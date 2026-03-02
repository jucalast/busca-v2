from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
import json
from app.schemas.requests import (
    ActionProfileRequest, ActionAnalyzeRequest, ActionAssistRequest, 
    ActionChatRequest, ActionDimensionChatRequest, BaseGrowthRequest,
    ActionSpecialistPlanRequest, ActionSpecialistExecuteRequest, 
    ActionExpandSubtasksRequest, ActionAITryUserTaskRequest,
    ActionExecuteAllSubtasksRequest, ActionPollBackgroundStatusRequest,
    ActionRedoSubtasksRequest, ActionRedoTaskRequest, ActionRedoPillarRequest
)
from app.services.core.service_growth import (
    do_profile, do_analyze, do_assist, do_chat, do_dimension_chat,
    do_list_businesses, do_get_business, do_specialist_plan,
    do_specialist_execute, do_expand_subtasks, do_ai_try_user_task,
    do_execute_all_subtasks, do_get_background_status,
    do_redo_subtasks, do_redo_task, do_redo_pillar, do_cancel_task,
    do_pillar_state, do_get_analysis_tasks, do_specialist_tasks, do_delete_business,
    do_run_production_pillar_agent
)

router = APIRouter()

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
    # Debug: log da requisição recebida
    print(f"🔍 Router Profile - Request received:", json.dumps(req.model_dump(), ensure_ascii=False, indent=2))
    
    result = do_profile(req.model_dump())
    
    # Debug: log do resultado
    print(f"🔍 Router Profile - Result:", json.dumps(result, ensure_ascii=False, indent=2))
    
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
    return do_chat(req.model_dump())

@router.post("/dimension-chat")
def dimension_chat(req: ActionDimensionChatRequest):
    return do_dimension_chat(req.model_dump())

@router.post("/list-businesses")
def list_businesses(req: BaseGrowthRequest):
    return do_list_businesses(req.user_id)

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
def execute_all_subtasks(req: ActionExecuteAllSubtasksRequest, background_tasks: BackgroundTasks):
    return do_execute_all_subtasks(req.model_dump(), background_tasks)

@router.post("/poll-background-status")
def poll_background_status(req: ActionPollBackgroundStatusRequest):
    return do_get_background_status(req.analysis_id, req.task_id)

@router.post("/pillar-state")
def pillar_state(req: dict):
    return do_pillar_state(req)

@router.post("/get-analysis-tasks")
def get_analysis_tasks(req: dict):
    return do_get_analysis_tasks(req)

@router.post("/specialist-tasks")
def specialist_tasks(req: dict):
    return do_specialist_tasks(req)

@router.post("/delete-business")
def delete_business(req: dict):
    """Delete a business (soft delete)."""
    return do_delete_business(req)

@router.post("/run-production-agent")
def run_production_agent(req: dict):
    """Execute production-ready pillar agent with SRE safeguards."""
    return do_run_production_pillar_agent(req)

# More actions following the orchestrator patterns can be registered here:
# /create-business, /save-analysis, /register, /login, /logout, etc.
