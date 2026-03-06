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


DEPENDENCY_THRESHOLDS = {
    'critical': 25,
    'warning': 45,
}


def check_pillar_dependencies(analysis_id: str, pillar_key: str) -> dict:
    """
    Check if prerequisite pillars are ready for this specialist to work.
    Returns dependency status with actionable messages.
    """
    from app.services.analysis.analyzer_business_scorer import DIMENSIONS

    dim_cfg = DIMENSIONS.get(pillar_key, {})
    upstream = dim_cfg.get("upstream", [])

    if not upstream:
        return {"ready": True, "blockers": [], "warnings": [], "upstream_states": {}}

    blockers = []
    warnings = []
    upstream_states = {}

    for up_key in upstream:
        up_label = DIMENSIONS.get(up_key, {}).get("label", up_key)
        diag = db.get_pillar_diagnostic(analysis_id, up_key)

        if not diag:
            # No diagnostic means analysis hasn't scored this pillar yet
            upstream_states[up_key] = {"score": 0, "status": "sem_dados", "label": up_label}
            continue

        up_score = diag.get("score", 50)
        up_status = diag.get("status", "atencao")
        upstream_states[up_key] = {"score": up_score, "status": up_status, "label": up_label}

        if up_score < DEPENDENCY_THRESHOLDS["critical"]:
            blockers.append({
                "pillar": up_key,
                "label": up_label,
                "score": up_score,
                "message": f"{up_label} está em estado crítico ({up_score}/100). Recomendo trabalhar nele antes."
            })
        elif up_score < DEPENDENCY_THRESHOLDS["warning"]:
            warnings.append({
                "pillar": up_key,
                "label": up_label,
                "score": up_score,
                "message": f"{up_label} precisa de atenção ({up_score}/100). Este pilar pode ser afetado."
            })

    return {
        "ready": len(blockers) == 0,
        "blockers": blockers,
        "warnings": warnings,
        "upstream_states": upstream_states,
    }
