from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
import psycopg2
import psycopg2.extras
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
    ActionRegisterRequest, ActionLoginRequest, ActionLogoutRequest, ActionValidateSessionRequest,
    ActionCheckExecutionStatusRequest
)
from app.services.core.service_growth import (
    do_profile, do_analyze, do_assist, do_chat, do_dimension_chat,
    do_list_businesses, do_get_business, do_specialist_plan,
    do_specialist_execute, do_specialist_execute_stream, do_expand_subtasks, do_ai_try_user_task,
    do_execute_all_subtasks, do_get_background_status,
    do_redo_subtasks, do_redo_task, do_redo_pillar, do_cancel_task, do_clear_task_status,
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

@router.post("/clear-task-status")
def clear_task_status(req: ActionRedoTaskRequest):
    return do_clear_task_status(req.model_dump())

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

@router.post("/specialist-execute-stream")
def specialist_execute_stream(req: ActionSpecialistExecuteRequest):
    """Execute a single specialist task with streaming updates."""
    return StreamingResponse(
        do_specialist_execute_stream(req.model_dump()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.post("/expand-subtasks")
def expand_subtasks(req: ActionExpandSubtasksRequest):
    return do_expand_subtasks(req.model_dump())

@router.post("/ai-try-user-task")
def ai_try_user_task(req: ActionAITryUserTaskRequest):
    return do_ai_try_user_task(req.model_dump())

@router.post("/ai-try-user-task-stream")
def ai_try_user_task_stream(req: ActionAITryUserTaskRequest):
    """Try a custom user task with streaming updates."""
    return StreamingResponse(
        do_specialist_execute_stream(req.model_dump(), is_user_task=True),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.post("/execute-all-subtasks")
def execute_all_subtasks(req: ActionExecuteAllSubtasksRequest):
    return do_execute_all_subtasks(req.model_dump())

@router.post("/poll-background-status")
def poll_background_status(req: ActionPollBackgroundStatusRequest):
    return do_get_background_status(req.analysis_id, req.task_id)

@router.post("/clear-task-status")
def clear_task_status(req: ActionPollBackgroundStatusRequest):
    return do_clear_task_status(req.model_dump())

@router.get("/task-events/{task_id}")
async def task_events_stream(task_id: str):
    """
    Subscreve-se aos eventos de uma tarefa no Redis e os envia via SSE para o Frontend.
    Canal: task_updates:{task_id}
    """
    import asyncio
    import redis.asyncio as async_redis
    
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    channel = f"task_updates:{task_id}"
    
    async def event_generator():
        # Conexão assíncrona com Redis para não bloquear o loop de eventos
        client = async_redis.from_url(redis_url)
        pubsub = client.pubsub()
        await pubsub.subscribe(channel)
        
        try:
            # Evento inicial para confirmar conexão
            yield f"data: {json.dumps({'type': 'connected', 'task_id': task_id})}\n\n"
            
            while True:
                # Espera por mensagens do canal
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30.0)
                if message is not None:
                    data = message['data']
                    if isinstance(data, bytes):
                        data = data.decode('utf-8')
                    yield f"data: {data}\n\n"
                
                # Heartbeat opcional ou apenas sleep curto
                await asyncio.sleep(0.1)
        except Exception as e:
            print(f"  ⚠️ SSE Task Stream Error ({task_id}): {e}", file=sys.stderr)
        finally:
            # Cleanup rigoroso
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
                await client.close()
            except:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        }
    )

@router.post("/check-execution-status")
def check_execution_status(req: ActionCheckExecutionStatusRequest):
    """Checks if there's any active background task for this analysis."""
    from app.core import database as db
    # Check all background tasks for this analysis
    conn = db.get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    cursor.execute('SELECT status FROM background_tasks WHERE analysis_id = %s', (req.analysis_id,))
    rows = cursor.fetchall()
    conn.close()
    
    # If any task is 'running' or 'started', then we have an active execution
    has_active = any(row['status'] in ['running', 'started', 'processing'] for row in rows)
    return {"success": True, "hasActiveExecution": has_active}

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

