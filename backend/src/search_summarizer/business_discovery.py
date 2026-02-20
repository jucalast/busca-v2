"""
Business Discovery — Searches for the ACTUAL business online before scoring.

Uses profile data collected during chat (name, channels, competitors, location)
to run targeted searches and build a real picture of the business's digital presence.

This data feeds into the scorer so tasks are SPECIFIC to what was actually found,
not generic advice.

Architecture:
1. Extract search hints from chat profile (Instagram handle, business name, etc.)
2. Run 4-6 targeted searches via DuckDuckGo
3. Scrape top results for concrete data
4. Use LLM to extract structured findings (followers, bio, reviews, competitor details)
5. Return discovery_data dict that feeds into all scorer dimensions
"""

import json
import os
import re
import sys
import time
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# Import search tools from cli.py
from cli import search_duckduckgo, scrape_page, call_groq


def _extract_search_hints(profile: dict) -> dict:
    """Extract actionable search hints from the chat-collected profile.
    Uses what the user already told us to make searches ultra-targeted."""
    perfil = profile.get("perfil", profile)
    # Also check _chat_context for fields that may not have been promoted into perfil
    chat_ctx = profile.get("_chat_context", {})
    
    def _get(*keys):
        """Return first non-empty value from perfil or chat_ctx for any of the given keys."""
        for k in keys:
            v = perfil.get(k, "")
            if v and str(v).strip() and str(v).strip() not in ("?", "null", "None"):
                return str(v).strip()
        for k in keys:
            v = chat_ctx.get(k, "")
            if v and str(v).strip() and str(v).strip() not in ("?", "null", "None"):
                return str(v).strip()
        return ""
    
    nome = _get("nome", "nome_negocio")
    segmento = _get("segmento")
    localizacao = _get("localizacao")
    canais_raw_val = perfil.get("canais_venda", "") or chat_ctx.get("canais_venda", "")
    if isinstance(canais_raw_val, list):
        canais_raw = ", ".join(str(c) for c in canais_raw_val).lower()
    else:
        canais_raw = str(canais_raw_val).lower()
    concorrentes_raw = _get("concorrentes")
    diferencial = _get("diferencial")
    tipo_produto = _get("tipo_produto")
    modelo = _get("modelo", "modelo_negocio")
    dificuldades = _get("dificuldades")
    cliente_ideal = _get("cliente_ideal")
    margem_lucro = _get("margem_lucro")
    ticket_medio = _get("ticket_medio", "ticket_medio_estimado")
    faturamento = _get("faturamento_mensal", "faturamento_faixa")
    capital = _get("capital_disponivel")
    maior_objecao = _get("maior_objecao")
    origem_clientes = _get("origem_clientes")

    # ── Digital presence fields (from chat or inferred) ──
    instagram_handle_raw = _get("instagram_handle")
    linkedin_url = _get("linkedin_url")
    site_url = _get("site_url")
    email_contato = _get("email_contato")
    whatsapp_numero = _get("whatsapp_numero")
    google_maps_url = _get("google_maps_url")

    # Normalize site URL
    if site_url and not site_url.startswith("http"):
        site_url = "https://" + site_url

    # If site_url is actually a LinkedIn URL, move it to linkedin_url and clear site_url
    if site_url and "linkedin.com" in site_url.lower():
        if not linkedin_url:
            linkedin_url = site_url
        site_url = ""

    # Detect which channels user mentioned
    has_instagram = "instagram" in canais_raw or bool(instagram_handle_raw)
    has_site = any(x in canais_raw for x in ["site", "loja virtual", "ecommerce"]) or bool(site_url)
    has_whatsapp = "whatsapp" in canais_raw or "zap" in canais_raw or bool(whatsapp_numero)
    has_ifood = "ifood" in canais_raw
    has_google = "google" in canais_raw or bool(google_maps_url)
    has_facebook = "facebook" in canais_raw
    has_linkedin = "linkedin" in canais_raw or bool(linkedin_url)

    # Normalize instagram handle
    instagram_handle = None
    if instagram_handle_raw:
        instagram_handle = instagram_handle_raw.lstrip("@")
    else:
        all_text = " ".join(str(v) for v in perfil.values())
        handle_match = re.search(r"@([a-zA-Z0-9_.]+)", all_text)
        if handle_match:
            instagram_handle = handle_match.group(1)

    # Extract competitor names
    competitor_names = []
    if concorrentes_raw and concorrentes_raw.lower() not in ("?", "não sei", "nenhum", "não", "nao sei"):
        competitor_names = [
            c.strip() for c in re.split(r"[,;]|\s+e\s+", concorrentes_raw)
            if c.strip() and len(c.strip()) > 2
        ]

    return {
        "nome": nome,
        "segmento": segmento,
        "localizacao": localizacao,
        "tipo_produto": tipo_produto,
        "modelo": modelo,
        "dificuldades": dificuldades,
        "diferencial": diferencial,
        "cliente_ideal": cliente_ideal,
        "margem_lucro": margem_lucro,
        "ticket_medio": ticket_medio,
        "faturamento": faturamento,
        "capital": capital,
        "maior_objecao": maior_objecao,
        "origem_clientes": origem_clientes,
        "has_instagram": has_instagram,
        "has_site": has_site,
        "has_whatsapp": has_whatsapp,
        "has_ifood": has_ifood,
        "has_google": has_google,
        "has_facebook": has_facebook,
        "has_linkedin": has_linkedin,
        "instagram_handle": instagram_handle,
        "linkedin_url": linkedin_url,
        "site_url": site_url,
        "email_contato": email_contato,
        "whatsapp_numero": whatsapp_numero,
        "google_maps_url": google_maps_url,
        "competitor_names": competitor_names,
    }


def _build_discovery_queries(hints: dict) -> list:
    """Build targeted search queries based on what we know from the chat.
    Each query has a purpose and expected data to extract."""

    nome = hints["nome"]
    segmento = hints["segmento"]
    loc = hints["localizacao"]
    tipo = hints["tipo_produto"] or segmento
    is_b2b = hints.get("modelo", "").upper() == "B2B"
    queries = []

    # 1. Find the business online — always do this
    if nome and nome != "?":
        queries.append({
            "id": "presenca_real",
            "query": f'"{nome}" {segmento} {loc}',
            "purpose": "Encontrar presença real do negócio na internet",
            "extract": ["site", "redes_sociais", "avaliacoes", "mencoes"],
        })

    # 2. Instagram — direct handle search if known, otherwise name search
    if hints["has_instagram"]:
        if hints["instagram_handle"]:
            ig_query = f'site:instagram.com "{hints["instagram_handle"]}"'
        elif nome:
            ig_query = f'site:instagram.com "{nome}" {segmento}'
        else:
            ig_query = f'site:instagram.com {segmento} {loc}'
        queries.append({
            "id": "instagram_real",
            "query": ig_query,
            "purpose": "Analisar perfil real do Instagram: bio, seguidores, tipo de conteúdo, frequência",
            "extract": ["handle", "bio", "seguidores", "tipo_conteudo", "frequencia_posts", "engajamento"],
        })

    # 3. Site — scrape directly if URL known, otherwise search for it
    if hints["has_site"]:
        if hints.get("site_url"):
            queries.append({
                "id": "site_real",
                "query": hints["site_url"],
                "purpose": "Analisar site real do negócio: produtos, preços, SEO, UX, CTA",
                "extract": ["produtos_listados", "precos", "seo_title", "contato", "cta"],
                "direct_url": hints["site_url"],
            })
        else:
            queries.append({
                "id": "site_real",
                "query": f'"{nome}" site oficial {segmento} {loc}',
                "purpose": "Encontrar e analisar site do negócio",
                "extract": ["url_site", "produtos", "precos", "seo"],
            })

    # 4. LinkedIn — if B2B or LinkedIn URL known
    if hints["has_linkedin"] or is_b2b:
        if hints.get("linkedin_url"):
            li_q = f'site:linkedin.com "{hints["linkedin_url"]}"'
        else:
            li_q = f'site:linkedin.com/company "{nome}" {segmento}'
        queries.append({
            "id": "linkedin_real",
            "query": li_q,
            "purpose": "Analisar presença no LinkedIn: seguidores, posts, posicionamento B2B",
            "extract": ["seguidores_linkedin", "descricao_empresa", "posts_recentes", "funcionarios"],
        })

    # 5. Google Maps / Reviews
    if loc and nome and nome != "?":
        maps_q = hints.get("google_maps_url") or f'"{nome}" {loc} avaliações google maps'
        queries.append({
            "id": "google_reviews",
            "query": maps_q,
            "purpose": "Encontrar avaliações reais e nota no Google Maps",
            "extract": ["nota_google", "num_avaliacoes", "comentarios_comuns", "pontos_fortes", "reclamacoes"],
        })

    # 6. WhatsApp Business presence check
    if hints.get("has_whatsapp"):
        queries.append({
            "id": "whatsapp_business",
            "query": f'"{nome}" whatsapp business catálogo atendimento {segmento}',
            "purpose": "Verificar uso do WhatsApp Business: catálogo, atendimento, automação",
            "extract": ["tem_catalogo", "usa_whatsapp_business", "tempo_resposta", "automacao"],
        })

    # 7. Competitor deep-dive
    if hints["competitor_names"]:
        for comp in hints["competitor_names"][:2]:
            if is_b2b:
                q = f'"{comp}" {segmento} site portfólio produtos preço'
            else:
                q = f'"{comp}" {segmento} {loc} instagram preço avaliações'
            queries.append({
                "id": f"concorrente_{comp.lower().replace(' ', '_')[:20]}",
                "query": q,
                "purpose": f"Analisar concorrente real: {comp} — preços, canais, diferenciais",
                "extract": ["site_concorrente", "preco_concorrente", "diferencial_concorrente", "canais_digitais", "avaliacoes"],
            })
    else:
        if is_b2b:
            q = f'{segmento} {loc} principais empresas distribuidores fornecedores site'
        else:
            q = f'{segmento} {loc} melhores instagram preço avaliações'
        queries.append({
            "id": "concorrentes_reais",
            "query": q,
            "purpose": "Descobrir concorrentes reais na região com dados de preço e canais",
            "extract": ["nomes_concorrentes", "precos", "diferenciais", "presenca_digital"],
        })

    # 8. Market / pricing opportunity — based on dificuldades
    dif = hints["dificuldades"].lower() if hints["dificuldades"] else ""
    if any(x in dif for x in ["cliente", "venda", "vender", "atrair", "conseguir"]):
        queries.append({
            "id": "aquisicao_clientes",
            "query": f'{tipo} {loc} como conseguir mais clientes canais marketing 2025',
            "purpose": "Estratégias reais de aquisição para o segmento e região",
            "extract": ["canais_efetivos", "custo_aquisicao", "estrategias_validadas"],
        })
    elif any(x in dif for x in ["preço", "margem", "lucro", "faturamento", "receita"]):
        queries.append({
            "id": "precificacao_mercado",
            "query": f'{tipo} {loc} preço médio tabela quanto cobrar 2025',
            "purpose": "Preços reais praticados no mercado local",
            "extract": ["faixa_preco", "preco_medio", "estrategia_preco"],
        })
    else:
        if is_b2b:
            queries.append({
                "id": "oportunidades_b2b",
                "query": f'{segmento} {loc} mercado B2B indicadores associações feiras 2025',
                "purpose": "Dados de mercado, associações e eventos do setor B2B",
                "extract": ["tamanho_mercado", "principais_players", "eventos_setor", "tendencias"],
            })
        else:
            queries.append({
                "id": "oportunidades",
                "query": f'{tipo} {loc} tendências oportunidades crescimento 2025',
                "purpose": "Tendências e oportunidades no segmento local",
                "extract": ["tendencias", "oportunidades", "riscos"],
            })

    return queries


def _run_discovery_search(query_spec: dict, region: str = "br-pt") -> dict:
    """Execute a single discovery search and return raw results.
    If direct_url is set, scrapes that URL directly instead of searching."""
    query = query_spec["query"]
    purpose = query_spec["purpose"]
    direct_url = query_spec.get("direct_url")

    print(f"  🔎 Discovery: {query}", file=sys.stderr)

    # Direct URL scrape (e.g. known site URL)
    if direct_url:
        content = scrape_page(direct_url, timeout=5)
        if content:
            return {
                "id": query_spec["id"],
                "purpose": purpose,
                "found": True,
                "raw_text": content[:5000],
                "sources": [direct_url],
                "extract_fields": query_spec.get("extract", []),
            }
        # Fall through to search if scrape failed
        print(f"    ⚠️ Scrape direto falhou, tentando busca: {direct_url}", file=sys.stderr)

    results = search_duckduckgo(query, max_results=5, region=region)

    if not results:
        print(f"    ⚠️ Nenhum resultado para: {query}", file=sys.stderr)
        return {
            "id": query_spec["id"],
            "purpose": purpose,
            "found": False,
            "raw_text": "",
            "sources": [],
        }

    aggregated_text = ""
    sources = []

    for i, result in enumerate(results):
        url = result.get("href", "")
        sources.append(url)
        snippet = result.get("body", "")
        title = result.get("title", "")
        aggregated_text += f"[{title}] ({url}): {snippet}\n"

        # Scrape top 2 results for more data
        if i < 2:
            content = scrape_page(url, timeout=3)
            if content:
                aggregated_text += f"Conteúdo: {content[:2000]}\n"

    return {
        "id": query_spec["id"],
        "purpose": purpose,
        "found": True,
        "raw_text": aggregated_text[:5000],
        "sources": sources,
        "extract_fields": query_spec.get("extract", []),
    }


def _synthesize_discovery(raw_results: list, hints: dict, api_key: str) -> dict:
    """Use LLM to extract structured insights from raw discovery data.
    Produces a clean discovery_data dict that feeds into the scorer."""

    # Truncate each result individually (800 chars each) so total stays under ~7K
    PER_RESULT_LIMIT = 800
    raw_block = ""
    for r in raw_results:
        if r.get("found") and r.get("raw_text"):
            raw_block += f"\n[{r['id']}] {r['purpose']}:\n"
            raw_block += r["raw_text"][:PER_RESULT_LIMIT] + "\n"

    if not raw_block.strip():
        print("  ⚠️ Nenhum dado de discovery encontrado", file=sys.stderr)
        return {"found": False, "insights": {}}

    nome = hints["nome"] or "o negócio"
    segmento = hints["segmento"] or "?"
    loc = hints["localizacao"] or "?"

    canais_conhecidos = []
    if hints.get('has_instagram'): canais_conhecidos.append(f"Instagram (@{hints.get('instagram_handle') or nome})")
    if hints.get('has_site'): canais_conhecidos.append(f"Site ({hints.get('site_url') or '?'})")
    if hints.get('has_whatsapp'): canais_conhecidos.append(f"WhatsApp ({hints.get('whatsapp_numero') or '?'})")
    if hints.get('has_ifood'): canais_conhecidos.append('iFood')
    if hints.get('has_facebook'): canais_conhecidos.append('Facebook')
    if hints.get('has_linkedin'): canais_conhecidos.append(f"LinkedIn ({hints.get('linkedin_url') or '?'})")
    if hints.get('email_contato'): canais_conhecidos.append(f"E-mail ({hints['email_contato']})")
    if hints.get('google_maps_url'): canais_conhecidos.append(f"Google Maps")

    # Compact prompt — smaller schema to keep output tokens low
    prompt = f"""Analise dados reais coletados da internet sobre "{nome}" ({segmento}, {loc}) e retorne JSON compacto.

NEGÓCIO: {nome} | {segmento} | {loc} | Canais: {', '.join(canais_conhecidos) or '?'} | Concorrentes: {', '.join(hints.get('competitor_names', [])) or 'nenhum'} | Dificuldade: {hints.get('dificuldades', '?')}

DADOS COLETADOS (extraia apenas o que está aqui, null se não encontrado):
{raw_block[:6000]}

Retorne SOMENTE este JSON (sem texto extra, sem markdown):
{{
  "presenca_digital": {{
    "instagram": {{"encontrado": true, "handle": "...", "seguidores": null, "observacoes": "1 frase"}},
    "site": {{"encontrado": true, "url": "...", "observacoes": "1 frase"}},
    "linkedin": {{"encontrado": true, "seguidores": null, "observacoes": "1 frase"}},
    "whatsapp": {{"encontrado": true, "observacoes": "1 frase"}},
    "google_maps": {{"encontrado": true, "nota": null, "num_avaliacoes": null, "observacoes": "1 frase"}},
    "email": {{"encontrado": true, "endereco": null}}
  }},
  "concorrentes_encontrados": [
    {{"nome": "...", "site": null, "diferencial": "1 frase", "ponto_fraco": "1 frase"}}
  ],
  "dados_mercado_local": {{
    "tendencias": ["1 tendência real"],
    "oportunidades": ["1 oportunidade real"]
  }},
  "problemas_detectados": ["1 problema real encontrado nos dados"],
  "resumo_executivo": "2 frases sobre situação digital real vs concorrentes"
}}"""

    client = Groq(api_key=api_key)
    # Use a model with higher output limit; llama-3.3-70b handles complex JSON better
    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    last_error = None

    for model in models:
        try:
            completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model,
                temperature=0.1,
                max_tokens=1500,
                response_format={"type": "json_object"},
            )
            result = json.loads(completion.choices[0].message.content)
            result["found"] = True

            all_sources = []
            for r in raw_results:
                all_sources.extend(r.get("sources", []))
            result["fontes_discovery"] = list(dict.fromkeys(all_sources))

            print(f"  ✅ Discovery sintetizado com {model}", file=sys.stderr)
            return result
        except Exception as e:
            last_error = e
            print(f"  ⚠️ Erro com {model}: {str(e)[:120]}", file=sys.stderr)
            continue

    print(f"  ❌ Erro ao sintetizar discovery: {last_error}", file=sys.stderr)
    return {"found": False, "error": str(last_error)[:200]}


def discover_business(profile: dict, region: str = "br-pt", emit_thought=None) -> dict:
    """
    Main entry point. Searches for the ACTUAL business online using chat data.
    
    Args:
        profile: Full profile dict from chat (contains perfil, restricoes, etc.)
        region: Search region
        emit_thought: Optional callable(str) to stream real-time thoughts to frontend
    
    Returns:
        discovery_data dict with structured findings about the real business
    """
    def _t(msg: str):
        if emit_thought:
            emit_thought(msg)

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"found": False, "error": "No API key"}
    
    print("\n🔍 === BUSINESS DISCOVERY ===", file=sys.stderr)

    # Step 1: Extract what we know from the chat
    hints = _extract_search_hints(profile)
    nome = hints['nome'] or 'negócio'
    print(f"  📋 Hints extraídos do chat:", file=sys.stderr)
    print(f"     Nome: {hints['nome']}", file=sys.stderr)
    print(f"     Instagram: {'SIM' if hints['has_instagram'] else 'NÃO'} (handle: @{hints['instagram_handle'] or '?'})", file=sys.stderr)
    print(f"     Site: {'SIM' if hints['has_site'] else 'NÃO'} ({hints.get('site_url') or '?'})", file=sys.stderr)
    print(f"     LinkedIn: {'SIM' if hints['has_linkedin'] else 'NÃO'} ({hints.get('linkedin_url') or '?'})", file=sys.stderr)
    print(f"     WhatsApp: {'SIM' if hints['has_whatsapp'] else 'NÃO'} ({hints.get('whatsapp_numero') or '?'})", file=sys.stderr)
    print(f"     Google Maps: {'SIM' if hints['has_google'] else 'NÃO'} ({hints.get('google_maps_url') or '?'})", file=sys.stderr)
    print(f"     E-mail: {hints.get('email_contato') or '?'}", file=sys.stderr)
    print(f"     Concorrentes: {hints['competitor_names'] or 'nenhum mencionado'}", file=sys.stderr)
    print(f"     Dificuldade: {hints['dificuldades'] or '?'}", file=sys.stderr)
    
    # Step 2: Build targeted queries
    queries = _build_discovery_queries(hints)
    print(f"  🔎 {len(queries)} buscas de discovery planejadas", file=sys.stderr)

    # Map query IDs to human-readable labels for thoughts
    _purpose_labels = {
        "presenca_real":      f"Buscando '{nome}' na internet...",
        "instagram_real":     f"Verificando Instagram de '{nome}'...",
        "site_real":          f"Analisando site de '{nome}'...",
        "linkedin_real":      f"Verificando LinkedIn de '{nome}'...",
        "google_reviews":     f"Buscando avaliações no Google Maps...",
        "whatsapp_business":  f"Verificando WhatsApp Business...",
        "aquisicao_clientes": f"Pesquisando estratégias de aquisição de clientes...",
        "precificacao_mercado": f"Pesquisando preços praticados no mercado...",
        "oportunidades_b2b":  f"Pesquisando oportunidades B2B do setor...",
        "oportunidades":      f"Pesquisando tendências e oportunidades do segmento...",
    }

    # Step 3: Execute searches (sequential to avoid rate limits)
    raw_results = []
    for i, q in enumerate(queries):
        qid = q.get("id", "")
        # Emit thought: concorrente searches use the competitor name
        if qid.startswith("concorrente_"):
            comp_name = q.get("purpose", "").replace("Analisar concorrente real: ", "").split(" —")[0]
            _t(f"Pesquisando concorrente: {comp_name}...")
        else:
            label = _purpose_labels.get(qid, q.get("purpose", f"Buscando dados ({qid})..."))
            _t(label)

        result = _run_discovery_search(q, region)
        raw_results.append(result)
        
        found_count = sum(1 for r in raw_results if r.get("found"))
        print(f"    [{i+1}/{len(queries)}] {q['id']}: {'✅' if result.get('found') else '⚠️'}", file=sys.stderr)
        
        # Small delay between searches
        if i < len(queries) - 1:
            time.sleep(0.5)
    
    found_total = sum(1 for r in raw_results if r.get("found"))
    print(f"  📊 {found_total}/{len(queries)} buscas com resultados", file=sys.stderr)
    
    if found_total == 0:
        print("  ⚠️ Nenhum dado de discovery encontrado", file=sys.stderr)
        return {
            "found": False,
            "hints": hints,
            "raw_results": [],
            "insights": {},
        }
    
    _t(f"Sintetizando dados encontrados sobre '{nome}'...")
    # Step 4: Use LLM to synthesize structured insights
    print("  🧠 Sintetizando insights...", file=sys.stderr)
    discovery_data = _synthesize_discovery(raw_results, hints, api_key)
    
    # Add metadata
    discovery_data["hints"] = hints
    discovery_data["queries_executadas"] = [q["id"] for q in queries]
    discovery_data["total_fontes"] = len(discovery_data.get("fontes_discovery", []))
    
    print(f"  ✅ Discovery completo: {discovery_data.get('found', False)}", file=sys.stderr)
    
    return discovery_data


def format_discovery_for_scorer(discovery_data: dict, dim_key: str = None) -> str:
    """Format discovery data as readable text to inject into scorer prompts.
    If dim_key is provided, returns ONLY data relevant to that dimension
    to avoid repetitive analysis across dimensions."""
    if not discovery_data.get("found"):
        return ""

    # ── Dimension-specific filtering ──
    # Each dimension only gets the discovery sections that matter to it
    DIM_SECTIONS = {
        "presenca_digital": ["instagram", "site", "linkedin", "whatsapp", "google_maps", "email", "outras", "problemas"],
        "competitividade": ["concorrentes", "mercado", "problemas"],
        "diversificacao_canais": ["site", "whatsapp", "outras", "mercado"],
        "precificacao": ["concorrentes", "mercado"],
        "potencial_mercado": ["mercado", "concorrentes"],
        "maturidade_operacional": ["whatsapp", "site", "google_maps"],
    }

    # Determine which sections to include
    if dim_key and dim_key in DIM_SECTIONS:
        allowed_sections = set(DIM_SECTIONS[dim_key])
    else:
        # No filter — include everything (backward compat)
        allowed_sections = {"instagram", "site", "linkedin", "whatsapp", "google_maps",
                            "email", "outras", "concorrentes", "mercado", "problemas"}

    lines = [f"\n🔍 DADOS REAIS ENCONTRADOS (foco: {dim_key or 'geral'}):"]
    pd = discovery_data.get("presenca_digital", {})

    # ── Instagram ──
    if "instagram" in allowed_sections:
        ig = pd.get("instagram", {})
        if ig.get("encontrado"):
            lines.append(f"\n📱 INSTAGRAM:")
            if ig.get("handle"): lines.append(f"  Handle: {ig['handle']}")
            if ig.get("bio"): lines.append(f"  Bio: {ig['bio']}")
            if ig.get("seguidores"): lines.append(f"  Seguidores: {ig['seguidores']}")
            if ig.get("frequencia_posts"): lines.append(f"  Frequência: {ig['frequencia_posts']}")
            if ig.get("tipo_conteudo"): lines.append(f"  Tipo de conteúdo: {ig['tipo_conteudo']}")
            if ig.get("engajamento_estimado"): lines.append(f"  Engajamento: {ig['engajamento_estimado']}")
            if ig.get("observacoes"): lines.append(f"  Obs: {ig['observacoes']}")
            if ig.get("fonte"): lines.append(f"  Fonte: {ig['fonte']}")

    # ── Site ──
    if "site" in allowed_sections:
        site = pd.get("site", {})
        if site.get("encontrado"):
            lines.append(f"\n🌐 SITE:")
            if site.get("url"): lines.append(f"  URL: {site['url']}")
            prods = site.get("produtos_listados") or []
            if prods: lines.append(f"  Produtos listados: {', '.join(prods[:5])}")
            if site.get("tem_preco_visivel") is not None:
                lines.append(f"  Preços visíveis: {'Sim' if site['tem_preco_visivel'] else 'Não'}")
            if site.get("tem_cta") is not None:
                lines.append(f"  CTA presente: {'Sim' if site['tem_cta'] else 'Não'}")
            if site.get("qualidade_seo"): lines.append(f"  SEO: {site['qualidade_seo']}")
            if site.get("observacoes"): lines.append(f"  Obs: {site['observacoes']}")
            if site.get("fonte"): lines.append(f"  Fonte: {site['fonte']}")

    # ── LinkedIn ──
    if "linkedin" in allowed_sections:
        li = pd.get("linkedin", {})
        if li.get("encontrado"):
            lines.append(f"\n💼 LINKEDIN:")
            if li.get("url"): lines.append(f"  URL: {li['url']}")
            if li.get("seguidores"): lines.append(f"  Seguidores: {li['seguidores']}")
            if li.get("descricao"): lines.append(f"  Descrição: {li['descricao']}")
            if li.get("posts_recentes") is not None:
                lines.append(f"  Posts recentes: {'Sim' if li['posts_recentes'] else 'Não'}")
            if li.get("observacoes"): lines.append(f"  Obs: {li['observacoes']}")

    # ── WhatsApp ──
    if "whatsapp" in allowed_sections:
        wpp = pd.get("whatsapp", {})
        if wpp.get("encontrado"):
            lines.append(f"\n💬 WHATSAPP BUSINESS:")
            if wpp.get("numero"): lines.append(f"  Número: {wpp['numero']}")
            if wpp.get("tem_catalogo") is not None:
                lines.append(f"  Catálogo: {'Sim' if wpp['tem_catalogo'] else 'Não'}")
            if wpp.get("usa_whatsapp_business") is not None:
                lines.append(f"  WhatsApp Business: {'Sim' if wpp['usa_whatsapp_business'] else 'Não'}")
            if wpp.get("observacoes"): lines.append(f"  Obs: {wpp['observacoes']}")

    # ── Google Maps ──
    if "google_maps" in allowed_sections:
        gm = pd.get("google_maps", {})
        if gm.get("encontrado"):
            lines.append(f"\n⭐ GOOGLE MAPS:")
            if gm.get("nota"): lines.append(f"  Nota: {gm['nota']}/5")
            if gm.get("num_avaliacoes"): lines.append(f"  Avaliações: {gm['num_avaliacoes']}")
            for c in (gm.get("principais_comentarios") or [])[:3]:
                lines.append(f"  💬 \"{c}\"")
            if gm.get("fonte"): lines.append(f"  Fonte: {gm['fonte']}")

    # ── E-mail ──
    if "email" in allowed_sections:
        email = pd.get("email", {})
        if email.get("encontrado"):
            lines.append(f"\n📧 E-MAIL:")
            if email.get("endereco"): lines.append(f"  Endereço: {email['endereco']}")

    # ── Outras plataformas ──
    if "outras" in allowed_sections:
        outras = pd.get("outras_plataformas") or []
        if outras:
            lines.append(f"\n🛒 OUTRAS PLATAFORMAS: {', '.join(outras)}")

    # ── Competitors ──
    if "concorrentes" in allowed_sections:
        competitors = discovery_data.get("concorrentes_encontrados", [])
        if competitors:
            lines.append(f"\n🎯 CONCORRENTES REAIS ENCONTRADOS:")
            for c in competitors[:5]:
                if isinstance(c, dict):
                    comp_line = f"  • {c.get('nome', '?')}"
                    if c.get("instagram"): comp_line += f" (IG: {c['instagram']})"
                    if c.get("site"): comp_line += f" | Site: {c['site']}"
                    if c.get("preco_referencia"): comp_line += f" | Preço: {c['preco_referencia']}"
                    if c.get("diferencial"): comp_line += f" | Diferencial: {c['diferencial']}"
                    if c.get("ponto_fraco"): comp_line += f" | Fraqueza: {c['ponto_fraco']}"
                    canais_c = c.get("canais_digitais") or []
                    if canais_c: comp_line += f" | Canais: {', '.join(canais_c)}"
                    if c.get("fonte"): comp_line += f" | Fonte: {c['fonte']}"
                    lines.append(comp_line)
                elif isinstance(c, str):
                    lines.append(f"  • {c}")

    # ── Market data ──
    if "mercado" in allowed_sections:
        market = discovery_data.get("dados_mercado_local", {})
        if market:
            lines.append(f"\n📊 MERCADO LOCAL:")
            if market.get("preco_medio_regiao"):
                lines.append(f"  Preço médio: {market['preco_medio_regiao']}")
            for t in (market.get("tendencias") or [])[:3]:
                lines.append(f"  📈 {t}")
            for o in (market.get("oportunidades") or [])[:3]:
                lines.append(f"  💡 {o}")

    # ── Problems ──
    if "problemas" in allowed_sections:
        problems = discovery_data.get("problemas_detectados", [])
        if problems:
            lines.append(f"\n⚠️ PROBLEMAS DETECTADOS:")
            for p in problems[:5]:
                lines.append(f"  • {p}")

    # ── Summary (only for presenca_digital or when no filter) ──
    if not dim_key or dim_key == "presenca_digital":
        resumo = discovery_data.get("resumo_executivo", "")
        if resumo:
            lines.append(f"\n📝 RESUMO EXECUTIVO: {resumo}")

    return "\n".join(lines)
