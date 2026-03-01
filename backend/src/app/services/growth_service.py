import os
import sys

# To handle local imports in NextJS backend pointing to the old directory
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'search_summarizer'))

from app.core import database as db

# Directly expose functions from the existing backend scripts 
from app.services.planning.task_assistant import run_assistant
from app.services.agents.chat_consultant import run_chat
from app.services.planning.macro_planner import generate_macro_plan
from app.services.agents.explore_agent import run_dimension_chat, run_market_search
from app.services.analysis.business_scorer import run_scorer
from app.services.analysis.business_discovery import discover_business
from app.services.analysis.business_profiler import run_profiler
from app.services.agents.specialist_engine import (
    generate_business_brief, 
    generate_pillar_plan,
    get_all_pillars_state,
    record_action_result,
    get_pillar_full_state,
    agent_execute_task,
    expand_task_subtasks,
    ai_try_user_task
)
from app.services.agents.pillar_agent import run_pillar_agent, get_pillar_status
from typing import Dict, Any, List

ACTIVE_BACKGROUND_TASKS = set()

def do_profile(data: dict) -> dict:
    onboarding = data.get("onboardingData", {})
    return run_profiler(onboarding, model_provider=data.get("aiModel", "groq"))

def do_chat(data: dict) -> dict:
    return run_chat(data)

def do_dimension_chat(data: dict) -> dict:
    return run_dimension_chat(data)

def do_assist(data: dict) -> dict:
    task = data.get("task", {})
    profile = data.get("profile", {})
    return run_assistant(task, profile)

def do_list_businesses(user_id: str) -> dict:
    businesses = db.list_user_businesses(user_id)
    # Add latest analysis info to each business
    for biz in businesses:
        latest = db.get_latest_analysis(biz["id"])
        if latest:
            biz["latest_analysis"] = {
                "id": latest["id"],
                "score_geral": latest["score_geral"],
                "classificacao": latest["classificacao"],
                "created_at": latest["created_at"]
            }
    return {"success": True, "businesses": businesses}

def do_get_business(business_id: str) -> dict:
    business = db.get_business(business_id)
    if business:
        latest = db.get_latest_analysis(business_id)
        if latest:
            business["latest_analysis"] = latest
        return {"success": True, "business": business}
    return {"success": False, "error": "Business not found"}

def do_specialist_plan(data: dict) -> dict:
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    return generate_pillar_plan(
        analysis_id, pillar_key, data.get("profile", {}), model_provider=data.get("aiModel", "groq")
    )

def do_specialist_execute(data: dict) -> dict:
    return agent_execute_task(
        analysis_id=data.get("analysis_id"),
        pillar_key=data.get("pillar_key"),
        task_id=data.get("task_id"),
        task_data=data.get("task_data", {}),
        brief=data.get("profile", {}),
        model_provider=data.get("aiModel", "groq")
    )

def do_expand_subtasks(data: dict) -> dict:
    return expand_task_subtasks(
        analysis_id=data.get("analysis_id"),
        pillar_key=data.get("pillar_key"),
        task_data=data.get("task_data", {}),
        brief=data.get("profile", {}),
        model_provider=data.get("aiModel", "groq")
    )

def do_execute_all_subtasks(data: dict, background_tasks) -> dict:
    """Trigger background execution of all subtasks."""
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    task_id = data.get("task_id")
    
    if not analysis_id or not pillar_key or not task_id:
        return {"success": False, "error": "analysis_id, pillar_key, task_id are required"}

    from app.core import database as db

    # CLEANUP OLD EXECUTIONS: Clear any previous subtask executions for this task so the UI doesn't see old data while running
    db.delete_specialist_executions(analysis_id, pillar_key, task_id)

    # Pre-register the task as running synchronously so the frontend's immediate poll doesn't miss it or kill the UI loop
    db.save_background_task_progress(analysis_id, task_id, pillar_key, "running", current_step=0, total_steps=0)
    task_identifier = f"{analysis_id}:{pillar_key}:{task_id}"
    ACTIVE_BACKGROUND_TASKS.add(task_identifier)

    # Start background process
    background_tasks.add_task(
        run_subtasks_background,
        analysis_id=analysis_id,
        pillar_key=pillar_key,
        task_id=task_id,
        task_data=data.get("task_data", {}),
        profile=data.get("profile", {}),
        model_provider=data.get("aiModel", "groq")
    )
    
    return {"success": True, "message": "Background execution started"}

def run_subtasks_background(analysis_id, pillar_key, task_id, task_data, profile, model_provider):
    """The actual sequential execution loop running in background."""
    from app.core import database as db
    
    # Track as an actively running background task
    task_identifier = f"{analysis_id}:{pillar_key}:{task_id}"
    ACTIVE_BACKGROUND_TASKS.add(task_identifier)
    
    def check_cancelled():
        """Helper function to check if task was cancelled"""
        current_status = db.get_background_task_progress(analysis_id, task_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 CANCELLATION DETECTED for task {task_id} in background loop", file=sys.stderr)
            return True
        return False
    
    def check_cancelled_aggressive():
        """More aggressive cancellation check with immediate return"""
        if check_cancelled():
            raise Exception("Task cancelled by user")

    try:
        # Check for cancellation at the very beginning
        if check_cancelled():
            print(f"  🛑 Task {task_id} was cancelled before background execution started.", file=sys.stderr)
            return
        # Step 1: Ensure we have subtasks
        subtasks_dict = db.get_subtasks(analysis_id, pillar_key, task_id)
        if not subtasks_dict or task_id not in subtasks_dict:
            res = expand_task_subtasks(
                analysis_id=analysis_id,
                pillar_key=pillar_key,
                task_data=task_data,
                brief=profile,
                model_provider=model_provider
            )
            if not res or not res.get("success") or not res.get("subtasks"):
                db.save_background_task_progress(analysis_id, task_id, pillar_key, "error", error_message=f"Failed to expand subtasks: {res.get('error') if res else 'No response'}")
                return
            subtasks_list = res["subtasks"].get("subtarefas", [])
        else:
            subtasks_list = subtasks_dict[task_id].get("subtarefas", [])

        total = len(subtasks_list)
        db.save_background_task_progress(analysis_id, task_id, pillar_key, "running", current_step=0, total_steps=total + 1)

        results = []
        # Step 2: Execute each subtask
        for i, st in enumerate(subtasks_list):
            # Check for cancellation before processing each subtask
            check_cancelled_aggressive()

            db.save_background_task_progress(analysis_id, task_id, pillar_key, "running", current_step=i + 1, total_steps=total + 1)
            
            # Use task_id + suffix for subtask storage
            st_id = f"{task_id}_st{i+1}"
            
            # Check for cancellation again before executing the subtask
            check_cancelled_aggressive()
            
            print(f"  🔄 Executing subtask {i+1}/{len(subtasks_list)}: {st.get('titulo', 'No title')[:50]}...", file=sys.stderr)
            
            exec_res = agent_execute_task(
                analysis_id=analysis_id,
                pillar_key=pillar_key,
                task_id=st_id,
                task_data=st,
                brief=profile,
                model_provider=model_provider,
                previous_results=results
            )
            
            # Check if the task was cancelled during execution
            if exec_res and exec_res.get("error") == "Task cancelled by user":
                print(f"  🛑 Task {task_id} was cancelled during subtask {i+1} execution.", file=sys.stderr)
                return
            
            # Aggressive cancellation check after each subtask
            check_cancelled_aggressive()
            
            if exec_res.get("success") and exec_res.get("execution"):
                results.append(exec_res["execution"])
                print(f"  ✅ Subtask {i+1} completed successfully", file=sys.stderr)
            else:
                print(f"  ⚠️ Subtask {i+1} failed or returned no data: {exec_res.get('error')}", file=sys.stderr)
                # We continue but mark step as failed? For now, just continue
                pass

        # Step 3: Create finalization subtask and execute it
        check_cancelled_aggressive()

        # Prepare combined content from all subtasks
        combined_content = ""
        for i, r in enumerate(results):
            if r and isinstance(r, dict):
                titulo = subtasks_list[i].get('titulo', f'Subtarefa {i+1}')
                conteudo = r.get('conteudo', '')
                combined_content += f"## {i+1}. {titulo}\n\n{conteudo}\n\n---\n\n"

        # Create finalization subtask
        finalization_task = {
            "id": f"{task_id}_finalization",
            "titulo": "Finalização do Documento para Entrega",
            "descricao": f"Consolide e finalize o documento completo para entrega: {task_data.get('titulo', 'Tarefa principal')}",
            "entregavel_ia": "Documento Final Consolidado",
            "ferramenta": "editor_final"
        }
        
        # Save the finalization subtask to database for UI visibility
        updated_subtasks = {task_id: {"subtarefas": subtasks_list + [finalization_task]}}
        db.save_subtasks(analysis_id, pillar_key, task_id, updated_subtasks)
        
        # Add the finalization task to the local subtasks list for progress tracking
        subtasks_list.append(finalization_task)
        total_steps = len(subtasks_list)  # Update total to include finalization
        
        # Update progress to show we're working on finalization
        db.save_background_task_progress(analysis_id, task_id, pillar_key, "running", current_step=total, total_steps=total_steps)
        
        print(f"  🔄 Executing finalization subtask: {finalization_task['titulo']}", file=sys.stderr)
        
        # Execute the finalization subtask
        finalization_res = agent_execute_task(
            analysis_id=analysis_id,
            pillar_key=pillar_key,
            task_id=f"{task_id}_finalization",
            task_data=finalization_task,
            brief=profile,
            model_provider=model_provider,
            previous_results=[
                {"titulo": "Conteúdo das Subtarefas", "conteudo": combined_content[:15000]},
                {"titulo": "Resumo das Execuções", "conteudo": f"Resultados de {len(results)} subtarefas executadas com sucesso."}
            ]
        )
        
        # Check for cancellation during finalization
        if finalization_res and finalization_res.get("error") == "Task cancelled by user":
            print(f"  🛑 Task {task_id} was cancelled during finalization.", file=sys.stderr)
            return
        
        # Add finalization result to results
        if finalization_res.get("success") and finalization_res.get("execution"):
            results.append(finalization_res["execution"])
            print(f"  ✅ Finalization subtask completed successfully", file=sys.stderr)
            
            # Save finalization subtask execution result
            db.save_execution_result(
                analysis_id, pillar_key, f"{task_id}_finalization", 
                finalization_task["titulo"],
                status="ai_executed", outcome="Subtarefa Completa",
                result_data=finalization_res["execution"]
            )
        else:
            print(f"  ⚠️ Finalization subtask failed: {finalization_res.get('error')}", file=sys.stderr)
            # Use basic combined content as fallback
            finalization_res = {"execution": {"conteudo": combined_content, "entregavel_titulo": "Documento Consolidado"}}

        # Final full deliverable
        final_content = combined_content
        if finalization_res and finalization_res.get("success") and finalization_res.get("execution"):
            final_content = finalization_res["execution"].get("conteudo", combined_content)
        
        combined_sources = []
        for r in results:
            if r and isinstance(r, dict):
                combined_sources.extend(r.get("sources", []) or r.get("fontes_consultadas", []) or [])
        
        final_deliverable = {
            "id": task_id,
            "entregavel_titulo": task_data.get("entregavel_ia", task_data.get("titulo")),
            "entregavel_tipo": "plano_completo",
            "conteudo": final_content,
            "conteudo_completo": combined_content,
            "fontes_consultadas": list(set(combined_sources)),
            "parts": results
        }
        
        # Save final result
        db.save_execution_result(
            analysis_id, pillar_key, task_id, task_data.get("titulo"),
            status="ai_executed", outcome="Tarefa Completa",
            result_data=final_deliverable
        )

        db.save_background_task_progress(analysis_id, task_id, pillar_key, "done", current_step=total_steps, total_steps=total_steps, result_data=final_deliverable)

    except Exception as e:
        # Check for cancellation exception
        if "Task cancelled by user" in str(e):
            print(f"  🛑 Task {task_id} was cancelled - stopping execution.", file=sys.stderr)
            return
        
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        db.save_background_task_progress(analysis_id, task_id, pillar_key, "error", error_message=error_msg)
    finally:
        task_identifier = f"{analysis_id}:{pillar_key}:{task_id}"
        if task_identifier in ACTIVE_BACKGROUND_TASKS:
            ACTIVE_BACKGROUND_TASKS.remove(task_identifier)

def do_get_background_status(analysis_id: str, task_id: str) -> dict:
    """Get the current progress of a background task."""
    from app.core import database as db
    status = db.get_background_task_progress(analysis_id, task_id)
    if status:
        # Detect ghost "running" states after server restarts
        if status.get("status") == "running":
            task_identifier = f"{analysis_id}:{status['pillar_key']}:{task_id}"
            if task_identifier not in ACTIVE_BACKGROUND_TASKS:
                # Task is marked running in DB but process isn't tracking it
                db.save_background_task_progress(
                    analysis_id, task_id, status["pillar_key"], 
                    "error", error_message="A execução foi interrompida ou o servidor foi reiniciado enquanto a tarefa estava rodando."
                )
                status["status"] = "error"
                status["error_message"] = "A execução foi interrompida ou o servidor foi reiniciado enquanto a tarefa estava rodando."
        
        # Fetch individual subtask results to show live in frontend
        sub_res = db.get_subtask_executions(analysis_id, status["pillar_key"], task_id)
        if sub_res:
            status["subtask_results"] = sub_res
        return {"success": True, "progress": status}
    return {"success": False, "error": "Task not found"}

def do_ai_try_user_task(data: dict) -> dict:
    return ai_try_user_task(
        analysis_id=data.get("analysis_id"),
        pillar_key=data.get("pillar_key"),
        task_id=data.get("task_id"),
        task_data=data.get("task_data", {}),
        brief=data.get("profile", {}),
        model_provider=data.get("aiModel", "groq")
    )

def do_redo_subtasks(data: dict) -> dict:
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    task_id = data.get("task_id")
    
    if not analysis_id or not pillar_key or not task_id:
        return {"success": False, "error": "analysis_id, pillar_key, task_id are required"}

    # Clear subtasks and subtask executions
    db.delete_subtasks(analysis_id, pillar_key, task_id)
    db.delete_specialist_subtasks(analysis_id, pillar_key, task_id)
    db.delete_background_task(analysis_id, pillar_key, task_id)
    db.delete_specialist_executions(analysis_id, pillar_key, task_id)
    db.delete_specialist_results(analysis_id, pillar_key, task_id)
    
    return {"success": True}

def do_cancel_task(data: dict) -> dict:
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    task_id = data.get("task_id")
    
    if not analysis_id or not pillar_key or not task_id:
        return {"success": False, "error": "analysis_id, pillar_key, task_id are required"}

    from app.core import database as db
    
    # Mark the task as cancelled in the database
    print(f"  🛑 CANCELLING TASK: {task_id} for analysis {analysis_id}", file=sys.stderr)
    db.save_background_task_progress(analysis_id, task_id, pillar_key, "cancelled")
    
    # Remove from active background tasks set if present
    task_identifier = f"{analysis_id}:{pillar_key}:{task_id}"
    if task_identifier in ACTIVE_BACKGROUND_TASKS:
        ACTIVE_BACKGROUND_TASKS.remove(task_identifier)
        print(f"  🛑 Removed {task_identifier} from ACTIVE_BACKGROUND_TASKS", file=sys.stderr)
    
    print(f"  🛑 Task {task_id} marked as cancelled by user request.", file=sys.stderr)
    
    return {"success": True, "message": "Task marked as cancelled"}

def do_redo_task(data: dict) -> dict:
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    task_id = data.get("task_id")
    
    if not analysis_id or not pillar_key or not task_id:
        return {"success": False, "error": "analysis_id, pillar_key, task_id are required"}

    # Clear task result, execution, subtasks, and subtask executions
    db.delete_specialist_result(analysis_id, pillar_key, task_id)
    db.delete_specialist_execution(analysis_id, pillar_key, task_id)
    db.delete_subtasks(analysis_id, pillar_key, task_id)
    db.delete_specialist_subtasks(analysis_id, pillar_key, task_id)
    db.delete_background_task(analysis_id, pillar_key, task_id)
    db.delete_specialist_executions(analysis_id, pillar_key, task_id)
    db.delete_specialist_results(analysis_id, pillar_key, task_id)
    
    return {"success": True}

def do_redo_pillar(data: dict) -> dict:
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    
    if not analysis_id or not pillar_key:
        return {"success": False, "error": "analysis_id and pillar_key are required"}

    db.delete_pillar_data(analysis_id, pillar_key)
    return {"success": True}

def do_analyze(data: dict) -> dict:
    # Note: Analyze is complex because it can stream SSE.
    # In FastAPI, we will handle this via StreamingResponse.
    pass
