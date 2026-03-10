# ═══════════════════════════════════════════════════════════════════
# IMPORTS CENTRALIZADOS (ANTES: 5 imports duplicados)
# ═══════════════════════════════════════════════════════════════════

from app.services.common import (
    json, os, sys,  # Python basics
    call_llm,            # LLM
    search_duckduckgo, scrape_page,  # Web utils
    log_info, log_error, log_warning, log_success, log_debug,  # Logging
    safe_json_dumps, safe_json_loads,  # Serialization
    CommonConfig,    # Config
    get_timestamp, format_duration, safe_get  # Utils
)

# Imports específicos deste módulo
import concurrent.futures

def process_category(cat, queries, perfil_data, description, restricoes, region, api_key, model_provider="groq"):
    """Helper function to process a single category in a thread."""
    cat_id = cat.get("id", "")
    query = queries.get(cat_id, f"{cat.get('nome', '')} {perfil_data.get('segmento', '')}")
    
    log_info(f"[{cat.get('icone', '📊')}] Buscando: {query}")

    results = search_duckduckgo(query, max_results=5, region=region)

    if not results:
        segmento = perfil_data.get('segmento', '')
        foco_words = cat.get('foco', '').split(',')[0].strip()[:60]
        fallback_query = f"{foco_words} {segmento}".strip()
        log_warning(f"Sem resultados, tentando: {fallback_query}")
        results = search_duckduckgo(fallback_query, max_results=5, region=region)

    if not results:
        log_warning(f"Nenhum resultado para {cat_id} mesmo com retry")
        return {
            "id": cat_id,
            "nome": cat.get("nome", ""),
            "icone": cat.get("icone", "📊"),
            "cor": cat.get("cor", "#71717a"),
            "query_usada": query,
            "resumo": {"visao_geral": f"Sem dados de mercado encontrados para {cat.get('nome',cat_id)}.", "pontos_chave": [], "recomendacoes": []},
            "fontes": []
        }

    aggregated_text = ""
    sources = []

    for i, result in enumerate(results):
        url = result.get('href', '')
        sources.append(url)
        snippet = result.get('body', '')
        title = result.get('title', '')
        aggregated_text += f"Fonte {i+1} ({title}): {snippet}\n"

        if i < 1:
            content = scrape_page(url, timeout=3)
            if content:
                aggregated_text += f"Conteúdo Fonte {i+1}: {content[:3000]}\n"

    foco = cat.get("foco", "análise geral")
    nao_falar = cat.get("nao_falar", "")
    
    restriction_instructions = ""
    if restricoes:
        modelo_op = restricoes.get("modelo_operacional", "")
        capital = restricoes.get("capital_disponivel", "")
        equipe = restricoes.get("equipe", "")
        canais = restricoes.get("canais_existentes", [])
        
        if modelo_op in ["sob_encomenda", "dropshipping"]:
            restriction_instructions += "\n- NÃO recomende ERP de estoque, gestão de inventário. O negócio opera sob encomenda."
        if capital in ["zero", "baixo"]:
            restriction_instructions += "\n- NÃO recomende ferramentas pagas caras. Apenas opções gratuitas ou de baixíssimo custo."
        if equipe in ["1", "solo", "sozinho"]:
            restriction_instructions += "\n- NÃO recomende estratégias que exijam equipe. Tudo deve ser executável por uma pessoa."
        if any("instagram" in str(c).lower() for c in canais):
            restriction_instructions += "\n- O negócio JÁ usa Instagram. Não sugira 'criar presença'. Sugira OTIMIZAÇÃO."

    try:
        # Load prompt from YAML
        from app.core.prompt_loader import load_prompt_file
        prompt_config = load_prompt_file("explorer.yaml")
        template = prompt_config.get("market_analysis", {}).get("prompt_template", "")
        
        prompt = template.format(
            description=description,
            restricoes=restricoes,
            foco=foco,
            restriction_instructions=restriction_instructions,
            nao_falar=nao_falar,
            aggregated_text=aggregated_text[:12000]
        )

        resumo = call_llm(provider=model_provider, prompt=prompt, temperature=0.3)
    except Exception as e:
        print(f"  ❌ Erro ao resumir {cat.get('nome', '')}: {e}", file=sys.stderr)
        resumo = {"erro": f"Não foi possível gerar resumo: {str(e)[:200]}"}

    # Capture tokens from summary call
    tokens = getattr(resumo, "_tokens", 0) if isinstance(resumo, str) else resumo.get("_tokens", 0)

    return {
        "id": cat_id,
        "nome": cat.get("nome", ""),
        "icone": cat.get("icone", "📊"),
        "cor": cat.get("cor", "#71717a"),
        "query_usada": query,
        "resumo": resumo,
        "fontes": sources,
        "_tokens": tokens
    }


DIMENSION_LABELS = {
    "publico_alvo": "Publico-Alvo e Personas",
    "branding": "Branding e Posicionamento",
    "identidade_visual": "Identidade Visual",
    "canais_venda": "Canais de Venda",
    "trafego_organico": "Trafego Organico",
    "trafego_pago": "Trafego Pago",
    "processo_vendas": "Processo de Vendas",
}

def run_dimension_chat(input_data: dict) -> dict:
    """AI chat focused on a specific business dimension with internet search."""
    model_provider = input_data.get("aiModel", input_data.get("model_provider", os.environ.get("GLOBAL_AI_MODEL", "groq")))

    dimension = input_data.get("dimension", "")
    context = input_data.get("context", {})
    user_message = input_data.get("userMessage", "")
    messages = input_data.get("messages", [])

    dim_label = DIMENSION_LABELS.get(dimension, dimension)

    profile = context.get("profile", {})
    perfil = profile.get("perfil", profile)
    segmento = perfil.get("segmento", "")
    nome = perfil.get("nome_negocio", perfil.get("nome", ""))
    localizacao = perfil.get("localizacao", "")
    modelo = perfil.get("modelo", perfil.get("modelo_negocio", ""))

    score = context.get("score", {})
    dim_data = score.get("dimensoes", {}).get(dimension, {})

    search_query = f"{dim_label} {segmento} {localizacao} {user_message}"
    print(f"  Dimension search: {search_query}", file=sys.stderr)

    results = search_duckduckgo(search_query, max_results=4, region='br-pt')
    search_context = ""
    sources = []

    for i, r in enumerate(results or []):
        url = r.get('href', '')
        sources.append(url)
        snippet = r.get('body', '')
        title = r.get('title', '')
        search_context += f"Fonte {i+1} ({title}): {snippet}\n"
        if i < 2:
            content = scrape_page(url, timeout=3)
            if content:
                search_context += f"  Detalhes: {content[:2000]}\n"

    history_text = ""
    for m in messages[-8:]:
        role = "Usuario" if m.get("role") == "user" else "Assistente"
        history_text += f"{role}: {m.get('content', '')}\n"

    # Load prompt from YAML
    from app.core.prompt_loader import load_prompt_file
    prompt_config = load_prompt_file("explorer.yaml")
    template = prompt_config.get("dimension_chat", {}).get("prompt_template", "")
    
    prompt = template.format(
        dim_label=dim_label,
        nome=nome,
        segmento=segmento,
        modelo=modelo,
        localizacao=localizacao,
        score_dim=dim_data.get('score', 'N/A'),
        status=dim_data.get('status', 'N/A'),
        justificativa=dim_data.get('justificativa', 'N/A'),
        acoes_imediatas=json.dumps(dim_data.get('acoes_imediatas', []), ensure_ascii=False),
        perfil=json.dumps(perfil, ensure_ascii=False)[:3000],
        score_geral=json.dumps(score, ensure_ascii=False)[:2000],
        search_context=search_context[:8000] if search_context else "Nenhum dado encontrado.",
        history_text=history_text if history_text else "Primeira mensagem.",
        user_message=user_message
    )

    try:
        reply = call_llm(provider=model_provider, prompt=prompt, temperature=0.4, json_mode=False)
    except Exception as e:
        print(f"  Erro no LLM: {e}", file=sys.stderr)
        try:
            reply = call_llm(provider=model_provider, prompt=prompt, temperature=0.4, json_mode=False, prefer_small=True)
        except Exception as e2:
            reply = f"Desculpe, nao consegui gerar uma resposta. Erro: {str(e2)[:200]}"

    # Capture tokens from reply call
    tokens = getattr(reply, "_tokens", 0) if isinstance(reply, str) else reply.get("_tokens", 0)

    return {
        "success": True,
        "reply": reply,
        "sources": sources,
        "searchQuery": search_query,
        "_tokens": tokens
    }

def run_market_search(profile: dict, region: str = 'br-pt', model_provider: str = "groq") -> dict:
    if model_provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"categories": [], "allSources": [], "error": "Gemini API key not configured"}
    elif model_provider == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            return {"categories": [], "allSources": [], "error": "OpenRouter API key not configured"}
    else:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return {"categories": [], "allSources": [], "error": "Groq API key not configured"}

    queries = profile.get("queries_sugeridas", profile.get("queries", {}))
    categories = profile.get("categorias_relevantes", profile.get("categories", []))

    if not categories:
        from app.services.analysis.analyzer_business_profiler import _VALID_PILLAR_IDS
        _DEFAULT_META = {
            "mercado": {"nome": "Panorama do Mercado", "icone": "📊", "cor": "#10B981", "foco": "tamanho, crescimento, tendências"},
            "concorrentes": {"nome": "Mapa de Concorrentes", "icone": "🎯", "cor": "#F59E0B", "foco": "concorrentes diretos, diferenciais, preços"},
            "publico_alvo": {"nome": "Público-Alvo e Personas", "icone": "👥", "cor": "#3B82F6", "foco": "quem compra, segmentos, comportamento"},
            "branding": {"nome": "Branding e Posicionamento", "icone": "🎯", "cor": "#8B5CF6", "foco": "posicionamento, diferencial, proposta de valor"},
            "identidade_visual": {"nome": "Identidade Visual", "icone": "🎨", "cor": "#EC4899", "foco": "presença visual, design, credibilidade"},
            "canais_venda": {"nome": "Canais de Venda", "icone": "🛒", "cor": "#10B981", "foco": "canais de venda, distribuição, prospecção"},
            "trafego_organico": {"nome": "Tráfego Orgânico", "icone": "📈", "cor": "#F59E0B", "foco": "SEO, conteúdo, redes sociais"},
            "trafego_pago": {"nome": "Tráfego Pago", "icone": "💰", "cor": "#EF4444", "foco": "anúncios, Google Ads, Meta Ads"},
            "processo_vendas": {"nome": "Processo de Vendas", "icone": "🤝", "cor": "#6366F1", "foco": "funil, conversão, precificação"},
        }
        categories = [{"id": pid, **meta, "prioridade": 5, "justificativa": "Pilar padrão", "nao_falar": ""} for pid, meta in _DEFAULT_META.items()]
        profile["categorias_relevantes"] = categories

    perfil_data = profile.get("perfil", profile.get("profile", {}).get("perfil", {}))
    description = f"{perfil_data.get('nome', '')} - {perfil_data.get('segmento', '')} - {perfil_data.get('modelo_negocio', '')} - {perfil_data.get('localizacao', '')}"
    
    restricoes_criticas = profile.get("restricoes_criticas", {})
    capital = restricoes_criticas.get("capital_disponivel", perfil_data.get('investimento_marketing', 'não informado'))
    equipe = restricoes_criticas.get("equipe_solo", False)
    if equipe:
        equipe_str = "solo"
    else:
        equipe_str = perfil_data.get('num_funcionarios', 'não informado')
    
    dificuldades = perfil_data.get('dificuldades', '')
    modelo_op = restricoes_criticas.get("modelo_operacional", "")
    canais_existentes = restricoes_criticas.get("canais_existentes", [])
    
    restricoes = {
        "capital_disponivel": capital,
        "equipe": equipe_str,
        "dificuldades": dificuldades,
        "modelo_operacional": modelo_op,
        "canais_existentes": canais_existentes,
        "texto": f"Capital: {capital}. Equipe: {equipe_str}. Dificuldades: {dificuldades}. Modelo: {modelo_op}."
    }

    categories_result = []
    all_sources = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_to_cat = {
            executor.submit(process_category, cat, queries, perfil_data, description, restricoes, region, api_key, model_provider): cat 
            for cat in categories
        }
        
        for future in concurrent.futures.as_completed(future_to_cat):
            try:
                result = future.result()
                categories_result.append(result)
                all_sources.extend(result.get("fontes", []))
            except Exception as exc:
                print(f"  ❌ Generated an exception: {exc}", file=sys.stderr)

    unique_sources = list(dict.fromkeys(all_sources))

    return {
        "businessMode": True,
        "categories": categories_result,
        "allSources": unique_sources,
        "restricoes_aplicadas": restricoes
    }
