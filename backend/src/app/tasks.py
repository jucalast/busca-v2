import sys
from app.core.worker import celery_app
from app.services.core.service_growth import run_subtasks_background

@celery_app.task(name="run_analysis_subtasks", bind=True)
def run_analysis_subtasks(self, analysis_id: str, pillar_key: str, task_id: str, task_data: dict, profile: dict, model_provider: str):
    """Celery background job wrapper to execute subtasks using distributed load rather than local background tasks."""
    try:
        run_subtasks_background(
            analysis_id=analysis_id,
            pillar_key=pillar_key,
            task_id=task_id,
            task_data=task_data,
            profile=profile,
            model_provider=model_provider
        )
        return {"success": True, "analysis_id": analysis_id, "task_id": task_id}
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Error in Celery task {self.request.id}: {error_msg}", file=sys.stderr)
        return {"success": False, "error": str(e)}
