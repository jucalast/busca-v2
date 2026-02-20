"""
Micro Planner — JIT (Just-In-Time) task detail generation with RAG.

This is Phase 2 of the Cascading Lazy-Load architecture.
Only called when user clicks on a specific task to expand it.

Flow:
1. Search DuckDuckGo for specialist content related to the task
2. Scrape top result for detailed content
3. Call LLM (small model) with profile + scraped content → generate sub-tasks checklist
4. Cache the result for future users with similar segments/tasks
"""

import json
import os
import sys
import time
import hashlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cli import call_groq, search_duckduckgo, scrape_page
import database as db


def _build_search_query(task_title: str, segmento: str, categoria: str) -> str:
    """Build a targeted search query for specialist content."""
    # Map categories to search focus areas
    category_search_hints = {
        "presenca_digital": "marketing digital passo a passo",
        "competitividade": "análise concorrência estratégia",
        "diversificacao_canais": "canais de venda como implementar",
        "precificacao": "estratégia precificação como calcular",
        "potencial_mercado": "pesquisa mercado tendências",
        "maturidade_operacional": "processos operacionais eficiência",
    }
    
    hint = category_search_hints.get(categoria, "como fazer passo a passo")
    
    # Build query targeting specialist Brazilian sites
    query = f"{task_title} {segmento} {hint} 2025 site:rockcontent.com OR site:rdstation.com OR site:sebrae.com.br OR site:neilpatel.com"
    
    # Truncate if too long
    if len(query) > 200:
        query = f"{task_title} {segmento} {hint} 2025 melhores práticas"
    
    return query


def _generate_cache_key(task_title: str, segmento: str, categoria: str) -> str:
    """Generate a cache key for specialist content."""
    normalized = f"{categoria}:{segmento.lower().strip()}:{task_title.lower().strip()}"
    return hashlib.sha256(normalized.encode()).hexdigest()[:32]


def expand_task(
    task_id: str,
    task_title: str,
    categoria: str,
    profile: dict,
    plan_context: dict = None,
) -> dict:
    """
    Expand a task into detailed sub-tasks using RAG (search + LLM).
    
    Args:
        task_id: Unique task identifier
        task_title: The task title from macro plan
        categoria: Task category (dimension)
        profile: Business profile
        plan_context: Optional context from the macro plan (phase info, meta, etc.)
    
    Returns:
        {
            "task_id": "t_1_1",
            "titulo": "...",
            "subtarefas": [...],
            "ferramentas": [...],
            "tempo_total": "...",
            "specialist_content": "...",
            "sources": [...]
        }
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "error": "GROQ_API_KEY not configured"}

    perfil = profile.get("perfil", {})
    segmento = perfil.get("segmento", "")
    nome = perfil.get("nome", perfil.get("nome_negocio", ""))
    modelo = perfil.get("modelo_negocio", perfil.get("modelo", ""))
    localizacao = perfil.get("localizacao", "")
    restricoes = profile.get("restricoes_criticas", {})
    capital = restricoes.get("capital_disponivel", perfil.get("capital_disponivel", "não informado"))
    equipe_solo = restricoes.get("equipe_solo", False)

    # ── Step 1: Check cache ──
    cache_key = _generate_cache_key(task_title, segmento, categoria)
    cached = db.get_specialist_cache(cache_key)
    
    if cached:
        print(f"  ✅ Cache hit for task '{task_title}' (key: {cache_key[:8]}...)", file=sys.stderr)
        return {
            "success": True,
            "task_id": task_id,
            "from_cache": True,
            **cached["content"]
        }

    # ── Step 2: Search DuckDuckGo for specialist content ──
    search_query = _build_search_query(task_title, segmento, categoria)
    print(f"  🔍 Micro-plan search: {search_query[:100]}...", file=sys.stderr)
    
    results = search_duckduckgo(search_query, max_results=4, region='br-pt')
    
    specialist_text = ""
    sources = []
    
    for i, r in enumerate(results or []):
        url = r.get("href", "")
        sources.append(url)
        snippet = r.get("body", "")
        title = r.get("title", "")
        specialist_text += f"Fonte {i+1} ({title}): {snippet}\n"
        
        # Scrape top 2 results for detailed content
        if i < 2:
            content = scrape_page(url, timeout=4)
            if content:
                specialist_text += f"Conteúdo detalhado: {content[:3000]}\n\n"

    # ── Step 3: Generate sub-tasks with LLM (smaller model for speed) ──
    restriction_lines = []
    if capital in ["zero", "baixo"]:
        restriction_lines.append("APENAS ferramentas gratuitas ou até R$50/mês")
    if equipe_solo:
        restriction_lines.append("Executável por UMA pessoa em poucas horas")
    restriction_text = ". ".join(restriction_lines) if restriction_lines else "Sem restrições especiais"

    meta = ""
    if plan_context:
        meta = plan_context.get("meta", "")

    prompt = f"""Você é um especialista executivo. Usando os dados reais da pesquisa, crie um checklist DETALHADO e EXECUTÁVEL.

TAREFA: {task_title}
NEGÓCIO: {nome} — {segmento} — {modelo} — {localizacao}
META: {meta}
RESTRIÇÕES: {restriction_text}

DADOS ESPECIALISTAS DA INTERNET (use como base):
{specialist_text[:8000] if specialist_text else "Nenhum dado encontrado. Use seu conhecimento."}

REGRAS:
1. Crie 4-7 sub-tarefas EXECUTÁVEIS e ORDENADAS
2. Cada sub-tarefa deve ser uma AÇÃO CONCRETA com ferramenta específica
3. Inclua tempo estimado por sub-tarefa
4. Cite dados reais das fontes quando disponível
5. Se capital zero: apenas ferramentas gratuitas
6. Cada sub-tarefa deve ser completável em 30min-2h

JSON OBRIGATÓRIO:
{{
    "titulo": "{task_title}",
    "descricao": "Por que esta tarefa é importante para atingir a meta",
    "subtarefas": [
        {{
            "id": "st_1",
            "titulo": "Ação concreta e específica",
            "descricao": "Explicação detalhada de como fazer",
            "tempo_estimado": "30min",
            "ferramenta": "Nome da ferramenta (grátis)",
            "dica_especialista": "Dica baseada nos dados da pesquisa"
        }}
    ],
    "ferramentas_necessarias": [
        {{
            "nome": "Nome da ferramenta",
            "url": "URL do site",
            "custo": "Grátis / R$ X/mês",
            "para_que": "Para que serve nesta tarefa"
        }}
    ],
    "tempo_total_estimado": "X horas",
    "resultado_esperado": "O que muda depois de completar",
    "dica_principal": "A dica mais importante baseada na pesquisa"
}}

Retorne APENAS o JSON."""

    try:
        result = call_groq(
            api_key, prompt,
            temperature=0.3,
            model="llama-3.1-8b-instant",
            force_json=True
        )
        
        # Add sources
        result["sources"] = sources
        result["search_query"] = search_query

        # ── Step 4: Cache the result ──
        try:
            db.save_specialist_cache(
                cache_key=cache_key,
                segment=segmento,
                categoria=categoria,
                task_title=task_title,
                content=result
            )
            print(f"  💾 Cached micro-plan for '{task_title}' (key: {cache_key[:8]}...)", file=sys.stderr)
        except Exception as ce:
            print(f"  ⚠️ Cache save failed: {ce}", file=sys.stderr)

        return {
            "success": True,
            "task_id": task_id,
            "from_cache": False,
            **result
        }

    except Exception as e:
        print(f"  ❌ Micro planner error: {e}", file=sys.stderr)
        return {
            "success": False,
            "task_id": task_id,
            "error": f"Erro ao expandir tarefa: {str(e)[:200]}",
            "sources": sources
        }


def run_task_chat(
    task_id: str,
    task_title: str,
    user_message: str,
    messages: list,
    profile: dict,
    task_detail: dict = None,
    plan_context: dict = None,
) -> dict:
    """
    Task-scoped chat. The AI is focused EXCLUSIVELY on helping complete this specific task.
    
    Args:
        task_id: Task identifier
        task_title: Task title for context
        user_message: Current user message
        messages: Chat history (last 5 messages only)
        profile: Business profile (light context)
        task_detail: The expanded task detail (subtasks, specialist content)
        plan_context: Macro plan context (meta, phase info)
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"success": False, "reply": "Erro: API key não configurada."}

    perfil = profile.get("perfil", {})
    nome = perfil.get("nome", perfil.get("nome_negocio", ""))
    segmento = perfil.get("segmento", "")
    meta = plan_context.get("meta", "") if plan_context else ""

    # Build conversation history (last 5 only — save tokens)
    history_text = ""
    recent_messages = messages[-5:] if messages else []
    for m in recent_messages:
        role = "Usuário" if m.get("role") == "user" else "Assistente"
        history_text += f"{role}: {m.get('content', '')}\n"

    # Task detail context
    task_context = ""
    if task_detail:
        subtarefas = task_detail.get("subtarefas", [])
        if subtarefas:
            task_context += "SUB-TAREFAS DO CHECKLIST:\n"
            for st in subtarefas:
                task_context += f"  - {st.get('titulo', '')}: {st.get('descricao', '')}\n"
        
        ferramentas = task_detail.get("ferramentas_necessarias", [])
        if ferramentas:
            task_context += "\nFERRAMENTAS:\n"
            for f in ferramentas:
                task_context += f"  - {f.get('nome', '')}: {f.get('para_que', '')} ({f.get('custo', '')})\n"
        
        dica = task_detail.get("dica_principal", "")
        if dica:
            task_context += f"\nDICA ESPECIALISTA: {dica}\n"

    # Optional: Quick web search for the user's specific question
    search_context = ""
    sources = []
    if len(user_message) > 15:  # Only search for substantive questions
        search_query = f"{task_title} {segmento} {user_message}"
        try:
            results = search_duckduckgo(search_query[:150], max_results=3, region='br-pt')
            for i, r in enumerate(results or []):
                url = r.get("href", "")
                sources.append(url)
                snippet = r.get("body", "")
                search_context += f"Fonte {i+1}: {snippet}\n"
                if i < 1:
                    content = scrape_page(url, timeout=3)
                    if content:
                        search_context += f"Detalhes: {content[:2000]}\n"
        except Exception:
            pass

    prompt = f"""Você é um assistente focado EXCLUSIVAMENTE em ajudar o usuário a completar a tarefa atual.

CONTEXTO BASE:
- Negócio: {nome} ({segmento})
- Meta: {meta}

TAREFA ATUAL: {task_title}

{task_context}

{f"DADOS DA PESQUISA (use como referência):{chr(10)}{search_context[:4000]}" if search_context else ""}

HISTÓRICO:
{history_text if history_text else "Primeira mensagem."}

REGRAS OBRIGATÓRIAS:
1. Responda APENAS sobre esta tarefa específica
2. Se o usuário perguntar algo fora do escopo, redirecione gentilmente para a tarefa
3. Seja CONCISO e DIRETO — parágrafos curtos
4. Cite ferramentas e passos ESPECÍFICOS
5. Se tiver dados da pesquisa, cite-os
6. NÃO use emojis
7. Responda em português

PERGUNTA DO USUÁRIO: {user_message}

Responda de forma direta e útil:"""

    try:
        reply = call_groq(
            api_key, prompt,
            temperature=0.4,
            model="llama-3.1-8b-instant",
            force_json=False
        )
    except Exception as e:
        reply = f"Desculpe, não consegui processar. Erro: {str(e)[:100]}"

    return {
        "success": True,
        "reply": reply,
        "sources": sources,
        "task_id": task_id
    }
