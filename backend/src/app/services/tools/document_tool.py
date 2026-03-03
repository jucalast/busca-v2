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
        is_finalization = "finalization" in ctx.task_id or "editor_final" in task.get("ferramenta", "")
        
        # Finalization tasks need a stronger prompt that synthesizes all subtask data
        if is_finalization:
            return f"""{context_block}

═══ MODO PRODUÇÃO — DOCUMENTO FINAL CONSOLIDADO ═══
TAREFA ORIGINAL: {title}
DESCRIÇÃO: {desc}
ENTREGÁVEL ESPERADO: {entregavel}

🚨 ESTA É A ETAPA DE FINALIZAÇÃO — Você tem acima TODOS os dados das subtarefas anteriores.
Seu trabalho é SINTETIZAR, APROFUNDAR e INTEGRAR esses dados em um documento final ÚNICO, COESO e PROFISSIONAL.

REGRAS CRÍTICAS:
1. NÃO RESUMA superficialmente. APROFUNDE cada ponto com análise crítica e insights estratégicos.
2. EXTRAIA e CITE dados ESPECÍFICOS das subtarefas: nomes de empresas, números, porcentagens, tendências reais, URLs, personas já definidas.
3. INTEGRE todos os dados em uma narrativa coesa — não copie seções lado a lado, CONECTE as ideias entre si.
4. CADA SEÇÃO deve ter no mínimo 3 parágrafos densos com dados concretos. PROIBIDO parágrafos de 1-2 frases.
5. Se personas foram criadas nas subtarefas, NOMEIE-AS, descreva seus perfis COMPLETOS, e USE-AS ao longo do documento.
6. INCLUA análise cruzada: como os dados de uma subtarefa impactam as conclusões de outra.
7. Recomendações devem ser ULTRA-ESPECÍFICAS para o negócio: com ações concretas, métricas, prazos sugeridos.
8. O campo "conteudo" DEVE ter MÍNIMO 2000 palavras. Se tiver menos, EXPANDA com mais análise e detalhamento.
9. PROIBIDO conteúdo genérico. CADA frase deve conter informação específica do setor/negócio.
10. Se houver dados de pesquisa brutos, TRANSFORME-OS em análise — não os ignore.

ESTRUTURA OBRIGATÓRIA DO DOCUMENTO FINAL:
## Introdução e Contexto (mínimo 2 parágrafos, contextualizando o negócio no mercado)
## [Seções temáticas conforme o assunto] (cada uma com mínimo 3 parágrafos, dados e análise)
## Análise Estratégica Integrada (cruzando todos os dados das subtarefas)
## Recomendações Práticas (ações concretas, específicas, com prioridade)
## Próximos Passos e Implementação (cronograma sugerido com ações claras)

EXEMPLO DE QUALIDADE ESPERADA (NÃO copie, use como referência de profundidade):
❌ RUIM: "A sustentabilidade é importante para o setor de embalagens."
✅ BOM: "O mercado de papelão ondulado brasileiro movimenta R$ XX bilhões/ano, com crescimento de X% impulsionado pela demanda por embalagens sustentáveis. Empresas como [nome da pesquisa] reportaram aumento de X% na procura por soluções recicláveis. Para a [nome do negócio], isso representa uma oportunidade de posicionar seu atendimento consultivo como diferencial frente a concorrentes como [nomes da pesquisa], especialmente no segmento de lotes menores onde gigantes como [nome] têm menor agilidade."

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título profissional do documento final",
    "entregavel_tipo": "documento",
    "opiniao": "Análise pessoal do especialista sobre o trabalho realizado, citando dados-chave e insights mais importantes. Tom conversacional. Min 5 linhas.",
    "conteudo": "DOCUMENTO FINAL COMPLETO em markdown. MÍNIMO 2000 palavras. Integração total dos dados. Análise profunda. Recomendações específicas.",
    "como_aplicar": "Instruções detalhadas de como aplicar este documento no negócio (min 3 frases)",
    "proximos_passos": "Próximas ações concretas com prioridade (min 3 itens)",
    "fontes_consultadas": ["urls das fontes reais usadas nas subtarefas"],
    "impacto_estimado": "Impacto esperado com métricas quando possível"
}}

Retorne APENAS o JSON."""
        
        # Standard (non-finalization) document production
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
6. Se houver informação de CADEIA PRODUTIVA no contexto, RESPEITE: NÃO confunda FORNECEDORES de matéria-prima com CONCORRENTES.
7. O campo "conteudo" DEVE ter MÍNIMO 1000 palavras. INCORPORE no corpo do texto TODOS os dados disponíveis: nomes de empresas, números, tendências, análises, dados de mercado. Se há dados de pesquisa acima, ESCREVA-OS no documento, não apenas os mencione.
8. Se as subtarefas anteriores contêm dados de pesquisa brutos, USE-OS como base para o documento. Transforme dados brutos em análise estruturada.

ESTRUTURA DO DOCUMENTO:
- Título claro e descritivo
- Sumário executivo (2-3 parágrafos)
- Seções com ## para cada tema principal
- Dados concretos e citações da pesquisa em cada seção
- Recomendações práticas e acionáveis
- Conclusão com próximos passos

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título descritivo do documento",
    "entregavel_tipo": "documento",
    "opiniao": "Sua análise em tom conversacional ('pelo que analisei...'), citando dados da pesquisa. Min 3 linhas.",
    "conteudo": "DOCUMENTO COMPLETO em markdown com ## seções. MÍNIMO 1000 palavras. Dados concretos, recomendações acionáveis, análise profunda do setor.",
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
