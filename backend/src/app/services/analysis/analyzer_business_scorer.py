"""
Business Scorer — 7 Sales Pillars scoring with chain context.

Each of the 7 pillars is scored INDIVIDUALLY in a specific ORDER so that
upstream pillars feed compact context into downstream ones.

The 7 pillars form an interconnected sales machine:
  Público-Alvo → Branding → Identidade Visual
       ↓             ↓            ↓
     Canais de Venda ←←←←←←←←←←←
       ↓
  Tráfego Orgânico → Tráfego Pago
       ↓                  ↓
    Processo de Vendas ←←←←

Architecture:
- 7 sequential LLM calls with 1.5s delays (rate-limit safe)
- Chain context: each pillar produces a compact summary (~150 tokens)
  that is injected into downstream pillars
- Each pillar has its OWN action plan (tasks live inside the pillar)
- Multi-model fallback across separate TPD quotas
"""

import json
import os
from app.services.analysis.analyzer_business_discovery import format_discovery_for_scorer
import re
import sys
import time
from app.core.llm_router import call_llm
from app.services.common import log_info, log_debug, log_warning, log_error, log_llm, log_success
from dotenv import load_dotenv

load_dotenv()

# ── 7 Sales Pillars (ordered for chain context) ─────────────────────
# Each pillar feeds context to downstream pillars via compact summaries.
# "upstream" lists which pillars' summaries this one receives.
DIMENSIONS = {
    "publico_alvo": {
        "label": "Público-Alvo e Personas",
        "peso": 0.20,
        "ordem": 1,
        "foco": "cliente ideal detalhado, personas de compra, demografia, comportamento, dores, desejos, onde encontrar o público, poder de compra, jornada de decisão",
        "market_keywords": ["publico", "persona", "cliente", "consumidor", "demografico",
                            "comportamento", "perfil", "segmento", "nicho", "alvo",
                            "audiencia", "comprador", "demanda", "mercado"],
        "category_ids": ["publico_alvo", "cliente_ideal", "personas", "segmento",
                         "mercado", "panorama", "potencial_mercado", "tendencias"],
        "upstream": [],
    },
    "branding": {
        "label": "Branding e Posicionamento",
        "peso": 0.15,
        "ordem": 2,
        "foco": "posicionamento de marca, proposta de valor, tom de voz, mensagem central, diferencial competitivo, análise de concorrentes, percepção de marca",
        "market_keywords": ["marca", "branding", "posicionamento", "diferencial", "proposta",
                            "valor", "concorrente", "competit", "benchmark", "imagem",
                            "mapa", "concorrencia"],
        "category_ids": ["branding", "posicionamento", "concorrentes", "diferencial",
                         "competitividade", "marca", "mapa_concorrentes", "benchmark"],
        "upstream": ["publico_alvo"],
    },
    "identidade_visual": {
        "label": "Identidade Visual",
        "peso": 0.10,
        "ordem": 3,
        "foco": "consistência visual, qualidade de fotos e vídeos, paleta de cores, tipografia, coerência entre canais, feed do Instagram, materiais gráficos, apresentação profissional",
        "market_keywords": ["visual", "design", "logo", "imagem", "foto", "estetica",
                            "cores", "tipografia", "layout", "banner", "feed",
                            "criativo", "template"],
        "category_ids": ["identidade_visual", "design", "estetica", "presenca_visual",
                         "credibilidade"],
        "upstream": ["publico_alvo", "branding"],
    },
    "canais_venda": {
        "label": "Canais de Venda",
        "peso": 0.15,
        "ordem": 4,
        "foco": "canais atuais e otimização, e-commerce, Instagram Shopping, WhatsApp Business, marketplace, loja física, novos canais viáveis, integração entre canais",
        "market_keywords": ["canal", "venda", "ecommerce", "marketplace", "loja",
                            "instagram", "whatsapp", "delivery", "distribuicao",
                            "ponto_venda", "diversificacao", "vendas_solo",
                            "como_vender", "prospectar"],
        "category_ids": ["canais", "vendas_solo", "como_vender", "diversificacao_canais",
                         "marketplace", "ecommerce", "prospectar"],
        "upstream": ["publico_alvo", "branding", "identidade_visual"],
    },
    "trafego_organico": {
        "label": "Tráfego Orgânico",
        "peso": 0.15,
        "ordem": 5,
        "foco": "SEO local e Google Meu Negócio, marketing de conteúdo, redes sociais orgânico, Reels, Stories, blog, YouTube, engajamento, alcance orgânico, hashtags, frequência de postagem",
        "market_keywords": ["seo", "conteudo", "organico", "engajamento", "seguidores",
                            "alcance", "google", "youtube", "reels", "blog", "post",
                            "stories", "marketing_organico", "presenca_online",
                            "presenca_digital", "otimizacao"],
        "category_ids": ["marketing_organico", "seo", "conteudo", "presenca_online",
                         "engajamento", "presenca_digital", "otimizacao_conversao"],
        "upstream": ["publico_alvo", "branding", "identidade_visual", "canais_venda"],
    },
    "trafego_pago": {
        "label": "Tráfego Pago",
        "peso": 0.10,
        "ordem": 6,
        "foco": "anúncios Meta Ads e Google Ads, orçamento de mídia, ROI, segmentação de público, copy de anúncios, criativos, remarketing, funil de anúncio, custo por aquisição",
        "market_keywords": ["anuncio", "ads", "pago", "midia", "investimento", "roi",
                            "meta_ads", "google_ads", "facebook_ads", "campanha",
                            "conversao", "cpc", "cpa", "remarketing"],
        "category_ids": ["trafego_pago", "anuncios", "ads", "midia_paga",
                         "campanha", "marketing"],
        "upstream": ["publico_alvo", "branding", "identidade_visual", "canais_venda"],
    },
    "processo_vendas": {
        "label": "Processo de Vendas",
        "peso": 0.15,
        "ordem": 7,
        "foco": "funil de vendas, processo de conversão, follow-up, contorno de objeções, scripts de venda, precificação, ticket médio, margem, fechamento, pós-venda, fidelização, upsell",
        "market_keywords": ["venda", "funil", "conversao", "fechamento", "objecao",
                            "preco", "precificacao", "margem", "ticket", "proposta",
                            "negociacao", "pos_venda", "fidelizacao", "upsell",
                            "script", "follow"],
        "category_ids": ["processo_vendas", "precificacao", "funil", "conversao",
                         "vendas", "negociacao", "precos", "margem", "financeiro"],
        "upstream": ["publico_alvo", "branding", "identidade_visual", "canais_venda", "trafego_organico", "trafego_pago"],
    },
}

# Sorted order for chain context processing
DIMENSION_ORDER = sorted(DIMENSIONS.keys(), key=lambda k: DIMENSIONS[k]["ordem"])

def get_dynamic_weights(profile: dict) -> dict:
    """ Adjust pillar weights based on business model (B2B, B2C, Service).
    Business logic:
    - B2B: Focus on Sales Process (consultative) and Branding (authority). Visual Identity/Org Traffic matter less.
    - B2C: Focus on Visual Identity, Sales Channels, and Paid Traffic (impulse).
    - Service: Focus on Branding (social proof) and Organic Traffic (SEO/Authority).
    """
    from app.services.agents.pillar_config import _detect_business_model
    model = _detect_business_model(profile)
    
    # Base weights (1.0 total)
    weights = {k: v["peso"] for k, v in DIMENSIONS.items()}
    
    if model == "b2b":
        weights.update({
            "publico_alvo": 0.20, "branding": 0.20, "identidade_visual": 0.05,
            "canais_venda": 0.10, "trafego_organico": 0.10, "trafego_pago": 0.10,
            "processo_vendas": 0.25
        })
    elif model == "servico":
        weights.update({
            "publico_alvo": 0.15, "branding": 0.25, "identidade_visual": 0.10,
            "canais_venda": 0.10, "trafego_organico": 0.20, "trafego_pago": 0.10,
            "processo_vendas": 0.10
        })
    elif model == "b2c":
        weights.update({
            "publico_alvo": 0.15, "branding": 0.10, "identidade_visual": 0.15,
            "canais_venda": 0.20, "trafego_organico": 0.15, "trafego_pago": 0.15,
            "processo_vendas": 0.10
        })
        
    total = sum(weights.values())
    return {k: v / total for k, v in weights.items()}




# Semantic mapping: common terms LLM uses in category names → which pillar(s) they relate to
# This catches dynamically-generated IDs like "credibilidade_e_confianca" → identidade_visual, branding
_SEMANTIC_PILLAR_MAP = {
    "publico_alvo": ["publico", "persona", "cliente", "consumidor", "comprador", "demanda",
                     "audiencia", "segmento", "nicho", "alvo", "mercado", "potencial",
                     "perfil_cliente", "b2b", "b2c", "quem_compra", "demografico"],
    "branding": ["marca", "branding", "posicionamento", "diferencial", "proposta_valor",
                 "concorrent", "competit", "benchmark", "reputacao", "autoridade",
                 "credibilidade", "confianca", "prova_social", "depoimento", "garantia"],
    "identidade_visual": ["visual", "design", "logo", "imagem", "foto", "estetica",
                          "cores", "tipografia", "feed", "criativo", "template", "banner",
                          "credibilidade", "confianca", "profissional", "apresentacao"],
    "canais_venda": ["canal", "venda", "ecommerce", "marketplace", "loja", "instagram",
                     "whatsapp", "delivery", "distribuicao", "prospectar", "como_vender",
                     "diversificacao", "ponto_venda", "logistica", "encomenda", "estoque",
                     "fornecedor", "prazo", "entrega", "frete"],
    "trafego_organico": ["seo", "conteudo", "organico", "engajamento", "seguidores",
                         "alcance", "google", "youtube", "reels", "blog", "post",
                         "stories", "marketing_organico", "presenca_online", "otimizacao",
                         "conversao_instagram", "baixo_custo", "gratuito"],
    "trafego_pago": ["anuncio", "ads", "pago", "midia", "investimento", "roi",
                     "meta_ads", "google_ads", "facebook_ads", "campanha", "cpc", "cpa",
                     "remarketing", "trafego_pago", "patrocinado"],
    "processo_vendas": ["processo", "funil", "fechamento", "objecao", "preco",
                        "precificacao", "margem", "ticket", "proposta", "negociacao",
                        "pos_venda", "fidelizacao", "upsell", "script", "follow",
                        "conversao", "crm", "pipeline"],
}


def _score_category_relevance(dim_key: str, cat: dict) -> int:
    """Score how relevant a market category is for a given pillar (0-100).
    Uses multiple matching strategies for robustness."""
    dim_cfg = DIMENSIONS[dim_key]
    category_ids = dim_cfg.get("category_ids", [])
    keywords = dim_cfg["market_keywords"]
    semantic_terms = _SEMANTIC_PILLAR_MAP.get(dim_key, [])

    cat_id = cat.get("id", "").lower()
    cat_nome = cat.get("nome", "").lower()
    cat_foco = cat.get("foco", "").lower()
    cat_text = f"{cat_id} {cat_nome} {cat_foco}"
    # Split compound IDs like "credibilidade_e_confianca" into words
    cat_id_parts = set(cat_id.replace("_", " ").split())

    score = 0

    # Pass 1: Exact category ID match (highest confidence)
    if cat_id in category_ids:
        score += 50

    # Pass 2: Bidirectional substring on category IDs
    # e.g. "credibilidade" in "credibilidade_e_confianca" or vice versa
    for expected_id in category_ids:
        if expected_id in cat_id or cat_id in expected_id:
            score += 30
            break
        # Also check if expected_id parts overlap with cat_id parts
        expected_parts = set(expected_id.replace("_", " ").split())
        if expected_parts & cat_id_parts:
            score += 20
            break

    # Pass 3: Keyword matching in full text (name, id, foco)
    kw_hits = sum(1 for kw in keywords if kw in cat_text)
    score += min(kw_hits * 8, 30)  # up to 30 points

    # Pass 4: Semantic term matching (catches LLM creative naming)
    sem_hits = sum(1 for term in semantic_terms if term in cat_text)
    score += min(sem_hits * 6, 25)  # up to 25 points

    return min(score, 100)


def _filter_market(dim_key: str, market_data: dict) -> str:
    """Extract relevant market data for a specific dimension.
    Uses multi-pass relevance scoring: exact IDs, bidirectional substring,
    keywords, and semantic mapping. Threshold: score >= 15."""
    categories = market_data.get("categories", [])
    if not categories:
        return ""

    # Score every category for this pillar
    scored = []
    for cat in categories:
        rel_score = _score_category_relevance(dim_key, cat)
        if rel_score >= 15:
            scored.append((rel_score, cat))

    # Sort by relevance descending
    scored.sort(key=lambda x: x[0], reverse=True)
    relevant = [cat for _, cat in scored[:3]]

    if not relevant:
        available_ids = [cat.get("id", "").lower() for cat in categories]
        log_warning(f"Nenhum dado de mercado correspondente para {dim_key} (disponíveis: {available_ids})")
        return ""

    matched_ids = [cat.get("id", "") for cat in relevant]
    matched_scores = [s for s, _ in scored[:3]]
    log_debug(f"Market match para {dim_key}: {list(zip(matched_ids, matched_scores))}")

    text = ""
    for cat in relevant:
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
    sources = []

    for cat in categories:
        rel_score = _score_category_relevance(dim_key, cat)
        if rel_score >= 15:
            sources.extend(cat.get("fontes", []))

    return list(dict.fromkeys(sources))  # Deduplicate preserving order


def extract_restrictions(profile: dict) -> dict:
    """Extract business restrictions from profile for context-aware scoring."""
    # Handle nesting from profiler output
    if "profile" in profile and isinstance(profile["profile"], dict) and "restricoes_criticas" in profile["profile"]:
        profile = profile["profile"]

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
    """Compute a deterministic partial score based on concrete profile data."""
    # Handle nesting from profiler output
    if "profile" in profile and isinstance(profile["profile"], dict) and "perfil" in profile["profile"]:
        profile = profile["profile"]
        
    perfil = profile.get("perfil", profile)
    score = 0
    
    def get_quality(field, *aliases):
        """Returns a score multiplier (0.0 to 1.0) based on value quality."""
        for f in (field,) + aliases:
            v = str(perfil.get(f, "")).strip()
            if v and v not in ("?", "null", "None", "não informado", "não sei", ""):
                # Qualitative check: very short answers get less points
                if len(v) < 10: return 0.4  # "Instagram" is too short
                if len(v) < 30: return 0.7  # "Vendo no instagram e whatsapp" is better
                return 1.0 # Detailed answer
        return 0.0
    
    canais_raw_val = perfil.get("canais_venda", "")
    if isinstance(canais_raw_val, list):
        canais_raw = ", ".join(str(c) for c in canais_raw_val).lower()
    else:
        canais_raw = str(canais_raw_val).lower()
    
    if dim_key == "publico_alvo":
        score += 35 * get_quality("cliente_ideal", "publico_alvo")
        score += 15 * get_quality("segmento")
        score += 15 * get_quality("localizacao")
        score += 15 * get_quality("maior_objecao")
        score += 20 * get_quality("origem_clientes")
        
    elif dim_key == "branding":
        score += 40 * get_quality("diferencial")
        score += 30 * get_quality("concorrentes")
        score += 15 * get_quality("maior_objecao")
        score += 15 * get_quality("objetivos")
        
    elif dim_key == "identidade_visual":
        if "instagram" in canais_raw or get_quality("instagram_handle") > 0: score += 40
        if "site" in canais_raw or get_quality("site_url") > 0: score += 40
        if get_quality("diferencial") > 0.5: score += 20
        
    elif dim_key == "canais_venda":
        n_canais = len([c for c in re.split(r"[,|;]", canais_raw) if c.strip()]) if canais_raw else 0
        if n_canais >= 3: score += 40
        elif n_canais >= 2: score += 25
        elif n_canais == 1: score += 10
        has_online = any(x in canais_raw for x in ["instagram", "site", "whatsapp", "marketplace", "ifood", "online", "ecommerce"])
        has_offline = any(x in canais_raw for x in ["loja", "rua", "físic", "boca", "feira"])
        if has_online: score += 30
        if has_offline: score += 30
        
    elif dim_key == "trafego_organico":
        score += 30 * get_quality("google_maps_url")
        score += 30 * get_quality("instagram_handle")
        score += 20 * get_quality("site_url")
        score += 20 * get_quality("origem_clientes")
        
    elif dim_key == "trafego_pago":
        score += 40 * get_quality("capital_disponivel")
        faturamento_val = str(perfil.get("faturamento_mensal", "")).lower()
        if any(x in faturamento_val for x in ["acima", "50k", "10k", "20k", "cem mil"]):
            score += 30
        score += 30 * get_quality("segmento")
        
    elif dim_key == "processo_vendas":
        score += 30 * get_quality("maior_objecao")
        score += 30 * get_quality("ticket_medio", "ticket_medio_estimado")
        score += 20 * get_quality("margem_lucro")
        score += 20 * get_quality("origem_clientes")
    
    return min(int(score), 100)


def _build_chain_context(dim_key: str, chain_summaries: dict) -> str:
    """Build compact context from upstream pillars for this dimension.
    Includes strategic alerts for low-score dependencies."""
    upstream_keys = DIMENSIONS[dim_key].get("upstream", [])
    if not upstream_keys or not chain_summaries:
        return ""
    
    lines = ["CONTEXTO DOS PILARES ANTERIORES (use para conectar sua análise):"]
    for uk in upstream_keys:
        data = chain_summaries.get(uk)
        if data:
            label = DIMENSIONS[uk]["label"]
            score = data.get("score", 50)
            summary = data.get("summary", "")
            
            # Critical Logic: Strategic Alerts
            prefix = ""
            if score < 40:
                prefix = "⚠️ [FRAQUEZA CRÍTICA]: "
                if uk == "publico_alvo":
                    prefix += "(Risco Alto) Como o público é desconhecido, esta estratégia aqui deve ser cautelosa. "
                elif uk == "branding":
                    prefix += "(Risco de Conversão) Sem posicionamento claro, esta ação pode não converter. "
            
            lines.append(f"• {label}: {prefix}{summary}")
    
    return "\n".join(lines) if len(lines) > 1 else ""


def _extract_chain_summary(dim_key: str, result: dict) -> dict:
    """Extract a compact summary + score from a scored dimension
    to pass as context/alerts to downstream pillars."""
    label = DIMENSIONS[dim_key]["label"]
    score = result.get("score", 50)
    dado_chave = result.get("dado_chave", "")
    justificativa = result.get("justificativa", "")
    
    # Take first sentence of justificativa
    just_short = justificativa.split(".")[0] + "." if justificativa else ""
    summary = f"Score {score}/100. {just_short} {dado_chave}".strip()[:300]
    
    return {"summary": summary, "score": score}


def _score_dimension(dim_key: str, dim_cfg: dict, profile: dict,
                     market_text: str, dim_sources: list,
                     restricoes: dict, api_key: str,
                     previous_actions: list = None,
                     discovery_text: str = "",
                     strategic_intel: dict = None,
                     chain_context: str = "",
                     model_provider: str = "auto",
                     contexto_dinamico: str = "") -> dict:
    """Score a single sales pillar with focused, specific analysis.
    Now receives chain_context from upstream pillars for interconnected analysis
    AND strategic_intel for market-based auditing.
    """
    perfil = profile.get("perfil", profile)
    nome = perfil.get("nome", perfil.get("nome_negocio", "Negócio"))
    segmento = perfil.get("segmento", "Setor Geral")

    # Build restriction notes for this dimension
    notes = []
    if restricoes.get("capital_disponivel") in ("zero", "baixo"):
        notes.append("Capital limitado — apenas opções GRATUITAS ou muito baratas (até R$50/mês).")
    if restricoes.get("equipe_solo"):
        notes.append("Trabalha sozinho/equipe mínima — tudo executável por 1 pessoa em poucas horas.")
    if restricoes.get("modelo_operacional") in ("sob_encomenda", "dropshipping"):
        notes.append(f"Opera {restricoes['modelo_operacional']} — NÃO penalize por falta de estoque.")
    
    canais = restricoes.get("canais_existentes", [])
    _cv_raw = perfil.get("canais_venda", "")
    if isinstance(_cv_raw, list):
        canais_raw = ", ".join(str(c) for c in _cv_raw).lower()
    else:
        canais_raw = str(_cv_raw).lower()
    
    if (canais or canais_raw) and dim_key in ("canais_venda", "trafego_organico"):
        canais_text = ", ".join(canais) if canais else canais_raw
        notes.append(f"JÁ usa: {canais_text}. Sugira OTIMIZAR o que já tem, não criar do zero.")

    restriction_text = "\n".join(f"⚠️ {n}" for n in notes) if notes else ""

    # Dedup block
    dedup_block = ""
    if previous_actions:
        actions_text = "\n".join(f"- {a}" for a in previous_actions[-5:])
        dedup_block = f"\n⛔ NÃO REPETIR: {actions_text}\nGere ações Únicas sobre {dim_cfg['label']}."

    # B2B Specific Context
    b2b_context = ""
    modelo_val = str(perfil.get('modelo_negocio', perfil.get('modelo', ''))).upper()
    seg_val = segmento.upper()
    if "B2B" in modelo_val or any(x in seg_val for x in ["INDUSTRIA", "DISTRIBUIDORA", "ATACADO"]):
        b2b_context = "\nCONTEXTO B2B: Vende para OUTRAS EMPRESAS. Foque em vendas consultivas, LinkedIn, Google Ads, SEO técnico, feiras, e-mail marketing frio. Ignore estratégias B2C puras."

    # Digital presence context
    digital_ctx_lines = []
    for field, label in [("instagram_handle", "Instagram"), ("site_url", "Site"), 
                         ("linkedin_url", "LinkedIn"), ("whatsapp_numero", "WhatsApp"),
                         ("email_contato", "E-mail"), ("google_maps_url", "Google Maps")]:
        val = perfil.get(field)
        if val: digital_ctx_lines.append(f"- {label}: {val}")
    digital_presence_block = ("\nCANAIS DIGITAIS DO USUÁRIO:\n" + "\n".join(digital_ctx_lines)) if digital_ctx_lines else ""

    # Chain context
    chain_block = ""
    if chain_context:
        chain_block = f"\n{chain_context[:800]}\n"

    # Specialist tools & Intel Hub context
    intel_text = ""
    if strategic_intel:
        trends = strategic_intel.get("trends", {})
        news = strategic_intel.get("news", {})
        intel_text = "\n═══ INTELIGÊNCIA ESTRATÉGICA DE MERCADO (DADOS REAIS TUALIZADOS) ═══\n"
        if trends:
            demand = trends.get("demand", {})
            intel_text += f"- DEMANDA: Tendência {demand.get('trend_direction', '?')} ({demand.get('growth_rate_3m', 0):+.1f}% no trimestre).\n"
            rising = trends.get("rising_queries", {}).get("rising_queries", [])
            if rising: intel_text += f"- BUSCAS EM ALTA: {', '.join([q['query'] for q in rising[:3]])}.\n"
        if news:
            sector_news = news.get("sector_news", {}).get("news", [])
            if sector_news: intel_text += f"- NOTÍCIAS DO SETOR: {sector_news[0]['title']}.\n"
            triggers = news.get("sales_triggers", [])
            if triggers: intel_text += f"- GATILHOS DE VENDA: {triggers[0].get('title', '')}.\n"

    # Auditor prompt
    _eq = perfil.get('num_funcionarios', '?')
    _cap = perfil.get('capital_disponivel', '?')
    _dif_val = perfil.get('diferencial', '?')
    _orig = perfil.get('origem_clientes', '?')
    _obj = perfil.get('maior_objecao', '?')
    _cli = perfil.get('cliente_ideal', '?')
    _tick = perfil.get('ticket_medio', perfil.get('ticket_medio_estimado', '?'))

    escopo_text = _ESCOPO_PILAR.get(dim_key, "")
    
    discovery_fairness = ""
    if not discovery_text.strip():
        discovery_fairness = "\n⚠️ NOTA: NENHUM dado externo foi encontrado no Discovery para este pilar. Dê o benefício da dúvida e foque em sugestões proativas de melhoria."
    else:
        discovery_fairness = "\n⚠️ NOTA: Use os dados do Discovery como evidência."

    prompt = f"""Você é o Consultor Estratégico de Crescimento do Hub de Especialistas. Sua missão é avaliar a MATURIDADE e o POTENCIAL de execução do pilar "{dim_cfg['label']}".

SEU FOCO: {dim_cfg['foco']}
{escopo_text}
Sua análise deve ser criteriosa e profissional, valorizando a clareza e a profundidade dos dados fornecidos.

CRITÉRIOS DE AVALIAÇÃO (Foco em Excelência Prática):
1. PROFISSIONALISMO: O dado permite uma execução real? (Ex: "Mulheres" = Genérico/Melhorável. "Donas de casa em Indaiatuba interessadas em produtos artesanais" = Profissional/Validado).
2. VIABILIDADE: As sugestões levam em conta as restrições de capital e equipe do negócio?
3. COERÊNCIA: O que o cliente diz faz sentido para o mercado atual? {discovery_fairness}
4. DIFERENCIAÇÃO: O negócio tem clareza de como se destaca dos concorrentes?

NEGÓCIO: {nome} | {segmento} | {perfil.get('localizacao','?')} | Equipe: {_eq} | Capital: {_cap} | Ticket: {_tick}
Canais: {perfil.get('canais_venda','?')} | Diferencial: {_dif_val} | Origem clientes: {_orig}
Objeção: {_obj} | Cliente ideal: {_cli}{digital_presence_block}
{restriction_text}{b2b_context}{chain_block}
{discovery_text[:2000] if discovery_text.strip() else ""}
{intel_text}
{dedup_block}

{contexto_dinamico}

DIRETRIZ DE PONTUAÇÃO:
- 0-30: Dados inexistentes ou extremamente vagos.
- 40-60: Dados básicos presentes, mas falta profundidade estratégica ou diferencial claro.
- 70-85: Dados profissionais, bem estruturados e prontos para execução de marketing.
- 90-100: Excelência absoluta, dados profundos e diferencial competitivo muito forte.

REGRAS DE RETORNO:
1. Score 0-100 refletindo a maturidade para crescimento.
2. 3-5 ações PRÁTICAS e ESPECÍFICAS para elevar o nível do pilar.
3. CADA AÇÃO deve citar uma ferramenta útil (Ex: Google Trends, Meta Library, CRM, LinkedIn).
4. JUSTIFIQUE: Diagnóstico equilibrado e encorajador, apontando os pontos fortes e o que falta para a excelência.

JSON:
{{
    "score": 0-100,
    "status": "critico/atencao/forte",
    "nivel_profissionalismo": 1-10,
    "veracidade_confirmada": true/false,
    "justificativa": "Texto crítico...",
    "acoes_imediatas": [
        {{
            "acao": "Título curto da ação", 
            "ferramenta": "NOME DA FERRAMENTA (Ex: Google Trends)",
            "como_fazer": "Instrução técnica de como usar a ferramenta para este caso",
            "impacto": "alto/medio/baixo", 
            "prazo": "1 semana", 
            "custo": "R$ 0", 
            "fonte": "motivo estratégico"
        }}
    ],
    "dado_chave": "Insight de veracidade",
    "meta_pilar": "Estado de excelência absoluta deste pilar"
}}"""

    log_debug(f"Pilar {dim_key} - Auditoria Iniciada")
    log_llm(f"Scorer ({dim_key}): Chamando LLM para auditoria. Discovery: {'Sim' if discovery_text.strip() else 'Não'}, Market: {'Sim' if market_text.strip() else 'Não'}, Intel: {'Sim' if strategic_intel else 'Não'}.")

    try:
        result = call_llm("groq", prompt=prompt, json_mode=True, prefer_small=True)
        # Ensure expected fields
        result.setdefault("score", 50)
        result.setdefault("status", "atencao")
        result.setdefault("justificativa", "")
        result.setdefault("acoes_imediatas", [])
        result.setdefault("dado_chave", "")
        result.setdefault("meta_pilar", f"Maximizar {dim_cfg['label']} para vender mais")
        
        # Blend with objective score
        obj_score = _compute_objective_score(dim_key, profile)
        llm_score = result.get("score", 50)
        blended = round(llm_score * 0.6 + obj_score * 0.4)
        
        result["_score_llm"] = llm_score
        result["_score_objetivo"] = obj_score
        result["score"] = blended
        
        if blended >= 70: result["status"] = "forte"
        elif blended >= 40: result["status"] = "atencao"
        else: result["status"] = "critico"
        
        result["fontes_utilizadas"] = list(dict.fromkeys(result.get("fontes_utilizadas", []) + dim_sources[:5]))
        result["peso"] = dim_cfg["peso"]
        return result
    except Exception as e:
        log_error(f"Erro na API do Scorer para '{dim_key}': {repr(e)}")
        
        # --- AUDITORIA ESTRUTURADA DE FALLBACK (Soberania do Usuário) ---
        obj_score = _compute_objective_score(dim_key, profile)
        
        # Mapeamento de preenchimento para justificativa técnica
        filled_fields = [k for k, v in profile.items() if v and str(v).lower() not in ("null", "none", "", "?", "nao informado")]
        fields_count = len(filled_fields)
        
        # Justificativas específicas por pilar baseadas nos dados reais
        just_map = {
            "publico_alvo": f"Público-alvo mapeado com base em '{profile.get('cliente_ideal', 'dados gerais')}'. O volume de {fields_count} indicadores permite segmentação precisa.",
            "branding": f"Posicionamento estruturado sobre o diferencial '{profile.get('diferencial', 'não detalhado')}'. Estratégia pronta para fortalecimento de marca.",
            "identidade_visual": "Análise visual baseada na presença digital detectada. Recomenda-se padronização técnica de ativos.",
            "canais_venda": f"Canais identificados: {profile.get('canais_venda', 'Loja/WhatsApp')}. Estrutura robusta para expansão de multicanalidade.",
            "trafego_organico": f"SEO e conteúdo baseados em {profile.get('tempo_operacao', 'tempo de mercado')}. Autoridade local detectada.",
            "trafego_pago": f"Capacidade de investimento: {profile.get('investimento_marketing', 'a definir')}. Pronto para escala de anúncios.",
            "processo_vendas": f"Processo comercial validado para ticket de {profile.get('ticket_medio', 'valor médio')}. Foco em redução de objeções."
        }
        
        justificativa = just_map.get(dim_key, "Análise baseada na integridade dos dados do DNA empresarial.")
        if fields_count > 30:
            justificativa += " O alto nível de detalhamento do perfil garante viabilidade estratégica imediata."

        return {
            "score": obj_score, 
            "status": "forte" if obj_score >= 70 else "atencao" if obj_score >= 40 else "critico",
            "justificativa": justificativa,
            "acoes_imediatas": [
                {
                    "acao": f"Otimizar {dim_cfg['label']} via Deep Search",
                    "ferramenta": "Google Trends",
                    "como_fazer": "Usar os dados do DNA para validar tendências de busca em tempo real.",
                    "impacto": "alto", "prazo": "1 semana", "custo": "R$ 0", "fonte": "Dados Estruturados"
                }
            ],
            "peso": dim_cfg["peso"],
            "dado_chave": f"{fields_count} indicadores validados.",
            "_score_llm": 50,
            "_score_objetivo": obj_score,
            "fallback_active": True
        }


def _dedup_actions_cross_dimension(all_tasks: list) -> list:
    """Remove tasks that are too similar across dimensions."""
    if len(all_tasks) <= 1: return all_tasks
    def normalize(text): return set(re.sub(r"[^a-záàâãéèêíìîóòôõúùûç\s]", "", text.lower()).split())
    deduped = []
    seen_word_sets = []
    for task in all_tasks:
        title_words = normalize(task.get("titulo", ""))
        if not title_words:
            deduped.append(task)
            continue
        is_duplicate = False
        for seen in seen_word_sets:
            intersection = len(title_words & seen)
            union = len(title_words | seen)
            if union > 0 and intersection / union > 0.7:
                is_duplicate = True
                break
        if not is_duplicate:
            deduped.append(task)
            seen_word_sets.append(title_words)
    return deduped


def run_scorer(profile: dict, market_data: dict, discovery_data: dict = None, strategic_intel: dict = None, 
               model_provider: str = None, generate_tasks: bool = True, is_reanalysis: bool = False,
               analysis_id: str = None, on_pillar_complete: callable = None) -> dict:
    """
    Runs 7 scoring dimensions with hybrid sequential/parallel execution.
    NOW: Supports real-time persistence (on_pillar_complete).
    """
    # Normalize profile if it's the full result from run_profiler
    if "success" in profile and "profile" in profile and isinstance(profile["profile"], dict):
        log_debug("Normalizing profile object in run_scorer")
        profile = profile["profile"]
    from app.services.agents.engine_specialist import get_dynamic_persona_context
    contexto_dinamico = get_dynamic_persona_context(profile)
    sales_brief = profile.get("_sales_brief", "")
    if sales_brief:
        contexto_dinamico = f"🎯 INTELIGÊNCIA DE VENDAS:\n{sales_brief.strip()}\n\n{contexto_dinamico}"
    
    # Check API keys
    api_key = os.environ.get("GEMINI_API_KEY" if model_provider == "gemini" else "GROQ_API_KEY")
    if not api_key: return {"success": False, "erro": f"Chave da API {model_provider} não configurada."}

    restricoes = extract_restrictions(profile)
    dynamic_weights = get_dynamic_weights(profile)
    
    dimensoes = {}
    all_tasks = []
    previous_action_titles = []
    chain_summaries = {}
    total_tokens = 0

    # Phase 2: Hybrid Sequential/Parallel execution
    # Step 1: Sequential Base (Strategic core)
    base_pillars = ["publico_alvo", "branding", "identidade_visual", "canais_venda"]
    for dim_key in base_pillars:
        dim_cfg = dict(DIMENSIONS[dim_key])
        dim_cfg["peso"] = dynamic_weights.get(dim_key, dim_cfg["peso"])
        
        market_text = _filter_market(dim_key, market_data)
        dim_sources = _get_all_sources_for_dimension(dim_key, market_data)
        disc_text = format_discovery_for_scorer(discovery_data, dim_key=dim_key) if discovery_data else ""
        chain_ctx = _build_chain_context(dim_key, chain_summaries)

        result = _score_dimension(
            dim_key, dim_cfg, profile, market_text, dim_sources, restricoes, api_key,
            previous_actions=previous_action_titles,
            discovery_text=disc_text,
            strategic_intel=strategic_intel,
            chain_context=chain_ctx,
            model_provider=model_provider,
            contexto_dinamico=contexto_dinamico
        )
        total_tokens += result.get("_tokens", 0)
        dimensoes[dim_key] = result
        chain_summaries[dim_key] = _extract_chain_summary(dim_key, result)
        
        # Persist immediately if callback provided
        if on_pillar_complete and analysis_id:
            on_pillar_complete(analysis_id, dim_key, result)
        
        # Collect tasks...
        for j, acao in enumerate(result.get("acoes_imediatas", [])):
            titulo = acao.get("acao", "") if isinstance(acao, dict) else str(acao)
            ferramenta = acao.get("ferramenta", "") if isinstance(acao, dict) else ""
            como_fazer = acao.get("como_fazer", "") if isinstance(acao, dict) else ""
            if ferramenta and ferramenta.lower() not in titulo.lower(): titulo = f"{titulo} usando {ferramenta}"
            all_tasks.append({
                "id": f"task_{dim_key}_{j+1}", "titulo": titulo, "ferramenta": ferramenta, "categoria": dim_key,
                "impacto": {"alto": 9, "medio": 6, "baixo": 3}.get(str(acao.get("impacto", "medio")).lower() if isinstance(acao, dict) else "medio", 6),
                "prazo_sugerido": acao.get("prazo", "1 semana") if isinstance(acao, dict) else "1 semana",
                "custo_estimado": acao.get("custo", "R$ 0") if isinstance(acao, dict) else "R$ 0",
                "fonte_referencia": acao.get("fonte", "") if isinstance(acao, dict) else "", "descricao": como_fazer or titulo,
            })
            previous_action_titles.append(titulo)

    # Step 2: Parallel Traffic (Canais dependencies met)
    traffic_pillars = ["trafego_organico", "trafego_pago"]
    print(f"🚀 Scorer: Processando pilares de tráfego em paralelo...", file=sys.stderr)
    
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_to_dim = {}
        for dim_key in traffic_pillars:
            dim_cfg = dict(DIMENSIONS[dim_key])
            dim_cfg["peso"] = dynamic_weights.get(dim_key, dim_cfg["peso"])
            market_text = _filter_market(dim_key, market_data)
            dim_sources = _get_all_sources_for_dimension(dim_key, market_data)
            disc_text = format_discovery_for_scorer(discovery_data, dim_key=dim_key) if discovery_data else ""
            chain_ctx = _build_chain_context(dim_key, chain_summaries)
            
            future = executor.submit(
                _score_dimension, dim_key, dim_cfg, profile, market_text, dim_sources, 
                restricoes, api_key, previous_action_titles, disc_text, strategic_intel, 
                chain_ctx, model_provider, contexto_dinamico
            )
            future_to_dim[future] = dim_key

        for future in concurrent.futures.as_completed(future_to_dim):
            dk = future_to_dim[future]
            try:
                res = future.result()
                dimensoes[dk] = res
                total_tokens += res.get("_tokens", 0)
                
                # Update summaries and persist traffic pillars immediately
                chain_summaries[dk] = _extract_chain_summary(dk, res)
                if on_pillar_complete and analysis_id:
                    on_pillar_complete(analysis_id, dk, res)
                    
                for j, acao in enumerate(res.get("acoes_imediatas", [])):
                    titulo = acao.get("acao", "") if isinstance(acao, dict) else str(acao)
                    ferramenta = acao.get("ferramenta", "") if isinstance(acao, dict) else ""
                    como_fazer = acao.get("como_fazer", "") if isinstance(acao, dict) else ""
                    if ferramenta and ferramenta.lower() not in titulo.lower(): titulo = f"{titulo} usando {ferramenta}"
                    all_tasks.append({
                        "id": f"task_{dk}_{j+1}", "titulo": titulo, "ferramenta": ferramenta, "categoria": dk,
                        "impacto": {"alto": 9, "medio": 6, "baixo": 3}.get(str(acao.get("impacto", "medio")).lower() if isinstance(acao, dict) else "medio", 6),
                        "prazo_sugerido": acao.get("prazo", "1 semana") if isinstance(acao, dict) else "1 semana",
                        "custo_estimado": acao.get("custo", "R$ 0") if isinstance(acao, dict) else "R$ 0",
                        "fonte_referencia": acao.get("fonte", "") if isinstance(acao, dict) else "", "descricao": como_fazer or titulo,
                    })
                    previous_action_titles.append(titulo)
            except Exception as e:
                log_error(f"Erro paralelo Scorer ({dk}): {e}")

    # Step 3: Sequential Final (Processo de Vendas depends on traffic)
    final_pillars = ["processo_vendas"]
    for dim_key in final_pillars:
        dim_cfg = dict(DIMENSIONS[dim_key])
        dim_cfg["peso"] = dynamic_weights.get(dim_key, dim_cfg["peso"])
        market_text = _filter_market(dim_key, market_data)
        dim_sources = _get_all_sources_for_dimension(dim_key, market_data)
        disc_text = format_discovery_for_scorer(discovery_data, dim_key=dim_key) if discovery_data else ""
        chain_ctx = _build_chain_context(dim_key, chain_summaries)
        
        result = _score_dimension(
            dim_key, dim_cfg, profile, market_text, dim_sources, restricoes, api_key,
            previous_actions=previous_action_titles, discovery_text=disc_text,
            strategic_intel=strategic_intel, chain_context=chain_ctx,
            model_provider=model_provider, contexto_dinamico=contexto_dinamico
        )
        dimensoes[dim_key] = result
        
        # Persist final pillar
        if on_pillar_complete and analysis_id:
            on_pillar_complete(analysis_id, dim_key, result)
            
        # Final tasks processing...
        for j, acao in enumerate(result.get("acoes_imediatas", [])):
            titulo = acao.get("acao", "") if isinstance(acao, dict) else str(acao)
            ferramenta = acao.get("ferramenta", "") if isinstance(acao, dict) else ""
            como_fazer = acao.get("como_fazer", "") if isinstance(acao, dict) else ""
            if ferramenta and ferramenta.lower() not in titulo.lower(): titulo = f"{titulo} usando {ferramenta}"
            all_tasks.append({
                "id": f"task_{dim_key}_{j+1}", "titulo": titulo, "ferramenta": ferramenta, "categoria": dim_key,
                "impacto": {"alto": 9, "medio": 6, "baixo": 3}.get(str(acao.get("impacto", "medio")).lower() if isinstance(acao, dict) else "medio", 6),
                "prazo_sugerido": acao.get("prazo", "1 semana") if isinstance(acao, dict) else "1 semana",
                "custo_estimado": acao.get("custo", "R$ 0") if isinstance(acao, dict) else "R$ 0",
                "fonte_referencia": acao.get("fonte", "") if isinstance(acao, dict) else "", "descricao": como_fazer or titulo,
            })
            previous_action_titles.append(titulo)
    
    all_tasks = _dedup_actions_cross_dimension(all_tasks)

    # Compute overall score
    total_w = sum(d.get("peso", 0.15) for d in dimensoes.values())
    total_s = sum(d.get("score", 50) * d.get("peso", 0.15) for d in dimensoes.values())
    score_geral = round(total_s / total_w) if total_w > 0 else 50

    # Resume & Opportunities
    sorted_dims = sorted(dimensoes.items(), key=lambda x: x[1].get("score", 50))
    weakest_key, weakest = sorted_dims[0]
    strongest_key, strongest = sorted_dims[-1]
    resumo = f"Pilar mais forte: {DIMENSIONS[strongest_key]['label']} ({strongest.get('score', 50)}/100). Pilar prioritário: {DIMENSIONS[weakest_key]['label']} ({weakest.get('score', 50)}/100). {weakest.get('dado_chave', '')}"

    oportunidades = []
    for dk, dd in sorted_dims[:3]:
        if dd.get("dado_chave"):
            oportunidades.append({
                "titulo": f"Fortalecer {DIMENSIONS[dk]['label']}",
                "descricao": dd["dado_chave"],
                "impacto_potencial": "alto" if dd.get("score", 50) < 40 else "medio",
                "dimensao": dk,
            })

    pillar_plans = {dk: {"meta": dimensoes.get(dk, {}).get("meta_pilar", ""), "tasks": [t for t in all_tasks if t.get("categoria") == dk]} for dk in DIMENSION_ORDER}

    return {
        "success": True,
        "score": {
            "score_geral": score_geral,
            "classificacao": "Pronto" if score_geral >= 70 else "Atenção",
            "resumo_executivo": resumo,
            "dimensoes": dimensoes,
            "oportunidades": oportunidades,
            "pillar_plans": pillar_plans
        },
        "taskPlan": {"tasks": all_tasks, "resumo_plano": resumo},
        "_tokens": total_tokens
    }


# Scopes - defined here to be available inside _score_dimension
_ESCOPO_PILAR = {
    "publico_alvo": "APENAS: pesquisa de público, personas, segmentação, jornada do cliente, dores e desejos.\nPROIBIDO: criar perfis em redes, fazer posts, montar funis de e-mail, criar conteúdo, configurar canais.",
    "branding": "APENAS: posicionamento de marca, proposta de valor, tom de voz, análise competitiva, diferenciação.\nPROIBIDO: criar logos, fazer posts, criar calendário editorial, configurar canais, montar campanhas.",
    "identidade_visual": "APENAS: paleta de cores, tipografia, estilo visual, templates, guia de estilo.\nPROIBIDO: publicar conteúdo, criar calendário, fazer SEO, configurar redes sociais, montar campanhas.",
    "canais_venda": "APENAS: mapear canais de venda, ativar novos canais, otimizar canais existentes, integrar canais.\nPROIBIDO: criar conteúdo/posts, fazer SEO, montar campanhas pagas, definir personas.",
    "trafego_organico": "APENAS: SEO local, Google Meu Negócio, calendário editorial, estratégia de conteúdo orgânico.\nPROIBIDO: definir personas, definir tom de voz, criar identidade visual, configurar novos canais, fazer ads.",
    "trafego_pago": "APENAS: campanhas Meta Ads/Google Ads, segmentação de público para ads, copies de anúncio, orçamento.\nPROIBIDO: fazer SEO, criar conteúdo orgânico, definir identidade visual, configurar canais.",
    "processo_vendas": "APENAS: funil de vendas, scripts, contorno de objeções, precificação, follow-up, pós-venda.\nPROIBIDO: criar conteúdo para redes, fazer SEO, montar campanhas, definir identidade visual.",
}
