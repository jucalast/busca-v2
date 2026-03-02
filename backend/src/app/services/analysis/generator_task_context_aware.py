"""
Context-Aware Task Generation Service
Gera tarefas inteligentes baseadas no contexto específico de cada pilar
"""

import json
import sys
from typing import Dict, Any, List, Optional

from app.core.llm_router import call_llm
from app.services.search.context_service import extract_structured_context
from app.services.research.unified_research import research_engine
from app.core import database as db


def generate_context_aware_tasks(
    analysis_id: str,
    pillar_key: str,
    profile: Dict[str, Any],
    score_data: Dict[str, Any],
    market_data: Dict[str, Any],
    discovery_data: Dict[str, Any],
    model_provider: str = "groq"
) -> Dict[str, Any]:
    """
    Gera tarefas context-aware para um pilar específico.
    
    Args:
        analysis_id: ID da análise
        pillar_key: Chave do pilar (ex: 'publico_alvo')
        profile: Perfil do negócio
        score_data: Dados de scoring do pilar
        market_data: Dados de pesquisa de mercado
        discovery_data: Dados de discovery do negócio
        model_provider: Provedor LLM
    
    Returns:
        Dict com plano de tarefas gerado
    """
    
    try:
        # OTIMIZAÇÃO: Verificar cache primeiro antes de qualquer processamento
        existing_plan = db.get_pillar_plan(analysis_id, pillar_key)
        if existing_plan and existing_plan.get("tasks"):
            print(f"  ✅ Tasks already cached for {pillar_key}: {len(existing_plan.get('tasks', []))} tasks", file=sys.stderr)
            return {"success": True, "plan": existing_plan}
        
        # 1. Extrair contexto específico do pilar
        pillar_diagnostic = score_data.get("dimensoes", {}).get(pillar_key, {})
        
        if not pillar_diagnostic:
            return {
                "success": False,
                "error": f"Diagnostic data not found for pillar: {pillar_key}"
            }
        
        # 2. Preparar contexto rico
        context = _prepare_rich_context(
            pillar_key, pillar_diagnostic, profile, market_data, discovery_data
        )
        
        # 3. Gerar tarefas com LLM usando pesquisa unificada
        tasks = _generate_pillar_tasks_with_llm(
            pillar_key, context, model_provider
        )
        
        # 4. Estruturar plano
        plan = {
            "meta": context["meta_pilar"],
            "diagnostico": context["diagnostico"],
            "score": context["score"],
            "status": context["status"],
            "tarefas": tasks,
            "dependencies": {"ready": True, "blockers": [], "warnings": []},
            "context_sources": context["sources"],
            "generation_method": "context_aware",
            "generated_at": _get_timestamp()
        }
        
        # 5. Salvar no banco
        _save_pillar_plan(analysis_id, pillar_key, plan)
        
        print(f"  ✅ Context-aware tasks generated for {pillar_key}: {len(tasks)} tasks", file=sys.stderr)
        
        return {
            "success": True,
            "plan": plan,
            "pillar_key": pillar_key,
            "tasks_count": len(tasks)
        }
        
    except Exception as e:
        print(f"  ❌ Context-aware task generation failed for {pillar_key}: {str(e)}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e)
        }


def _prepare_rich_context(
    pillar_key: str,
    diagnostic: Dict[str, Any],
    profile: Dict[str, Any],
    market_data: Dict[str, Any],
    discovery_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Prepara contexto rico para geração de tarefas."""
    
    # Dados do diagnóstico
    score = diagnostic.get("score", 0)
    status = diagnostic.get("status", "unknown")
    justificativa = diagnostic.get("justificativa", "")
    meta_pilar = diagnostic.get("meta_pilar", "")
    dado_chave = diagnostic.get("dado_chave", "")
    
    # Dados do perfil
    nome_negocio = profile.get("nome_negocio", profile.get("nome", ""))
    segmento = profile.get("segmento", "")
    localizacao = profile.get("localizacao", "")
    
    # Dados de mercado relevantes
    market_context = _extract_relevant_market_data(pillar_key, market_data)
    
    # Dados de discovery
    discovery_context = _extract_relevant_discovery_data(discovery_data)
    
    # Fontes utilizadas
    sources = []
    if diagnostic.get("fontes_utilizadas"):
        sources.extend(diagnostic["fontes_utilizadas"])
    if market_context.get("sources"):
        sources.extend(market_context["sources"])
    
    return {
        "pillar_key": pillar_key,
        "score": score,
        "status": status,
        "diagnostico": justificativa,
        "meta_pilar": meta_pilar,
        "dado_chave": dado_chave,
        "negocio": {
            "nome": nome_negocio,
            "segmento": segmento,
            "localizacao": localizacao
        },
        "market_data": market_context,
        "discovery_data": discovery_context,
        "sources": list(set(sources))  # Remove duplicatas
    }


def _generate_pillar_tasks_with_llm(
    pillar_key: str,
    context: Dict[str, Any],
    model_provider: str
) -> List[Dict[str, Any]]:
    """Gera tarefas usando LLM com pesquisa unificada e contexto rico."""
    
    # Obter configuração do especialista
    from app.services.agents.engine_specialist import SPECIALISTS
    specialist = SPECIALISTS.get(pillar_key.replace("-", "_"))
    
    if not specialist:
        raise ValueError(f"Specialist not found for pillar: {pillar_key}")
    
    # Usar research_engine para pesquisa específica do pilar
    # OTIMIZAÇÃO: Para melhor performance, usar apenas contexto existente
    print(f"  ⚡ Using fast context-only generation for {pillar_key}", file=sys.stderr)
    research_content = ""
    research_sources = []
    
    # Desabilitar pesquisa por enquanto para melhor performance
    # TODO: Reativar quando o sistema estiver mais estável
    """
    try:
        import threading
        import time
        
        research_data = None
        research_error = None
        
        def research_worker():
            nonlocal research_data, research_error
            try:
                research_data = research_engine.search_tasks(
                    pillar_key=pillar_key,
                    score=context["score"],
                    diagnostic={
                        "justificativa": context["diagnostico"],
                        "status": context["status"],
                        "meta_pilar": context["meta_pilar"]
                    },
                    segmento=context["negocio"]["segmento"],
                    force_refresh=False  # Usar cache quando possível
                )
            except Exception as e:
                research_error = e
        
        # Executar pesquisa em thread com timeout
        thread = threading.Thread(target=research_worker)
        thread.start()
        thread.join(timeout=3)  # 3 segundos de timeout
        
        if thread.is_alive():
            print(f"  ⚠️ Research timeout for {pillar_key}, using fallback", file=sys.stderr)
            research_content = ""
            research_sources = []
        elif research_error:
            print(f"  ⚠️ Unified research failed for {pillar_key}: {research_error}, using fallback", file=sys.stderr)
            research_content = ""
            research_sources = []
        elif research_data:
            # Extrair conteúdo da pesquisa
            research_content = research_data.get("content", "")
            research_sources = research_data.get("sources", [])
            print(f"  📦 Used unified research for {pillar_key}: {len(research_sources)} sources", file=sys.stderr)
        else:
            research_content = ""
            research_sources = []
        
    except Exception as e:
        print(f"  ⚠️ Research system error for {pillar_key}: {e}, using fallback", file=sys.stderr)
        research_content = ""
        research_sources = []
    """
    
    # Construir prompt inteligente
    prompt = _build_context_aware_prompt(pillar_key, context, specialist, research_content)
    
    # Chamar LLM
    result = call_llm(
        provider=model_provider,
        prompt=prompt,
        temperature=0.4,
        json_mode=True
    )
    
    if not result.get("success"):
        raise Exception(f"LLM call failed: {result.get('error')}")
    
    # Processar resposta
    tasks_data = result.get("content", "{}")
    
    try:
        parsed = json.loads(tasks_data) if isinstance(tasks_data, str) else tasks_data
        tasks = parsed.get("tarefas", [])
        
        # Enriquecer tarefas com metadados
        enriched_tasks = []
        for i, task in enumerate(tasks):
            enriched_task = {
                "id": f"task_{pillar_key}_{i+1}",
                "titulo": task.get("titulo", ""),
                "descricao": task.get("descricao", ""),
                "categoria": pillar_key,
                "executavel_por_ia": task.get("executavel_por_ia", True),
                "entregavel_ia": task.get("entregavel_ia", ""),
                "ferramenta": task.get("ferramenta", ""),
                "tempo_estimado": task.get("tempo_estimado", "1 semana"),
                "impacto": _map_impact(task.get("impacto", "medio")),
                "prazo_sugerido": task.get("prazo", "1 semana"),
                "custo_estimado": task.get("custo", "R$ 0"),
                "fonte_referencia": "context_aware_generation",
                "context_score": context["score"],
                "context_status": context["status"]
            }
            enriched_tasks.append(enriched_task)
        
        return enriched_tasks
        
    except json.JSONDecodeError as e:
        print(f"  ❌ Failed to parse LLM response: {e}", file=sys.stderr)
        print(f"  📄 Raw response: {str(tasks_data)[:500]}...", file=sys.stderr)
        
        # Fallback: criar tarefas básicas
        return _create_fallback_tasks(pillar_key, context)


def _build_context_aware_prompt(
    pillar_key: str,
    context: Dict[str, Any],
    specialist: Dict[str, Any],
    research_content: str = ""
) -> str:
    """Constrói prompt inteligente baseado no contexto."""
    
    prompt = f"""
{specialist['persona']}

## CONTEXTO ESPECÍFICO DO PILAR

### Diagnóstico Completo:
- **Score**: {context['score']}/100
- **Status**: {context['status']}
- **Problema Identificado**: {context['diagnostico']}
- **Meta do Pilar**: {context['meta_pilar']}
- **Dado Chave**: {context['dado_chave']}

### Dados do Negócio:
- **Nome**: {context['negocio']['nome']}
- **Segmento**: {context['negocio']['segmento']}
- **Localização**: {context['negocio']['localizacao']}

### Contexto de Mercado:
{context['market_data'].get('summary', 'Dados de mercado relevantes disponíveis')}

### Dados de Discovery:
{context['discovery_data'].get('summary', 'Dados reais do negócio disponíveis')}

### Pesquisa Específica do Pilar:
{research_content if research_content else 'Nenhuma pesquisa específica disponível'}

## MISSÃO

Baseado no diagnóstico específico acima, gere um plano de 3-7 tarefas ALTAMENTE RELEVANTES para resolver o problema detectado no pilar "{pillar_key}".

## REGRAS CRÍTICAS

1. **FOCO TOTAL**: Todas as tarefas devem estar 100% focadas em resolver: "{context['diagnostico']}"
2. **CONTEXT-AWARE**: Use os dados específicos do negócio, mercado e discovery
3. **PRAGMÁTICO**: Considere as restrições reais (segmento, localização, etc.)
4. **EXECUTÁVEL**: Cada tarefa deve ser acionável e mensurável
5. **HIERÁRQUICO**: Comece do mais básico para o mais avançado

## ESTRUTURA OBRIGATÓRIA

Retorne JSON:
{{
    "tarefas": [
        {{
            "titulo": "Título específico e acionável",
            "descricao": "Descrição detalhada do que fazer",
            "executavel_por_ia": true/false,
            "entregavel_ia": "Nome do entregável se aplicável",
            "ferramenta": "Ferramenta necessária",
            "tempo_estimado": "Ex: 2 semanas",
            "impacto": "alto/medio/baixo",
            "prazo": "Ex: 1 semana",
            "custo": "Ex: R$ 0, R$ 50, R$ 100+"
        }}
    ]
}}

## EXEMPLO DE QUALIDADE

Se o diagnóstico for "Persona mal definida", as tarefas devem ser:
1. "Pesquisar personas de referência no segmento"
2. "Entrevistar clientes existentes"
3. "Criar documento de persona detalhado"

NÃO gere tarefas genéricas. Seja ESPECÍFICO para o contexto fornecido!
"""
    
    return prompt


def _extract_relevant_market_data(pillar_key: str, market_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extrai dados de mercado relevantes para o pilar."""
    
    # Mapear pilares para categorias de mercado
    pillar_categories = {
        "publico_alvo": ["publico_alvo", "cliente_ideal", "personas", "segmento"],
        "branding": ["branding", "marca", "posicionamento", "identidade"],
        "identidade_visual": ["identidade_visual", "design", "logo", "cores"],
        "canais_venda": ["canais_venda", "vendas", "distribuicao"],
        "trafego_organico": ["trafego_organico", "seo", "conteudo", "blog"],
        "trafego_pago": ["trafego_pago", "anuncios", "midias_sociais", "performance"],
        "processo_vendas": ["processo_vendas", "funil", "conversao", "crm"]
    }
    
    relevant_categories = pillar_categories.get(pillar_key.replace("-", "_"), [])
    relevant_data = []
    sources = []
    
    categories = market_data.get("categories", [])
    for category in categories:
        cat_id = category.get("id", "")
        if any(rc in cat_id for rc in relevant_categories):
            relevant_data.append(category)
            sources.extend(category.get("fontes", []))
    
    summary = ""
    if relevant_data:
        summary = f"Encontrados {len(relevant_data)} conjuntos de dados relevantes: "
        for i, cat in enumerate(relevant_data[:3]):  # Limitar para não sobrecarregar
            summary += f"{cat.get('nome', '')} ({len(cat.get('fontes', []))} fontes)"
            if i < min(2, len(relevant_data) - 1):
                summary += ", "
    
    return {
        "categories": relevant_data,
        "summary": summary,
        "sources": sources
    }


def _extract_relevant_discovery_data(discovery_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extrai dados de discovery relevantes."""
    
    if not discovery_data:
        return {"summary": "Sem dados de discovery", "data": {}}
    
    summary = f"Discovery encontrou: "
    
    if discovery_data.get("instagram_data"):
        summary += "Instagram verificado, "
    
    if discovery_data.get("website_data"):
        summary += "Website analisado, "
    
    if discovery_data.get("google_data"):
        summary += "Presença no Google confirmada, "
    
    if discovery_data.get("found"):
        summary += "negócio validado online"
    else:
        summary += "dados limitados do negócio"
    
    return {
        "summary": summary,
        "data": discovery_data
    }


def _map_impact(impact: str) -> int:
    """Mapeia impacto textual para numérico."""
    mapping = {
        "alto": 9,
        "medio": 6,
        "baixo": 3
    }
    return mapping.get(impact.lower(), 6)


def _create_fallback_tasks(pillar_key: str, context: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Cria tarefas básicas de fallback."""
    
    fallback_tasks = [
        {
            "id": f"task_{pillar_key}_1",
            "titulo": f"Analisar situação atual do {pillar_key.replace('_', ' ').title()}",
            "descricao": f"Avaliar o estado atual baseado no diagnóstico: {context['diagnostico'][:100]}...",
            "categoria": pillar_key,
            "executavel_por_ia": True,
            "entregavel_ia": "Relatório de Análise",
            "ferramenta": "analysis",
            "tempo_estimado": "1 semana",
            "impacto": 6,
            "prazo_sugerido": "1 semana",
            "custo_estimado": "R$ 0",
            "fonte_referencia": "fallback_generation",
            "context_score": context["score"],
            "context_status": context["status"]
        }
    ]
    
    print(f"  ⚠️ Using fallback tasks for {pillar_key}", file=sys.stderr)
    return fallback_tasks


def _save_pillar_plan(analysis_id: str, pillar_key: str, plan: Dict[str, Any]) -> None:
    """Salva o plano do pilar no banco."""
    try:
        db.save_pillar_plan(analysis_id, pillar_key, plan)
        print(f"  💾 Saved plan for {pillar_key}", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️ Failed to save plan for {pillar_key}: {e}", file=sys.stderr)


def _get_timestamp() -> str:
    """Retorna timestamp atual."""
    from datetime import datetime
    return datetime.now().isoformat()


def has_context_aware_tasks(analysis_id: str, pillar_key: str) -> bool:
    """Verifica se já existem tarefas context-aware geradas."""
    try:
        plan = db.get_pillar_plan(analysis_id, pillar_key)
        return plan and plan.get("generation_method") == "context_aware"
    except:
        return False
