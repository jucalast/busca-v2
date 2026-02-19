"""
Business Scorer — Per-dimension focused scoring for deep, specific analysis.

Each of the 6 dimensions is scored INDIVIDUALLY with focused context,
producing more specific and personalized results than one giant prompt.

Architecture:
- Uses llama-3.1-8b-instant exclusively (avoids rate limits, great with focused context)
- 6 sequential LLM calls with 1.5s delays (rate-limit safe)
- Each call gets only RELEVANT market data for that dimension
- Sources tracked per dimension and per action
"""

import json
import os
from business_discovery import format_discovery_for_scorer
import re
import sys
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ── Dimension definitions ──────────────────────────────────────────
DIMENSIONS = {
    "presenca_digital": {
        "label": "Presença Digital",
        "peso": 0.20,
        "foco": "presença online, redes sociais, site, Google Meu Negócio, SEO local, conteúdo, reputação",
        "market_keywords": ["marketing", "digital", "instagram", "facebook", "seo", "conteudo",
                            "presenca", "credibilidade", "otimizacao", "social", "marketing_organico",
                            "otimizacao_conversao", "presenca_online", "ugc", "engajamento",
                            "seguidores", "reputacao", "avaliacao"],
        # Explicit category IDs from profiler that map to this dimension
        "category_ids": ["marketing_organico", "otimizacao_conversao", "presenca_online",
                         "credibilidade", "marketing", "presenca_digital"],
    },
    "competitividade": {
        "label": "Competitividade e Concorrência",
        "peso": 0.20,
        "foco": "concorrentes diretos e indiretos, diferencial competitivo, posicionamento, preços dos concorrentes",
        "market_keywords": ["concorrente", "competit", "diferencial", "posicionamento",
                            "mapa", "marca", "benchmark", "comparativo"],
        "category_ids": ["concorrentes", "mapa_concorrentes", "competitividade",
                         "benchmark", "diferencial"],
    },
    "diversificacao_canais": {
        "label": "Canais de Venda",
        "peso": 0.15,
        "foco": "canais atuais, dependência de canal único, canais novos viáveis, marketplaces, delivery",
        "market_keywords": ["canal", "diversificacao", "marketplace", "ecommerce", "delivery",
                            "loja", "distribuicao", "vendas_solo", "como_vender",
                            "prospectar", "leads", "whatsapp"],
        "category_ids": ["vendas_solo", "como_vender", "canais", "diversificacao_canais",
                         "prospectar", "marketplace"],
    },
    "precificacao": {
        "label": "Precificação e Margem",
        "peso": 0.15,
        "foco": "estratégia de precificação, margem de lucro, preço vs concorrentes, percepção de valor",
        "market_keywords": ["preco", "precificacao", "margem", "custo", "ticket", "lucro",
                            "rentabilidade", "faturamento", "receita"],
        "category_ids": ["precificacao", "precos", "margem", "financeiro"],
    },
    "potencial_mercado": {
        "label": "Potencial de Mercado",
        "peso": 0.15,
        "foco": "tamanho do mercado, tendências, sazonalidade, nichos inexplorados, crescimento do setor",
        "market_keywords": ["mercado", "tendencia", "potencial", "crescimento", "oportunidade",
                            "panorama", "nicho", "demanda", "publico_alvo", "cliente_ideal",
                            "segmento", "tamanho"],
        "category_ids": ["mercado", "panorama", "publico_alvo", "potencial_mercado",
                         "tendencias", "oportunidades"],
    },
    "maturidade_operacional": {
        "label": "Maturidade Operacional",
        "peso": 0.15,
        "foco": "processos internos, eficiência, logística, gargalos, escalabilidade, fornecedores",
        "market_keywords": ["operacao", "logistica", "processo", "fornecedor", "estoque",
                            "entrega", "gestao", "producao", "eficiencia", "escala",
                            "automacao", "ferramentas"],
        "category_ids": ["operacional", "logistica", "gestao", "processos",
                         "fornecedores", "maturidade_operacional"],
    },
}


def _call_llm(api_key: str, prompt: str, temperature: float = 0.2, max_retries: int = 3) -> dict:
    """Focused LLM call using 8b-instant (fast, consistent, avoids rate limits)."""
    client = Groq(api_key=api_key)
    for attempt in range(max_retries):
        try:
            completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=temperature,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
            return json.loads(completion.choices[0].message.content)
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait = (attempt + 1) * 3
                print(f"  ⏳ Rate limit. Aguardando {wait}s...", file=sys.stderr)
                time.sleep(wait)
                continue
            raise


def _filter_market(dim_key: str, market_data: dict) -> str:
    """Extract only relevant market data for a specific dimension.
    Uses explicit category ID mapping + keyword fallback.
    Does NOT fall back to all data — returns empty string if no match."""
    categories = market_data.get("categories", [])
    dim_cfg = DIMENSIONS[dim_key]
    keywords = dim_cfg["market_keywords"]
    category_ids = dim_cfg.get("category_ids", [])

    relevant = []
    
    # First pass: match by explicit category IDs (highest priority)
    for cat in categories:
        cat_id = cat.get("id", "").lower()
        if cat_id in category_ids:
            relevant.append(cat)
    
    # Second pass: match by keywords in name/id (if not enough)
    if len(relevant) < 2:
        for cat in categories:
            if cat in relevant:
                continue
            cat_text = f"{cat.get('id', '')} {cat.get('nome', '')}".lower()
            if any(kw in cat_text for kw in keywords):
                relevant.append(cat)

    # NO fallback to all data — if nothing matches, LLM gets "Nenhum dado"
    if not relevant:
        print(f"    ⚠️ No market data matched for {dim_key}", file=sys.stderr)
        return ""

    text = ""
    for cat in relevant[:3]:
        resumo = cat.get("resumo", {})
        fontes = cat.get("fontes", [])
        text += f"\n── {cat.get('nome', '')} ──\n"
        if isinstance(resumo, dict):
            if resumo.get("visao_geral"):
                text += f"{resumo['visao_geral']}\n"
            for p in (resumo.get("pontos_chave") or [])[:4]:
                pt = p if isinstance(p, str) else str(p)
                text += f"• {pt}\n"
            for r in (resumo.get("recomendacoes") or [])[:3]:
                rt = r if isinstance(r, str) else str(r)
                text += f"→ {rt}\n"
            dados = resumo.get("dados_relevantes", {})
            if isinstance(dados, dict):
                for k, v in list(dados.items())[:4]:
                    text += f"  {k}: {v}\n"
        if fontes:
            text += f"Fontes: {', '.join(str(f) for f in fontes[:3])}\n"

    return text[:4000]


def _get_all_sources_for_dimension(dim_key: str, market_data: dict) -> list:
    """Collect all source URLs from market categories relevant to this dimension."""
    categories = market_data.get("categories", [])
    dim_cfg = DIMENSIONS[dim_key]
    keywords = dim_cfg["market_keywords"]
    category_ids = dim_cfg.get("category_ids", [])
    sources = []

    for cat in categories:
        cat_id = cat.get("id", "").lower()
        cat_text = f"{cat_id} {cat.get('nome', '')}".lower()
        if cat_id in category_ids or any(kw in cat_text for kw in keywords):
            sources.extend(cat.get("fontes", []))

    # NO fallback to all sources
    return list(dict.fromkeys(sources))  # Deduplicate preserving order


def extract_restrictions(profile: dict) -> dict:
    """Extract business restrictions from profile for context-aware scoring."""
    restricoes = profile.get("restricoes_criticas", {})
    perfil = profile.get("perfil", {})
    num_func = str(perfil.get("num_funcionarios", "")).lower()

    # canais_existentes: prefer restricoes, fall back to perfil.canais_venda (list or string)
    canais_existentes = restricoes.get("canais_existentes", [])
    if not canais_existentes:
        cv = perfil.get("canais_venda", "")
        if isinstance(cv, list):
            canais_existentes = cv
        elif cv:
            canais_existentes = [c.strip() for c in re.split(r"[,;]", cv) if c.strip()]

    # capital_disponivel: prefer restricoes, fall back to perfil
    capital = restricoes.get("capital_disponivel") or perfil.get("capital_disponivel", "medio")

    return {
        "modelo_operacional": restricoes.get("modelo_operacional", perfil.get("modelo_operacional", "")),
        "capital_disponivel": capital,
        "equipe_solo": restricoes.get("equipe_solo", num_func in ["1", "solo", "só eu", "sozinho", "eu e meu filho"]),
        "canais_existentes": canais_existentes,
        "dificuldades": perfil.get("dificuldades", ""),
    }


def _compute_objective_score(dim_key: str, profile: dict) -> int:
    """Compute a deterministic partial score based on concrete profile data.
    Returns 0-100 based on what data the business has for this dimension."""
    perfil = profile.get("perfil", profile)
    score = 0
    
    def has(field, *aliases):
        """Check field or any alias for a non-empty, non-placeholder value."""
        for f in (field,) + aliases:
            v = perfil.get(f, "")
            if v and str(v).strip() and str(v).strip() not in ("?", "null", "None", "não informado", ""):
                return True
        return False
    
    # canais_venda may be a list or a comma-separated string
    canais_raw_val = perfil.get("canais_venda", "")
    if isinstance(canais_raw_val, list):
        canais_raw = ", ".join(str(c) for c in canais_raw_val).lower()
    else:
        canais_raw = str(canais_raw_val).lower()
    
    if dim_key == "presenca_digital":
        if "instagram" in canais_raw: score += 20
        if "site" in canais_raw or "loja virtual" in canais_raw: score += 15
        if "google" in canais_raw: score += 10
        if canais_raw.count(",") >= 1 or "|" in canais_raw: score += 10  # Multiple channels
        if has("origem_clientes"): score += 10
        if not any(x in canais_raw for x in ["instagram", "site", "facebook"]): score += 5  # Only offline = low
        # Cap: pure offline business shouldn't get too high
        
    elif dim_key == "competitividade":
        if has("concorrentes"): score += 20
        if has("diferencial"): score += 25
        if has("maior_objecao"): score += 10
        if has("segmento"): score += 10
        
    elif dim_key == "diversificacao_canais":
        n_canais = len([c for c in re.split(r"[,|;]", canais_raw) if c.strip()]) if canais_raw else 0
        if n_canais >= 3: score += 30
        elif n_canais >= 2: score += 20
        elif n_canais == 1: score += 10
        has_online = any(x in canais_raw for x in ["instagram", "site", "whatsapp", "marketplace", "ifood", "online", "ecommerce", "televendas"])
        has_offline = any(x in canais_raw for x in ["loja", "rua", "físic", "boca", "feira", "presença direta", "presenca direta"])
        if has_online: score += 15
        if has_offline: score += 10
        if has_online and has_offline: score += 10  # Diversified
        
    elif dim_key == "precificacao":
        if has("ticket_medio", "ticket_medio_estimado"): score += 20
        if has("margem_lucro"): score += 20
        if has("faturamento_mensal", "faturamento_faixa"): score += 15
        if has("capital_disponivel"): score += 10
        
    elif dim_key == "potencial_mercado":
        if has("localizacao"): score += 15
        if has("segmento"): score += 15
        if has("cliente_ideal", "publico_alvo"): score += 20
        if has("objetivos"): score += 10
        
    elif dim_key == "maturidade_operacional":
        if has("modelo_operacional"): score += 20
        if has("num_funcionarios"): score += 15
        if has("canais_venda"): score += 10
        if has("modelo", "modelo_negocio"): score += 10
        if has("tempo_entrega"): score += 10
        if has("principal_gargalo"): score += 5
    
    return min(score, 100)


def _score_dimension(dim_key: str, dim_cfg: dict, profile: dict,
                     market_text: str, dim_sources: list,
                     restricoes: dict, api_key: str,
                     previous_actions: list = None,
                     discovery_text: str = "") -> dict:
    """Score a single dimension with focused, specific analysis.
    Now also receives previous_actions and discovery_text for real business context."""
    perfil = profile.get("perfil", profile)

    # Build restriction notes for this dimension
    notes = []
    if restricoes.get("capital_disponivel") in ("zero", "baixo"):
        notes.append("Capital limitado — apenas opções GRATUITAS ou muito baratas (até R$50/mês).")
    if restricoes.get("equipe_solo"):
        notes.append("Trabalha sozinho/equipe mínima — tudo executável por 1 pessoa em poucas horas.")
    if restricoes.get("modelo_operacional") in ("sob_encomenda", "dropshipping"):
        notes.append(f"Opera {restricoes['modelo_operacional']} — NÃO penalize por falta de estoque.")
    canais = restricoes.get("canais_existentes", [])
    # Also check raw canais_venda from profile (may be list or string)
    _cv_raw = perfil.get("canais_venda", "")
    if isinstance(_cv_raw, list):
        canais_raw = ", ".join(str(c) for c in _cv_raw).lower()
    else:
        canais_raw = str(_cv_raw).lower()
    if (canais or canais_raw) and dim_key == "presenca_digital":
        canais_text = ", ".join(canais) if canais else canais_raw
        notes.append(f"JÁ usa: {canais_text}. Sugira OTIMIZAR o que já tem, não criar do zero.")

    restriction_text = "\n".join(f"⚠️ {n}" for n in notes) if notes else ""

    # Build compact profile summary — normalize aliases
    nome = perfil.get('nome', perfil.get('nome_negocio', '?'))
    segmento = perfil.get('segmento', '?')
    # Normalize canais_venda: may be list or string
    _canais_val = perfil.get('canais_venda', '')
    if isinstance(_canais_val, list):
        perfil = dict(perfil)  # shallow copy to avoid mutating original
        perfil['canais_venda'] = ', '.join(str(c) for c in _canais_val)
    
    # Cross-dimension dedup: tell LLM what actions were already generated
    dedup_block = ""
    if previous_actions:
        actions_text = "\n".join(f"- {a}" for a in previous_actions[:10])
        dedup_block = f"""

⛔ AÇÕES JÁ GERADAS EM OUTRAS DIMENSÕES (NÃO REPETIR):
{actions_text}
Não sugira ações iguais ou muito similares às listadas acima. Cada ação DEVE ser ÚNICA."""

    # B2B Specific Context
    b2b_context = ""
    modelo_val = perfil.get('modelo_negocio', perfil.get('modelo', '')).upper()
    seg_val = segmento.upper()
    if "B2B" in modelo_val or "INDUSTRIA" in seg_val or "DISTRIBUIDORA" in seg_val or "ATACADO" in seg_val:
        b2b_context = """
CONTEXTO B2B (BUSINESS TO BUSINESS):
Este negócio vende para OUTRAS EMPRESAS.
- IGNORE estratégias B2C (dancinhas, influencers de varejo, viralização, sorteios).
- FOQUE em: Vendas consultivas, representantes comerciais, LinkedIn, Google Ads fundo de funil, SEO técnico, participação em feiras, e-mail marketing frio, catálogos digitais, otimização logística de carga, crédito faturado.
- A "experiência do cliente" aqui é: prazo de entrega, nota fiscal correta, suporte técnico confiável."""

    # Build digital presence context block from profile fields
    digital_ctx_lines = []
    if perfil.get("instagram_handle"):
        digital_ctx_lines.append(f"- Instagram: {perfil['instagram_handle']}")
    if perfil.get("site_url"):
        digital_ctx_lines.append(f"- Site: {perfil['site_url']}")
    if perfil.get("linkedin_url"):
        digital_ctx_lines.append(f"- LinkedIn: {perfil['linkedin_url']}")
    if perfil.get("whatsapp_numero"):
        digital_ctx_lines.append(f"- WhatsApp: {perfil['whatsapp_numero']}")
    if perfil.get("email_contato"):
        digital_ctx_lines.append(f"- E-mail: {perfil['email_contato']}")
    if perfil.get("google_maps_url"):
        digital_ctx_lines.append(f"- Google Maps: {perfil['google_maps_url']}")
    digital_presence_block = ("\nCANAIS DIGITAIS DECLARADOS PELO USUÁRIO:\n" + "\n".join(digital_ctx_lines)) if digital_ctx_lines else ""

    prompt = f"""Analise SOMENTE "{dim_cfg['label']}" para o negócio abaixo. Seja ESPECÍFICO e CONCRETO.

NEGÓCIO: {nome} — {segmento}
- Modelo: {perfil.get('modelo_negocio', perfil.get('modelo', '?'))}
- Localização: {perfil.get('localizacao', '?')}
- Ticket médio: {perfil.get('ticket_medio', perfil.get('ticket_medio_estimado', '?'))}
- Faturamento: {perfil.get('faturamento_mensal', perfil.get('faturamento_faixa', '?'))}
- Equipe: {perfil.get('num_funcionarios', '?')}
- Canais atuais: {perfil.get('canais_venda', '?')}
- Dificuldade: {perfil.get('dificuldades', '?')}
- Diferencial: {perfil.get('diferencial', '?')}
- Concorrentes: {perfil.get('concorrentes', '?')}
- Operação: {perfil.get('modelo_operacional', '?')}
- Margem: {perfil.get('margem_lucro', '?')}
- Origem clientes: {perfil.get('origem_clientes', '?')}
- Objeção principal: {perfil.get('maior_objecao', '?')}
- Cliente ideal: {perfil.get('cliente_ideal', '?')}
- Capital disponível: {perfil.get('capital_disponivel', '?')}
- Tempo de mercado: {perfil.get('tempo_mercado', perfil.get('tempo_operacao', '?'))}
{digital_presence_block}
{restriction_text}
{b2b_context}

FOCO DA ANÁLISE: {dim_cfg['foco']}

{discovery_text if discovery_text.strip() else ""}

DADOS DE MERCADO ENCONTRADOS:
{market_text if market_text.strip() else "Nenhum dado disponível para esta dimensão."}
{dedup_block}

REGRAS OBRIGATÓRIAS:
1. Score 0-100. Se não há dados suficientes, use o perfil declarado + score = 50.
2. Justificativa: cite DADOS CONCRETOS (nomes reais, números, URLs, handles) encontrados.
3. Cada ação deve ser ULTRA-ESPECÍFICA para {nome} ({segmento}), NÃO genérica.
4. Cada ação DEVE ser sobre {dim_cfg['label']} — NÃO sobre outros temas.
5. PROIBIDO: "pesquise", "avalie", "considere", "analise opções" — dê a resposta pronta.
6. Ações devem ser executáveis ESTA SEMANA por {perfil.get('num_funcionarios', '1 pessoa')}.
7. Gere de 3 a 5 ações — cada uma DEVE referenciar um dado real encontrado acima.
8. Se o usuário declarou canais digitais (Instagram, site, etc.), as ações DEVEM ser sobre MELHORAR esses canais específicos, não criar novos do zero.
9. NÃO invente dados. Só cite dados que apareceram acima ou foram declarados pelo usuário.

EXEMPLOS BOM vs RUIM para {nome} ({segmento}):
- ❌ RUIM: "Otimizar o perfil com palavras-chave" (genérico)
- ✅ BOM: "No Instagram {perfil.get('instagram_handle', '@perfil')}, adicionar '{segmento} em {perfil.get('localizacao', 'sua cidade')}' na bio — pesquisa mostra que esse termo tem alta busca local"
- ❌ RUIM: "Crie um site" (usuário já tem site)
- ✅ BOM: "No site {perfil.get('site_url', 'do negócio')}, adicionar botão de WhatsApp fixo e CTA 'Solicitar orçamento' — concorrente X já faz isso e tem mais conversões"
- ❌ RUIM: "Aumentar credibilidade com depoimentos" (genérico)
- ✅ BOM: "Pedir para 3 clientes gravarem depoimento em vídeo de 15s e publicar nos Stories — concorrente {perfil.get('concorrentes', 'X')} faz isso e tem engajamento alto"

Retorne JSON:
{{
    "score": 0-100,
    "status": "critico / atencao / forte",
    "justificativa": "2-3 frases com dados CONCRETOS. Cite handles, URLs, números reais.",
    "acoes_imediatas": [
        {{
            "acao": "Ação ultra-específica para {nome}: o que fazer + como fazer + resultado esperado. DEVE citar dado real ou canal declarado.",
            "impacto": "alto / medio / baixo",
            "prazo": "1 semana / 2 semanas / 1 mês",
            "custo": "R$ 0 / até R$ 50 / até R$ 100",
            "fonte": "Qual fonte/dado/canal suporta esta ação"
        }}
    ],
    "fontes_utilizadas": ["URLs ou handles ou fontes usadas nesta análise"],
    "dado_chave": "O achado MAIS IMPORTANTE — 1 frase com dado concreto e específico"
}}"""

    try:
        result = _call_llm(api_key, prompt)
        # Ensure expected fields
        result.setdefault("score", 50)
        result.setdefault("status", "atencao")
        result.setdefault("justificativa", "")
        result.setdefault("acoes_imediatas", [])
        result.setdefault("dado_chave", "")
        
        # ── Combine LLM score with objective score (60/40 blend) ──
        llm_score = result["score"]
        obj_score = _compute_objective_score(dim_key, profile)
        blended = round(llm_score * 0.6 + obj_score * 0.4)
        result["score"] = blended
        result["_score_llm"] = llm_score
        result["_score_objetivo"] = obj_score
        print(f"    📐 Score blend: LLM={llm_score} × 0.6 + OBJ={obj_score} × 0.4 = {blended}", file=sys.stderr)
        
        # Recalculate status based on blended score
        if blended >= 70:
            result["status"] = "forte"
        elif blended >= 40:
            result["status"] = "atencao"
        else:
            result["status"] = "critico"
        
        # Merge source URLs from market data into fontes_utilizadas
        llm_fontes = result.get("fontes_utilizadas", [])
        result["fontes_utilizadas"] = list(dict.fromkeys(llm_fontes + dim_sources[:5]))
        result["peso"] = dim_cfg["peso"]
        return result
    except Exception as e:
        print(f"  ❌ Erro ao scorar {dim_key}: {e}", file=sys.stderr)
        obj_score = _compute_objective_score(dim_key, profile)
        return {
            "score": obj_score, "status": "atencao", "peso": dim_cfg["peso"],
            "justificativa": "Não foi possível analisar esta dimensão com os dados disponíveis.",
            "acoes_imediatas": [], "fontes_utilizadas": dim_sources[:5], "dado_chave": "",
            "_score_llm": 50, "_score_objetivo": obj_score,
        }


def _dedup_actions_cross_dimension(all_tasks: list) -> list:
    """Remove tasks that are too similar across dimensions.
    Uses word overlap to detect near-duplicates."""
    if len(all_tasks) <= 1:
        return all_tasks
    
    def normalize(text):
        return set(re.sub(r"[^a-záàâãéèêíìîóòôõúùûç\s]", "", text.lower()).split())
    
    deduped = []
    seen_word_sets = []
    
    for task in all_tasks:
        title_words = normalize(task.get("titulo", ""))
        if not title_words:
            deduped.append(task)
            continue
        
        is_duplicate = False
        for seen in seen_word_sets:
            # Jaccard similarity
            intersection = len(title_words & seen)
            union = len(title_words | seen)
            if union > 0 and intersection / union > 0.5:  # >50% word overlap = duplicate
                is_duplicate = True
                break
        
        if not is_duplicate:
            deduped.append(task)
            seen_word_sets.append(title_words)
    
    removed = len(all_tasks) - len(deduped)
    if removed > 0:
        print(f"  🔄 Dedup cross-dimensão: removeu {removed} ações duplicadas", file=sys.stderr)
    return deduped


def run_scorer(profile: dict, market_data: dict, discovery_data: dict = None) -> dict:
    """
    Main entry point. Scores each dimension individually for deep, focused analysis.
    Returns score data AND task plan (no separate task_generator needed).
    
    Improvements:
    - Cross-dimension action dedup (previous actions passed to each subsequent dimension)
    - Blended scoring (60% LLM + 40% objective criteria)
    - Strict market data filtering (no fallback to all data)
    - Discovery data injection (real business data from web searches)
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "erro": "Chave da API Groq não configurada."}

    restricoes = extract_restrictions(profile)
    dimensoes = {}
    all_tasks = []
    # Track action titles for cross-dimension dedup in prompts
    previous_action_titles = []

    print("📊 Calculando score por dimensão...", file=sys.stderr)

    for i, (dim_key, dim_cfg) in enumerate(DIMENSIONS.items()):
        print(f"  [{i+1}/6] {dim_cfg['label']}...", file=sys.stderr)

        market_text = _filter_market(dim_key, market_data)
        dim_sources = _get_all_sources_for_dimension(dim_key, market_data)

        # Format discovery data per-dimension so each scorer gets channel-relevant context
        disc_text = ""
        if discovery_data and discovery_data.get("found"):
            disc_text = format_discovery_for_scorer(discovery_data, dim_key=dim_key)
            print(f"  📋 Discovery [{dim_key}]: {len(disc_text)} chars", file=sys.stderr)

        result = _score_dimension(
            dim_key, dim_cfg, profile, market_text, dim_sources, restricoes, api_key,
            previous_actions=previous_action_titles,
            discovery_text=disc_text
        )
        dimensoes[dim_key] = result

        # Convert acoes to flat task list and track for dedup
        for j, acao in enumerate(result.get("acoes_imediatas", [])):
            if isinstance(acao, dict):
                titulo = acao.get("acao", "")
                all_tasks.append({
                    "id": f"task_{dim_key}_{j+1}",
                    "titulo": titulo,
                    "categoria": dim_key,
                    "impacto": {"alto": 9, "medio": 6, "baixo": 3}.get(
                        str(acao.get("impacto", "medio")).lower(), 6
                    ),
                    "prazo_sugerido": acao.get("prazo", "1 semana"),
                    "custo_estimado": acao.get("custo", "R$ 0"),
                    "fonte_referencia": acao.get("fonte", ""),
                    "descricao": acao.get("fonte", ""),
                })
                if titulo:
                    previous_action_titles.append(titulo)
            elif isinstance(acao, str):
                all_tasks.append({
                    "id": f"task_{dim_key}_{j+1}",
                    "titulo": acao,
                    "categoria": dim_key,
                    "impacto": 6,
                    "prazo_sugerido": "1 semana",
                    "custo_estimado": "R$ 0",
                    "fonte_referencia": "",
                    "descricao": "",
                })
                previous_action_titles.append(acao)

        s = result.get("score", "?")
        n = len(result.get("acoes_imediatas", []))
        print(f"    → {s}/100 | {n} ações", file=sys.stderr)

        # Delay between calls to stay within rate limits
        if i < len(DIMENSIONS) - 1:
            time.sleep(1.5)
    
    # Post-processing: cross-dimension dedup
    all_tasks = _dedup_actions_cross_dimension(all_tasks)

    # ── Overall score (weighted average) ──
    total_w = 0
    total_s = 0
    for d in dimensoes.values():
        p = d.get("peso", 0.15)
        s = d.get("score", 50)
        total_s += s * p
        total_w += p

    score_geral = round(total_s / total_w) if total_w > 0 else 50

    if score_geral >= 70:
        classificacao = "Saudável"
    elif score_geral >= 55:
        classificacao = "Estável"
    elif score_geral >= 40:
        classificacao = "Em Risco"
    else:
        classificacao = "Crítico"

    # ── Executive summary from dimension data ──
    sorted_dims = sorted(dimensoes.items(), key=lambda x: x[1].get("score", 50))
    weakest_key, weakest = sorted_dims[0]
    strongest_key, strongest = sorted_dims[-1]

    resumo = (
        f"Ponto forte: {DIMENSIONS[strongest_key]['label']} ({strongest.get('score', 50)}/100). "
        f"Prioridade: {DIMENSIONS[weakest_key]['label']} ({weakest.get('score', 50)}/100). "
        f"{weakest.get('dado_chave', '')}"
    )

    # ── Opportunities from weakest dimensions ──
    oportunidades = []
    for dk, dd in sorted_dims[:3]:
        if dd.get("dado_chave"):
            oportunidades.append({
                "titulo": f"Melhorar {DIMENSIONS[dk]['label']}",
                "descricao": dd["dado_chave"],
                "impacto_potencial": "alto" if dd.get("score", 50) < 40 else "medio",
                "dimensao": dk,
            })

    score_output = {
        "score_geral": score_geral,
        "classificacao": classificacao,
        "resumo_executivo": resumo,
        "dimensoes": dimensoes,
        "oportunidades": oportunidades,
    }

    task_plan = {
        "tasks": all_tasks,
        "resumo_plano": resumo,
        "meta_principal": f"Priorizar {DIMENSIONS[weakest_key]['label']}",
    }

    print(f"  ✅ Score geral: {score_geral}/100 ({classificacao})", file=sys.stderr)

    return {
        "success": True,
        "score": score_output,
        "taskPlan": task_plan,
    }
