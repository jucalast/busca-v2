"""
Specialist Engine — 7 Professionals, 1 Business.

Each of the 7 sales pillars is treated as an independent specialist professional
who diagnoses, plans, executes, and measures results.

Architecture: Token-Efficient Layered Context
─────────────────────────────────────────────
Layer 0: Compact Business Brief (CBB)  ~300 tokens — generated once, shared by all
Layer 1: Market Intel Digest           ~200 tokens — compressed from research
Layer 2: Digital Footprint             ~150 tokens — from discovery
Layer 3: Pillar States                 ~100 tokens each — from diagnosis
Layer 4: Cross-Pillar Insights         ~50 tokens each — only upstream
Layer 5: Execution History             ~100 tokens — what was done + results

Total per specialist call: ~800-1200 tokens context (very efficient!)

Key Innovation: "Resultado = Novo Dado"
After execution, results become NEW DATA that feeds back into the business profile.
"""

# ═══════════════════════════════════════════════════════════════════
# IMPORTS CENTRALIZADOS (ANTES: 5 imports duplicados)
# ═══════════════════════════════════════════════════════════════════

from app.services.common import (
    json, sys, os, time,  # Python basics
    call_llm,            # LLM
    db,                  # Database
    log_info, log_error, log_warning, log_success, log_debug,  # Logging
    safe_json_dumps, safe_json_loads,  # Serialization
    CommonConfig,    # Config
    get_timestamp, format_duration, safe_get, retry_with_delay  # Utils
)

# ═══════════════════════════════════════════════════════════════════
# SPECIALIST PERSONAS — imported from pillar_config.py
# ═══════════════════════════════════════════════════════════════════
from app.services.agents.pillar_config import (
    _SPECIALISTS_BY_MODEL,
    _detect_business_model,
    get_specialist,
    _get_specialist_from_brief,
    SPECIALISTS,
)


# ═══════════════════════════════════════════════════════════════════

from typing import Dict, List, Any, Optional
from app.core.prompt_loader import get_engine_prompt
import copy, concurrent.futures


def _should_search_for_task(task_title: str, task_desc: str, market_context: str) -> bool:
    """
    Intelligent decision: when to search for specific task data.
    Combines context length with task specificity analysis.
    """
    # Rule 1: Always search if context is thin (original logic)
    if len(market_context) < 500:
        return True
    
    # Rule 2: Search for specific task types that need fresh data
    specific_keywords = [
        "pesquisar", "analisar", "benchmark", "concorrência", "tendências",
        "estatísticas", "dados", "mercado", "estudo", "pesquisa de mercado",
        "análise competitiva", "oportunidades", "cenário", "perfil", "persona"
    ]
    
    title_lower = task_title.lower()
    desc_lower = task_desc.lower()
    
    # Check if task contains specific research keywords
    for keyword in specific_keywords:
        if keyword in title_lower or keyword in desc_lower:
            return True
    
    # Rule 3: Search for tasks mentioning specific industries, tools, or methodologies
    industry_keywords = [
        "indústria", "setor", "segmento", "nichos", "público-alvo",
        "ferramentas", "plataformas", "software", "tecnologia", "métodos"
    ]
    
    for keyword in industry_keywords:
        if keyword in title_lower or keyword in desc_lower:
            return True
    
    # Rule 4: Search for tasks asking for current/trending information
    time_keywords = [
        "2025", "atual", "recente", "tendências", "futuro", "próximos",
        "hoje", "agora", "moderno", "inovação"
    ]
    
    for keyword in time_keywords:
        if keyword in title_lower or keyword in desc_lower:
            return True
    
    return False


def _build_smart_search_query(task_title: str, task_desc: str, segmento: str, pillar_key: str) -> str:
    """
    Builds intelligent search queries based on task characteristics.
    Focuses on the SUBJECT of the task + business segment, NOT generic action verbs.
    """
    # Remove action verbs and stop words to focus on the actual subject
    stop_words = {
        "o", "a", "os", "as", "de", "do", "da", "dos", "das", "em", "para",
        "com", "sem", "um", "uma", "que", "por", "no", "na", "nos", "nas",
        "ao", "à", "pelo", "pela", "se", "e", "ou", "mas", "como",
        "criar", "desenvolver", "implementar", "definir", "analisar",
        "pesquisar", "coletar", "identificar", "elaborar", "estabelecer",
        "mapear", "levantar", "realizar", "executar", "gerar", "produzir",
    }
    
    all_text = f"{task_title} {task_desc}".lower()
    words = all_text.split()
    keywords = []
    seen = set()
    for w in words:
        if w not in stop_words and len(w) > 2 and w not in seen:
            seen.add(w)
            keywords.append(w)
    
    # Build contextual query based on pillar
    pillar_contexts = {
        "publico_alvo": "público-alvo persona comprador",
        "branding": "branding marca posicionamento",
        "identidade_visual": "identidade visual design",
        "canais_venda": "canais vendas e-commerce",
        "trafego_organico": "SEO tráfego orgânico conteúdo",
        "trafego_pago": "anúncios tráfego pago",
        "processo_vendas": "processo vendas funil",
    }
    
    pillar_term = pillar_contexts.get(pillar_key, "").split()[0] if pillar_key in pillar_contexts else ""
    
    # Assemble: segmento + subject keywords + pillar context + year
    parts = []
    if segmento:
        parts.append(segmento)
    parts.extend(keywords[:4])
    if pillar_term and pillar_term not in seen:
        parts.append(pillar_term)
    parts.append("2025")
    
    return " ".join(parts)


def _extract_market_for_pillar(pillar_key: str, market_data: dict) -> str:
    """Extract relevant market research data for a specific pillar.
    Reuses the same relevance scoring as the scorer to ensure consistency."""
    if not market_data:
        return ""
    
    # Robustness: handle cases where market_data might be passed as a string
    import json
    if isinstance(market_data, str):
        try:
            market_data = json.loads(market_data)
        except (json.JSONDecodeError, TypeError):
            return ""

    if not isinstance(market_data, dict):
        return ""

    categories = market_data.get("categories", [])
    if not categories:
        return ""

    from app.services.analysis.analyzer_business_scorer import _score_category_relevance

    scored = []
    for cat in categories:
        rel_score = _score_category_relevance(pillar_key, cat)
        if rel_score >= 10:  # Lower threshold than scorer — we want more context
            scored.append((rel_score, cat))

    scored.sort(key=lambda x: x[0], reverse=True)
    relevant = [cat for _, cat in scored[:3]]

    if not relevant:
        return ""

    text = ""
    for cat in relevant:
        resumo = cat.get("resumo", {})
        fontes = cat.get("fontes", [])
        text += f"\n── {cat.get('nome', '')} ──\n"
        if isinstance(resumo, dict):
            if resumo.get("visao_geral"):
                text += f"{resumo['visao_geral']}\n"
            for p in (resumo.get("pontos_chave") or [])[:5]:
                pt = p if isinstance(p, str) else str(p)
                text += f"• {pt}\n"
            for r in (resumo.get("recomendacoes") or [])[:4]:
                rt = r if isinstance(r, str) else str(r)
                text += f"→ {rt}\n"
            dados = resumo.get("dados_relevantes", {})
            if isinstance(dados, dict):
                for k, v in list(dados.items())[:5]:
                    text += f"  {k}: {v}\n"
        if fontes:
            text += f"Fontes: {', '.join(str(f) for f in fontes[:3])}\n"

    return text[:4000]
