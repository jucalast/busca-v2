"""
AnalysisTool — Performs deep data analysis and competitive intelligence.

Market analysis, competitor analysis, SWOT, customer behavior analysis,
trend analysis. Produces structured findings with data, charts, insights.
"""
from __future__ import annotations
import json
from app.services.tools.base import (
    ToolPlugin, ToolContext, ToolResult, ArtifactType,
    PRODUCTION_PREAMBLE, ANTI_GENERIC_RULES, CASCADE_RULES,
)


class AnalysisTool(ToolPlugin):
    name = "analysis_tool"
    description = "Performs deep analysis — competitive intel, SWOT, market analysis"
    artifact_types = [ArtifactType.ANALISE]
    
    match_keywords = [
        "análise", "analisar", "swot", "concorrente", "concorrência",
        "benchmark", "comparação", "tendência", "trend",
        "mercado", "segmentação", "comportamento",
        "inteligência", "insight", "dados", "métricas",
        "avaliação", "diagnóstico", "auditoria", "gap",
    ]
    match_ferramentas = [
        "analise", "analise_concorrente", "analise_concorrentes", "analise_mercado",
        "analise_dados", "swot", "benchmark", "auditoria", "diagnostico",
    ]
    
    def match_score(self, task_data: dict) -> float:
        base = self._keyword_match_score(task_data)
        title = task_data.get("titulo", "").lower()
        # Strong boost for analysis-specific patterns
        if any(kw in title for kw in ["analisar", "análise de", "swot",
                                       "benchmark", "comparar concorrentes",
                                       "auditar", "diagnosticar"]):
            base = max(base, 0.92)   # Higher than document_tool's 0.9 ferramenta match
        return base
    
    def _get_export_formats(self):
        return ["google_docs", "google_sheets"]
    
    def build_production_prompt(self, ctx: ToolContext) -> str:
        context_block = self._build_context_block(ctx)
        task = ctx.task_data
        title = task.get("titulo", "")
        desc = task.get("descricao", "")
        entregavel = task.get("entregavel_ia", task.get("entregavel", desc))
        
        return f"""{context_block}

{PRODUCTION_PREAMBLE}

═══ TAREFA DE PRODUÇÃO: EXECUTAR ANÁLISE ═══
TAREFA: {title}
DESCRIÇÃO: {desc}
ENTREGÁVEL: {entregavel}

{ANTI_GENERIC_RULES}
{CASCADE_RULES}

INSTRUÇÕES DE PRODUÇÃO — ANÁLISE:
Você é um ANALISTA DE NEGÓCIOS SÊNIOR executando esta análise AGORA.
NÃO explique "como fazer uma análise". FAÇA a análise.

EXECUTE a análise COMPLETA:

Se for ANÁLISE DE CONCORRENTES:
- Liste 3-5 concorrentes REAIS do setor (use os dados de mercado)
- Para cada: posicionamento, preço, diferenciais, pontos fracos, canais
- Matriz comparativa com scores
- Oportunidades que eles estão perdendo
- Estratégia para superar cada um

Se for SWOT:
- Mínimo 5 itens por quadrante (Forças, Fraquezas, Oportunidades, Ameaças)
- Cada item com evidência/dados
- Cruzamento: FO, FA, DO, DA com ações
- Priorização por impacto

Se for ANÁLISE DE MERCADO/COMPORTAMENTO:
- Dados quantitativos (números, %, tendências)
- Segmentação clara
- Insights acionáveis (não óbvios)
- Oportunidades identificadas com tamanho estimado
- Riscos do mercado

Se for AUDITORIA/DIAGNÓSTICO:
- Checklist completo de itens avaliados
- Score por área
- Gaps identificados com prioridade
- Recomendações por gap

TODOS OS DADOS DEVEM SER ESPECÍFICOS PARA ESTE NEGÓCIO.
Use os dados de mercado já pesquisados como base, mas VAYA ALÉM — crie insights originais.

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título da análise",
    "entregavel_tipo": "analise",
    "opiniao": "Sua análise pessoal sobre os achados (tom conversacional, min 4 linhas)",
    "conteudo": "A ANÁLISE COMPLETA formatada — com dados, tabelas, insights. Pronta para usar.",
    "structured_data": {{
        "tipo_analise": "concorrentes|swot|mercado|comportamento|auditoria|gap",
        "resumo_executivo": "2-3 frases com os achados mais importantes",
        "achados_principais": [
            {{
                "achado": "Descrição do achado",
                "evidencia": "Dados/métricas que suportam",
                "impacto": "alto|medio|baixo",
                "acao_recomendada": "O que fazer"
            }}
        ],
        "dados_comparativos": [
            {{
                "item": "Nome (concorrente, área, etc.)",
                "metricas": {{
                    "criterio1": "valor",
                    "criterio2": "valor"
                }},
                "score": 8.5,
                "pontos_fortes": ["pf1"],
                "pontos_fracos": ["pf1"]
            }}
        ],
        "oportunidades": [
            {{
                "oportunidade": "Descrição",
                "tamanho_estimado": "Potencial em R$ ou %",
                "dificuldade": "alta|media|baixa",
                "prazo_retorno": "curto|medio|longo"
            }}
        ],
        "conclusao": "Conclusão principal da análise"
    }},
    "como_aplicar": "Como usar os resultados desta análise",
    "proximos_passos": "Ações imediatas baseadas nos achados",
    "fontes_consultadas": ["urls"],
    "impacto_estimado": "Impacto de agir sobre os achados"
}}

REGRAS:
- Mínimo 5 achados principais
- Todos os achados com evidência/dados
- Comparativos com scores numéricos
- Oportunidades priorizadas por facilidade x impacto
- Conclusões ACIONÁVEIS (não "é importante analisar mais")

Retorne APENAS o JSON."""
    
    def post_process(self, llm_result: dict, ctx: ToolContext) -> ToolResult:
        structured = llm_result.get("structured_data", {})
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except (json.JSONDecodeError, TypeError):
                structured = {}
        
        # Summary stats
        achados = structured.get("achados_principais", [])
        oportunidades = structured.get("oportunidades", [])
        structured["stats"] = {
            "total_achados": len(achados),
            "achados_alto_impacto": sum(1 for a in achados if a.get("impacto") == "alto"),
            "total_oportunidades": len(oportunidades),
        }
        
        return ToolResult(
            success=True,
            artifact_type=ArtifactType.ANALISE,
            content=llm_result.get("conteudo", ""),
            structured_data=structured,
            export_formats=self._get_export_formats(),
            opiniao=llm_result.get("opiniao", ""),
            como_aplicar=llm_result.get("como_aplicar", ""),
            proximos_passos=llm_result.get("proximos_passos", ""),
            fontes_consultadas=llm_result.get("fontes_consultadas", []),
            impacto_estimado=llm_result.get("impacto_estimado", ""),
            entregavel_titulo=llm_result.get("entregavel_titulo", ""),
            entregavel_tipo="analise",
        )
