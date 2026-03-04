# ═══════════════════════════════════════════════════════════════════
# IMPORTS CENTRALIZADOS (ANTES: 4 imports duplicados)
# ═══════════════════════════════════════════════════════════════════

import time
from app.services.common import (
    os, sys,            # Python basics
    datetime,           # Datetime
    db,                 # Database
    log_info, log_error, log_warning, log_success, log_debug, log_research,  # Logging colorido
    safe_json_dumps, safe_json_loads,  # Serialization
    CommonConfig,       # Config
    get_timestamp, format_duration, safe_get  # Utils
)

# To handle local imports in NextJS backend pointing to the old directory
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'search_summarizer'))

# Directly expose functions from the existing backend scripts 
from app.services.planning.task_assistant import run_assistant
from app.services.agents.agent_conversation import run_chat
from app.services.planning.macro_planner import generate_macro_plan
from app.services.agents.agent_explorer import run_dimension_chat, run_market_search
from app.services.analysis.analyzer_business_scorer import run_scorer
from app.services.analysis.analyzer_business_discovery import discover_business
from app.services.analysis.analyzer_business_profiler import run_profiler
from app.services.agents.engine_specialist import (
    generate_business_brief, 
    generate_pillar_plan,
    get_all_pillars_state,
    record_action_result,
    get_pillar_full_state,
    agent_execute_task,
    expand_task_subtasks,
    ai_try_user_task,
    generate_specialist_tasks
)
from app.services.agents.agent_pillar import run_pillar_agent, get_pillar_status
from app.services.agents.agent_pillar_unified import UnifiedPillarAgent
from typing import Dict, Any, List

ACTIVE_BACKGROUND_TASKS = set()

import json

# Minimum fields the profiler MUST have for a useful analysis
_PROFILE_REQUIRED = ['nome_negocio', 'segmento']
# Critical fields — profiler can infer but results degrade significantly without them
_PROFILE_CRITICAL_SOURCES = {
    'modelo': ['modelo', 'modelo_negocio'],
    'localizacao': ['localizacao', 'cidade_estado'],
    'dificuldades': ['dificuldades', 'problemas'],
}


# ═══════════════════════════════════════════════════════════════════
# MELHORIA: Função de deduplicação de conteúdo entre subtarefas
# ═══════════════════════════════════════════════════════════════════

def deduplicate_subtask_results(results: list, subtasks_list: list) -> str:
    """
    Remove conteúdo duplicado entre subtarefas.
    Identifica parágrafos idênticos ou muito similares e mantém apenas a primeira ocorrência.
    Retorna o conteúdo combinado sem duplicações.
    """
    import re
    from difflib import SequenceMatcher
    
    seen_paragraphs = []  # Lista de (texto_normalizado, subtask_index)
    deduplicated_content = ""
    
    def normalize_text(text: str) -> str:
        """Normaliza texto para comparação."""
        # Remove espaços extras, números, e caracteres especiais
        text = re.sub(r'\s+', ' ', text.strip().lower())
        text = re.sub(r'[0-9]+', '', text)  # Remove números
        text = re.sub(r'[^\w\s]', '', text)  # Remove pontuação
        return text
    
    def is_duplicate(para: str, threshold: float = 0.85) -> bool:
        """Verifica se parágrafo é duplicado (similaridade > threshold)."""
        para_norm = normalize_text(para)
        if len(para_norm) < 50:  # Ignora parágrafos muito curtos
            return False
        for seen_norm, _ in seen_paragraphs:
            if SequenceMatcher(None, para_norm, seen_norm).ratio() > threshold:
                return True
        return False
    
    for i, r in enumerate(results):
        if not r or not isinstance(r, dict):
            continue
        
        titulo = subtasks_list[i].get('titulo', f'Subtarefa {i+1}') if i < len(subtasks_list) else f'Subtarefa {i+1}'
        conteudo = r.get('conteudo', '')
        
        if not conteudo:
            continue
        
        # Divide em parágrafos (seções ## ou blocos de texto)
        paragraphs = re.split(r'\n\n+', conteudo)
        filtered_paragraphs = []
        
        for para in paragraphs:
            para_stripped = para.strip()
            if not para_stripped:
                continue
            
            # Mantém headers sempre
            if para_stripped.startswith('#'):
                filtered_paragraphs.append(para)
                continue
            
            # Verifica duplicação
            if not is_duplicate(para_stripped):
                filtered_paragraphs.append(para)
                seen_paragraphs.append((normalize_text(para_stripped), i))
        
        # Reconstrói conteúdo filtrado
        filtered_content = '\n\n'.join(filtered_paragraphs)
        if filtered_content.strip():
            section = f"## {i+1}. {titulo}\n\n{filtered_content}\n\n---\n\n"
            deduplicated_content += section
    
    return deduplicated_content


def do_profile(data: dict) -> dict:
    onboarding = data.get("onboardingData", {})
    
    # Debug: log do perfil recebido
    print(f"🔍 Service Growth - onboarding received:", json.dumps(onboarding, ensure_ascii=False, indent=2))
    
    # Validate minimum fields — profiler cannot produce useful results without these
    perfil_sub = onboarding.get("perfil", {})
    for field in _PROFILE_REQUIRED:
        val = onboarding.get(field) or perfil_sub.get(field)
        if not val:
            return {
                "success": False,
                "erro": f"Campo obrigatório ausente: {field}. Converse mais com o consultor antes de gerar a análise."
            }
    
    # Warn about critical fields but don't block (profiler can infer)
    for label, sources in _PROFILE_CRITICAL_SOURCES.items():
        found = any(onboarding.get(s) or perfil_sub.get(s) for s in sources)
        if not found:
            print(f"⚠️ Campo crítico ausente: {label} — profiler vai tentar inferir", file=sys.stderr)
    
    result = run_profiler(onboarding, model_provider=data.get("aiModel", "groq"))
    
    # Debug: log do resultado
    print(f"🔍 Service Growth - profiler result:", json.dumps(result, ensure_ascii=False, indent=2))
    
    return result

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
    from app.core import database as db

    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    task_data = data.get("task_data", {})
    task_id = task_data.get("id", "")

    result = expand_task_subtasks(
        analysis_id=analysis_id,
        pillar_key=pillar_key,
        task_data=task_data,
        brief=data.get("profile", {}),
        model_provider=data.get("aiModel", "groq")
    )

    # Persiste as subtarefas no banco imediatamente para que o background
    # executor as encontre sem precisar regerar (garantindo consistência com a UI).
    # IMPORTANTE: salva SOMENTE o objeto de subtarefas (não envolve num dict extra),
    # pois get_subtasks já devolve {task_id: <valor salvo>}.
    if result.get("success") and result.get("subtasks") and task_id:
        db.save_subtasks(analysis_id, pillar_key, task_id, result["subtasks"])

    return result

def do_execute_all_subtasks(data: dict, background_tasks) -> dict:
    """Trigger background execution of all subtasks."""
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    task_id = data.get("task_id")
    
    if not analysis_id or not pillar_key or not task_id:
        return {"success": False, "error": "analysis_id, pillar_key, task_id are required"}

    from app.core import database as db

    # PREVENT DUPLICATE EXECUTIONS: If task is already running, don't start another
    task_identifier = f"{analysis_id}:{pillar_key}:{task_id}"
    if task_identifier in ACTIVE_BACKGROUND_TASKS:
        print(f"  ⚠️ Task {task_id} already running, ignoring duplicate execution request.", file=sys.stderr)
        return {"success": True, "message": "Task already running"}

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
    
    # Convert raw profile to proper brief if needed (ensures dna.segmento is always present)
    if profile and "dna" not in profile:
        try:
            profile = generate_business_brief(profile)
            print(f"  📋 Generated business brief from raw profile (segmento: {profile.get('dna', {}).get('segmento', '?')})", file=sys.stderr)
        except Exception as e:
            print(f"  ⚠️ Failed to generate brief from profile: {e}", file=sys.stderr)
    
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
                previous_results=results,
                subtask_index=i
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

        # ═══ MELHORIA: Usar deduplicação antes de combinar conteúdo ═══
        # Aplica deduplicação para remover parágrafos repetidos entre subtarefas
        deduplicated_content = deduplicate_subtask_results(results, subtasks_list)
        print(f"  🧹 Deduplicação aplicada: conteúdo processado", file=sys.stderr)

        # Separate PESQUISA (research context) from PRODUCAO (real deliverables)
        pesquisa_content = ""
        producao_content = ""
        # Collect ALL research data from subtask executions
        accumulated_research = ""
        for i, r in enumerate(results):
            if r and isinstance(r, dict):
                # Já foi processado pela deduplicação, apenas coleta research
                if r.get('execution_mode') == 'producao':
                    producao_content = deduplicated_content  # Usa conteúdo deduplicado
                # Accumulate research context from subtasks
                research_ctx = r.get('_research_context', '')
                if research_ctx and research_ctx not in accumulated_research:
                    accumulated_research += research_ctx + "\n\n"

        # Combined for finalization context; deliverable focuses on production artifacts
        combined_content = ""
        if deduplicated_content:
            combined_content = "# ARTEFATOS PRODUZIDOS (DEDUPLICADOS)\n\n" + deduplicated_content

        # Build rich description for finalization using original task info
        task_titulo = task_data.get('titulo', 'Tarefa principal')
        task_desc = task_data.get('descricao', '')
        task_entregavel = task_data.get('entregavel_ia', task_data.get('entregavel', ''))

        # Create finalization subtask with explicit, detailed instructions
        finalization_task = {
            "id": f"{task_id}_finalization",
            "titulo": f"Produzir Documento Final: {task_titulo}",
            "descricao": (
                f"SINTETIZE e APROFUNDE todos os dados coletados em um DOCUMENTO FINAL PROFISSIONAL para: {task_titulo}. "
                f"Descrição original: {task_desc}. "
                f"INTEGRE os dados de TODAS as subtarefas em uma narrativa coesa. "
                f"NÃO RESUMA superficialmente. APROFUNDE cada ponto com análise crítica. "
                f"CITE dados específicos: nomes de empresas, números, tendências reais, personas já definidas. "
                f"O documento deve ter MÍNIMO 2000 palavras com seções claras (##), dados concretos, "
                f"análises cruzadas entre subtarefas, recomendações ULTRA-ESPECÍFICAS para o negócio."
            ),
            "entregavel_ia": task_entregavel or "Documento Final Consolidado",
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
        print(f"  📊 Finalization input: {len(combined_content)} chars content + {len(accumulated_research)} chars research", file=sys.stderr)

        # Build rich previous_results for finalization:
        # Include subtask content + original research data
        finalization_previous = [
            {"titulo": "Conteúdo das Subtarefas Executadas", "conteudo": combined_content[:28000], "execution_mode": "producao"},
        ]
        # Add accumulated research as separate context item (this is the raw research data
        # that was collected during subtask execution but may not be reflected in short outputs)
        if accumulated_research:
            finalization_previous.append({
                "titulo": "Dados Brutos de Pesquisa Coletados",
                "conteudo": accumulated_research[:20000],
                "execution_mode": "pesquisa"
            })
        
        # Execute the finalization subtask
        finalization_res = agent_execute_task(
            analysis_id=analysis_id,
            pillar_key=pillar_key,
            task_id=f"{task_id}_finalization",
            task_data=finalization_task,
            brief=profile,
            model_provider=model_provider,
            previous_results=finalization_previous
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
            fin_content = finalization_res["execution"].get("conteudo", "")
            # Use finalization content if it's substantial enough (at least 2000 chars or 1/4 of combined)
            min_acceptable = max(2000, len(combined_content) // 4)
            if len(str(fin_content)) > min_acceptable:
                final_content = fin_content
            else:
                print(f"  ⚠️ Finalization content too short ({len(str(fin_content))} chars vs {len(combined_content)} combined). Using combined content.", file=sys.stderr)
                final_content = combined_content
        
        combined_sources = []
        for r in results:
            if r and isinstance(r, dict):
                combined_sources.extend(r.get("sources", []) or r.get("fontes_consultadas", []) or [])
        
        final_deliverable = {
            "id": task_id,
            "entregavel_titulo": task_data.get("entregavel_ia", task_data.get("titulo")),
            "entregavel_tipo": "plano_completo",
            "conteudo": final_content,
            "conteudo_completo": producao_content or combined_content,
            "execution_mode": "producao",
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

def do_analyze(data: dict):
    """
    Execute complete business analysis using Growth Orchestrator
    """
    import json
    import sys
    
    print(f"🚀 Starting analysis using Growth Orchestrator", file=sys.stderr)
    
    def stream_generator():
        try:
            # Helper to flatten nested profile payloads
            def normalize_profile_struct(raw_profile):
                if not isinstance(raw_profile, dict):
                    return raw_profile or {}
                profile_copy = dict(raw_profile)
                # Case 1: payload is { profile: { perfil: {...}, ... } }
                nested_profile = profile_copy.get("profile")
                if isinstance(nested_profile, dict):
                    if isinstance(nested_profile.get("perfil"), dict):
                        for key, value in nested_profile["perfil"].items():
                            if key not in profile_copy:
                                profile_copy[key] = value
                    if isinstance(nested_profile.get("_chat_context"), dict):
                        for key, value in nested_profile["_chat_context"].items():
                            if key not in profile_copy:
                                profile_copy[key] = value
                    for key, value in nested_profile.items():
                        if key not in profile_copy:
                            profile_copy[key] = value
                # Case 2: payload is already { perfil: {...}, restricoes_criticas: {...}, ... }
                direct_perfil = profile_copy.get("perfil")
                if isinstance(direct_perfil, dict):
                    for key, value in direct_perfil.items():
                        if key not in profile_copy:
                            profile_copy[key] = value
                # Case 3: _chat_context directly in payload
                direct_ctx = profile_copy.get("_chat_context")
                if isinstance(direct_ctx, dict):
                    for key, value in direct_ctx.items():
                        if key not in profile_copy:
                            profile_copy[key] = value
                return profile_copy

            # Extract data no início
            user_id = data.get("user_id", "default_user")
            business_id = data.get("business_id")
            analysis_id = data.get("analysis_id")
            profile = normalize_profile_struct(data.get("profile", {}))
            model_provider = data.get("aiModel", "groq")
            region = data.get("region", "br-pt")
            
            # Send initial thought
            yield f"data: {json.dumps({'type': 'thought', 'text': 'Iniciando análise completa do negócio...'})}\n\n"
            
            # Send progress updates
            yield f"data: {json.dumps({'type': 'thought', 'text': 'Pesquisando presença digital do negócio...'})}\n\n"
            yield f"data: {json.dumps({'type': 'thought', 'text': 'Analisando mercado e concorrência...'})}\n\n"
            yield f"data: {json.dumps({'type': 'thought', 'text': 'Calculando score dos 7 pilares de vendas...'})}\n\n"
            
            # Import Growth Orchestrator functions directly
            from app.services.analysis.analyzer_business_profiler import run_profiler, identify_dynamic_categories
            from app.services.analysis.analyzer_business_scorer import run_scorer
            from app.services.analysis.analyzer_business_discovery import discover_business, generate_sales_brief, extract_discovery_gaps
            from app.services.agents.engine_specialist import (
                generate_business_brief, generate_pillar_plan,
                get_all_pillars_state, SPECIALISTS,
            )
            from app.services.core.orchestrator_growth import run_market_search
            
            # Handle nested profile structure (already normalized for first run)

            # Fallback: load enriched profile from previous analyses when IDs are missing
            def _load_previous_profile(existing_analysis_id: str | None) -> None:
                nonlocal profile, analysis_id
                if not existing_analysis_id:
                    return
                try:
                    previous_analysis = db.get_analysis(existing_analysis_id)
                    if previous_analysis and previous_analysis.get("profile_data"):
                        profile = normalize_profile_struct(previous_analysis["profile_data"])
                        print("  ✅ Perfil enriquecido carregado da análise anterior", file=sys.stderr)
                except Exception as e:
                    print(f"  ⚠️ Erro ao carregar perfil anterior ({existing_analysis_id}): {e}", file=sys.stderr)

            # If analysis_id not provided but we have a business_id, reuse the latest analysis automatically
            if not analysis_id and business_id:
                try:
                    latest_analysis = db.get_latest_analysis(business_id)
                    if latest_analysis and latest_analysis.get("profile_data"):
                        analysis_id = latest_analysis["id"]
                        profile = normalize_profile_struct(latest_analysis["profile_data"])
                        print(f"  ♻️ Perfil reutilizado do último analysis_id={analysis_id}", file=sys.stderr)
                except Exception as e:
                    print(f"  ⚠️ Não foi possível carregar a última análise do negócio {business_id}: {e}", file=sys.stderr)

            _load_previous_profile(analysis_id)

            # Profile summary (otimizado)
            nome = profile.get('nome_negocio', profile.get('nome', 'N/A'))
            site = profile.get('site', profile.get('site_url', 'N/A'))
            log_info(f"📋 Perfil: {nome} | Site: {site} | Business ID: {business_id or '(novo)'}")
            
            # Garantir que temos um nome válido para salvar
            if not nome or nome == 'N/A':
                # Tentar extrair de outros campos
                nome = profile.get('perfil', {}).get('nome_negocio', 'Negócio Sem Nome')
                if not nome or nome == 'N/A':
                    nome = profile.get('perfil', {}).get('nome', 'Negócio Sem Nome')
            
            # Salvar nome no profile para uso posterior
            profile['_business_name'] = nome
            
            # Clear existing task data for reanalysis
            if analysis_id:
                try:
                    conn = db.get_connection()
                    conn.execute("DELETE FROM specialist_plans WHERE analysis_id = ?", (analysis_id,))
                    conn.execute("DELETE FROM specialist_executions WHERE analysis_id = ?", (analysis_id,))
                    conn.execute("DELETE FROM specialist_results WHERE analysis_id = ?", (analysis_id,))
                    conn.execute("DELETE FROM specialist_subtasks WHERE analysis_id = ?", (analysis_id,))
                    conn.execute("DELETE FROM pillar_kpis WHERE analysis_id = ?", (analysis_id,))
                    conn.commit()
                    conn.close()
                except Exception as e:
                    print(f"  ⚠️ Clear old data failed (non-blocking): {e}", file=sys.stderr)

            # Step 1: Business Discovery
            log_research("🔍 Executando discovery...")
            discovery_data = discover_business(profile, region, model_provider=model_provider)
            discovery_found = discovery_data.get("found", False)
            log_info(f"🌐 Discovery: {'dados encontrados' if discovery_found else 'sem dados específidos'}")

            # Step 1.5: Extrair gaps do discovery para refinar queries de mercado
            if discovery_found:
                gap_queries = extract_discovery_gaps(discovery_data, profile)
                if gap_queries:
                    existing_queries = profile.get("queries_sugeridas", {})
                    for cat_id, gap_query in gap_queries.items():
                        # gap_query is more specific (from discovery findings), so use it directly
                        existing_queries[cat_id] = gap_query.strip()[:150]
                    profile["queries_sugeridas"] = existing_queries
                    log_info(f"💡 {len(gap_queries)} queries refinadas pelo discovery: {list(gap_queries.keys())}")

            # Step 2: Market search
            try:
                identify_dynamic_categories(profile)
            except Exception:
                pass  # Categorias devem existir mesmo se remap falhar

            log_research("🔍 Pesquisando mercado...")
            cats_for_search = profile.get("categorias_relevantes", profile.get("categories", []))
            
            # Para market search, usar modelo pequeno (Fiat) - só resumir páginas
            market_data = run_market_search(profile, region, model_provider="groq")  # Vai usar prefer_small=True internamente
            mkt_cats = market_data.get('categories', [])
            log_info(f"📊 Mercado: {len(mkt_cats)} categorias pesquisadas")

            # Step 2.5: Sales Intelligence Brief — sintetiza pesquisa em contexto orientado a vendas
            log_info("🧠 Gerando brief de inteligência de vendas...")
            sales_brief = generate_sales_brief(profile, discovery_data, market_data, model_provider)
            if sales_brief:
                profile["_sales_brief"] = sales_brief
                log_success(f"💡 Brief gerado: {len(sales_brief)} chars")
            else:
                log_warning("⚠️ Brief de vendas vazio — scorer usará contexto padrão")

            # Step 3: Scoring otimizado - Usa modelo pesado só para estratégia
            log_info("📈 Calculando scores...")
            
            # Para scoring, usar modelo inteligente (Ferrari)
            score_result = run_scorer(
                profile, 
                market_data, 
                discovery_data=discovery_data, 
                model_provider="groq",  # Usa 70B para estratégia
                generate_tasks=False
            )
            score_data = score_result.get("score", {}) if score_result.get("success") else {}
            task_plan = score_result.get("taskPlan", {})

            # Score summary
            dims = score_data.get("dimensoes", {})
            total_actions = sum(len(d.get("acoes_imediatas", [])) for d in dims.values())
            score_geral = score_data.get('score_geral', 0)
            log_success(f"🎯 Score: {score_geral}/100 | {total_actions} ações geradas")

            # Merge research tasks from chat (if any)
            research_tasks = profile.get("_research_tasks", [])
            if research_tasks:
                for task in research_tasks:
                    pillar_id = task.get("pillar", "geral")
                    if pillar_id not in task_plan:
                        task_plan[pillar_id] = {"acoes_imediatas": []}
                    task_plan[pillar_id]["acoes_imediatas"].append({
                        "titulo": task.get("titulo", "Tarefa de pesquisa"),
                        "descricao": task.get("descricao", ""),
                        "origem": "chat_research"
                    })

            # Step 4: Business brief
            log_info("📝 Gerando briefing...")
            business_brief = generate_business_brief(profile, discovery_data, market_data)

            # Save to database
            if not business_id:
                business_id = f"biz_{user_id}_{int(time.time())}"
            
            if not analysis_id:
                analysis_id = f"analysis_{business_id}_{int(time.time())}"
            
            # Save the business first
            business_name = profile.get('_business_name', profile.get('nome_negocio', profile.get('nome', 'Negócio Sem Nome')))
            try:
                business_result = db.create_business(
                    user_id=user_id,
                    name=business_name,
                    profile_data={
                        "profile": profile,
                        "discovery_data": discovery_data,
                        "created_at": time.time()
                    }
                )
                business_id = business_result.get('id', business_id)
                log_success(f"💾 Negócio salvo: {business_name}")
            except Exception as e:
                log_warning(f"⚠️ Erro ao salvar negócio: {e}")
            
            # Save analysis data
            analysis_record = db.create_analysis(
                business_id=business_id,
                score_data=score_data,
                task_data=task_plan,
                market_data=market_data,
                profile_data=profile,
                discovery_data=None
            )
            analysis_id = analysis_record.get("id", analysis_id)
            
            # Save pillar diagnostics
            if score_data and score_data.get("dimensoes"):
                for pillar_key, pillar_data in score_data["dimensoes"].items():
                    try:
                        diagnostic_data = {
                            "score": pillar_data.get("score", 0),
                            "status": pillar_data.get("status", "unknown"),
                            "justificativa": pillar_data.get("justificativa", ""),
                            "meta_pilar": pillar_data.get("meta_pilar", ""),
                            "acoes_imediatas": pillar_data.get("acoes_imediatas", []),
                            "fontes_utilizadas": pillar_data.get("fontes_utilizadas", []),
                            "dado_chave": pillar_data.get("dado_chave", "")
                        }
                        db.save_pillar_diagnostic(analysis_id, pillar_key, diagnostic_data)
                    except Exception as e:
                        print(f"  ⚠️ Falha ao salvar diagnóstico de {pillar_key}: {e}", file=sys.stderr)
            
            log_success(f"✅ Análise concluída: {analysis_id}")

            # Return final result
            result = {
                "success": True,
                "analysis_id": analysis_id,
                "business_id": business_id,
                "profile": profile,
                "discovery_data": discovery_data,
                "marketData": market_data,
                "score": score_data,
                "specialists": business_brief.get("specialists", {}),
                "taskPlan": task_plan,
                "business_brief": business_brief
            }
            
            # Send completion
            yield f"data: {json.dumps({'type': 'thought', 'text': 'Analise concluída com sucesso!'})}\n\n"
            yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"
                
        except Exception as e:
            import traceback
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            print(f"❌ Error running Growth Orchestrator: {error_msg}", file=sys.stderr)
            yield f"data: {json.dumps({'type': 'thought', 'text': f'Erro crítico: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
    
    return stream_generator()

def do_pillar_state(data: dict) -> dict:
    """Get the complete state of a pillar."""
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    return get_pillar_full_state(analysis_id, pillar_key)

def do_run_production_pillar_agent(data: dict) -> dict:
    """Execute production-ready pillar agent with SRE safeguards."""
    pillar_key = data.get("pillar_key")
    business_id = data.get("business_id")
    profile = data.get("profile", {})
    user_command = data.get("user_command", f"Analyze {pillar_key} pillar")
    
    if not pillar_key or not business_id:
        return {"success": False, "error": "pillar_key and business_id are required"}
    
    try:
        # Initialize production-ready agent
        agent = ProductionReadyPillarAgent(pillar_key)
        
        # Prepare initial state
        initial_state = {
            "pillar_key": pillar_key,
            "business_id": business_id,
            "profile": profile,
            "user_command": user_command,
            "upstream_context": {},
            "status": "initialized",
            "error": None,
            "sources": []
        }
        
        # Execute the production workflow
        result = agent.compiled_graph.invoke(initial_state)
        
        return {
            "success": True,
            "result": result,
            "pillar_key": pillar_key,
            "sre_metrics": result.get("sre_metrics", {}),
            "structured_output": result.get("structured_output", {})
        }
        
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        return {"success": False, "error": error_msg}

def do_get_analysis_tasks(data: dict) -> dict:
    """Get tasks for a specific analysis and pillar."""
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    return get_pillar_full_state(analysis_id, pillar_key)

def do_delete_business(data: dict) -> dict:
    """Delete a business (soft delete)."""
    business_id = data.get("business_id")
    
    if not business_id:
        return {"success": False, "error": "business_id is required"}
    
    try:
        from app.core import database as db
        success = db.delete_business(business_id)
        
        if success:
            return {"success": True, "message": f"Business {business_id} deleted successfully"}
        else:
            return {"success": False, "error": "Failed to delete business"}
            
    except Exception as e:
        return {"success": False, "error": str(e)}

def do_specialist_tasks(data: dict) -> dict:
    """Generate specialist tasks for a pillar."""
    analysis_id = data.get("analysis_id")
    pillar_key = data.get("pillar_key")
    profile = data.get("profile", {})
    
    return generate_specialist_tasks(
        analysis_id=analysis_id,
        pillar_key=pillar_key,
        brief=profile,
        model_provider=data.get("aiModel", "groq")
    )
