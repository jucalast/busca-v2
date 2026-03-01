from fastapi import APIRouter, BackgroundTasks
from app.schemas.requests import (
    ActionProfileRequest, ActionAnalyzeRequest, ActionAssistRequest, 
    ActionChatRequest, ActionDimensionChatRequest, BaseGrowthRequest,
    ActionSpecialistPlanRequest, ActionSpecialistExecuteRequest, 
    ActionExpandSubtasksRequest, ActionAITryUserTaskRequest,
    ActionExecuteAllSubtasksRequest, ActionPollBackgroundStatusRequest,
    ActionRedoSubtasksRequest, ActionRedoTaskRequest, ActionRedoPillarRequest
)
from app.services.growth_service import (
    do_profile, do_analyze, do_assist, do_chat, do_dimension_chat,
    do_list_businesses, do_get_business, do_specialist_plan,
    do_specialist_execute, do_expand_subtasks, do_ai_try_user_task,
    do_execute_all_subtasks, do_get_background_status,
    do_redo_subtasks, do_redo_task, do_redo_pillar, do_cancel_task
)

router = APIRouter()

@router.post("/redo-subtasks")
def redo_subtasks(req: ActionRedoSubtasksRequest):
    return do_redo_subtasks(req.dict())

@router.post("/redo-task")
def redo_task(req: ActionRedoTaskRequest):
    return do_redo_task(req.dict())

@router.post("/cancel-task")
def cancel_task(req: ActionRedoTaskRequest):
    return do_cancel_task(req.dict())

@router.post("/redo-pillar")
def redo_pillar(req: ActionRedoPillarRequest):
    return do_redo_pillar(req.dict())

@router.post("/profile")
def profile(req: ActionProfileRequest):
    return do_profile(req.dict())

# Placeholder for Analyze (needs streaming response)
@router.post("/analyze")
def analyze(req: ActionAnalyzeRequest):
    return {"message": "analyze endpoint placeholder"}

@router.post("/assist")
def assist(req: ActionAssistRequest):
    return do_assist(req.dict())

@router.post("/chat")
def chat(req: ActionChatRequest):
    return do_chat(req.dict())

@router.post("/dimension-chat")
def dimension_chat(req: ActionDimensionChatRequest):
    return do_dimension_chat(req.dict())

@router.post("/list-businesses")
def list_businesses(req: BaseGrowthRequest):
    return do_list_businesses(req.user_id)

@router.post("/get-business")
def get_business(req: BaseGrowthRequest):
    return do_get_business(req.business_id)

@router.post("/specialist-plan")
def specialist_plan(req: ActionSpecialistPlanRequest):
    return do_specialist_plan(req.dict())

@router.post("/specialist-execute")
def specialist_execute(req: ActionSpecialistExecuteRequest):
    return do_specialist_execute(req.dict())

@router.post("/expand-subtasks")
def expand_subtasks(req: ActionExpandSubtasksRequest):
    return do_expand_subtasks(req.dict())

@router.post("/ai-try-user-task")
def ai_try_user_task(req: ActionAITryUserTaskRequest):
    return do_ai_try_user_task(req.dict())

@router.post("/execute-all-subtasks")
def execute_all_subtasks(req: ActionExecuteAllSubtasksRequest, background_tasks: BackgroundTasks):
    return do_execute_all_subtasks(req.dict(), background_tasks)

@router.post("/poll-background-status")
def poll_background_status(req: ActionPollBackgroundStatusRequest):
    return do_get_background_status(req.analysis_id, req.task_id)

# More actions following the orchestrator patterns can be registered here:
# /create-business, /save-analysis, /register, /login, /logout, etc.
