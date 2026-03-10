"""
Pillar Agent — Autonomous execution engine for each of the 7 sales pillars.

Architecture:
- Each pillar has its own agent that plans, researches, executes, and saves
- Chain context: each pillar reads structured output from its upstream pillars
- The user is the "Director" — gives commands, the agent does the work

Flow per pillar:
1. Trigger: User gives command (or clicks "Executar")
2. Context: Agent reads profile + upstream pillar data
3. Plan: Agent creates micro-tasks it will execute itself
4. Execute: Agent runs searches, processes data, generates insights
5. Save: Agent saves structured output in pillar-specific schema

REFACTORED: Now uses clean architecture with separated concerns
"""

import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.services.search.search_service import search_duckduckgo
from app.services.search.context_service import extract_structured_context
import traceback
from app.core import database as db

# Import new architecture components
from app.config.pillars_config import PillarConfig
from app.exceptions.pillar_exceptions import (
    PillarExecutionError, 
    ContextExtractionError, 
    ScopeViolationError
)

# ═══════════════════════════════════════════════════════════════════
# BACKWARD COMPATIBILITY: Keep original PILLARS reference
# ═══════════════════════════════════════════════════════════════════

PILLARS = PillarConfig.PILLARS
PILLAR_ORDER = PillarConfig.get_pillar_order()

# ═══════════════════════════════════════════════════════════════════
# Context Extraction Functions (Updated to use new service)
# ═══════════════════════════════════════════════════════════════════

def _extract_structured_context(up_output: dict, pillar_key: str) -> dict:
    """
    BACKWARD COMPATIBILITY: Wrapper for new context extraction service.
    Maintains the same interface as the original function.
    """
    return extract_structured_context(up_output, pillar_key)

# ═══════════════════════════════════════════════════════════════════
# Schema Description Function
# ═══════════════════════════════════════════════════════════════════

def _build_schema_description(schema: dict, depth: int = 0) -> str:
    """
    Convert a nested schema dict into a flat, readable field description
    that the LLM can reliably follow without triggering JSON validation errors.
    Returns a compact JSON skeleton with type hints as values.
    """
    def _simplify(val, d=0):
        if isinstance(val, dict):
            return {k: _simplify(v, d + 1) for k, v in val.items()}
        if isinstance(val, list):
            if not val:
                return []
            inner = _simplify(val[0], d + 1)
            return [inner]
        if isinstance(val, str):
            return val  # keep example strings as hints
        return val

    simplified = _simplify(schema)
    return json.dumps(simplified, ensure_ascii=False, indent=2)

# ═══════════════════════════════════════════════════════════════════
# LLM Service Functions
# ═══════════════════════════════════════════════════════════════════

def call_llm(prompt: str, temperature: float = 0.2, provider: str = "groq", json_mode: bool = False) -> Any:
    """Call LLM service with error handling."""
    try:
        from app.core.llm_router import call_llm as router_call
        return router_call(
            provider=provider,
            prompt=prompt,
            temperature=temperature,
            json_mode=json_mode
        )
    except Exception as e:
        raise PillarExecutionError(f"LLM service failed: {str(e)}")

def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response."""
    # Find first { and last }
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise ValueError(f"Nenhum JSON encontrado na resposta: {text[:200]}")

    json_str = text[start:end + 1]
    return json.loads(json_str)

# ═══════════════════════════════════════════════════════════════════
# Main Pillar Agent Function (Updated with new architecture)
# ═══════════════════════════════════════════════════════════════════

def run_pillar_agent(
    pillar_key: str,
    business_id: str,
    profile: dict,
    user_command: str = "",
    emit_thought=None,
) -> dict:
    """
    Run the autonomous agent for a specific pillar.
    
    Flow:
    1. Load upstream pillar data (chain context)
    2. Research: search web for pillar-specific data
    3. Plan + Execute: LLM generates structured output using research + upstream data
    4. Save: persist structured output to database
    
    Args:
        pillar_key: One of the 7 pillar keys
        business_id: Business identifier for data persistence
        profile: Business profile from profiler
        user_command: Optional user directive (e.g. "Focus on B2B personas")
        emit_thought: Optional callback for streaming progress
    """
    try:
        # Get pillar configuration
        pillar = PillarConfig.get_pillar_config(pillar_key)
        
        # Extract business information
        nome = profile.get("nome_empresa", "")
        segmento = profile.get("segmento", "")
        localizacao = profile.get("localizacao", "")
        modelo = profile.get("modelo_negocio", "")
        restricoes = profile.get("restricoes", {})
        perfil = profile.get("perfil", {})

        def thought(msg):
            print(f"  💭 [{pillar_key}] {msg}", file=sys.stderr)
            if emit_thought:
                emit_thought(msg)

        thought(f"Iniciando agente: {pillar['label']}")

        # ── Step 1: Load upstream pillar data (Structured Context) ──
        thought("Carregando dados estruturados dos pilares anteriores...")
        upstream_context = {}
        for up_key in pillar["upstream"]:
            up_data = db.get_pillar_data(business_id, up_key)
            if up_data:
                up_output = up_data.get("structured_output", {})
                # Extract only primary keys - NO TEXT SUMMARIES
                structured_context = _extract_structured_context(up_output, up_key)
                upstream_context[up_key] = structured_context
                thought(f"  ✅ Contexto estruturado de '{up_key}' carregado: {list(structured_context.keys())}")
            else:
                thought(f"  ⚠️ Pilar '{up_key}' ainda não foi executado")

        # Build structured context injection (JSON only, no text)
        upstream_context_json = json.dumps(upstream_context, ensure_ascii=False) if upstream_context else "{}"

        # ── Step 2: Research — search web for pillar-specific data ──
        thought("Pesquisando dados reais na internet...")
        research_text = ""
        research_sources = []

        queries = pillar["search_queries_template"]
        for qi, query_tpl in enumerate(queries):
            query = query_tpl.format(
                segmento=segmento,
                localizacao=localizacao,
                nome=nome,
            )
            thought(f"  🔍 Buscando: {query[:80]}...")

            results = search_duckduckgo(query, max_results=4, region='br-pt')
            for i, r in enumerate(results or []):
                url = r.get("href", "")
                research_sources.append(url)
                snippet = r.get("body", "")
                title = r.get("title", "")
                research_text += f"[Fonte {len(research_sources)}] {title}: {snippet}\n"

                if i < 1:  # Scrape top result per query
                    content = scrape_page(url, timeout=4)
                    if content:
                        research_text += f"Conteúdo: {content[:2500]}\n\n"

            time.sleep(1)  # Rate limit courtesy

        thought(f"Pesquisa concluída: {len(research_sources)} fontes encontradas")

        # ── Step 3: Plan + Execute — LLM generates structured output ──
        thought("IA analisando dados e gerando resultados...")

        # Build restriction context
        restriction_lines = []
        capital = restricoes.get("capital_disponivel", "")
        equipe_solo = restricoes.get("equipe_solo", False)
        if capital in ["zero", "baixo"]:
            restriction_lines.append("Capital ZERO ou baixo: apenas soluções gratuitas ou muito baratas")
        if equipe_solo:
            restriction_lines.append("Equipe de 1 pessoa: tudo deve ser executável solo")
        restriction_text = "\n".join(restriction_lines) if restriction_lines else "Sem restrições especiais"

        # Add structured context processing instructions
        context_instructions = _build_context_instructions(pillar_key, upstream_context)

        # Validate scope compliance
        if not PillarConfig.validate_scope_compliance(pillar_key, upstream_context):
            raise ScopeViolationError(f"Pillar '{pillar_key}' output violates its defined scope")

        schema_description = _build_schema_description(pillar["output_schema"])

        prompt = f"""Você é especialista em {pillar['label']} para PMEs brasileiras.
Empresa: "{nome}" | {segmento} | {modelo} | {localizacao}
{f'Diretiva: {user_command}' if user_command else ''}
Funcionários: {perfil.get('num_funcionarios','?')} | Ticket: {perfil.get('ticket_medio', perfil.get('ticket_medio_estimado','?'))} | Restrições: {restriction_text}

[CONTEXTO UPSTREAM ESTRUTURADO]
{upstream_context_json}
{context_instructions}

[REGRA DE ESCOPO ESTRITO - APENAS PARA Pilar 1]
Se você está processando o Pilar 1 (Público-Alvo): LIMITE-SE APENAS a mapear o mercado. NÃO gere scripts de vendas, quebra de objeções ou diferenciais competitivos. Foque exclusivamente em: "Quem é o alvo e o que ele sofre?". Extraia dados comportamentais e demográficos puros.

[REGRA DE OURO - ALTO PESO]
Você é um estrategista de vendas autônomo operando EXCLUSIVAMENTE em prol da empresa analisada ("{nome}"). Regra de Ouro: Qualquer outra empresa encontrada nos dados de pesquisa que atue no mesmo segmento ("{segmento}") ou venda o mesmo tipo de produto/serviço é ESTRITAMENTE uma CONCORRENTE (Benchmarking) e NUNCA uma parceira estratégica. Na etapa de Jornada do Cliente, o prospect DEVE SEMPRE cotar e fechar negócio com a empresa "{nome}". Use os concorrentes apenas para identificar fraquezas que a "{nome}" pode explorar com seus próprios diferenciais competitivos.

PESQUISA INTERNET:
{research_text[:5000] if research_text else 'Use seu conhecimento especializado.'}

Retorne SOMENTE um objeto JSON com exatamente estes campos (sem texto extra, sem markdown):
{schema_description}

Todos os valores devem ser específicos para "{nome}". Não use valores de exemplo."""

        try:
            result = call_llm(
                prompt=prompt,
                temperature=0.2,
                provider="groq",
                json_mode=True
            )
        except Exception as e:
            thought(f"Modelo principal falhou, tentando fallback...")
            try:
                result = call_llm(
                    prompt=prompt,
                    temperature=0.3,
                    provider="gemini",
                    json_mode=True
                )
            except Exception as e2:
                raise PillarExecutionError(f"Both LLM providers failed: {str(e)}, {str(e2)}")

        # ── Step 4: Save results ──
        thought("Salvando resultados no banco de dados...")
        
        # Validate scope compliance before saving
        if not PillarConfig.validate_scope_compliance(pillar_key, result):
            raise ScopeViolationError(f"Generated output violates pillar '{pillar_key}' scope")
        
        # Save to database
        save_result = db.save_pillar_data(
            business_id=business_id,
            pillar_key=pillar_key,
            structured_output=result,
            sources=research_sources,
            user_command=user_command
        )
        
        if not save_result.get("success"):
            raise PillarExecutionError(f"Failed to save pillar data: {save_result.get('error', 'Unknown error')}")

        thought(f"✅ Pilar '{pillar_key}' executado com sucesso!")
        
        return {
            "success": True,
            "pillar_key": pillar_key,
            "data": result,
            "sources": research_sources,
            "context_used": upstream_context
        }

    except Exception as e:
        error_msg = f"Error in pillar '{pillar_key}': {str(e)}"
        thought(f"❌ {error_msg}")
        raise PillarExecutionError(error_msg)


def _build_context_instructions(pillar_key: str, upstream_context: dict) -> str:
    """Build context-specific instructions for the LLM."""
    if not upstream_context:
        return ""
    
    if pillar_key == "branding" and "publico_alvo" in upstream_context:
        industrias = upstream_context["publico_alvo"].get("industrias_alvo", [])
        dores_por_industria = upstream_context["publico_alvo"].get("dores_por_industria", {})
        return f"\n[CONTEXTO ESTRUTURADO - REQUER PROCESSAMENTO ITERATIVO]\nGere um posicionamento DISTINTO para CADA indústria: {industrias}. Use as dores mapeadas como base: {dores_por_industria}. NÃO funda as indústrias. Crie elementos separados para cada segmento.\n"
    elif pillar_key == "identidade_visual" and "branding" in upstream_context:
        proposta_valor = upstream_context["branding"].get("proposta_valor_tecnica", "")
        industrias_pos = upstream_context["branding"].get("industrias_posicionamentos", [])
        return f"\n[CONTEXTO ESTRUTURADO - REQUER PROCESSAMENTO ITERATIVO]\nBaseie a identidade visual na proposta de valor: '{proposta_valor}'. Crie diretrizes visuais DISTINTAS para CADA indústria: {industrias_pos}. Mantenha coerência mas permita variação por setor.\n"
    elif pillar_key == "canais_venda" and "publico_alvo" in upstream_context:
        industrias = upstream_context["publico_alvo"].get("industrias_alvo", [])
        return f"\n[CONTEXTO ESTRUTURADO - REQUER PROCESSAMENTO ITERATIVO]\nSugira canais DISTINTOS para CADA indústria: {industrias}. Cada setor pode ter canais diferentes. NÃO generalize.\n"
    elif pillar_key == "trafego_organico" and "canais_venda" in upstream_context:
        canais = upstream_context["canais_venda"].get("canais_efetivos", [])
        return f"\n[CONTEXTO ESTRUTURADO]\nAlinhe a estratégia orgânica com os canais: {canais}. Crie conteúdo específico para cada canal.\n"
    elif pillar_key == "trafego_pago" and "canais_venda" in upstream_context:
        canais = upstream_context["canais_venda"].get("canais_efetivos", [])
        return f"\n[CONTEXTO ESTRUTURADO]\nDirecione os anúncios para os canais: {canais}. Otimize para cada plataforma.\n"
    elif pillar_key == "processo_venda" and "trafego_pago" in upstream_context:
        plataformas = upstream_context["trafego_pago"].get("plataformas_principais", [])
        return f"\n[CONTEXTO ESTRUTURADO]\nAdapte o processo de vendas para as plataformas: {plataformas}. Cada origem de tráfego pode ter abordagem diferente.\n"
    
    return ""


def get_pillar_status(pillar_key: str, business_id: str) -> dict:
    """Get execution status for a specific pillar."""
    try:
        pillar_data = db.get_pillar_data(business_id, pillar_key)
        if pillar_data:
            return {
                "executed": True,
                "data": pillar_data.get("structured_output", {}),
                "sources": pillar_data.get("sources", []),
                "updated_at": pillar_data.get("updated_at"),
                "user_command": pillar_data.get("user_command", "")
            }
        else:
            return {
                "executed": False,
                "data": None,
                "sources": [],
                "updated_at": None,
                "user_command": ""
            }
    except Exception as e:
        raise PillarExecutionError(f"Failed to get pillar status: {str(e)}")


def get_pillar_data(business_id: str, pillar_key: str = None):
    """Legacy function - use db.get_pillar_data instead."""
    if pillar_key:
        return db.get_pillar_data(business_id, pillar_key)
    else:
        return db.get_all_pillar_data(business_id)
