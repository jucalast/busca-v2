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
        # Só usa cache se o plano já tiver a lista de entregaveis (planos antigos sem ela são regenerados)
        existing_plan = db.get_pillar_plan(analysis_id, pillar_key)
        if (
            existing_plan
            and existing_plan.get("plan_data", {}).get("tarefas")
            and existing_plan.get("plan_data", {}).get("entregaveis")
        ):
            cached_tasks = existing_plan["plan_data"]["tarefas"]
            print(f"  ✅ Tasks already cached for {pillar_key}: {len(cached_tasks)} tasks", file=sys.stderr)
            return {"success": True, "plan": existing_plan["plan_data"]}
        
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
        # Derivar entregaveis a partir do campo entregavel_ia de cada tarefa
        entregaveis = [
            {
                "id": f"e{i + 1}",
                "titulo": task.get("entregavel_ia", f"Entregável {i + 1}"),
                "descricao": task.get("descricao", ""),
                "ferramenta": task.get("ferramenta", "documento"),
                "tarefa_origem": task.get("id", f"task_{i + 1}"),
            }
            for i, task in enumerate(tasks)
        ]

        plan = {
            "meta": context["meta_pilar"],
            "diagnostico": context["diagnostico"],
            "score": context["score"],
            "status": context["status"],
            "tarefas": tasks,
            "entregaveis": entregaveis,
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
    acoes_imediatas = diagnostic.get("acoes_imediatas", [])
    
    # Dados do perfil (suporta perfil flat ou aninhado em 'profile')
    _profile = profile.get("profile", profile) if isinstance(profile, dict) and "profile" in profile else profile
    nome_negocio = _profile.get("nome_negocio", _profile.get("nome", profile.get("nome_negocio", profile.get("nome", ""))))
    segmento = _profile.get("segmento", profile.get("segmento", ""))
    localizacao = _profile.get("localizacao", profile.get("localizacao", ""))
    
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
        "acoes_imediatas": acoes_imediatas,
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
    
    # Pesquisa específica do pilar via unified_research (com timeout seguro)
    research_content = ""
    research_sources = []
    
    try:
        import threading
        
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
        
        # Executar pesquisa em thread com timeout de 5s
        thread = threading.Thread(target=research_worker, daemon=True)
        thread.start()
        thread.join(timeout=5)
        
        if thread.is_alive():
            print(f"  ⚠️ Research timeout for {pillar_key}, using context only", file=sys.stderr)
        elif research_error:
            print(f"  ⚠️ Unified research failed for {pillar_key}: {research_error}, using context only", file=sys.stderr)
        elif research_data:
            research_content = research_data.get("content", "")
            research_sources = research_data.get("sources", [])
            print(f"  📦 Unified research for {pillar_key}: {len(research_sources)} sources", file=sys.stderr)
        
    except Exception as e:
        print(f"  ⚠️ Research system error for {pillar_key}: {e}, using context only", file=sys.stderr)
    
    # Construir prompt inteligente
    prompt = _build_context_aware_prompt(pillar_key, context, specialist, research_content)
    
    # Chamar LLM
    result = call_llm(
        provider=model_provider,
        prompt=prompt,
        temperature=0.7,
        json_mode=True
    )

    # call_llm with json_mode=True returns the parsed dict directly (not a wrapper)
    if result is None:
        raise Exception("LLM call failed: no response")
    if isinstance(result, dict) and result.get("error") and not result.get("tarefas"):
        raise Exception(f"LLM call failed: {result.get('error')}")

    # result IS the parsed content
    parsed = result if isinstance(result, dict) else {}

    try:
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
        
    except Exception as e:
        print(f"  ❌ Failed to process LLM response: {e}", file=sys.stderr)
        
        # Fallback: criar tarefas básicas
        return _create_fallback_tasks(pillar_key, context)


def _build_context_aware_prompt(
    pillar_key: str,
    context: Dict[str, Any],
    specialist: Dict[str, Any],
    research_content: str = ""
) -> str:
    """Constrói prompt inteligente baseado no contexto."""

    negocio = context["negocio"]
    loc_str = f", {negocio['localizacao']}" if negocio.get("localizacao") else ""

    acoes_hint = ""
    if context.get("acoes_imediatas"):
        acoes_list = "\n".join(f"  - {a}" for a in context["acoes_imediatas"][:5])
        acoes_hint = f"\n### Ações Prioritárias do Diagnóstico (use como base para as tarefas):\n{acoes_list}\n"

    research_section = ""
    if research_content:
        research_section = f"\n### Referências do Setor:\n{research_content[:500]}\n"

    discovery_summary = context["discovery_data"].get("summary", "")
    market_summary = context["market_data"].get("summary", "")

    prompt = f"""{specialist['persona']}

Você está criando um plano de execução CONCRETO para "{negocio['nome']}" — {negocio['segmento']}{loc_str}.

## DIAGNÓSTICO DO PILAR

- Score atual: {context['score']}/100 ({context['status']})
- Problema central: {context['diagnostico']}
- Meta do pilar: {context['meta_pilar']}
- Dado chave: {context['dado_chave']}
- Discovery: {discovery_summary}
- Mercado: {market_summary}
{acoes_hint}{research_section}
## SUA MISSÃO

Gere EXATAMENTE 5 tarefas ORIGINAIS e ESPECÍFICAS para resolver o problema acima.
TODAS as 5 tarefas DEVEM ter `executavel_por_ia: true` — a IA vai executar cada uma delas.

## REGRAS ABSOLUTAS

1. `executavel_por_ia` deve ser SEMPRE `true` para todas as 5 tarefas
2. `entregavel_ia` deve descrever o DOCUMENTO COMPLETO que a IA vai produzir (ex: "Relatório de análise de personas com perfis detalhados, dores identificadas e recomendações")
3. As tarefas devem ser DIRETAMENTE derivadas do PROBLEMA ESPECÍFICO acima — NÃO use templates genéricos.
   Use o dado-chave "{context['dado_chave'][:100]}" e as ações prioritárias do diagnóstico como base concreta.
4. Use dados específicos do negócio: segmento "{negocio['segmento']}", problema "{context['diagnostico'][:80]}"
5. NÃO gere tarefas que exijam presença física, ligações ou reuniões
6. NÃO repita tarefas genéricas como "Auditar situação atual" ou "Monitorar resultados" — seja CRIATIVO e específico ao contexto
7. ⛔ PROIBIDO tarefas de coleta de dados humanos: "Aplicar pesquisa/questionário com clientes", "Coletar respostas de participantes", "Aguardar feedback de clientes", "Tabular respostas recebidas" — a IA NÃO consegue executar estas tarefas (exigem ação de clientes reais). Substitua sempre por: "Pesquisar [mesmo tema] via dados de mercado, estudos setoriais e fontes online"

## TIPOS DE ENTREGÁVEIS POSSÍVEIS

- Análise → "Relatório de [tema] com insights, dados levantados e recomendações práticas"
- Pesquisa → "Documento de pesquisa com benchmarks do setor e referências de boas práticas"
- Persona/Estratégia → "Documento estratégico com [conteúdo detalhado] e próximos passos"
- Conteúdo → "[Tipo de conteúdo] completo e pronto para uso"
- Auditoria → "Relatório de auditoria com pontos críticos priorizados e plano de correção"

## FORMATO — retorne SOMENTE este JSON, sem markdown:

{{
    "tarefas": [
        {{
            "titulo": "Verbo + objeto específico (ex: 'Auditar presença digital atual')",
            "descricao": "O que será feito em detalhes, citando o problema específico do diagnóstico",
            "executavel_por_ia": true,
            "entregavel_ia": "Descrição completa do documento que a IA vai entregar",
            "ferramenta": "web_research | analysis | content_creation | strategy | audit",
            "tempo_estimado": "X dias",
            "impacto": "alto | medio | baixo",
            "prazo": "X semana",
            "custo": "R$ 0"
        }}
    ]
}}"""

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
        return bool(
            plan
            and plan.get("plan_data", {}).get("generation_method") == "context_aware"
            and plan.get("plan_data", {}).get("tarefas")
        )
    except:
        return False
