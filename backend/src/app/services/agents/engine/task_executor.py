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

# Import context builder functions
from app.services.agents.engine.context_builder import (
    brief_to_text,
    build_execution_context,
    build_cross_pillar_context,
)

# Import market researcher functions
from app.services.agents.engine.market_researcher import (
    _extract_market_for_pillar,
)


# ═══════════════════════════════════════════════════════════════════

from typing import Dict, List, Any, Optional
from app.core.prompt_loader import get_engine_prompt
import copy, concurrent.futures


def _format_previous_results(previous_results: list = None, max_chars_per_item: int = 2500) -> str:
    """Format previous subtask results into context for the next subtask."""
    if not previous_results:
        return ""
    
    text = "═══ RESULTADOS DAS SUBTAREFAS ANTERIORES (USE COMO BASE) ═══\n"
    text += "OBRIGATÓRIO: Use os mesmos dados, nomes, números descritos abaixo. NÃO re-invente.\n\n"
    
    covered_topics = []
    covered_sections = []  # Track specific sections to block
    
    for i, pr in enumerate(previous_results):
        if not pr or not isinstance(pr, dict):
            continue
        titulo = pr.get("titulo", pr.get("entregavel_titulo", f"Subtarefa {i+1}"))
        covered_topics.append(titulo)
        conteudo = pr.get("conteudo", "")
        mode = pr.get("execution_mode", "pesquisa")
        mode_label = "🏭 PRODUZIDO" if mode == "producao" else "📚 PESQUISA"
        if isinstance(conteudo, dict):
            import json
            conteudo = json.dumps(conteudo, ensure_ascii=False)
        if isinstance(conteudo, str):
            # Extract section headers from previous content to block repetition
            import re
            sections = re.findall(r'^#{1,3}\s+(.+)$', conteudo, re.MULTILINE)
            covered_sections.extend(sections[:10])
            if len(conteudo) > max_chars_per_item:
                conteudo = conteudo[:max_chars_per_item] + "..."
        text += f"── Subtarefa {i+1} [{mode_label}]: {titulo} ──\n{conteudo}\n\n"
    
    if covered_topics:
        text += "\n⛔⛔⛔ PROIBIÇÃO ABSOLUTA DE REPETIÇÃO ⛔⛔⛔\n"
        text += "O conteúdo acima JÁ FOI entregue ao cliente. Se você repetir, o cliente recebe documentos IDÊNTICOS (lixo).\n\n"
        text += "Temas JÁ COBERTOS (NÃO repita):\n"
        for t in covered_topics:
            text += f"  ❌ {t}\n"
        if covered_sections:
            text += "\nSeções JÁ ESCRITAS (NÃO recrie essas seções):\n"
            for s in covered_sections[:15]:
                text += f"  ❌ {s}\n"
        text += "\nVocê DEVE produzir conteúdo 100% DIFERENTE:\n"
        text += "  ✅ Seções com títulos DIFERENTES dos listados acima\n"
        text += "  ✅ Análises e dados NOVOS que complementem (não repitam)\n"
        text += "  ✅ Se precisar referenciar algo anterior, cite em 1 linha: 'conforme subtarefa X'\n"
        text += "  ❌ PROIBIDO: copiar mesma estrutura, mesmas listas, mesmas tabelas das subtarefas anteriores\n"
        text += "═══════════════════════════════════════════════════\n\n"
    
    return text


def agent_execute_task(
    analysis_id: str,
    pillar_key: str,
    task_id: str,
    task_data: dict,
    brief: dict,
    all_diagnostics: dict = None,
    market_data: dict = None,
    previous_results: list = None,
    model_provider: str = None,
    monitor_task_id: str = None,
    subtask_index: int = 0,
) -> dict:
    """
    The AI specialist EXECUTES a task — generates the actual deliverable.
    
    This is called when the user approves an AI-executable task.
    The specialist generates the full deliverable (text, strategy, plan, etc.)
    and returns it for user review before marking as complete.
    
    Uses saved market research + targeted RAG search for task-specific details.
    """
    # Check for cancellation at the start
    from app.core import database as db
    from app.core.cancellation_watchdog import CancellationWatchdog
    
    def check_cancelled():
        """Helper function to check if task was cancelled"""
        # Use monitor_task_id if provided (e.g. parent task of subtasks), otherwise fallback to task_id
        check_id = monitor_task_id or task_id
        current_status = db.get_background_task_progress(analysis_id, check_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 CANCELLATION DETECTED for task {check_id}", file=sys.stderr)
            return True
        return False
    
    # Aggressive cancellation check - check every few operations
    def check_cancelled_aggressive():
        """More aggressive cancellation check with immediate return"""
        if check_cancelled():
            raise Exception("Task cancelled by user")
    
    # Ultra-aggressive cancellation check with database polling
    def check_cancelled_ultra():
        """Ultra aggressive cancellation that polls database frequently"""
        # CRÍTICO: Usar monitor_task_id se disponível (é o ID que o usuário cancela no front)
        check_id = monitor_task_id or task_id
        current_status = db.get_background_task_progress(analysis_id, check_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 ULTRA CANCELLATION DETECTED for task {check_id}", file=sys.stderr)
            raise Exception("Task cancelled by user")
    
    # Create watchdog for continuous monitoring
    watchdog = CancellationWatchdog(check_cancelled, interval=0.3)
    
    # Check at the very beginning
    if check_cancelled():
        print(f"  🛑 Task {task_id} was cancelled before execution started.", file=sys.stderr)
        return {"success": False, "error": "Task cancelled by user"}
    
    # Start watchdog for continuous monitoring
    watchdog.start()
    print(f"  🐕 Watchdog started for task {task_id}", file=sys.stderr)
    
    try:
        # Removed GROQ_API_KEY check since call_llm handles keys per provider

        spec = _get_specialist_from_brief(pillar_key, brief)
        if not spec:
            return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

        from app.services.analysis.analyzer_business_scorer import DIMENSIONS
        dim_cfg = DIMENSIONS.get(pillar_key, {})

        # Load market data from DB if not passed
        if not market_data:
            market_data = db.get_analysis_market_data(analysis_id)

        # Build context
        brief_text = brief_to_text(brief)
        cross_pillar = build_cross_pillar_context(analysis_id, pillar_key, all_diagnostics)
        exec_history = build_execution_context(analysis_id, pillar_key)

    # ── Primary: Market research from Phase 1 ──
        market_context = _extract_market_for_pillar(pillar_key, market_data)
        sources = []
        if market_data:
            for cat in market_data.get("categories", []):
                sources.extend(cat.get("fontes", [])[:2])
            sources = list(dict.fromkeys(sources))

        # ── Task-specific RAG search via unified_research (cached) ──
        dna = brief.get("dna", {})
        # Fallback: if brief was passed as raw profile (no dna key), try to extract segmento directly
        if not dna:
            # Unwrap nested profile_data: { "profile": { "perfil": {...} } } → { "perfil": {...} }
            _brief_inner = brief
            if "profile" in _brief_inner and "perfil" not in _brief_inner:
                _brief_inner = _brief_inner["profile"]
            perfil = _brief_inner.get("perfil", _brief_inner)
            dna = {
                "segmento": perfil.get("segmento", ""),
                "nome": perfil.get("nome", perfil.get("nome_negocio", "")),
            }
        task_title = task_data.get("titulo", "")
        segmento = dna.get("segmento", "")

        print(f"  🤖 Agent executing: {task_title[:60]}...", file=sys.stderr)
        
        # Check for cancellation before search
        check_cancelled_ultra()
        
        research = ""
        task_sources = []
        intelligence_tools_used = []
        try:
            from app.services.research.unified_research import research_engine
            research_data = research_engine.search_subtasks(
                task_title=task_title,
                task_desc=task_data.get("descricao", ""),
                pillar_key=pillar_key,
                segmento=segmento,
                task_context=task_data,
                force_refresh=False,
                subtask_index=subtask_index,
                cancellation_check=check_cancelled_ultra
            )
            research = research_data.get("content", "")
            task_sources = research_data.get("sources", [])
            intelligence_tools_used = research_data.get("intelligence_tools_used", [])
            sources.extend(task_sources)
            # Add web_search as tool used (always runs)
            intelligence_tools_used.insert(0, {"tool": "web_search", "status": "success" if task_sources else "no_data", "detail": f"{len(task_sources)} fontes"})
            # Add web_extractor if we got content
            if research:
                intelligence_tools_used.insert(1, {"tool": "web_extractor", "status": "success", "detail": f"{len(research)} chars extraídos"})
            print(f"  📦 Task execute via unified_research: {len(task_sources)} sources | tools: {[t['tool'] for t in intelligence_tools_used]}", file=sys.stderr)
        except Exception as e:
            print(f"  ⚠️ Unified research failed for task exec: {e}", file=sys.stderr)
            intelligence_tools_used.append({"tool": "web_search", "status": "error", "detail": str(e)[:80]})

        # Combine all research with clear structure
        # Finalization tasks get more research context for richer documents
        is_finalization = "finalization" in task_id or "editor_final" in task_data.get("ferramenta", "")
        max_research_chars = 10000 if is_finalization else 5000
        all_research = ""
        if market_context:
            all_research += f"═══ DADOS DE MERCADO DO SETOR ═══\n{market_context[:3000]}\n\n"
        if research:
            all_research += f"═══ DADOS COLETADOS ═══\n"
            all_research += f"{research[:max_research_chars]}\n"
        if not all_research:
            all_research = "Nenhuma pesquisa web disponível. Baseie-se no contexto do negócio fornecido e na sua expertise do setor.\n"

        entregavel = task_data.get("entregavel_ia", task_data.get("descricao", ""))
        restr = brief.get("restricoes", [])
        restr_text = ""
        if "capital_zero" in restr:
            restr_text += "\n⚠️ Capital ZERO: apenas ferramentas gratuitas."
        if "equipe_solo" in restr:
            restr_text += "\n⚠️ Equipe de 1 pessoa."

        # ═══ Load deliverables already produced in this pillar to avoid repetition ═══
        completed_docs_text = ""
        try:
            parent_task = task_id.split("_st")[0] if "_st" in task_id else task_id
            parts = []

            # SOURCE 1: Subtasks already expanded from OTHER parent tasks
            all_pillar_subtasks = db.get_subtasks(analysis_id, pillar_key)
            if all_pillar_subtasks:
                other_subtask_titles = []
                for other_tid, other_data in all_pillar_subtasks.items():
                    if other_tid == parent_task:
                        continue
                    subs = other_data.get("subtarefas", []) if isinstance(other_data, dict) else []
                    for s in subs:
                        t = s.get("titulo", "")
                        if t:
                            other_subtask_titles.append(f"  • {t}")
                if other_subtask_titles:
                    parts.append("Subtarefas de OUTRAS tarefas do pilar:\n" + "\n".join(other_subtask_titles[:10]))

            # SOURCE 2: Documents already executed
            full_execs = db.get_full_executions(analysis_id, pillar_key)
            if full_execs:
                docs = []
                for exec_tid, exec_data in full_execs.items():
                    if exec_tid.startswith(parent_task):
                        continue
                    rd = exec_data.get("result_data", {})
                    if not rd:
                        continue
                    titulo = rd.get("entregavel_titulo", "")
                    conteudo = rd.get("conteudo", "")
                    if titulo or conteudo:
                        snippet = conteudo[:200] + "..." if len(conteudo) > 200 else conteudo
                        docs.append(f"  • {titulo}: {snippet}")
                if docs:
                    parts.append("Documentos já produzidos:\n" + "\n".join(docs[:8]))

            if parts:
                completed_docs_full = "\n\n".join(parts)
                # Prevent this section from exploding the context
                if len(completed_docs_full) > 2500:
                    completed_docs_full = completed_docs_full[:2500] + "\n... (truncado para brevidade)"
                completed_docs_text = "\n═══ DOCUMENTOS E SUBTAREFAS JÁ EXISTENTES (NÃO REPITA) ═══\n" + completed_docs_full + "\n⚠️ NÃO reproduza o conteúdo acima. Produza conteúdo NOVO e DIFERENTE.\n"
        except Exception:
            pass

        # ════════════════════════════════════════════════════════════════
        # TOOL SYSTEM: Try specialized production tool before generic exec
        # ════════════════════════════════════════════════════════════════
        try:
            from app.services.tools.registry import tool_registry
            from app.services.tools.base import ToolContext, ExecutionMode
            
            exec_mode = tool_registry.classify_execution_mode(task_data)
            
            if exec_mode == ExecutionMode.PRODUCAO:
                tool = tool_registry.match_tool(task_data)
                if tool:
                    print(f"  🏭 PRODUCTION MODE: {tool.name} matched for '{task_title[:50]}'", file=sys.stderr)
                    
                    # Build ToolContext with all available data
                    tool_ctx = ToolContext(
                        analysis_id=analysis_id,
                        pillar_key=pillar_key,
                        task_id=task_id,
                        task_data=task_data,
                        business_profile=brief,
                        specialist=spec,
                        research_content=all_research,
                        previous_results=previous_results or [],
                        market_data=market_data or {},
                        cross_pillar_context=cross_pillar,
                        execution_history=exec_history,
                        restrictions=restr_text,
                        all_diagnostics=all_diagnostics or {},
                        dim_label=dim_cfg.get('label', pillar_key),
                        completed_docs_context=completed_docs_text,
                    )
                    
                    # Execute with the matched tool
                    tool_result = tool_registry.execute_with_tool(tool_ctx, model_provider=model_provider)
                    
                    if tool_result and tool_result.success:
                        result = tool_result.to_execution_dict()
                        
                        # Add standard metadata
                        result["task_id"] = task_id
                        result["sources"] = sources
                        result["intelligence_tools_used"] = intelligence_tools_used
                        # Propagate research data so finalization can use it
                        result["_research_context"] = all_research
                        
                        # Save to DB
                        db.save_execution_result(
                            analysis_id, pillar_key, task_id, task_title,
                            status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável produzido"),
                            business_impact=result.get("impacto_estimado", ""),
                            result_data=result
                        )
                        
                        # 🛠️ STRATEGIC FEEDBACK LOOP (NEW)
                        try:
                            from app.services.agents.engine.feedback_loop import extract_strategic_insights, apply_feedback_loop
                            insights = extract_strategic_insights(
                                analysis_id=analysis_id,
                                pillar_key=pillar_key,
                                task_title=task_title,
                                execution_content=result.get("conteudo", ""),
                                current_profile=brief,
                                model_provider=model_provider
                            )
                            if insights:
                                apply_feedback_loop(analysis_id, pillar_key, insights)
                                result["strategic_insights"] = insights
                        except Exception as fe:
                            print(f"  ⚠️ Error in Feedback Loop for Tools (non-fatal): {fe}", file=sys.stderr)

                        print(f"  ✅ PRODUCTION delivered: {result.get('entregavel_titulo', 'OK')} ({tool.name})", file=sys.stderr)
                        watchdog.stop()
                        return {"success": True, "execution": result}
                    else:
                        print(f"  ⚠️ Tool {tool.name} failed, falling back to generic execution", file=sys.stderr)
            else:
                print(f"  📚 RESEARCH MODE: generic execution for '{task_title[:50]}'", file=sys.stderr)
                        
        except Exception as tool_err:
            print(f"  ⚠️ Tool system error (non-fatal, using generic): {tool_err}", file=sys.stderr)

    # Scope boundaries for execution (generic fallback)
        escopo = spec.get("escopo", "")
        nao_fazer = spec.get("nao_fazer", "")

        # ═══ MELHORIA: Contexto ESPECÍFICO da empresa (dados reais) ═══
        empresa_context = ""
        if dna:
            empresa_context = f"""
═══ DADOS ESPECÍFICOS DA EMPRESA (USE OBRIGATORIAMENTE) ═══
Empresa: {dna.get('nome', 'N/A')}
Segmento: {dna.get('segmento', 'N/A')}
Modelo de Negócio: {dna.get('modelo', 'N/A')}
Localização: {dna.get('localizacao', 'N/A')}
Clientes atuais: {dna.get('tipo_cliente', dna.get('cliente_ideal', 'N/A'))}
Concorrentes DIRETOS (mesmos clientes, mesmo produto): {dna.get('concorrentes', 'N/A')}
Fornecedores (matéria-prima/insumos - NÃO são concorrentes): {dna.get('fornecedores', 'N/A')}
Diferencial declarado: {dna.get('diferencial', 'N/A')}
Ticket Médio: {dna.get('ticket_medio', 'N/A')}
Dificuldade principal: {dna.get('dificuldade_principal', 'N/A')}
Objeção mais comum dos clientes: {dna.get('maior_objecao', 'não informada')}
Capacidade produtiva: {dna.get('capacidade_produtiva', 'N/A')}
Região de atendimento: {dna.get('regiao_atendimento', 'N/A')}

⚠️ CRÍTICO: A persona e análise DEVEM referenciar estes dados reais.
NÃO invente nomes de empresas genéricos. USE os concorrentes e fornecedores acima.
"""

        prompt = f"""{spec['persona']}

Cargo: {spec['cargo']}
Pilar: {dim_cfg.get('label', pillar_key)}

═══ SEU ESCOPO ═══
{escopo}
🚫 PROIBIDO: {nao_fazer}

⛔ FRONTEIRAS ENTRE PILARES — NÃO invada escopo de outros pilares:
- Público-Alvo: mapeamento de quem compra, personas, jornada, dores, critérios
- Branding: posicionamento de marca, proposta de valor, diferenciação
- Identidade Visual: cores, tipografia, logo, templates visuais
- Canais de Venda: onde vender, canais de distribuição
- Tráfego Orgânico: SEO, conteúdo, redes sociais
- Tráfego Pago: anúncios pagos, Google/Meta/LinkedIn Ads
- Processo de Vendas: funil de vendas, scripts, fechamento

{empresa_context}

{completed_docs_text}

═══ CONTEXTO DO NEGÓCIO ═══
{brief_text}

{cross_pillar}

{exec_history}
{restr_text}

═══ TAREFA ═══
TAREFA: {task_title}
DESCRIÇÃO: {task_data.get('descricao', '')}
ENTREGÁVEL ESPERADO: {entregavel}

{_format_previous_results(previous_results)}

{all_research}

═══ REGRAS ═══
1. Use os dados coletados como base factual. EXTRAIA e CITE: empresas reais, tendências reais, números reais, dores reais das FONTES pesquisadas.
2. NÃO INVENTE dados. Se os dados estiverem fragmentados, use o que há e complemente com expertise do setor — mas NÃO fabrique nomes de empresas, estatísticas ou tabelas inventadas.
3. PROIBIDO comentar sobre qualidade ou formato dos dados. NUNCA escreva "dados corrompidos", "seção incompleta", "não foi possível extrair" etc.
4. USE resultados das subtarefas anteriores como REFERÊNCIA. NÃO contradiga e NÃO repita o que já foi definido. Se a subtarefa anterior já listou etapas, critérios, concorrentes — REFERENCIE ('conforme mapeado na etapa anterior'), não re-escreva.
5. Ultra-específico para {segmento}. PROIBIDO conteúdo genérico que serve para qualquer setor.
6. CADEIA PRODUTIVA: NÃO confunda FORNECEDORES de matéria-prima com CONCORRENTES. Use APENAS os concorrentes listados nos DADOS DA EMPRESA acima.
7. O campo "conteudo" DEVE conter o ENTREGÁVEL COMPLETO com MÍNIMO 800 palavras. INCORPORE dados da pesquisa NO CORPO do texto.
8. PROIBIDO INVENTAR CONCORRENTES. Use EXCLUSIVAMENTE os concorrentes listados em "DADOS ESPECÍFICOS DA EMPRESA" acima. Se não há concorrentes listados, NÃO crie tabela comparativa inventada.
9. CADA subtarefa produz conteúdo ÚNICO. Se a anterior já fez "Etapas da Jornada" ou "Critérios de Seleção" ou "Análise de Concorrentes", você NÃO recria essas seções. Produza seções NOVAS.
10. "proximos_passos" devem estar DENTRO do escopo deste pilar ({dim_cfg.get('label', pillar_key)}). NÃO recomende ações de outros pilares (marketing digital, conteúdo de valor, LinkedIn, anúncios).

EXECUTE a tarefa AGORA. Produza o ENTREGÁVEL COMPLETO, profissional, específico para {segmento} e pronto para uso.
O "conteudo" deve ser um documento EXTENSO e DETALHADO em markdown com seções (##), dados reais, e recomendações acionáveis.

JSON:
{{
    "entregavel_titulo": "Título do entregável",
    "entregavel_tipo": "texto|estrategia|analise|calendario|script|template|plano",
    "opiniao": "Seu pensamento analítico sobre os dados e o entregável produzido. Tom conversacional natural. CITE SEMPRE dados concretos da pesquisa (empresas, números, tendências reais encontradas). Mínimo 4 linhas. ⛔ ABSOLUTAMENTE PROIBIDO: NÃO escreva NADA sobre qualidade, formato ou ausência de dados ('corrompidos', 'incompletos', 'seção inválida', 'não foi possível extrair', 'baseio-me em minha expertise', 'dados insuficientes'). Se os dados estão fragmentados, use-os e complemente com análise — sem citar essa limitação.",
    "conteudo": "O ENTREGÁVEL COMPLETO em markdown (##seções). MÍNIMO 800 palavras. INCORPORE todos os dados da pesquisa: nomes de empresas, números, tendências, análises. Documento profissional pronto para uso.",
    "como_aplicar": "Instruções de como aplicar este entregável",
    "proximos_passos": "Próximos passos DENTRO DO ESCOPO deste pilar ({dim_cfg.get('label', pillar_key)}). NÃO recomende ações de outros pilares.",
    "fontes_consultadas": ["urls das fontes reais usadas — SOMENTE URLs que aparecem na pesquisa acima"],
    "impacto_estimado": "Impacto esperado no negócio"
}}

Retorne APENAS o JSON."""

        try:
            # DEBUG: Log prompt length and research size
            print(f"  📝 Prompt length: {len(prompt)} chars | Research length: {len(all_research)} chars", file=sys.stderr)
            print(f"  📄 Research preview: {all_research[:300]}...", file=sys.stderr)
            
            # Check for cancellation before LLM call
            check_cancelled_ultra()
            watchdog.check_or_raise()  # Verificação adicional do watchdog
            
            result = call_llm(
                provider=model_provider,
                prompt=prompt,
                temperature=0.4,
                json_mode=True,
                cancellation_check=watchdog.check_or_raise
            )
            
            # Check for cancellation after LLM call
            check_cancelled_ultra()
            watchdog.check_or_raise()
            
            # Handle raw_response fallback (when JSON constraint was relaxed by LLM router)
            if isinstance(result, dict) and "raw_response" in result and not result.get("conteudo"):
                result["conteudo"] = result["raw_response"][:8000]
                result.setdefault("entregavel_titulo", "Resultado gerado")
                result.setdefault("entregavel_tipo", "documento")
            
            # Validate result has minimum required content
            content = result.get("conteudo", "")
            # Normalize content early: LLM sometimes returns dict/list instead of string
            if isinstance(content, dict):
                import json as _json
                content = _json.dumps(content, ensure_ascii=False)
                result["conteudo"] = content
            elif isinstance(content, list):
                content = "\n".join(str(i) for i in content)
                result["conteudo"] = content
            elif not isinstance(content, str):
                content = str(content) if content else ""
                result["conteudo"] = content
            
            content_len = len(content)
            print(f"  📤 Generated content length: {content_len} chars", file=sys.stderr)
            
            # Determine minimum acceptable content length based on task type
            task_tipo = task_data.get("tipo", "").lower()
            has_ferramenta = bool(task_data.get("ferramenta", "").strip())
            is_production_task = task_tipo == "producao" or has_ferramenta or "finalization" in task_id
            min_content_len = 1000 if is_production_task else 300
            
            if content_len < min_content_len:
                print(f"  ⚠️ Content too short ({content_len} chars)! Retrying with explicit length requirement...", file=sys.stderr)
                
                # Check for cancellation before retry
                check_cancelled_ultra()
                
                # Retry with explicit length requirement prepended
                retry_prompt = prompt + "\n\n⚠️ ATENÇÃO: Sua resposta anterior tinha apenas " + str(content_len) + " caracteres. ISSO É INACEITÁVEL. O campo 'conteudo' DEVE ter MÍNIMO 800 palavras com dados reais da pesquisa. Reescreva AGORA com o documento COMPLETO."
                
                # Try with fallback model (don't use prefer_small — it's too weak for complex JSON)
                result = call_llm(
                    provider=model_provider,
                    prompt=retry_prompt,
                    temperature=0.3,
                    json_mode=True,
                    prefer_small=False,
                    cancellation_check=watchdog.check_or_raise
                )
                # Handle raw_response on retry too
                if isinstance(result, dict) and "raw_response" in result and not result.get("conteudo"):
                    result["conteudo"] = result["raw_response"][:8000]
                    result.setdefault("entregavel_titulo", "Resultado gerado")
                content = result.get("conteudo", "")
                if isinstance(content, dict):
                    import json as _json
                    content = _json.dumps(content, ensure_ascii=False)
                    result["conteudo"] = content
                elif isinstance(content, list):
                    content = "\n".join(str(i) for i in content)
                    result["conteudo"] = content
                elif not isinstance(content, str):
                    content = str(content) if content else ""
                    result["conteudo"] = content
                content_len = len(content)
                print(f"  📤 Fallback content length: {content_len} chars", file=sys.stderr)
            
            if content_len < 200:
                # Ensure content is string before slicing
                content_str = str(content) if content is not None else ""
                print(f"  ⚠️ Content seems short! Preview: {content_str[:200]}", file=sys.stderr)

            # Normalizar campos de texto: o LLM às vezes retorna dicts aninhados
            # em vez de strings — convertemos tudo pra garantir serialização correta.
            def _to_str(v):
                if v is None:
                    return ""
                if isinstance(v, str):
                    return v
                if isinstance(v, dict):
                    import json as _json
                    return _json.dumps(v, ensure_ascii=False)
                if isinstance(v, list):
                    return "\n".join(str(i) for i in v)
                return str(v)

            for _field in ("conteudo", "opiniao", "como_aplicar", "proximos_passos",
                           "entregavel_titulo", "entregavel_tipo", "impacto_estimado"):
                if _field in result:
                    result[_field] = _to_str(result[_field])

            # Normalizar fontes_consultadas: garante lista de strings
            if "fontes_consultadas" in result:
                raw_fontes = result["fontes_consultadas"]
                if isinstance(raw_fontes, list):
                    result["fontes_consultadas"] = [
                        f.get("url", f.get("link", str(f))) if isinstance(f, dict) else str(f)
                        for f in raw_fontes if f
                    ]
                elif raw_fontes:
                    result["fontes_consultadas"] = [str(raw_fontes)]
                else:
                    result["fontes_consultadas"] = []

            # Mark as PESQUISA (research/instructional) — PRODUCAO is already set by tool system
            if "execution_mode" not in result:
                result["execution_mode"] = "pesquisa"

            # Add required metadata
            result["task_id"] = task_id
            result["sources"] = sources
            result["intelligence_tools_used"] = intelligence_tools_used
            # Propagate research data so finalization can use it
            result["_research_context"] = all_research

            # Auto-record as executed (pending user confirmation)
            db.save_execution_result(
                analysis_id, pillar_key, task_id, task_title,
                status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável gerado"),
                business_impact=result.get("impacto_estimado", ""),
                result_data=result
            )

            # 🛠️ STRATEGIC FEEDBACK LOOP (NEW)
            try:
                from app.services.agents.engine.feedback_loop import extract_strategic_insights, apply_feedback_loop
                insights = extract_strategic_insights(
                    analysis_id=analysis_id,
                    pillar_key=pillar_key,
                    task_title=task_title,
                    execution_content=result.get("conteudo", ""),
                    current_profile=brief,
                    model_provider=model_provider
                )
                if insights:
                    apply_feedback_loop(analysis_id, pillar_key, insights)
                    result["strategic_insights"] = insights
            except Exception as fe:
                print(f"  ⚠️ Error in Feedback Loop (non-fatal): {fe}", file=sys.stderr)

            print(f"  ✅ Agent delivered: {result.get('entregavel_titulo', 'OK')}", file=sys.stderr)
            return {"success": True, "execution": result}

        except Exception as e:
            error_msg = str(e)
            print(f"  ❌ Agent execution error: {e}", file=sys.stderr)
            
            # Check for cancellation exception
            if "Task cancelled by user" in error_msg:
                print(f"  🛑 Task {task_id} was cancelled during execution.", file=sys.stderr)
                return {"success": False, "error": "Task cancelled by user"}
            
            # Check for rate limit errors
            if any(keyword in error_msg.lower() for keyword in ['rate limit', 'tpd', '429', 'limit exceeded', 'quota']):
                return {
                    "success": False, 
                    "error": f"Rate limit atingido. Tente outro modelo: {error_msg[:200]}"
                }
            
            try:
                result = call_llm(
                    provider=model_provider,
                    prompt=prompt,
                    temperature=0.4,
                    json_mode=True,
                    prefer_small=True,
                    cancellation_check=watchdog.check_or_raise
                )
                result["task_id"] = task_id
                result["sources"] = sources
                db.save_execution_result(
                    analysis_id, pillar_key, task_id, task_title,
                    status="ai_executed", outcome=result.get("entregavel_titulo", "Entregável gerado"),
                    business_impact=result.get("impacto_estimado", ""),
                    result_data=result
                )
                return {"success": True, "execution": result}
            except Exception as e2:
                return {"success": False, "error": f"Erro na execução: {str(e2)[:200]}"}
    
    except Exception as e:
        # Handle any errors from the outer try block
        print(f"  ❌ Outer execution error: {e}", file=sys.stderr)
        return {"success": False, "error": f"Erro geral na execução: {str(e)[:200]}"}
    
    finally:
        # Always stop the watchdog
        watchdog.stop()
        print(f"  🐕 Watchdog stopped for task {task_id}", file=sys.stderr)


def expand_task_subtasks(
    analysis_id: str,
    pillar_key: str,
    task_data: dict,
    brief: dict,
    market_data: dict = None,
    model_provider: str = None,
) -> dict:
    """
    Break a single task into 3-6 concrete subtasks.
    Each subtask is small enough for the AI to execute in one shot.
    This is the 'macro plan' concept applied at task level.
    
    NEW: Uses unified_research for intelligent subtask research.
    """
    from app.core import database as db
    
    def check_cancelled():
        """Helper function to check if task was cancelled"""
        current_status = db.get_background_task_progress(analysis_id, task_data.get("id", ""))
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 CANCELLATION DETECTED during subtask expansion", file=sys.stderr)
            return True
        return False

    if check_cancelled():
        return {"success": False, "error": "Task cancelled by user"}

    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from app.services.analysis.analyzer_business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    # Load market data from DB if not passed
    if not market_data:
        market_data = db.get_analysis_market_data(analysis_id)

    # Extract segmento with fallback for raw profile data
    _dna = brief.get("dna", {})
    if not _dna:
        # Unwrap nested profile_data: { "profile": { "perfil": {...} } } → { "perfil": {...} }
        _brief_unwrapped = brief
        if "profile" in _brief_unwrapped and "perfil" not in _brief_unwrapped:
            _brief_unwrapped = _brief_unwrapped["profile"]
        _perfil = _brief_unwrapped.get("perfil", _brief_unwrapped)
        _dna = {"segmento": _perfil.get("segmento", ""), "nome": _perfil.get("nome", _perfil.get("nome_negocio", ""))}
    _segmento = _dna.get("segmento", "")

    # ── Load sibling tasks from the pillar plan to avoid overlap ──
    sibling_tasks_text = ""
    try:
        plan = db.get_pillar_plan(analysis_id, pillar_key)
        if plan and plan.get("plan_data"):
            plan_data = plan["plan_data"]
            # plan_data may be nested: { "tarefas": [...] } or { pillar_key: { "tarefas": [...] } }
            tarefas = plan_data.get("tarefas", [])
            if not tarefas and isinstance(plan_data, dict):
                for v in plan_data.values():
                    if isinstance(v, dict) and "tarefas" in v:
                        tarefas = v["tarefas"]
                        break
                    elif isinstance(v, list):
                        tarefas = v
                        break
            
            current_id = task_data.get("id", "")
            siblings = []
            current_idx = 0
            for idx, t in enumerate(tarefas, 1):
                t_id = t.get("id", "")
                t_titulo = t.get("titulo", "")
                if t_id == current_id or t_titulo == task_data.get("titulo", ""):
                    current_idx = idx
                else:
                    siblings.append(f"  #{idx}: {t_titulo}")
            
            if siblings:
                sibling_tasks_text = f"""
═══ OUTRAS TAREFAS DO PILAR (JÁ EXISTEM — NÃO REPITA) ═══
Esta é a tarefa #{current_idx} de {len(tarefas)} neste pilar.
As outras tarefas são:
""" + "\n".join(siblings) + """

⚠️ REGRA ANTI-SOBREPOSIÇÃO (CRÍTICO):
As tarefas acima serão executadas SEPARADAMENTE. Suas subtarefas NÃO DEVEM:
- Repetir o escopo das tarefas acima (cada tarefa cuida do SEU tema)
- Criar personas se outra tarefa já é "Criar personas"
- Analisar concorrentes se outra tarefa já é "Analisar concorrentes"
- Pesquisar perfil se outra tarefa já é "Pesquisar perfil"
FOQUE EXCLUSIVAMENTE no escopo desta tarefa: "{task_data.get('titulo', '')}".
"""
    except Exception as e:
        print(f"  ⚠️ Could not load sibling tasks: {e}", file=sys.stderr)

    # ── Load ALREADY COMPLETED deliverables from previous tasks to avoid duplication ──
    completed_deliverables_text = ""
    try:
        # SOURCE 1: Subtasks already EXPANDED (saved but not yet executed) from OTHER tasks
        all_pillar_subtasks = db.get_subtasks(analysis_id, pillar_key)  # all tasks in this pillar
        current_task_id = task_data.get("id", "")
        existing_subtask_titles = []
        if all_pillar_subtasks:
            for other_task_id, other_data in all_pillar_subtasks.items():
                if other_task_id == current_task_id:
                    continue
                subs = other_data.get("subtarefas", []) if isinstance(other_data, dict) else []
                for s in subs:
                    titulo = s.get("titulo", "")
                    entregavel = s.get("entregavel_ia", "")
                    if titulo:
                        existing_subtask_titles.append(f"  • {titulo} → entregável: {entregavel}")

        # SOURCE 2: Deliverables already EXECUTED (produced documents)
        full_execs = db.get_full_executions(analysis_id, pillar_key)
        executed_deliverables = []
        if full_execs:
            for exec_task_id, exec_data in full_execs.items():
                if exec_task_id.startswith(current_task_id):
                    continue
                rd = exec_data.get("result_data", {})
                if not rd:
                    continue
                titulo = rd.get("entregavel_titulo", rd.get("titulo", ""))
                tipo = rd.get("entregavel_tipo", "")
                conteudo = rd.get("conteudo", "")
                if titulo or conteudo:
                    summary = conteudo[:300] + "..." if len(conteudo) > 300 else conteudo
                    executed_deliverables.append(f"  • [{tipo}] {titulo}\n    Resumo: {summary}")

        # Build the anti-duplication context
        parts = []
        if existing_subtask_titles:
            parts.append(f"""═══ SUBTAREFAS JÁ GERADAS EM OUTRAS TAREFAS DESTE PILAR ═══
As seguintes subtarefas JÁ FORAM CRIADAS para outras tarefas deste pilar:
""" + "\n".join(existing_subtask_titles[:15]))

        if executed_deliverables:
            parts.append(f"""═══ DOCUMENTOS JÁ PRODUZIDOS NESTE PILAR ═══
""" + "\n".join(executed_deliverables[:10]))

        if parts:
            completed_deliverables_text = "\n".join(parts) + """

⛔ REGRA ANTI-DUPLICAÇÃO (PRIORIDADE MÁXIMA):
As subtarefas e documentos acima JÁ EXISTEM. Suas novas subtarefas NÃO DEVEM:
- Criar persona se já existe "Criar Persona" acima
- Pesquisar perfil/comportamento se já existe pesquisa similar acima
- Analisar concorrentes se já existe análise acima
- Produzir relatório com o mesmo tema de um documento/subtarefa acima
- Coletar dados que outra subtarefa já coleta ou coletou
CADA subtarefa que você criar deve ser DIFERENTE de TODAS listadas acima.
Se o tema já foi coberto → NÃO CRIE. Foque no que FALTA ser feito.
"""
            print(f"  📋 Anti-duplication: {len(existing_subtask_titles)} existing subtasks + {len(executed_deliverables)} executed deliverables loaded", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️ Could not load previous deliverables: {e}", file=sys.stderr)

    # Use unified research ONLY — no duplicate fallback searches
    try:
        from app.services.research.unified_research import research_engine
        
        research_data = research_engine.search_subtasks(
            task_title=task_data.get("titulo", ""),
            task_desc=task_data.get("descricao", ""),
            pillar_key=pillar_key,
            segmento=_segmento,
            task_context=task_data,
            force_refresh=False,
            subtask_index=0
        )
        
        research_text = research_data.get("content", "")
        research_sources = research_data.get("sources", [])
        
        print(f"  📦 Subtask expansion via unified_research: {len(research_sources)} sources", file=sys.stderr)
        
    except Exception as e:
        print(f"  ⚠️ Unified research failed for subtasks: {e}", file=sys.stderr)
        research_text = ""
        research_sources = []

    brief_text = brief_to_text(brief)
    exec_history = build_execution_context(analysis_id, pillar_key)

    task_title = task_data.get("titulo", "")
    task_desc = task_data.get("descricao", "")
    is_ai = task_data.get("executavel_por_ia", True)

    # Primary: saved market research
    market_context = _extract_market_for_pillar(pillar_key, market_data)
    sources = list(research_sources)  # Start with unified_research sources

    # Combine all research — no additional web search needed
    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO:\n{market_context}\n\n"
    if research_text:
        all_research += f"PESQUISA ESPECIALIZADA:\n{research_text[:3000]}\n"
    if not all_research:
        all_research = "Use seu conhecimento.\n"

    # Scope boundaries from specialist config
    escopo = spec.get("escopo", "")
    nao_fazer = spec.get("nao_fazer", "")

    # Load prompt template from YAML
    template_config = get_engine_prompt("subtask_expansion")
    if template_config:
        prompt = template_config.get("prompt_template", "").format(
            persona=spec['persona'],
            brief_text=brief_text,
            exec_history=exec_history,
            escopo=escopo,
            nao_fazer=nao_fazer,
            sibling_tasks_text=sibling_tasks_text,
            completed_deliverables_text=completed_deliverables_text,
            task_title=task_title,
            task_desc=task_desc,
            entregavel_final=task_data.get('entregavel_ia', 'N/A'),
            all_research=all_research,
            segmento=_segmento,
            task_id=task_data.get("id", "")
        )
    else:
        # Fallback (legacy)
        prompt = f"""{spec['persona']}
... (omitted)
"""

    try:
        from app.core.llm_router import call_llm
        # Check for cancellation before LLM call
        if check_cancelled():
            return {"success": False, "error": "Task cancelled by user"}
            
        result = call_llm(
            provider=model_provider,
            prompt=prompt,
            temperature=0.3,
            json_mode=True
        )
        # Check for cancellation after LLM call
        if check_cancelled():
            return {"success": False, "error": "Task cancelled by user"}
            
        result["sources"] = sources
        
        # Annotate each subtask with its execution mode (pesquisa vs producao)
        # so the frontend can show appropriate badges and the engine can route correctly
        try:
            from app.services.tools.registry import tool_registry
            for st in result.get("subtarefas", []):
                mode = tool_registry.classify_execution_mode(st)
                st["modo_execucao"] = mode.value
        except Exception:
            pass  # Non-critical
        
        # Capture tokens from expansion call
        tokens = getattr(result, "_tokens", 0) if isinstance(result, str) else result.get("_tokens", 0)
        
        return {"success": True, "subtasks": result, "_tokens": tokens}
    except Exception as e:
        print(f"  ❌ Subtask expansion error: {e}", file=sys.stderr)
        return {"success": False, "error": f"Erro ao expandir subtarefas: {str(e)[:200]}"}


def ai_try_user_task(
    analysis_id: str,
    pillar_key: str,
    task_id: str,
    task_data: dict,
    brief: dict,
    all_diagnostics: dict = None,
    market_data: dict = None,
    model_provider: str = None,
) -> dict:
    """
    AI attempts a task that was classified as user-required.
    It generates the best possible deliverable it CAN produce,
    Uses saved market research + targeted RAG search for task-specific details.
    """
    from app.core import database as db
    
    def check_cancelled():
        """Helper function to check if task was cancelled"""
        current_status = db.get_background_task_progress(analysis_id, task_id)
        if current_status and current_status.get("status") == "cancelled":
            print(f"  🛑 CANCELLATION DETECTED for AI user task {task_id}", file=sys.stderr)
            return True
        return False

    if check_cancelled():
        return {"success": False, "error": "Task cancelled by user"}

    spec = SPECIALISTS.get(pillar_key)
    if not spec:
        return {"success": False, "error": f"Unknown pillar: {pillar_key}"}

    from app.services.analysis.analyzer_business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})

    # Load market data from DB if not passed
    if not market_data:
        market_data = db.get_analysis_market_data(analysis_id)

    brief_text = brief_to_text(brief)
    cross_pillar = build_cross_pillar_context(analysis_id, pillar_key, all_diagnostics)

    task_title = task_data.get("titulo", "")
    task_desc = task_data.get("descricao", "")
    instrucoes = task_data.get("instrucoes_usuario", "")

    # Primary: saved market research
    market_context = _extract_market_for_pillar(pillar_key, market_data)
    sources = []
    if market_data:
        for cat in market_data.get("categories", []):
            sources.extend(cat.get("fontes", [])[:2])
        sources = list(dict.fromkeys(sources))

    # Smart task-specific RAG search via unified_research
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")
    
    # Check for cancellation before search
    if check_cancelled():
        return {"success": False, "error": "Task cancelled by user"}

    research = ""
    try:
        from app.services.research.unified_research import research_engine
        research_data = research_engine.search_subtasks(
            task_title=task_title,
            task_desc=task_desc,
            pillar_key=pillar_key,
            segmento=brief.get("dna", {}).get("segmento", brief.get("segmento", "")),
            task_context=task_data,
            subtask_index=0,
            cancellation_check=check_cancelled_ultra
        )
        research = research_data.get("content", "")
        sources.extend(research_data.get("sources", []))
        print(f"  📦 AI user task via unified_research: {len(research_data.get('sources', []))} sources", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️ Unified research failed for AI user task: {e}", file=sys.stderr)

    # Check for cancellation after search
    if check_cancelled():
        return {"success": False, "error": "Task cancelled by user"}

    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO:\n{market_context}\n\n"
    if research:
        all_research += f"PESQUISA ESPECÍFICA:\n{research[:4000]}\n"
    if not all_research:
        all_research = "Use seu conhecimento.\n"

    # Load prompt template from YAML
    template_config = get_engine_prompt("ai_user_task_execution")
    if template_config:
        prompt = template_config.get("prompt_template", "").format(
            persona=spec['persona'],
            brief_text=brief_text,
            cross_pillar=cross_pillar,
            task_title=task_title,
            task_desc=task_desc,
            instrucoes=instrucoes,
            all_research=all_research
        )
    else:
        # Fallback (legacy)
        prompt = f"""{spec['persona']}
... (omitted)
"""

    try:
        # DEBUG: Log prompt length and research size
        print(f"  📝 AI Try Prompt length: {len(prompt)} chars | Research length: {len(all_research)} chars", file=sys.stderr)
        print(f"  📄 AI Try Research preview: {all_research[:300]}...", file=sys.stderr)
        
        # Check for cancellation before LLM call
        if check_cancelled():
            return {"success": False, "error": "Task cancelled by user"}

        from app.core.llm_router import call_llm
        result = call_llm(
            provider=model_provider,
            prompt=prompt,
            temperature=0.4,
            json_mode=True
        )
        # Check for cancellation after LLM call
        if check_cancelled():
            return {"success": False, "error": "Task cancelled by user"}

        result["task_id"] = task_id
        result["sources"] = sources
        result["was_user_task"] = True

        # DEBUG: Log generated content length
        content = result.get("conteudo", "")
        content_len = len(content)
        print(f"  📤 AI Try Generated content length: {content_len} chars", file=sys.stderr)
        if content_len < 200:
            # Ensure content is string before slicing
            content_str = str(content) if content is not None else ""
            print(f"  ⚠️ AI Try Content seems short! Preview: {content_str[:200]}", file=sys.stderr)

        db.save_execution_result(
            analysis_id, pillar_key, task_id, task_title,
            status="ai_partial", outcome=result.get("entregavel_titulo", "IA tentou executar"),
            business_impact=result.get("impacto_estimado", ""),
            result_data=result
        )

        # Also save to specialist_executions for full content
        db.save_execution_result(
            analysis_id, pillar_key, task_id, task_title,
            status="ai_partial", outcome=result.get("entregavel_titulo", "IA tentou executar"),
            business_impact=result.get("impacto_estimado", ""),
            result_data=result
        )

        return {"success": True, "execution": result}

    except Exception as e:
        print(f"  ❌ AI try user task error: {e}", file=sys.stderr)
        return {"success": False, "error": f"Erro: {str(e)[:200]}"}
