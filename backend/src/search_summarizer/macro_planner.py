"""
Macro Planner — Generates the execution plan skeleton (Phases + Task Titles only).

This is Phase 1 of the Cascading Lazy-Load architecture.
Uses minimal tokens: only phase names and task titles are generated.
The full sub-task detail is generated JIT when the user clicks a task (micro_planner.py).
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cli import call_groq


def generate_macro_plan(profile: dict, score: dict, meta: str, discovery_data: dict = None, emit_thought=None) -> dict:
    """
    Generate a macro execution plan: phases with task titles only.
    
    Args:
        profile: Full business profile from profiler
        score: Score result with dimensoes
        meta: User's goal (e.g. "Bater R$ 50k de faturamento mensal em 6 meses")
        discovery_data: Optional discovery results
        emit_thought: Optional callback for real-time progress
    
    Returns:
        {
            "meta": "...",
            "horizonte": "3 meses",
            "fases": [
                {
                    "id": "fase_1",
                    "titulo": "Fase 1: Fundações (Semanas 1-2)",
                    "descricao_curta": "Montar a base...",
                    "semanas": "1-2",
                    "tarefas": [
                        {
                            "id": "t_1_1",
                            "titulo": "Configurar Instagram Shopping com 10 produtos",
                            "categoria": "presenca_digital",
                            "impacto": "alto",
                            "tempo_estimado": "2-4h"
                        }
                    ]
                }
            ]
        }
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"error": "GROQ_API_KEY not configured"}

    if emit_thought:
        emit_thought("Gerando plano de execução personalizado...")

    perfil = profile.get("perfil", {})
    restricoes = profile.get("restricoes_criticas", {})

    # Build compact context (minimize tokens)
    nome = perfil.get("nome", perfil.get("nome_negocio", "Negócio"))
    segmento = perfil.get("segmento", "")
    modelo = perfil.get("modelo_negocio", perfil.get("modelo", ""))
    localizacao = perfil.get("localizacao", "")
    dificuldades = perfil.get("dificuldades", "")
    capital = restricoes.get("capital_disponivel", perfil.get("capital_disponivel", "não informado"))
    equipe_solo = restricoes.get("equipe_solo", False)
    canais = restricoes.get("canais_existentes", [])

    # Extract dimension scores (compact)
    dim_summary = ""
    dimensoes = score.get("dimensoes", {})
    for dim_key, dim_val in dimensoes.items():
        s = dim_val.get("score", "?")
        status = dim_val.get("status", "?")
        dim_summary += f"  - {dim_key}: {s}/100 ({status})\n"

    score_geral = score.get("score_geral", 0)
    classificacao = score.get("classificacao", "")

    # Discovery summary (compact)
    discovery_summary = ""
    if discovery_data and discovery_data.get("found"):
        pd = discovery_data.get("presenca_digital", {})
        for canal, info in pd.items():
            if isinstance(info, dict) and info.get("encontrado"):
                discovery_summary += f"  - {canal}: presente\n"

    # Restriction warnings
    restriction_lines = []
    if capital in ["zero", "baixo"]:
        restriction_lines.append("Capital ZERO ou baixo: apenas ferramentas gratuitas")
    if equipe_solo:
        restriction_lines.append("Equipe de 1 pessoa: tarefas devem ser executáveis solo em poucas horas")
    if any("instagram" in str(c).lower() for c in canais):
        restriction_lines.append("Já usa Instagram: otimizar, não criar do zero")
    restriction_text = "\n".join(restriction_lines) if restriction_lines else "Sem restrições especiais"

    prompt = f"""Você é um consultor estratégico de crescimento. Crie um PLANO MACRO de execução.

META DO USUÁRIO: "{meta}"

NEGÓCIO:
- Nome: {nome}
- Segmento: {segmento}
- Modelo: {modelo}
- Local: {localizacao}
- Dificuldades: {dificuldades}
- Score geral: {score_geral}/100 ({classificacao})

SCORES POR DIMENSÃO:
{dim_summary}

PRESENÇA ONLINE REAL:
{discovery_summary if discovery_summary else "Sem dados específicos encontrados"}

RESTRIÇÕES:
{restriction_text}

REGRAS CRÍTICAS:
1. Gere APENAS o esqueleto do plano: fases + títulos de tarefas
2. NÃO gere sub-tarefas, passos detalhados ou ferramentas específicas (isso será gerado depois)
3. Cada tarefa deve ter um título ULTRA-ESPECÍFICO (não genérico)
4. Organize em 3-4 fases cronológicas (ex: Semanas 1-2, Semanas 3-4, etc.)
5. 3-5 tarefas por fase (total de 12-20 tarefas no plano)
6. Priorize resolver a dificuldade principal PRIMEIRO
7. Respeite as restrições de capital e equipe
8. Categorias válidas: presenca_digital, competitividade, diversificacao_canais, precificacao, potencial_mercado, maturidade_operacional

JSON OBRIGATÓRIO:
{{
    "meta": "{meta}",
    "horizonte": "X meses",
    "resumo_estrategia": "2-3 frases sobre a estratégia geral",
    "fases": [
        {{
            "id": "fase_1",
            "titulo": "Fase 1: [Nome descritivo] (Semanas X-Y)",
            "descricao_curta": "1 frase sobre o objetivo desta fase",
            "semanas": "1-2",
            "tarefas": [
                {{
                    "id": "t_1_1",
                    "titulo": "Título ESPECÍFICO da tarefa (ex: Gravar 3 depoimentos em vídeo)",
                    "categoria": "presenca_digital",
                    "impacto": "alto/medio/baixo",
                    "tempo_estimado": "2-4h"
                }}
            ]
        }}
    ]
}}

Retorne APENAS o JSON."""

    try:
        result = call_groq(
            api_key, prompt,
            temperature=0.3,
            model="llama-3.3-70b-versatile",
            force_json=True
        )

        if emit_thought:
            n_fases = len(result.get("fases", []))
            n_tarefas = sum(len(f.get("tarefas", [])) for f in result.get("fases", []))
            emit_thought(f"Plano gerado: {n_fases} fases, {n_tarefas} tarefas")

        return {
            "success": True,
            "plan": result
        }

    except Exception as e:
        print(f"  ❌ Erro no macro planner: {e}", file=sys.stderr)
        # Fallback to smaller model
        try:
            if emit_thought:
                emit_thought("Tentando modelo alternativo para o plano...")
            result = call_groq(
                api_key, prompt,
                temperature=0.3,
                model="llama-3.1-8b-instant",
                force_json=True
            )
            return {
                "success": True,
                "plan": result
            }
        except Exception as e2:
            return {
                "success": False,
                "error": f"Erro ao gerar plano macro: {str(e2)[:200]}"
            }
