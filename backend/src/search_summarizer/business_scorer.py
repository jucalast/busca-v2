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
from business_discovery import format_discovery_for_scorer
import re
import sys
import time
try:
    from .llm_router import call_llm
except ImportError:
    from llm_router import call_llm
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
        print(f"    ⚠️ No market data matched for {dim_key} (available: {available_ids})", file=sys.stderr)
        return ""

    matched_ids = [cat.get("id", "") for cat in relevant]
    matched_scores = [s for s, _ in scored[:3]]
    print(f"    📊 Market match for {dim_key}: {list(zip(matched_ids, matched_scores))}", file=sys.stderr)

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
    
    canais_raw_val = perfil.get("canais_venda", "")
    if isinstance(canais_raw_val, list):
        canais_raw = ", ".join(str(c) for c in canais_raw_val).lower()
    else:
        canais_raw = str(canais_raw_val).lower()
    
    if dim_key == "publico_alvo":
        if has("cliente_ideal", "publico_alvo"): score += 30
        if has("segmento"): score += 15
        if has("localizacao"): score += 10
        if has("maior_objecao"): score += 10
        if has("origem_clientes"): score += 15
        if has("modelo", "modelo_negocio"): score += 10
        
    elif dim_key == "branding":
        if has("diferencial"): score += 30
        if has("concorrentes"): score += 20
        if has("segmento"): score += 10
        if has("maior_objecao"): score += 10
        if has("objetivos"): score += 10
        
    elif dim_key == "identidade_visual":
        if "instagram" in canais_raw: score += 20
        if "site" in canais_raw or "loja virtual" in canais_raw: score += 20
        if has("instagram_handle"): score += 15
        if has("site_url"): score += 15
        if has("diferencial"): score += 10
        
    elif dim_key == "canais_venda":
        n_canais = len([c for c in re.split(r"[,|;]", canais_raw) if c.strip()]) if canais_raw else 0
        if n_canais >= 3: score += 30
        elif n_canais >= 2: score += 20
        elif n_canais == 1: score += 10
        has_online = any(x in canais_raw for x in ["instagram", "site", "whatsapp", "marketplace", "ifood", "online", "ecommerce"])
        has_offline = any(x in canais_raw for x in ["loja", "rua", "físic", "boca", "feira"])
        if has_online: score += 15
        if has_offline: score += 10
        if has_online and has_offline: score += 10
        
    elif dim_key == "trafego_organico":
        if "instagram" in canais_raw: score += 15
        if has("instagram_handle"): score += 15
        if "site" in canais_raw or has("site_url"): score += 15
        if has("google_maps_url"): score += 10
        if has("origem_clientes"): score += 10
        if not any(x in canais_raw for x in ["instagram", "site", "facebook", "google"]): score += 5
        
    elif dim_key == "trafego_pago":
        if has("capital_disponivel"): score += 20
        capital_val = str(perfil.get("capital_disponivel", "")).lower()
        if capital_val in ("zero", "baixo", "nenhum", "0"): score += 5
        elif capital_val: score += 15
        if has("faturamento_mensal", "faturamento_faixa"): score += 15
        if has("cliente_ideal", "publico_alvo"): score += 15
        if has("segmento"): score += 10
        
    elif dim_key == "processo_vendas":
        if has("ticket_medio", "ticket_medio_estimado"): score += 20
        if has("margem_lucro"): score += 20
        if has("faturamento_mensal", "faturamento_faixa"): score += 15
        if has("maior_objecao"): score += 15
        if has("modelo_operacional"): score += 10
        if has("origem_clientes"): score += 10
    
    return min(score, 100)


def _build_chain_context(dim_key: str, chain_summaries: dict) -> str:
    """Build compact context from upstream pillars for this dimension.
    Each upstream summary is ~100-150 tokens, keeping total injection small."""
    upstream_keys = DIMENSIONS[dim_key].get("upstream", [])
    if not upstream_keys or not chain_summaries:
        return ""
    
    lines = ["CONTEXTO DOS PILARES ANTERIORES (use para conectar sua análise):"]
    for uk in upstream_keys:
        summary = chain_summaries.get(uk)
        if summary:
            label = DIMENSIONS[uk]["label"]
            lines.append(f"• {label}: {summary}")
    
    return "\n".join(lines) if len(lines) > 1 else ""


def _extract_chain_summary(dim_key: str, result: dict) -> str:
    """Extract a compact summary (~100 tokens) from a scored dimension
    to pass as context to downstream pillars."""
    label = DIMENSIONS[dim_key]["label"]
    score = result.get("score", 50)
    dado_chave = result.get("dado_chave", "")
    justificativa = result.get("justificativa", "")
    
    # Take first sentence of justificativa + dado_chave
    just_short = justificativa.split(".")[0] + "." if justificativa else ""
    
    return f"Score {score}/100. {just_short} {dado_chave}".strip()[:300]


def _score_dimension(dim_key: str, dim_cfg: dict, profile: dict,
                     market_text: str, dim_sources: list,
                     restricoes: dict, api_key: str,
                     previous_actions: list = None,
                     discovery_text: str = "",
                     chain_context: str = "",
                     model_provider: str = "groq") -> dict:
    """Score a single sales pillar with focused, specific analysis.
    Now receives chain_context from upstream pillars for interconnected analysis."""
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
    _cv_raw = perfil.get("canais_venda", "")
    if isinstance(_cv_raw, list):
        canais_raw = ", ".join(str(c) for c in _cv_raw).lower()
    else:
        canais_raw = str(_cv_raw).lower()
    if (canais or canais_raw) and dim_key in ("canais_venda", "trafego_organico"):
        canais_text = ", ".join(canais) if canais else canais_raw
        notes.append(f"JÁ usa: {canais_text}. Sugira OTIMIZAR o que já tem, não criar do zero.")

    restriction_text = "\n".join(f"⚠️ {n}" for n in notes) if notes else ""

    nome = perfil.get('nome', perfil.get('nome_negocio', '?'))
    segmento = perfil.get('segmento', '?')
    _canais_val = perfil.get('canais_venda', '')
    if isinstance(_canais_val, list):
        perfil = dict(perfil)
        perfil['canais_venda'] = ', '.join(str(c) for c in _canais_val)
    
    # Cross-dimension dedup
    dedup_block = ""
    if previous_actions:
        actions_text = "\n".join(f"- {a}" for a in previous_actions[-5:])
        dedup_block = f"\n⛔ NÃO REPETIR: {actions_text}\nGere ações Únicas sobre {dim_cfg['label']}."

    # B2B Specific Context
    b2b_context = ""
    modelo_val = perfil.get('modelo_negocio', perfil.get('modelo', '')).upper()
    seg_val = segmento.upper()
    if "B2B" in modelo_val or "INDUSTRIA" in seg_val or "DISTRIBUIDORA" in seg_val or "ATACADO" in seg_val:
        b2b_context = """
CONTEXTO B2B: Vende para OUTRAS EMPRESAS. Foque em vendas consultivas, LinkedIn, Google Ads, SEO técnico, feiras, e-mail marketing frio, catálogos. Ignore estratégias B2C."""

    # Digital presence context
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
    digital_presence_block = ("\nCANAIS DIGITAIS DO USUÁRIO:\n" + "\n".join(digital_ctx_lines)) if digital_ctx_lines else ""

    # Chain context from upstream pillars
    chain_block = ""
    if chain_context:
        chain_block = f"\n{chain_context[:600]}\n"

    # Compact profile block — only fields relevant to this pillar
    _eq = perfil.get('num_funcionarios', '?')
    _cap = perfil.get('capital_disponivel', '?')
    _dif_val = perfil.get('diferencial', '?')
    _orig = perfil.get('origem_clientes', '?')
    _obj = perfil.get('maior_objecao', '?')
    _cli = perfil.get('cliente_ideal', '?')
    _tick = perfil.get('ticket_medio', perfil.get('ticket_medio_estimado', '?'))

    # Dynamic off-topic guard: extract the business difficulty to explicitly exclude it
    _dificuldade = perfil.get('dificuldades', '')
    off_topic_guard = ""
    if _dificuldade and dim_key not in ("processo_vendas",):
        off_topic_guard = f"\n⚠️ A dificuldade do negócio é \"{_dificuldade}\" — NÃO use isso como tema das ações. Suas ações são EXCLUSIVAMENTE sobre {dim_cfg['label']}."

    # Per-pillar scope boundaries to prevent cross-pillar bleed
    _ESCOPO_PILAR = {
        "publico_alvo": "APENAS: pesquisa de público, personas, segmentação, jornada do cliente, dores e desejos.\nPROIBIDO: criar perfis em redes, fazer posts, montar funis de e-mail, criar conteúdo, configurar canais.",
        "branding": "APENAS: posicionamento de marca, proposta de valor, tom de voz, análise competitiva, diferenciação.\nPROIBIDO: criar logos, fazer posts, criar calendário editorial, configurar canais, montar campanhas.",
        "identidade_visual": "APENAS: paleta de cores, tipografia, estilo visual, templates, guia de estilo.\nPROIBIDO: publicar conteúdo, criar calendário, fazer SEO, configurar redes sociais, montar campanhas.",
        "canais_venda": "APENAS: mapear canais de venda, ativar novos canais, otimizar canais existentes, integrar canais.\nPROIBIDO: criar conteúdo/posts, fazer SEO, montar campanhas pagas, definir personas.",
        "trafego_organico": "APENAS: SEO local, Google Meu Negócio, calendário editorial, estratégia de conteúdo orgânico.\nPROIBIDO: definir personas, definir tom de voz, criar identidade visual, configurar novos canais, fazer ads.",
        "trafego_pago": "APENAS: campanhas Meta Ads/Google Ads, segmentação de público para ads, copies de anúncio, orçamento.\nPROIBIDO: fazer SEO, criar conteúdo orgânico, definir identidade visual, configurar canais.",
        "processo_vendas": "APENAS: funil de vendas, scripts, contorno de objeções, precificação, follow-up, pós-venda.\nPROIBIDO: criar conteúdo para redes, fazer SEO, montar campanhas, definir identidade visual.",
    }
    escopo_text = _ESCOPO_PILAR.get(dim_key, "")

    prompt = f"""Você é consultor especialista EXCLUSIVAMENTE em "{dim_cfg['label']}".

SEU FOCO EXCLUSIVO: {dim_cfg['foco']}{off_topic_guard}
{escopo_text}
Sua análise e TODAS as ações devem ser EXCLUSIVAMENTE sobre {dim_cfg['label']}.

NEGÓCIO: {nome} | {segmento} | {perfil.get('localizacao','?')} | Equipe: {_eq} | Capital: {_cap} | Ticket: {_tick}
Canais: {perfil.get('canais_venda','?')} | Diferencial: {_dif_val} | Origem clientes: {_orig}
Objeção: {_obj} | Cliente ideal: {_cli}{digital_presence_block}
{restriction_text}{b2b_context}{chain_block}
{discovery_text[:1500] if discovery_text.strip() else ""}
MERCADO: {market_text[:1000] if market_text.strip() else "Sem dados."}
{dedup_block}

REGRAS:
1. Score 0-100. Justificativa com DADOS CONCRETOS sobre {dim_cfg['label']}.
2. 3-5 ações ULTRA-ESPECÍFICAS sobre {dim_cfg['label']}, executáveis esta semana.
3. PROIBIDO: "pesquise"/"avalie"/"considere" — dê respostas prontas.
4. meta_pilar = estado IDEAL deste pilar (ex: "Ter 3 canais ativos gerando vendas").
5. NÃO repita a dificuldade do negócio como meta. A meta é sobre {dim_cfg['label']}.

JSON:
{{
    "score": 0-100,
    "status": "critico/atencao/forte",
    "justificativa": "2-3 frases sobre {dim_cfg['label']} com dados concretos",
    "acoes_imediatas": [
        {{"acao": "Ação sobre {dim_cfg['label']}: o que + como + resultado", "impacto": "alto/medio/baixo", "prazo": "1 semana/2 semanas/1 mês", "custo": "R$ 0/até R$ 50/até R$ 100", "fonte": "dado de suporte"}}
    ],
    "fontes_utilizadas": ["URLs reais"],
    "dado_chave": "Achado mais importante sobre {dim_cfg['label']}",
    "meta_pilar": "Estado ideal de {dim_cfg['label']} para {nome} (NÃO sobre logística/custos)"
}}"""

    print(f"    📝 Prompt: {len(prompt)} chars", file=sys.stderr)

    try:
        result = call_llm(provider=model_provider, prompt=prompt)
        # Log raw LLM response keys and action count
        print(f"    📦 LLM retornou: {list(result.keys())} | acoes: {len(result.get('acoes_imediatas', []))}", file=sys.stderr)
        # Ensure expected fields
        result.setdefault("score", 50)
        result.setdefault("status", "atencao")
        result.setdefault("justificativa", "")
        result.setdefault("acoes_imediatas", [])
        result.setdefault("dado_chave", "")
        result.setdefault("meta_pilar", f"Maximizar {dim_cfg['label']} para vender mais")
        
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
        print(f"  ⚠️ Erro no LLM para {dim_key}: {e}. Tentando prompt mínimo...", file=sys.stderr)
        # Retry with a minimal prompt using only profile data (no market/discovery)
        minimal_prompt = f"""Consultor de {dim_cfg['label']}. Analise este pilar para {nome} ({segmento}).

Perfil: Equipe {_eq} | Capital {_cap} | Ticket {_tick} | Canais: {perfil.get('canais_venda','?')} | Cliente ideal: {_cli}
Foco: {dim_cfg['foco']}

Retorne JSON: {{"score": 0-100, "status": "critico/atencao/forte", "justificativa": "2 frases sobre {dim_cfg['label']}", "acoes_imediatas": [{{"acao": "ação sobre {dim_cfg['label']}", "impacto": "alto", "prazo": "1 semana", "custo": "R$ 0", "fonte": "perfil do negócio"}}], "fontes_utilizadas": [], "dado_chave": "dado sobre {dim_cfg['label']}", "meta_pilar": "estado ideal de {dim_cfg['label']} para {nome}"}}"""
        try:
            result = call_llm(provider=model_provider, prompt=minimal_prompt)
            result.setdefault("score", 50)
            result.setdefault("status", "atencao")
            result.setdefault("justificativa", "")
            result.setdefault("acoes_imediatas", [])
            result.setdefault("dado_chave", "")
            result.setdefault("meta_pilar", f"Maximizar {dim_cfg['label']} para vender mais")
            obj_score = _compute_objective_score(dim_key, profile)
            blended = round(result["score"] * 0.6 + obj_score * 0.4)
            result["score"] = blended
            result["_score_llm"] = result["score"]
            result["_score_objetivo"] = obj_score
            result["peso"] = dim_cfg["peso"]
            result["fontes_utilizadas"] = list(dict.fromkeys(result.get("fontes_utilizadas", []) + dim_sources[:5]))
            print(f"  ✅ Retry {dim_key} OK: {blended}/100", file=sys.stderr)
            return result
        except Exception as e2:
            print(f"  ❌ Retry também falhou para {dim_key}: {e2}", file=sys.stderr)
            raise RuntimeError(f"Não foi possível scorar o pilar '{dim_cfg['label']}': {e2}") from e2


def _dedup_actions_cross_dimension(all_tasks: list) -> list:
    """Remove tasks that are too similar across dimensions.
    Uses word overlap (Jaccard) + substring containment to detect near-duplicates."""
    if len(all_tasks) <= 1:
        return all_tasks
    
    def normalize(text):
        return set(re.sub(r"[^a-záàâãéèêíìîóòôõúùûç\s]", "", text.lower()).split())
    
    def normalize_str(text):
        return re.sub(r"[^a-záàâãéèêíìîóòôõúùûç\s]", "", text.lower()).strip()
    
    deduped = []
    seen_word_sets = []
    seen_normalized_strs = []
    
    for task in all_tasks:
        title_words = normalize(task.get("titulo", ""))
        title_norm = normalize_str(task.get("titulo", ""))
        if not title_words:
            deduped.append(task)
            continue
        
        is_duplicate = False
        for i, seen in enumerate(seen_word_sets):
            # Jaccard similarity (lowered threshold to catch more duplicates)
            intersection = len(title_words & seen)
            union = len(title_words | seen)
            if union > 0 and intersection / union > 0.6:
                is_duplicate = True
                break
            
            # Substring containment: if one action's core text is inside another
            seen_str = seen_normalized_strs[i]
            shorter, longer = (title_norm, seen_str) if len(title_norm) <= len(seen_str) else (seen_str, title_norm)
            if len(shorter) > 20 and shorter in longer:
                is_duplicate = True
                break
        
        if not is_duplicate:
            deduped.append(task)
            seen_word_sets.append(title_words)
            seen_normalized_strs.append(title_norm)
        else:
            print(f"    🗑️ Dedup removeu [{task.get('categoria','')}]: {task.get('titulo','')[:60]}", file=sys.stderr)
    
    removed = len(all_tasks) - len(deduped)
    if removed > 0:
        # Log kept tasks per dimension
        from collections import Counter
        kept_per_dim = Counter(t.get("categoria", "") for t in deduped)
        print(f"  🔄 Dedup: {removed} removidas de {len(all_tasks)} | Mantidas: {dict(kept_per_dim)}", file=sys.stderr)
    return deduped


def run_scorer(profile: dict, market_data: dict, discovery_data: dict = None, model_provider: str = "groq") -> dict:
    """
    Main entry point. Scores each of 7 sales pillars in chain order.
    Returns score data AND per-pillar task plans.
    
    Chain context: each pillar produces a compact summary that feeds
    into downstream pillars, creating interconnected analysis.
    """
    # Check for appropriate API key based on provider
    if model_provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"success": False, "erro": "Chave da API Gemini não configurada."}
    else:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return {"success": False, "erro": "Chave da API Groq não configurada."}

    restricoes = extract_restrictions(profile)
    dimensoes = {}
    all_tasks = []
    previous_action_titles = []
    chain_summaries = {}  # compact summaries for chain context

    n_pillars = len(DIMENSION_ORDER)
    print(f"📊 Calculando score por pilar de vendas ({n_pillars} pilares)...", file=sys.stderr)

    for i, dim_key in enumerate(DIMENSION_ORDER):
        dim_cfg = DIMENSIONS[dim_key]
        print(f"  [{i+1}/{n_pillars}] {dim_cfg['label']}...", file=sys.stderr)

        market_text = _filter_market(dim_key, market_data)
        dim_sources = _get_all_sources_for_dimension(dim_key, market_data)

        disc_text = ""
        if discovery_data and discovery_data.get("found"):
            disc_text = format_discovery_for_scorer(discovery_data, dim_key=dim_key)
            if disc_text:
                print(f"    📋 Discovery: {len(disc_text)} chars", file=sys.stderr)

        # Build chain context from upstream pillars
        chain_ctx = _build_chain_context(dim_key, chain_summaries)
        if chain_ctx:
            print(f"    🔗 Chain context de: {', '.join(DIMENSIONS[dim_key]['upstream'])}", file=sys.stderr)

        result = _score_dimension(
            dim_key, dim_cfg, profile, market_text, dim_sources, restricoes, api_key,
            previous_actions=previous_action_titles,
            discovery_text=disc_text,
            chain_context=chain_ctx,
            model_provider=model_provider
        )
        dimensoes[dim_key] = result

        # Extract chain summary for downstream pillars
        chain_summaries[dim_key] = _extract_chain_summary(dim_key, result)

        # Convert acoes to flat task list and track for dedup
        for j, acao in enumerate(result.get("acoes_imediatas", [])):
            if isinstance(acao, dict):
                titulo = acao.get("acao", "")
                descricao = acao.get("descricao", "") or acao.get("resultado", "") or ""
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
                    "descricao": descricao,
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
        acoes = result.get("acoes_imediatas", [])
        meta = result.get("meta_pilar", "")
        print(f"    → {s}/100 | {len(acoes)} ações | Meta: {meta[:60]}", file=sys.stderr)
        for ai, a in enumerate(acoes[:5]):
            a_title = a.get("acao", a) if isinstance(a, dict) else str(a)
            print(f"      [{ai+1}] {str(a_title)[:70]}", file=sys.stderr)

        # Delay between calls to stay within rate limits
        if i < n_pillars - 1:
            time.sleep(3)
    
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
        classificacao = "Pronto pra Vender"
    elif score_geral >= 55:
        classificacao = "Em Construção"
    elif score_geral >= 40:
        classificacao = "Precisa de Atenção"
    else:
        classificacao = "Urgente"

    # ── Executive summary from pillar data ──
    sorted_dims = sorted(dimensoes.items(), key=lambda x: x[1].get("score", 50))
    weakest_key, weakest = sorted_dims[0]
    strongest_key, strongest = sorted_dims[-1]

    resumo = (
        f"Pilar mais forte: {DIMENSIONS[strongest_key]['label']} ({strongest.get('score', 50)}/100). "
        f"Pilar prioritário: {DIMENSIONS[weakest_key]['label']} ({weakest.get('score', 50)}/100). "
        f"{weakest.get('dado_chave', '')}"
    )

    # ── Opportunities from weakest pillars ──
    oportunidades = []
    for dk, dd in sorted_dims[:3]:
        if dd.get("dado_chave"):
            oportunidades.append({
                "titulo": f"Fortalecer {DIMENSIONS[dk]['label']}",
                "descricao": dd["dado_chave"],
                "impacto_potencial": "alto" if dd.get("score", 50) < 40 else "medio",
                "dimensao": dk,
            })

    # ── Per-pillar plans (each dimension's actions = its plan) ──
    pillar_plans = {}
    for dk in DIMENSION_ORDER:
        dd = dimensoes.get(dk, {})
        pillar_plans[dk] = {
            "meta": dd.get("meta_pilar", f"Maximizar {DIMENSIONS[dk]['label']}"),
            "tasks": [t for t in all_tasks if t.get("categoria") == dk],
            "upstream": DIMENSIONS[dk].get("upstream", []),
        }

    score_output = {
        "score_geral": score_geral,
        "classificacao": classificacao,
        "resumo_executivo": resumo,
        "dimensoes": dimensoes,
        "oportunidades": oportunidades,
        "pillar_plans": pillar_plans,
    }

    task_plan = {
        "tasks": all_tasks,
        "resumo_plano": resumo,
        "meta_principal": f"Priorizar {DIMENSIONS[weakest_key]['label']} para destravar vendas",
    }

    print(f"  ✅ Score geral: {score_geral}/100 ({classificacao})", file=sys.stderr)

    return {
        "success": True,
        "score": score_output,
        "taskPlan": task_plan,
    }
