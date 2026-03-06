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


def record_action_result(
    analysis_id: str,
    pillar_key: str,
    task_id: str,
    action_title: str,
    outcome: str,
    business_impact: str = "",
) -> dict:
    """
    Record the result of a completed action.
    This creates NEW business data that feeds back into future specialist analysis.
    """
    # Save the result
    result = db.save_execution_result(
        analysis_id, pillar_key, task_id, action_title,
        status="completed", outcome=outcome, business_impact=business_impact
    )

    # Auto-generate KPI if impact is quantifiable
    if business_impact:
        db.save_pillar_kpi(
            analysis_id, pillar_key,
            kpi_name=f"resultado_{task_id}",
            kpi_value=business_impact,
            kpi_target=""
        )

    return {"success": True, "result": result}


def get_pillar_full_state(analysis_id: str, pillar_key: str) -> dict:
    """
    Get the complete current state of a pillar:
    diagnostic + plan + execution results + KPIs + dependencies.
    This is the full picture of WHERE the business IS for this pillar.
    """
    diagnostic = db.get_pillar_diagnostic(analysis_id, pillar_key)
    plan = db.get_pillar_plan(analysis_id, pillar_key)
    results = db.get_pillar_results(analysis_id, pillar_key)
    kpis = db.get_pillar_kpis(analysis_id, pillar_key)

    # Calculate execution progress
    total_actions = 0
    completed_actions = 0
    if plan and plan.get("plan_data"):
        acoes = plan["plan_data"].get("acoes", [])
        total_actions = len(acoes)
    if results:
        completed_actions = len([r for r in results if r["status"] == "completed"])

    # Check dependencies
    deps = check_pillar_dependencies(analysis_id, pillar_key)

    return {
        "pillar_key": pillar_key,
        "diagnostic": diagnostic,
        "plan": plan,
        "results": results,
        "kpis": kpis,
        "progress": {
            "total": total_actions,
            "completed": completed_actions,
            "pct": round((completed_actions / total_actions * 100) if total_actions > 0 else 0),
        },
        "dependencies": deps,
    }


def get_all_pillars_state(analysis_id: str) -> dict:
    """Get the state of ALL 7 pillars at once — for the unified dashboard."""
    from app.services.analysis.analyzer_business_scorer import DIMENSIONS, DIMENSION_ORDER

    pillars = {}
    for pk in DIMENSION_ORDER:
        dim_cfg = DIMENSIONS[pk]
        spec = SPECIALISTS.get(pk, {})
        diag = db.get_pillar_diagnostic(analysis_id, pk)
        plan = db.get_pillar_plan(analysis_id, pk)
        results = db.get_pillar_results(analysis_id, pk)

        total = 0
        completed = 0
        ai_tasks = 0
        user_tasks = 0
        if plan and plan.get("plan_data"):
            tarefas = plan["plan_data"].get("tarefas", plan["plan_data"].get("acoes", []))
            total = len(tarefas)
            for t in tarefas:
                if t.get("executavel_por_ia"):
                    ai_tasks += 1
                else:
                    user_tasks += 1
        if results:
            completed = len([r for r in results if r["status"] in ("completed", "ai_executed")])

        deps = check_pillar_dependencies(analysis_id, pk)

        pillars[pk] = {
            "key": pk,
            "label": dim_cfg["label"],
            "ordem": dim_cfg["ordem"],
            "cargo": spec.get("cargo", ""),
            "score": diag.get("score", 0) if diag else 0,
            "status": diag.get("status", "sem_dados") if diag else "sem_dados",
            "has_plan": plan is not None,
            "plan_status": plan.get("status", None) if plan else None,
            "progress": {"total": total, "completed": completed, "ai_tasks": ai_tasks, "user_tasks": user_tasks},
            "dependencies": deps,
            "meta_pilar": diag.get("estado_atual", {}).get("meta_pilar", "") if diag and isinstance(diag.get("estado_atual"), dict) else "",
        }

    return pillars
