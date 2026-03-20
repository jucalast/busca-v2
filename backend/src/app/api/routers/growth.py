from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from app.core.auth_middleware import get_current_user
import json
from app.services.common import log_info, log_debug, log_error
from app.schemas.requests import (
    ActionProfileRequest, ActionAnalyzeRequest, ActionAssistRequest, 
    ActionChatRequest, ActionDimensionChatRequest, BaseGrowthRequest,
    ActionSpecialistPlanRequest, ActionSpecialistExecuteRequest, 
    ActionExpandSubtasksRequest, ActionAITryUserTaskRequest,
    ActionExecuteAllSubtasksRequest, ActionPollBackgroundStatusRequest,
    ActionRedoSubtasksRequest, ActionRedoTaskRequest, ActionRedoPillarRequest,
    PillarStateRequest, AnalysisTasksRequest, DeleteBusinessRequest, ProductionAgentRequest,
    ActionRegisterRequest, ActionLoginRequest, ActionLogoutRequest, ActionValidateSessionRequest
)
from app.services.core.service_growth import (
    do_profile, do_analyze, do_assist, do_chat, do_dimension_chat,
    do_list_businesses, do_get_business, do_specialist_plan,
    do_specialist_execute, do_expand_subtasks, do_ai_try_user_task,
    do_execute_all_subtasks, do_get_background_status,
    do_redo_subtasks, do_redo_task, do_redo_pillar, do_cancel_task,
    do_pillar_state, do_get_analysis_tasks, do_specialist_tasks, do_specialist_tasks_stream, do_delete_business,
    do_run_production_pillar_agent, do_register, do_login, do_logout, do_validate_session,
    do_get_business_summary, do_get_business_action_plan
)

router = APIRouter()

@router.post("/register")
def register(req: ActionRegisterRequest):
    return do_register(req.model_dump())

@router.post("/login")
def login(req: ActionLoginRequest):
    return do_login(req.model_dump())

@router.post("/logout")
def logout(req: ActionLogoutRequest):
    return do_logout(req.model_dump())

@router.post("/validate-session")
def validate_session(req: ActionValidateSessionRequest):
    return do_validate_session(req.model_dump())

@router.post("/redo-subtasks")
def redo_subtasks(req: ActionRedoSubtasksRequest):
    return do_redo_subtasks(req.model_dump())

@router.post("/redo-task")
def redo_task(req: ActionRedoTaskRequest):
    return do_redo_task(req.model_dump())

@router.post("/cancel-task")
def cancel_task(req: ActionRedoTaskRequest):
    return do_cancel_task(req.model_dump())

@router.post("/redo-pillar")
def redo_pillar(req: ActionRedoPillarRequest):
    return do_redo_pillar(req.model_dump())

@router.post("/profile")
def profile(req: ActionProfileRequest):
    # Log resumido da requisição
    biz_name = req.onboardingData.get("nome_negocio") or req.onboardingData.get("nome", "Desconhecido")
    log_info(f"Requisição de Perfil recebida para: {biz_name}")
    log_debug(f"Router Profile - Dados: {json.dumps(req.model_dump(), ensure_ascii=False)}")
    
    result = do_profile(req.model_dump())
    
    # Log resumido do resultado
    success = result.get("success", False)
    log_info(f"Processamento de Perfil concluído: {'SUCESSO' if success else 'FALHA'}")
    log_debug(f"Router Profile - Resultado: {json.dumps(result, ensure_ascii=False)}")
    
    return result

@router.post("/analyze")
def analyze(req: ActionAnalyzeRequest):
    """Execute complete business analysis pipeline with streaming"""
    return StreamingResponse(
        do_analyze(req.model_dump()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.post("/assist")
def assist(req: ActionAssistRequest):
    return do_assist(req.model_dump())

@router.post("/chat")
def chat(req: ActionChatRequest):
    return StreamingResponse(
        do_chat(req.model_dump()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.post("/dimension-chat")
def dimension_chat(req: ActionDimensionChatRequest):
    return do_dimension_chat(req.model_dump())

@router.post("/list-businesses")
def list_businesses(req: BaseGrowthRequest):
    return do_list_businesses(req.user_id)

@router.post("/get-business-summary")
def get_business_summary(req: BaseGrowthRequest):
    return do_get_business_summary(req.business_id)

@router.post("/get-business-action-plan")
def get_business_action_plan(req: BaseGrowthRequest):
    return do_get_business_action_plan(req.business_id)

@router.post("/get-business")
def get_business(req: BaseGrowthRequest):
    return do_get_business(req.business_id)

@router.post("/specialist-plan")
def specialist_plan(req: ActionSpecialistPlanRequest):
    return do_specialist_plan(req.model_dump())

@router.post("/specialist-execute")
def specialist_execute(req: ActionSpecialistExecuteRequest):
    return do_specialist_execute(req.model_dump())

@router.post("/expand-subtasks")
def expand_subtasks(req: ActionExpandSubtasksRequest):
    return do_expand_subtasks(req.model_dump())

@router.post("/ai-try-user-task")
def ai_try_user_task(req: ActionAITryUserTaskRequest):
    return do_ai_try_user_task(req.model_dump())

@router.post("/execute-all-subtasks")
def execute_all_subtasks(req: ActionExecuteAllSubtasksRequest):
    return do_execute_all_subtasks(req.model_dump())

@router.post("/poll-background-status")
def poll_background_status(req: ActionPollBackgroundStatusRequest):
    return do_get_background_status(req.analysis_id, req.task_id)

@router.post("/pillar-state")
def pillar_state(req: PillarStateRequest):
    return do_pillar_state(req.model_dump())

@router.post("/get-analysis-tasks")
def get_analysis_tasks(req: AnalysisTasksRequest):
    return do_get_analysis_tasks(req.model_dump())

@router.post("/specialist-tasks")
def specialist_tasks(req: AnalysisTasksRequest):
    """Generate specialist tasks with optional streaming."""
    # We always use streaming for specialist tasks now to show progress
    return StreamingResponse(
        do_specialist_tasks_stream(req.model_dump()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.post("/delete-business")
def delete_business(req: DeleteBusinessRequest):
    """Delete a business (soft delete)."""
    return do_delete_business(req.model_dump())

@router.post("/run-production-agent")
def run_production_agent(req: ProductionAgentRequest):
    """Execute production-ready pillar agent with SRE safeguards."""
    return do_run_production_pillar_agent(req.model_dump())

@router.get("/metrics")
def get_dashboard_metrics(current_user: dict = Depends(get_current_user)):
    from app.core import database as db
    import time
    
    # Simple process-level cache (60s)
    global _METRICS_CACHE
    if not hasattr(sys.modules[__name__], '_METRICS_CACHE'):
        setattr(sys.modules[__name__], '_METRICS_CACHE', {"data": None, "ts": 0})
    
    cache = getattr(sys.modules[__name__], '_METRICS_CACHE')
    if time.time() - cache["ts"] < 60 and cache["data"]:
        return cache["data"]

    conn = db.get_connection()
    c = conn.cursor()
    
    try:
        # Unified query for performance
        c.execute("""
            SELECT 
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM businesses) as businesses,
                (SELECT COUNT(*) FROM analyses) as analyses,
                (SELECT COUNT(*) FROM background_tasks WHERE status = 'failed') as failed
        """)
        row = c.fetchone()
        
        result = {
            "success": True,
            "metrics": {
                "total_users": row[0],
                "total_businesses": row[1],
                "total_analyses": row[2],
                "failed_tasks": row[3]
            }
        }
        # Update cache
        cache["data"] = result
        cache["ts"] = time.time()
        return result
    finally:
        conn.close()

@router.get("/usage-metrics")
def get_llm_usage_metrics():
    from app.services.intelligence.usage_tracker import usage_tracker
    usage = usage_tracker.get_current_usage()
    return {
        "success": True,
        "usage": usage
    }

