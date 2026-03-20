import sys
from app.core.worker import celery_app
from app.services.core.service_growth import run_subtasks_background

@celery_app.task(name="run_analysis_subtasks", bind=True)
def run_analysis_subtasks(self, analysis_id: str, pillar_key: str, task_id: str, task_data: dict, profile: dict, model_provider: str):
    """Celery background job wrapper to execute subtasks using distributed load rather than local background tasks."""
    try:
        # Check for cancellation before starting
        from app.core import database as db
        current_status = db.get_background_task_progress(analysis_id, task_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 Celery task {task_id} was cancelled before execution", file=sys.stderr)
            return {"success": False, "error": "Task cancelled by user", "cancelled": True}
        
        run_subtasks_background(
            analysis_id=analysis_id,
            pillar_key=pillar_key,
            task_id=task_id,
            task_data=task_data,
            profile=profile,
            model_provider=model_provider
        )
        
        # Check if task was cancelled during execution
        current_status = db.get_background_task_progress(analysis_id, task_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 Celery task {task_id} completed but was cancelled during execution", file=sys.stderr)
            return {"success": False, "error": "Task cancelled by user", "cancelled": True}
        
        return {"success": True, "analysis_id": analysis_id, "task_id": task_id}
    except Exception as e:
        # Check if exception is due to cancellation
        if "Task cancelled by user" in str(e):
            print(f"  🛑 Celery task {task_id} cancelled via exception", file=sys.stderr)
            return {"success": False, "error": "Task cancelled by user", "cancelled": True}
        
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Error in Celery task {self.request.id}: {error_msg}", file=sys.stderr)
        return {"success": False, "error": str(e)}
