"""
DocumentTool — Produces complete, professional documents.

Personas, reports, research documents, sales briefs, competitive analyses.
The LLM creates the ACTUAL document, not instructions on how to write one.
"""
from __future__ import annotations
import json
from app.services.tools.base import (
    ToolPlugin, ToolContext, ToolResult, ArtifactType,
    PRODUCTION_PREAMBLE, ANTI_GENERIC_RULES, CASCADE_RULES,
)


class DocumentTool(ToolPlugin):
    name = "document_tool"
    description = "Produces complete professional documents (personas, reports, analyses)"
    artifact_types = [ArtifactType.DOCUMENTO, ArtifactType.ANALISE]
    
    match_keywords = [
        "documento", "persona", "relatório", "report", "análise",
        "perfil", "mapeamento", "diagnóstico", "pesquisa",
        "briefing", "proposta", "apresentação", "guia",
        "manual", "playbook", "ficha", "dossiê",
    ]
    match_ferramentas = [
        "documento", "criacao_persona", "pesquisa_mercado",
        "editor_final", "mapeamento", "persona", "relatorio",
    ]
    
    def match_score(self, task_data: dict) -> float:
        return self._keyword_match_score(task_data)
    
    def _get_export_formats(self):
        return ["google_docs", "pdf"]
    
    def build_production_prompt(self, ctx: ToolContext) -> str:
        context_block = self._build_context_block(ctx)
        task = ctx.task_data
        title = task.get("titulo", "")
        desc = task.get("descricao", "")
        entregavel = task.get("entregavel_ia", task.get("entregavel", desc))
        
        return f"""{context_block}

═══ MODO PRODUÇÃO — CRIAR DOCUMENTO ═══
TAREFA: {title}
DESCRIÇÃO: {desc}
ENTREGÁVEL: {entregavel}

REGRAS (TODAS OBRIGATÓRIAS):
1. Você é o profissional EXECUTANDO. Produza o artefato PRONTO PARA USO, não explique como fazer.
2. EXTRAIA dados REAIS da PESQUISA REALIZADA acima: empresas, tendências, números, dores do setor.
3. Sem dados na pesquisa → "Análise profissional do setor". NÃO invente estatísticas.
4. MANTENHA consistência com subtarefas anteriores (persona, dados, decisões já tomadas).
5. Seja ultra-específico para ESTE setor e ESTE negócio. Zero conteúdo genérico.

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título descritivo do documento",
    "entregavel_tipo": "documento",
    "opiniao": "Sua análise em tom conversacional ('pelo que analisei...'), citando dados da pesquisa. Min 3 linhas.",
    "conteudo": "DOCUMENTO COMPLETO em markdown com ## seções. Dados concretos, recomendações acionáveis. Min 800 palavras.",
    "como_aplicar": "Como usar este documento no negócio",
    "proximos_passos": "Próximas ações recomendadas",
    "fontes_consultadas": ["urls das fontes usadas"],
    "impacto_estimado": "Impacto no negócio"
}}

Retorne APENAS o JSON."""
    
    def post_process(self, llm_result: dict, ctx: ToolContext) -> ToolResult:
        # Ensure structured_data exists
        structured = llm_result.get("structured_data", {})
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except (json.JSONDecodeError, TypeError):
                structured = {}
        
        return ToolResult(
            success=True,
            artifact_type=ArtifactType.DOCUMENTO,
            content=llm_result.get("conteudo", ""),
            structured_data=structured,
            export_formats=self._get_export_formats(),
            opiniao=llm_result.get("opiniao", ""),
            como_aplicar=llm_result.get("como_aplicar", ""),
            proximos_passos=llm_result.get("proximos_passos", ""),
            fontes_consultadas=llm_result.get("fontes_consultadas", []),
            impacto_estimado=llm_result.get("impacto_estimado", ""),
            entregavel_titulo=llm_result.get("entregavel_titulo", ""),
            entregavel_tipo="documento",
        )
