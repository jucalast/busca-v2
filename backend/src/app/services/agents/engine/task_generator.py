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


# ═══════════════════════════════════════════════════════════════════

from typing import Dict, List, Any, Optional
from app.core.prompt_loader import get_engine_prompt
import copy, concurrent.futures


def generate_specialist_tasks(
    analysis_id: str,
    pillar_key: str,
    brief: dict,
    diagnostic: dict = None,
    all_diagnostics: dict = None,
    market_data: dict = None,
    model_provider: str = "groq",
) -> dict:
    """
    The specialist creates TASKS for their pillar using context-aware generation.
    
    NEW: Uses context-aware generation based on scores and diagnostics.
    FALLBACK: Maintains backward compatibility with original system.
    """
    print(f"DEBUG: generate_specialist_tasks(analysis_id={analysis_id}, pillar_key={pillar_key})", file=sys.stderr)
    
    # Comprehensive normalization (convert all hyphens to underscores)
    pillar_key = pillar_key.replace("-", "_")

    spec = _get_specialist_from_brief(pillar_key, brief)
    if not spec:
        print(f"DEBUG: Specialist not found for {pillar_key}", file=sys.stderr)
        return {"success": False, "error": f"Pilar desconhecido: {pillar_key}"}

    # Try NEW context-aware generation first
    try:
        from app.services.analysis.generator_task_context_aware import generate_context_aware_tasks, has_context_aware_tasks
        
        # Check if we already have context-aware tasks
        if has_context_aware_tasks(analysis_id, pillar_key):
            print(f"  ✅ Context-aware tasks already exist for {pillar_key}", file=sys.stderr)
            plan = db.get_pillar_plan(analysis_id, pillar_key)
            return {"success": True, "plan": plan}
        
        # Load score data for context-aware generation
        analysis_data = db.get_analysis(analysis_id)
        if not analysis_data:
            print(f"  ⚠️ No analysis data found for {pillar_key}, falling back to original method", file=sys.stderr)
            return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=market_data)
        
        score_data = analysis_data.get("score_data", {})
        discovery_data = analysis_data.get("discovery_data", {})
        analysis_market_data = market_data or analysis_data.get("market_data", {})
        
        if not score_data:
            print(f"  ⚠️ No score data found for {pillar_key}, falling back to original method", file=sys.stderr)
            return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=analysis_market_data)
        
        # Generate context-aware tasks
        print(f"  🎯 Using context-aware generation for {pillar_key}", file=sys.stderr)
        result = generate_context_aware_tasks(
            analysis_id=analysis_id,
            pillar_key=pillar_key,
            profile=brief,
            score_data=score_data,
            market_data=analysis_market_data,
            discovery_data=discovery_data,
            model_provider=model_provider
        )
        
        if result.get("success"):
            print(f"  ✅ Context-aware generation successful for {pillar_key}", file=sys.stderr)
            return result
        else:
            print(f"  ⚠️ Context-aware generation failed for {pillar_key}: {result.get('error')}", file=sys.stderr)
            return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=analysis_market_data)
            
    except ImportError as e:
        print(f"  ⚠️ Context-aware module not available for {pillar_key}: {e}", file=sys.stderr)
        return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=market_data)
    except Exception as e:
        print(f"  ❌ Context-aware generation error for {pillar_key}: {e}", file=sys.stderr)
        return _fallback_to_original_generation(analysis_id, pillar_key, brief, model_provider, market_data=market_data)


def _fallback_to_original_generation(
    analysis_id: str,
    pillar_key: str,
    brief: dict,
    model_provider: str,
    market_data: dict | None = None,
) -> dict:
    """Fallback to original generation method for backward compatibility."""
    print(f"  🔄 Using original generation method for {pillar_key}", file=sys.stderr)
    
    from app.services.analysis.analyzer_business_scorer import DIMENSIONS
    dim_cfg = DIMENSIONS.get(pillar_key, {})
    spec = _get_specialist_from_brief(pillar_key, brief)
    if not spec:
        return {"success": False, "error": f"Especialista desconhecido: {pillar_key}"}

    # Load all diagnostics for cross-pillar context
    all_diags_list = db.get_all_diagnostics(analysis_id)
    all_diagnostics = {d["pillar_key"].replace("-", "_"): d for d in all_diags_list}
    print(f"DEBUG: Found {len(all_diagnostics)} diagnostics for analysis {analysis_id}", file=sys.stderr)
    print(f"DEBUG: Available diagnostics: {list(all_diagnostics.keys())}", file=sys.stderr)
    print(f"DEBUG: Looking for pillar: {pillar_key}", file=sys.stderr)
    
    # Load diagnostic for this pillar
    diagnostic = db.get_pillar_diagnostic(analysis_id, pillar_key)
    print(f"DEBUG: Direct diagnostic lookup result: {diagnostic is not None}", file=sys.stderr)
    
    if not diagnostic:
        print(f"DEBUG: Attempting to find diagnostic with different key formats...", file=sys.stderr)
        # Try different key formats
        alternative_keys = [
            pillar_key,
            pillar_key.replace("_", "-"),
            pillar_key.replace("-", "_")
        ]
        for alt_key in alternative_keys:
            if alt_key in all_diagnostics:
                print(f"DEBUG: Found diagnostic with alternative key: {alt_key}", file=sys.stderr)
                diagnostic = all_diagnostics[alt_key]
                break
        
        if not diagnostic:
            print(f"DEBUG: No diagnostic found for any key format", file=sys.stderr)
            # Last resort: reconstruct from analysis score_data
            analysis_record = db.get_analysis(analysis_id)
            if analysis_record and analysis_record.get("score_data", {}).get("dimensoes", {}).get(pillar_key):
                pd = analysis_record["score_data"]["dimensoes"][pillar_key]
                diagnostic = {
                    "score": pd.get("score", 0),
                    "status": pd.get("status", "unknown"),
                    "justificativa": pd.get("justificativa", ""),
                    "estado_atual": {"justificativa": pd.get("justificativa", ""), "meta_pilar": pd.get("meta_pilar", "")},
                    "gaps": [a.get("acao", str(a)) for a in pd.get("acoes_imediatas", []) if isinstance(a, dict)][:3],
                    "dado_chave": pd.get("dado_chave", ""),
                    "meta_pilar": pd.get("meta_pilar", ""),
                    "acoes_imediatas": pd.get("acoes_imediatas", []),
                }
                # Save it to avoid repeated recovery on next call
                db.save_pillar_diagnostic(analysis_id, pillar_key, diagnostic)
                print(f"DEBUG: Reconstructed diagnostic for {pillar_key} from score_data", file=sys.stderr)
            else:
                return {"success": False, "error": f"Diagnostic not found for pillar {pillar_key}"}

    # ... (rest of the code remains the same)
    # Check dependencies first
    deps = check_pillar_dependencies(analysis_id, pillar_key)

    # Build context layers
    brief_text = brief_to_text(brief)
    cross_pillar = build_cross_pillar_context(analysis_id, pillar_key, all_diagnostics)
    exec_history = build_execution_context(analysis_id, pillar_key)

    # Diagnostic summary
    estado = diagnostic.get("estado_atual", {})
    gaps = diagnostic.get("gaps", [])
    score = diagnostic.get("score", 50)
    diag_text = f"DIAGNÓSTICO ATUAL ({score}/100):\n"
    if isinstance(estado, dict):
        for k, v in estado.items():
            diag_text += f"  {k}: {v}\n"
    if gaps:
        diag_text += "GAPS:\n" + "\n".join(f"  ⚠️ {g}" for g in (gaps[:5] if isinstance(gaps, list) else [gaps]))

    # Dependency context
    dep_text = ""
    if deps["blockers"]:
        dep_text = "⚠️ DEPENDÊNCIAS BLOQUEANTES:\n"
        for b in deps["blockers"]:
            dep_text += f"  - {b['label']} ({b['score']}/100): {b['message']}\n"
        dep_text += "Inclua tarefas preparatórias ou adapte o plano considerando estas limitações.\n"
    if deps["warnings"]:
        dep_text += "AVISOS DE DEPENDÊNCIA:\n"
        for w in deps["warnings"]:
            dep_text += f"  - {w['label']} ({w['score']}/100): {w['message']}\n"

    # ── Primary: Market research from Phase 1 (already collected) ──
    market_context = _extract_market_for_pillar(pillar_key, market_data or {})
    sources = []
    if market_data:
        for cat in market_data.get("categories", []):
            sources.extend(cat.get("fontes", [])[:2])
        sources = list(dict.fromkeys(sources))  # dedup

    # ── Supplemental RAG: Only search web via unified_research if context is thin ──
    total_context_len = len(market_context) + len(cross_pillar)
    research = ""
    dna = brief.get("dna", {})
    segmento = dna.get("segmento", "")

    pillar_label = dim_cfg.get('label', pillar_key)
    if _should_search_for_task(pillar_label, f"Plano de ação para o pilar de {pillar_label}", market_context + cross_pillar):
        try:
            from app.services.research.unified_research import research_engine
            research_data = research_engine.search_tasks(
                pillar_key=pillar_key,
                score=score,
                diagnostic={"justificativa": diag_text[:200] if 'diag_text' in dir() else ""},
                segmento=segmento,
                force_refresh=False
            )
            research = research_data.get("content", "")
            sources.extend(research_data.get("sources", []))
            print(f"  📦 Smart plan gen via unified_research: {len(research_data.get('sources', []))} sources", file=sys.stderr)
        except Exception as e:
            print(f"  ⚠️ Unified research failed: {e}", file=sys.stderr)
    else:
        print(f"  ✅ Contexto de planejamento rico ({total_context_len} chars: market={len(market_context)}, upstream={len(cross_pillar)}) — sem busca web", file=sys.stderr)

    # Combine research context
    all_research = ""
    if market_context:
        all_research += f"DADOS DE MERCADO (coletados na análise):\n{market_context}\n\n"
    if research:
        all_research += f"PESQUISA COMPLEMENTAR:\n{research[:2000]}\n"
    if not all_research:
        all_research = "Use seu conhecimento profissional.\n"

    # Restriction flags
    restr = brief.get("restricoes", [])
    restr_text = ""
    if "capital_zero" in restr:
        restr_text += "\n⚠️ Capital ZERO: APENAS ferramentas gratuitas."
    if "equipe_solo" in restr:
        restr_text += "\n⚠️ Equipe de 1 pessoa: tudo deve ser executável sozinho."

    # Build scope section from SPECIALISTS config
    escopo = spec.get("escopo", "")
    entregaveis_obrig = spec.get("entregaveis_obrigatorios", [])
    nao_fazer = spec.get("nao_fazer", "")
    entregaveis_text = "\n".join(f"  {i+1}. {e}" for i, e in enumerate(entregaveis_obrig))

    prompt = f"""{spec['persona']}

Cargo: {spec['cargo']}
Pilar: {dim_cfg.get('label', pillar_key)}

═══ SEU ESCOPO (ESTRITAMENTE LIMITADO) ═══
{escopo}

⛔ FRONTEIRAS ENTRE PILARES — Crie tarefas APENAS dentro do SEU escopo:
- Público-Alvo: mapeamento de quem compra, personas, jornada, dores, critérios
- Branding: posicionamento de marca, proposta de valor, diferenciação
- Identidade Visual: cores, tipografia, logo, templates visuais
- Canais de Venda: onde vender, canais de distribuição
- Tráfego Orgânico: SEO, conteúdo, redes sociais
- Tráfego Pago: anúncios pagos, Google/Meta/LinkedIn Ads
- Processo de Vendas: funil de vendas, scripts, fechamento
NÃO proponha tarefas que pertencem a OUTRO pilar. Cada pilar faz o MELHOR da SUA função.

ENTREGÁVEIS OBRIGATÓRIOS deste pilar (suas tarefas DEVEM produzir estes):
{entregaveis_text}

🚫 PROIBIDO — NÃO FAÇA NADA DISTO:
{nao_fazer}

═══ CONTEXTO DO NEGÓCIO ═══
{brief_text}

{diag_text}

{cross_pillar}

{exec_history}

{dep_text}
{restr_text}

{all_research}

COMO {spec['cargo'].upper()}, crie TAREFAS FOCADAS EM CRIAR E PRODUZIR OS ENTREGÁVEIS OBRIGATÓRIOS acima.

⛔ PROIBIÇÃO ABSOLUTA DE TAREFAS DE PESQUISA ⛔
NÃO CRIE tarefas cujo título ou descrição contenha:
- "Pesquisar", "Identificar", "Mapear", "Coletar dados", "Analisar mercado", "Levantar informações", "Explorar", "Investigar"
A IA JÁ FEZ TODA A PESQUISA. Os dados estão nos contextos acima (DADOS DE MERCADO, PESQUISA COMPLEMENTAR).
TODAS as suas tarefas devem ser de CRIAÇÃO e PRODUÇÃO de entregáveis concretos:
✅ "Criar documento de Persona B2B detalhado"
✅ "Escrever Script de Vendas para indústrias"
✅ "Descrever Mapa de Jornada de Compra"
❌ NÃO: "Pesquisar perfil do cliente ideal"
❌ NÃO: "Identificar dores do público"
❌ NÃO: "Mapear concorrentes" (já está nos dados!)

REGRA DE CASCATA: É OBRIGATÓRIO (CRÍTICO) usar os dados fornecidos. Se a Persona, Tom de Voz ou Posicionamento já foram definidos pelos pilares anteriores (upstream), USE esses dados exatos e NÃO INVENTE NADA NOVO que concorra. No entanto, se o seu pilar é o responsável por CRIAR esse dado pela primeira vez (ex: Publico-Alvo criando a Persona), então VOCÊ DEVE INVENTAR E CRIAR o documento profundamente do zero usando a inteligência da pesquisa!

CLASSIFICAÇÃO OBRIGATÓRIA para cada tarefa:
- "executavel_por_ia": true → A IA CONSEGUE FAZER ISSO SOZINHA! (Ex: gerar textos, escrever roteiros, mapear jornadas, descrever personas, criar planos, sugerir ideias, dar dicas técnicas, estruturar scripts). MARQUE COMO TRUE SEMPRE QUE ENVOLVER PENSAMENTO OU ESCRITA.
- "executavel_por_ia": false → O USUÁRIO TEM QUE FAZER ISSO COM AS MÃOS NO MUNDO REAL (Ex: cadastrar em um site, pagar um boleto, criar senha, gravar vídeos, ligar pro cliente, imprimir).

REGRAS:
1. 4-8 tarefas CONCRETAS e SEQUENCIAIS — TODAS dentro do escopo deste pilar
2. Use "Google Docs" para tarefas de documentos, textos, planos e análises (A IA VAI ESCREVER ISSO, marque true)
3. Para tarefas IA: descreva exatamente o entregável (ex: "documento de persona completo")
4. Para tarefas usuário: dê instruções passo-a-passo claras
5. NÃO repita ações já concluídas
6. Se capital zero: apenas ferramentas gratuitas
7. Responda em português

JSON OBRIGATÓRIO:
{{
    "titulo_plano": "Nome profissional do plano",
    "objetivo": "Objetivo em 1 frase",
    "prazo_total": "X semanas",
    "entregaveis": [
        {{
            "id": "e1",
            "titulo": "Nome do entregável específico para este negócio",
            "descricao": "O que este entregável contém e para que serve",
            "tarefa_origem": "t1",
            "status": "pendente"
        }}
    ],
    "tarefas": [
        {{
            "id": "t1",
            "titulo": "Ação concreta",
            "descricao": "O que fazer e como",
            "executavel_por_ia": true,
            "entregavel_ia": "Descreva o que a IA vai gerar (ex: documento de persona completo)",
            "instrucoes_usuario": null,
            "ferramenta": "Nome da ferramenta",
            "ferramenta_url": "URL",
            "tempo_estimado": "2-4h",
            "resultado_esperado": "O que muda ao completar",
            "kpi": "Métrica mensurável",
            "prioridade": "critica/alta/media",
            "depende_de": null,
            "depende_pilar": null
        }}
    ],
    "kpis_pilar": [
        {{
            "nome": "Nome do KPI",
            "valor_atual": "Estimativa",
            "meta": "Meta 30 dias",
            "como_medir": "Como medir"
        }}
    ],
    "resultado_final": "O que o negócio terá ao completar",
    "conexao_pilares": "Como alimenta outros pilares"
}}

Retorne APENAS o JSON."""

    try:
        result = call_llm(
            provider=model_provider,
            prompt=prompt,
            temperature=0.3,
            json_mode=True
        )
        result["sources"] = sources
        result["pillar_key"] = pillar_key
        result["dependencies"] = deps

        # Ensure each task has the classification
        for t in result.get("tarefas", []):
            if "executavel_por_ia" not in t:
                # Auto-classify based on keywords
                t["executavel_por_ia"] = _classify_task_executability(t.get("titulo", "") + " " + t.get("descricao", ""))

        # Save as plan
        db.save_pillar_plan(analysis_id, pillar_key, result, status="generated")

        return {"success": True, "plan": result}

    except Exception as e:
        print(f"  ❌ Task generation error for {pillar_key}: {e}", file=sys.stderr)
        try:
            result = call_llm(
                provider=model_provider,
                prompt=prompt,
                temperature=0.3,
                json_mode=True,
                prefer_small=True
            )
            result["sources"] = sources
            result["pillar_key"] = pillar_key
            result["dependencies"] = deps
            for t in result.get("tarefas", []):
                if "executavel_por_ia" not in t:
                    t["executavel_por_ia"] = _classify_task_executability(t.get("titulo", "") + " " + t.get("descricao", ""))
            db.save_pillar_plan(analysis_id, pillar_key, result, status="generated")
            return {"success": True, "plan": result}
        except Exception as e2:
            return {"success": False, "error": f"Erro ao gerar tarefas: {str(e2)[:200]}"}


def _classify_task_executability(text: str) -> bool:
    """Fallback: classify a task as AI-executable or user-required based on keywords."""
    text_lower = text.lower()
    user_score = sum(1 for kw in REQUIRES_USER_ACTION if kw in text_lower)
    ai_score = sum(1 for kw in AI_CAPABILITIES if kw in text_lower)
    return ai_score > user_score
