"""
Base classes for the Tool Plugin system.

Architecture: 2-Phase Execution
================================
Phase 1 (PESQUISA): Research + plan what to do (current system - unchanged)
Phase 2 (PRODUCAO): Actually CREATE the artifact using specialized tool prompts

The ToolPlugin system intercepts execution at Phase 2. When a subtask is 
classified as PRODUCAO, the matched tool builds a specialized production prompt 
that forces the LLM to output STRUCTURED DATA (JSON schemas, tables, real content)
instead of generic advice text.

The key insight: the LLM IS the executor. We don't need external APIs to "create
a survey" — the LLM creates the survey content as structured JSON that can be
directly exported to Google Forms, Google Docs, Sheets, etc.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


# ═══════════════════════════════════════════════════════════════════
# EXECUTION MODES
# ═══════════════════════════════════════════════════════════════════

class ExecutionMode(str, Enum):
    """How a subtask should be executed."""
    PESQUISA = "pesquisa"      # Research / gather data / plan
    PRODUCAO = "producao"      # Actually CREATE the deliverable


# ═══════════════════════════════════════════════════════════════════
# ARTIFACT TYPES — What kind of output a tool produces
# ═══════════════════════════════════════════════════════════════════

class ArtifactType(str, Enum):
    DOCUMENTO = "documento"           # Full doc (persona, report, plan)
    FORMULARIO = "formulario"         # Survey / questionnaire  
    PLANILHA = "planilha"             # Spreadsheet / data table
    CONTEUDO = "conteudo"             # Marketing content (posts, emails, ads)
    ESTRATEGIA = "estrategia"         # Strategy framework / action plan
    ANALISE = "analise"               # Data analysis / competitive intel
    SCRIPT = "script"                 # Sales scripts, video scripts
    TEMPLATE = "template"             # Reusable templates
    CALENDARIO = "calendario"         # Content calendar, timeline
    PLANO_ACAO = "plano_acao"         # Detailed action plan with steps


# ═══════════════════════════════════════════════════════════════════
# TOOL CONTEXT — Everything a tool needs to execute
# ═══════════════════════════════════════════════════════════════════

@dataclass
class ToolContext:
    """All the context a tool needs to produce a deliverable."""
    analysis_id: str
    pillar_key: str
    task_id: str
    task_data: dict                         # The subtask/task definition
    business_profile: dict                  # Business brief
    specialist: dict                        # Specialist persona config
    research_content: str = ""              # Research gathered in Phase 1
    previous_results: list = field(default_factory=list)  # Prior subtask outputs
    market_data: dict = field(default_factory=dict)
    cross_pillar_context: str = ""
    execution_history: str = ""
    restrictions: str = ""
    all_diagnostics: dict = field(default_factory=dict)
    dim_label: str = ""                     # Pillar display label


# ═══════════════════════════════════════════════════════════════════
# TOOL RESULT — Structured output from tool execution
# ═══════════════════════════════════════════════════════════════════

@dataclass
class ToolResult:
    """Structured output from a tool execution."""
    success: bool
    artifact_type: str                         # "documento", "formulario", etc.
    content: str                               # Main generated content (markdown)
    structured_data: dict = field(default_factory=dict)  # Structured JSON data (tables, forms, etc.)
    export_formats: list = field(default_factory=list)   # ["google_docs", "pdf", "csv", "google_sheets", "google_forms"]
    metadata: dict = field(default_factory=dict)
    opiniao: str = ""
    como_aplicar: str = ""
    proximos_passos: str = ""
    fontes_consultadas: list = field(default_factory=list)
    impacto_estimado: str = ""
    entregavel_titulo: str = ""
    entregavel_tipo: str = ""
    execution_mode: str = "producao"           # Always "producao" for tool results

    def to_execution_dict(self) -> dict:
        """Convert to the same format as agent_execute_task output."""
        result = {
            "entregavel_titulo": self.entregavel_titulo,
            "entregavel_tipo": self.entregavel_tipo or self.artifact_type,
            "opiniao": self.opiniao,
            "conteudo": self.content,
            "como_aplicar": self.como_aplicar,
            "proximos_passos": self.proximos_passos,
            "fontes_consultadas": self.fontes_consultadas,
            "impacto_estimado": self.impacto_estimado,
            "artifact_type": self.artifact_type,
            "export_formats": self.export_formats,
            "execution_mode": self.execution_mode,
        }
        if self.structured_data:
            result["structured_data"] = self.structured_data
        if self.metadata:
            result["metadata"] = self.metadata
        return result


# ═══════════════════════════════════════════════════════════════════
# TOOL PLUGIN — Base class for all execution tools
# ═══════════════════════════════════════════════════════════════════

class ToolPlugin(ABC):
    """
    Base class for execution tools.
    
    Each tool knows how to:
    1. Match itself to a task (by keywords, ferramenta, description)
    2. Classify if the task is RESEARCH or PRODUCTION
    3. Build a PRODUCTION prompt — telling the LLM to CREATE, not EXPLAIN
    4. Define a structured JSON schema for the output
    5. Post-process the LLM output into a structured artifact with export formats
    """
    
    name: str = "base_tool"
    description: str = "Base tool"
    artifact_types: List[str] = []
    
    # Keywords that indicate this tool should handle the task
    match_keywords: List[str] = []
    # ferramenta values from task_data that this tool handles
    match_ferramentas: List[str] = []
    
    @abstractmethod
    def match_score(self, task_data: dict) -> float:
        """
        Return 0.0–1.0 indicating how well this tool matches the task.
        Higher = better match.
        """
        ...
    
    def _keyword_match_score(self, task_data: dict) -> float:
        """Helper: score based on keyword matching in title/desc."""
        title = (task_data.get("titulo", "") + " " + task_data.get("descricao", "")).lower()
        ferramenta = task_data.get("ferramenta", "").lower()
        
        # Check ferramenta first (strongest signal)
        for f in self.match_ferramentas:
            if f.lower() in ferramenta:
                return 0.9
        
        # Count keyword hits
        hits = sum(1 for kw in self.match_keywords if kw.lower() in title)
        if not self.match_keywords:
            return 0.0
        return min(hits / max(len(self.match_keywords) * 0.3, 1), 1.0)
    
    def _build_context_block(self, ctx: ToolContext) -> str:
        """Build the standard context block from ToolContext (shared by all tools)."""
        from app.services.agents.engine_specialist import brief_to_text, _format_previous_results
        
        brief_text = brief_to_text(ctx.business_profile)
        prev_text = _format_previous_results(ctx.previous_results) if ctx.previous_results else ""
        
        parts = [
            f"{ctx.specialist.get('persona', '')}",
            f"\nCargo: {ctx.specialist.get('cargo', '')}",
            f"Pilar: {ctx.dim_label}",
            f"\n═══ CONTEXTO DO NEGÓCIO ═══\n{brief_text}",
        ]
        
        if ctx.cross_pillar_context:
            parts.append(f"\n{ctx.cross_pillar_context}")
        if ctx.execution_history:
            parts.append(f"\n{ctx.execution_history}")
        if ctx.restrictions:
            parts.append(f"\n{ctx.restrictions}")
        if prev_text:
            parts.append(f"\n{prev_text}")
        if ctx.research_content:
            parts.append(f"\n═══ DADOS COLETADOS ═══\n{ctx.research_content[:4000]}")
        
        return "\n".join(parts)
    
    @abstractmethod
    def build_production_prompt(self, ctx: ToolContext) -> str:
        """
        Build the LLM prompt that tells it to PRODUCE the deliverable.
        
        NOT "explain how to create a survey" but "CREATE the survey NOW".
        Must output structured JSON with the tool's specific schema.
        """
        ...
    
    def get_json_schema(self) -> dict:
        """
        The JSON schema the LLM should follow for this tool's output.
        Override in subclasses for tool-specific schemas.
        """
        return {
            "entregavel_titulo": "Título do entregável produzido",
            "entregavel_tipo": "tipo_do_artefato",
            "opiniao": "Análise pessoal do especialista sobre o que foi criado",
            "conteudo": "O ARTEFATO COMPLETO produzido — pronto para uso",
            "como_aplicar": "Como usar este artefato no negócio",
            "proximos_passos": "Próximas ações recomendadas",
            "fontes_consultadas": ["urls"],
            "impacto_estimado": "Impacto esperado no negócio",
        }
    
    def post_process(self, llm_result: dict, ctx: ToolContext) -> ToolResult:
        """
        Post-process the raw LLM JSON into a structured ToolResult.
        Override for tool-specific post-processing (table extraction, form building, etc.).
        """
        return ToolResult(
            success=True,
            artifact_type=self.artifact_types[0] if self.artifact_types else "documento",
            content=llm_result.get("conteudo", ""),
            structured_data=llm_result.get("structured_data", {}),
            export_formats=self._get_export_formats(),
            opiniao=llm_result.get("opiniao", ""),
            como_aplicar=llm_result.get("como_aplicar", ""),
            proximos_passos=llm_result.get("proximos_passos", ""),
            fontes_consultadas=llm_result.get("fontes_consultadas", []),
            impacto_estimado=llm_result.get("impacto_estimado", ""),
            entregavel_titulo=llm_result.get("entregavel_titulo", ""),
            entregavel_tipo=llm_result.get("entregavel_tipo", ""),
        )
    
    def _get_export_formats(self) -> List[str]:
        """Default export formats based on artifact type. Override for custom."""
        return ["google_docs"]
    
    def __repr__(self):
        return f"<{self.__class__.__name__} name='{self.name}'>"


# ═══════════════════════════════════════════════════════════════════
# HELPER: Common production prompt fragments
# ═══════════════════════════════════════════════════════════════════

PRODUCTION_PREAMBLE = """
🚨 MODO PRODUÇÃO ATIVADO 🚨
Você NÃO é um consultor explicando como fazer.
Você É o profissional EXECUTANDO a tarefa AGORA.

NÃO ESCREVA:
- "Aqui está como fazer..."
- "Recomendo que você..."  
- "Os passos são..."
- "A empresa deve..."
- "Não foi possível extrair" / "dados corrompidos" / "informações insuficientes"

ESCREVA:
- O ARTEFATO REAL, pronto para uso
- Como se fosse um profissional entregando o trabalho finalizado
- Use os dados coletados como base; se fragmentados, complemente com expertise

Se é uma PESQUISA → ENTREGUE o documento da pesquisa PRONTO
Se é um FORMULÁRIO → CRIE as perguntas PRONTAS para aplicar
Se é uma ANÁLISE → FAÇA a análise com dados e insights CONCRETOS
Se é um PLANO → ESCREVA o plano COMPLETO com ações e datas
Se é CONTEÚDO → PRODUZA os textos FINAIS prontos para publicar
Se é um SCRIPT → ESCREVA o script PALAVRA POR PALAVRA
"""

ANTI_GENERIC_RULES = """
REGRAS ANTI-GENÉRICO (CRÍTICO):
- PROIBIDO definições teóricas ou explicações acadêmicas
- PROIBIDO frases como "A importância de..." ou "É fundamental que..."
- PROIBIDO listar passos genéricos que servem pra qualquer negócio
- OBRIGATÓRIO usar dados ESPECÍFICOS do negócio em análise
- OBRIGATÓRIO incluir nomes, números, datas e detalhes concretos
- OBRIGATÓRIO que o resultado seja UTILIZÁVEL IMEDIATAMENTE
"""

CASCADE_RULES = """
REGRA DE CASCATA (MANDATÓRIA): INJETE todos os dados já definidos
(personas, tom de voz, posicionamento) diretamente no artefato.
Se dados upstream existem, USE-OS. Se não existem, CRIE-OS do zero.

REGRA ANTI-AMNÉSIA: CONSISTÊNCIA ABSOLUTA com subtarefas anteriores.
Se persona "João Carlos, 42 anos" já foi criada, USE a mesma persona.
NÃO crie novos dados que contradizem o que já existe.
"""
