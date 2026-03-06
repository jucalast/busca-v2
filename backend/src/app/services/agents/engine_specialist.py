"""
Specialist Engine Facade — 7 Professionals, 1 Business.

This file has been refactored into the `engine/` package to establish a clean, domain-driven architecture.
It now acts as a facade, exposing all the necessary functions for backward compatibility.
"""

from app.services.agents.engine import (
    get_dynamic_persona_context,
    get_adapted_specialist_persona,
    generate_business_brief,
    _detect_supply_chain_context,
    brief_to_text,
    build_cross_pillar_context,
    build_execution_context,
    generate_pillar_plan,
    record_action_result,
    get_pillar_full_state,
    get_all_pillars_state,
    check_pillar_dependencies,
    _should_search_for_task,
    _build_smart_search_query,
    _extract_market_for_pillar,
    generate_specialist_tasks,
    _fallback_to_original_generation,
    _classify_task_executability,
    _format_previous_results,
    agent_execute_task,
    expand_task_subtasks,
    ai_try_user_task
)

# Export configuration variables that used to live here
from app.services.agents.pillar_config import SPECIALISTS
