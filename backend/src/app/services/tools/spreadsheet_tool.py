"""
SpreadsheetTool — Creates structured tabular data.

Competitive analyses, pricing matrices, lead lists, content calendars,
action plans with dates. Output is structured as rows/columns for export
to Google Sheets or CSV.
"""
from __future__ import annotations
import json
from app.services.tools.base import (
    ToolPlugin, ToolContext, ToolResult, ArtifactType,
    PRODUCTION_PREAMBLE, ANTI_GENERIC_RULES, CASCADE_RULES,
)


class SpreadsheetTool(ToolPlugin):
    name = "spreadsheet_tool"
    description = "Creates structured tabular data (spreadsheets, matrices, lists)"
    artifact_types = [ArtifactType.PLANILHA, ArtifactType.CALENDARIO]
    
    match_keywords = [
        "planilha", "tabela", "matriz", "lista de leads",
        "lista de contatos", "calendário editorial", "cronograma",
        "comparação", "comparativo", "ranking", "preços",
        "orçamento", "budget", "timeline", "checklist",
        "controle", "dashboard", "scorecard", "kpi",
    ]
    match_ferramentas = [
        "planilha",
        "planilha", "calendario", "cronograma", "matriz",
        "lista_leads", "comparativo", "controle",
    ]
    
    def match_score(self, task_data: dict) -> float:
        base = self._keyword_match_score(task_data)
        # Boost for clearly tabular tasks
        title = task_data.get("titulo", "").lower()
        if any(kw in title for kw in ["calendário", "cronograma", "lista de",
                                       "planilha", "matriz", "comparativo"]):
            base = max(base, 0.85)
        return base
    
    def _get_export_formats(self):
        return ["google_sheets", "csv", "google_docs"]
    
    def build_production_prompt(self, ctx: ToolContext) -> str:
        context_block = self._build_context_block(ctx)
        task = ctx.task_data
        title = task.get("titulo", "")
        desc = task.get("descricao", "")
        entregavel = task.get("entregavel_ia", task.get("entregavel", desc))
        
        return f"""{context_block}

{PRODUCTION_PREAMBLE}

═══ TAREFA DE PRODUÇÃO: CRIAR PLANILHA/TABELA ESTRUTURADA ═══
TAREFA: {title}
DESCRIÇÃO: {desc}
ENTREGÁVEL: {entregavel}

{ANTI_GENERIC_RULES}
{CASCADE_RULES}

INSTRUÇÕES DE PRODUÇÃO — PLANILHA/DADOS TABULARES:
Você NÃO está explicando "como organizar dados em planilha".
Você ESTÁ CRIANDO a planilha/tabela COMPLETA AGORA, com dados reais.

CRIE os dados REAIS com:
- Colunas claramente definidas e nomeadas
- Linhas preenchidas com dados ESPECÍFICOS para este negócio
- Fórmulas/cálculos onde aplicável
- Categorização e agrupamento lógico
- Dados numéricos quando relevante (preços, percentuais, datas)

Se for um CALENDÁRIO EDITORIAL:
- Datas reais (próximos 30-90 dias)
- Temas específicos para cada publicação
- Horários recomendados
- Canais para cada peça
- Status (programado, rascunho, etc.)

Se for uma LISTA DE LEADS:
- Nomes de empresas/pessoas (fictícios mas realistas para o setor)
- Dados de contato relevantes
- Score/priorização
- Estratégia de abordagem para cada

Se for uma MATRIZ/COMPARATIVO:
- Critérios claros de comparação
- Scores ou classificações
- Prós e contras de cada opção
- Recomendação destacada

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título da planilha/tabela",
    "entregavel_tipo": "planilha",
    "opiniao": "Sua análise pessoal sobre os dados criados (tom conversacional, min 4 linhas)",
    "conteudo": "VERSÃO FORMATADA em markdown da planilha — use tabelas markdown (| col1 | col2 |). Incluir todos os dados de forma legível.",
    "structured_data": {{
        "titulo_planilha": "Título",
        "descricao": "O que esta planilha contém",
        "abas": [
            {{
                "nome": "Nome da aba",
                "colunas": ["Coluna 1", "Coluna 2", "Coluna 3"],
                "linhas": [
                    ["Dado 1", "Dado 2", "Dado 3"],
                    ["Dado 4", "Dado 5", "Dado 6"]
                ],
                "total_linhas": 10
            }}
        ],
        "resumo": {{
            "total_registros": 10,
            "metricas_calculadas": {{"nome": "valor"}}
        }}
    }},
    "como_aplicar": "Como usar esta planilha no dia a dia",
    "proximos_passos": "O que fazer com estes dados",
    "fontes_consultadas": ["urls"],
    "impacto_estimado": "Impacto esperado"
}}

REGRAS:
- Mínimo 8 linhas de dados reais por aba
- Máximo 3 abas (foque na principal)
- Todos os dados devem ser ESPECÍFICOS para este negócio
- Se é calendário: mínimo 20 entradas com datas reais
- Se é lista de leads: mínimo 10 leads com dados completos

Retorne APENAS o JSON."""
    
    def post_process(self, llm_result: dict, ctx: ToolContext) -> ToolResult:
        structured = llm_result.get("structured_data", {})
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except (json.JSONDecodeError, TypeError):
                structured = {}
        
        # Count total rows across all sheets
        total_rows = 0
        for aba in structured.get("abas", []):
            total_rows += len(aba.get("linhas", []))
        if "resumo" not in structured:
            structured["resumo"] = {}
        structured["resumo"]["total_registros"] = total_rows
        
        # Determine if it's a calendar
        artifact = ArtifactType.PLANILHA
        title_lower = llm_result.get("entregavel_titulo", "").lower()
        if any(kw in title_lower for kw in ["calendário", "cronograma", "timeline"]):
            artifact = ArtifactType.CALENDARIO
        
        return ToolResult(
            success=True,
            artifact_type=artifact,
            content=llm_result.get("conteudo", ""),
            structured_data=structured,
            export_formats=self._get_export_formats(),
            opiniao=llm_result.get("opiniao", ""),
            como_aplicar=llm_result.get("como_aplicar", ""),
            proximos_passos=llm_result.get("proximos_passos", ""),
            fontes_consultadas=llm_result.get("fontes_consultadas", []),
            impacto_estimado=llm_result.get("impacto_estimado", ""),
            entregavel_titulo=llm_result.get("entregavel_titulo", ""),
            entregavel_tipo="planilha",
        )
