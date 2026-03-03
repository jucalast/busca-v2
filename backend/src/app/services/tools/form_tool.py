"""
FormTool — Creates complete surveys, questionnaires, and forms.

The LLM produces structured form data (questions, options, types) that can be
directly exported to Google Forms or used as-is.
"""
from __future__ import annotations
import json
from app.services.tools.base import (
    ToolPlugin, ToolContext, ToolResult, ArtifactType,
    PRODUCTION_PREAMBLE, ANTI_GENERIC_RULES, CASCADE_RULES,
)


class FormTool(ToolPlugin):
    name = "form_tool"
    description = "Creates complete surveys, questionnaires, and research forms"
    artifact_types = [ArtifactType.FORMULARIO]
    
    match_keywords = [
        "formulário", "pesquisa online", "questionário", "survey",
        "enquete", "perguntas", "entrevista", "feedback",
        "nps", "satisfação", "coleta de dados", "formulario",
    ]
    match_ferramentas = [
        "pesquisa_online", "formulario", "enquete", "survey",
        "nps", "feedback", "coleta_dados",
    ]
    
    def match_score(self, task_data: dict) -> float:
        base = self._keyword_match_score(task_data)
        # Boost if title contains "criar pesquisa" or "criar formulário"
        title = task_data.get("titulo", "").lower()
        if any(kw in title for kw in ["criar pesquisa", "criar formulário", "criar questionário",
                                       "aplicar pesquisa", "aplicar questionário"]):
            base = max(base, 0.85)
        return base
    
    def _get_export_formats(self):
        return ["google_forms", "google_docs", "pdf"]
    
    def build_production_prompt(self, ctx: ToolContext) -> str:
        context_block = self._build_context_block(ctx)
        task = ctx.task_data
        title = task.get("titulo", "")
        desc = task.get("descricao", "")
        entregavel = task.get("entregavel_ia", task.get("entregavel", desc))
        
        return f"""{context_block}

{PRODUCTION_PREAMBLE}

═══ TAREFA DE PRODUÇÃO: CRIAR FORMULÁRIO/PESQUISA ═══
TAREFA: {title}
DESCRIÇÃO: {desc}
ENTREGÁVEL: {entregavel}

{ANTI_GENERIC_RULES}
{CASCADE_RULES}

INSTRUÇÕES DE PRODUÇÃO — FORMULÁRIO:
Você NÃO está explicando "como criar uma pesquisa".
Você ESTÁ CRIANDO a pesquisa completa AGORA, pronta para aplicar.

CRIE o formulário REAL com:
- Título profissional e descrição introdutória
- Seções temáticas organizadas logicamente
- Perguntas ESPECÍFICAS para este negócio e público
- Mix de tipos: múltipla escolha, escala likert, texto livre, NPS
- Opções de resposta pré-definidas e relevantes
- Lógica condicional quando necessário (ex: "Se respondeu X, vá para seção Y")

Use as PERSONAS e DADOS já definidos nas subtarefas anteriores para personalizar
as perguntas. Se a persona é "João Carlos, gerente de compras", faça perguntas
que façam sentido para ELE.

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título do formulário/pesquisa",
    "entregavel_tipo": "formulario",
    "opiniao": "Sua análise pessoal sobre o formulário criado (tom conversacional, min 4 linhas)",
    "conteudo": "VERSÃO COMPLETA em texto corrido formatado do formulário — com todas as perguntas, opções, introdução e conclusão. Pronto para copiar e usar.",
    "structured_data": {{
        "titulo_formulario": "Título do Formulário",
        "descricao_intro": "Texto de introdução para o respondente",
        "publico_alvo": "Para quem é esta pesquisa",
        "tempo_estimado": "5-10 minutos",
        "secoes": [
            {{
                "titulo": "Nome da Seção",
                "descricao": "Descrição opcional da seção",
                "perguntas": [
                    {{
                        "id": "q1",
                        "tipo": "multipla_escolha|escala_likert|texto_livre|nps|caixa_selecao|dropdown|grade",
                        "obrigatoria": true,
                        "texto": "Texto completo da pergunta",
                        "opcoes": ["Opção 1", "Opção 2", "Opção 3"],
                        "escala_min": 1,
                        "escala_max": 5,
                        "labels": {{"min": "Muito insatisfeito", "max": "Muito satisfeito"}}
                    }}
                ]
            }}
        ],
        "mensagem_final": "Mensagem de agradecimento ao respondente",
        "total_perguntas": 15
    }},
    "como_aplicar": "Como distribuir e aplicar esta pesquisa",
    "proximos_passos": "O que fazer com os resultados",
    "fontes_consultadas": ["urls"],
    "impacto_estimado": "Impacto esperado"
}}

REGRAS IMPORTANTES:
- Mínimo 12 perguntas, máximo 25
- Cada seção 3-6 perguntas
- Mínimo 3 seções temáticas
- Pelo menos 1 pergunta NPS
- Pelo menos 2 perguntas de texto livre
- Opções devem ser ESPECÍFICAS (não "Outro" sozinho — inclua opções reais)

Retorne APENAS o JSON."""
    
    def post_process(self, llm_result: dict, ctx: ToolContext) -> ToolResult:
        structured = llm_result.get("structured_data", {})
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except (json.JSONDecodeError, TypeError):
                structured = {}
        
        # Validate form has sections and questions
        secoes = structured.get("secoes", [])
        total_perguntas = sum(len(s.get("perguntas", [])) for s in secoes)
        structured["total_perguntas"] = total_perguntas
        structured["total_secoes"] = len(secoes)
        
        return ToolResult(
            success=True,
            artifact_type=ArtifactType.FORMULARIO,
            content=llm_result.get("conteudo", ""),
            structured_data=structured,
            export_formats=self._get_export_formats(),
            opiniao=llm_result.get("opiniao", ""),
            como_aplicar=llm_result.get("como_aplicar", ""),
            proximos_passos=llm_result.get("proximos_passos", ""),
            fontes_consultadas=llm_result.get("fontes_consultadas", []),
            impacto_estimado=llm_result.get("impacto_estimado", ""),
            entregavel_titulo=llm_result.get("entregavel_titulo", ""),
            entregavel_tipo="formulario",
        )
