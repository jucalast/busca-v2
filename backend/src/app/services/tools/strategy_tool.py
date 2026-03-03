"""
StrategyTool — Creates complete strategy frameworks and action plans.

Positioning strategies, go-to-market plans, pricing strategies, channel strategies.
Produces structured plans with phases, actions, timelines, and KPIs.
"""
from __future__ import annotations
import json
from app.services.tools.base import (
    ToolPlugin, ToolContext, ToolResult, ArtifactType,
    PRODUCTION_PREAMBLE, ANTI_GENERIC_RULES, CASCADE_RULES,
)


class StrategyTool(ToolPlugin):
    name = "strategy_tool"
    description = "Creates complete strategy frameworks and action plans"
    artifact_types = [ArtifactType.ESTRATEGIA, ArtifactType.PLANO_ACAO]
    
    match_keywords = [
        "estratégia", "plano de ação", "plano", "framework",
        "posicionamento", "diferenciação", "go-to-market",
        "precificação", "pricing", "canal de vendas",
        "funil", "jornada", "processo", "fluxo",
        "roadmap", "ação", "implementação", "metodologia",
        "proposta de valor", "value proposition",
    ]
    match_ferramentas = [
        "estrategia",
        "estrategia", "plano_acao", "posicionamento",
        "precificacao", "funil", "processo_vendas",
    ]
    
    def match_score(self, task_data: dict) -> float:
        base = self._keyword_match_score(task_data)
        title = task_data.get("titulo", "").lower()
        if any(kw in title for kw in ["criar estratégia", "desenvolver plano",
                                       "criar plano de ação", "definir processo",
                                       "criar funil", "criar proposta de valor"]):
            base = max(base, 0.85)
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

═══ TAREFA DE PRODUÇÃO: CRIAR ESTRATÉGIA/PLANO ═══
TAREFA: {title}
DESCRIÇÃO: {desc}
ENTREGÁVEL: {entregavel}

{ANTI_GENERIC_RULES}
{CASCADE_RULES}

INSTRUÇÕES DE PRODUÇÃO — ESTRATÉGIA:
Você é um ESTRATEGISTA DE NEGÓCIOS SÊNIOR executando esta tarefa.
NÃO explique teoria de estratégia. CRIE a estratégia REAL.

PRODUZA a estratégia/plano COMPLETO:

REGRAS DE PRODUÇÃO:
1. Cada ação deve ter: responsável, prazo, recurso necessário, KPI
2. Fases ordenadas cronologicamente com dependências claras
3. Métricas de sucesso MENSURÁVEIS (não "aumentar vendas" → "aumentar vendas em 20% em 3 meses")
4. Riscos identificados com plano de mitigação
5. Quick wins (ações de retorno rápido) destacadas

Se for POSICIONAMENTO:
- Declaração de posicionamento formal (Para [público], [marca] é [categoria] que [diferencial])
- Pilares de diferenciação com evidências
- Mapa perceptual vs concorrentes
- Mensagem-chave para cada persona

Se for FUNIL/PROCESSO DE VENDAS:
- Cada etapa do funil com ações concretas
- Scripts/templates para cada fase
- Gatilhos de passagem entre fases
- Métricas de conversão esperadas por fase

Se for PLANO DE AÇÃO:
- Fases com datas reais (próximos 30/60/90 dias)
- Ações específicas com responsáveis
- Investimento necessário por ação
- ROI esperado

JSON OBRIGATÓRIO:
{{
    "entregavel_titulo": "Título da estratégia/plano",
    "entregavel_tipo": "estrategia",
    "opiniao": "Sua análise pessoal sobre a estratégia criada (tom conversacional, min 4 linhas)",
    "conteudo": "A ESTRATÉGIA/PLANO COMPLETO em texto formatado — pronto para apresentar ao time.",
    "structured_data": {{
        "tipo": "posicionamento|funil|plano_acao|go_to_market|pricing|processo",
        "visao_geral": "Resumo executivo da estratégia",
        "fases": [
            {{
                "id": "f1",
                "nome": "Nome da Fase",
                "periodo": "Semana 1-2",
                "objetivo": "O que alcançar nesta fase",
                "acoes": [
                    {{
                        "acao": "Descrição da ação concreta",
                        "responsavel": "Quem faz",
                        "prazo": "Data ou período",
                        "recurso": "O que precisa",
                        "investimento": "R$ 0 ou valor",
                        "kpi": "Métrica de sucesso"
                    }}
                ],
                "meta_fase": "Métrica de conclusão"
            }}
        ],
        "kpis_globais": [
            {{"nome": "Nome do KPI", "meta": "Valor meta", "prazo": "Quando alcançar"}}
        ],
        "riscos": [
            {{"risco": "Descrição", "probabilidade": "alta|media|baixa", "mitigacao": "Como mitigar"}}
        ],
        "quick_wins": ["Ação de retorno rápido 1", "Ação de retorno rápido 2"],
        "investimento_total": "Estimativa de investimento",
        "roi_esperado": "Retorno esperado"
    }},
    "como_aplicar": "Como implementar esta estratégia step by step",
    "proximos_passos": "Primeiras ações imediatas",
    "fontes_consultadas": ["urls"],
    "impacto_estimado": "Impacto quantificado no negócio"
}}

REGRAS:
- Mínimo 3 fases, máximo 6
- Cada fase com mínimo 3 ações concretas
- Todos os KPIs numéricos e mensuráveis
- Prazos reais (não "a definir")
- Investimentos estimados (mesmo que R$ 0)

Retorne APENAS o JSON."""
    
    def post_process(self, llm_result: dict, ctx: ToolContext) -> ToolResult:
        structured = llm_result.get("structured_data", {})
        if isinstance(structured, str):
            try:
                structured = json.loads(structured)
            except (json.JSONDecodeError, TypeError):
                structured = {}
        
        # Count totals
        fases = structured.get("fases", [])
        total_acoes = sum(len(f.get("acoes", [])) for f in fases)
        structured["total_fases"] = len(fases)
        structured["total_acoes"] = total_acoes
        
        # Determine type
        artifact = ArtifactType.ESTRATEGIA
        tipo = structured.get("tipo", "")
        if tipo in ("plano_acao", "go_to_market"):
            artifact = ArtifactType.PLANO_ACAO
        
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
            entregavel_tipo="estrategia",
        )
