"""
Tool Registry — Auto-discovers and matches tools to tasks.
"""
from __future__ import annotations

import sys
from typing import Optional, List

from app.services.tools.base import ToolPlugin, ToolContext, ToolResult, ExecutionMode


class ToolRegistry:
    """
    Central registry for all tool plugins.
    
    Matches tasks to the best available tool based on:
    1. ferramenta field from task_data
    2. Keywords in title/description
    3. Context from the pillar and specialist
    """
    
    _instance: Optional["ToolRegistry"] = None
    
    def __init__(self):
        self._tools: List[ToolPlugin] = []
        self._loaded = False
    
    @classmethod
    def get_instance(cls) -> "ToolRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def register(self, tool: ToolPlugin):
        """Register a tool plugin."""
        self._tools.append(tool)
        print(f"  🔧 Tool registered: {tool.name}", file=sys.stderr)
    
    def _ensure_loaded(self):
        """Lazy-load all tool plugins on first use."""
        if self._loaded:
            return
        self._loaded = True
        
        # Import and register all built-in tools (graceful — skip missing)
        tool_classes = []
        
        try:
            from app.services.tools.document_tool import DocumentTool
            tool_classes.append(DocumentTool)
        except ImportError as e:
            print(f"  ⚠️ DocumentTool not available: {e}", file=sys.stderr)
        
        try:
            from app.services.tools.form_tool import FormTool
            tool_classes.append(FormTool)
        except ImportError as e:
            print(f"  ⚠️ FormTool not available: {e}", file=sys.stderr)
        
        try:
            from app.services.tools.spreadsheet_tool import SpreadsheetTool
            tool_classes.append(SpreadsheetTool)
        except ImportError as e:
            print(f"  ⚠️ SpreadsheetTool not available: {e}", file=sys.stderr)
        
        try:
            from app.services.tools.content_tool import ContentTool
            tool_classes.append(ContentTool)
        except ImportError as e:
            print(f"  ⚠️ ContentTool not available: {e}", file=sys.stderr)
        
        try:
            from app.services.tools.strategy_tool import StrategyTool
            tool_classes.append(StrategyTool)
        except ImportError as e:
            print(f"  ⚠️ StrategyTool not available: {e}", file=sys.stderr)
        
        try:
            from app.services.tools.analysis_tool import AnalysisTool
            tool_classes.append(AnalysisTool)
        except ImportError as e:
            print(f"  ⚠️ AnalysisTool not available: {e}", file=sys.stderr)
        
        for ToolClass in tool_classes:
            self.register(ToolClass())
        
        print(f"  🔧 {len(self._tools)} tools loaded", file=sys.stderr)
    
    def match_tool(self, task_data: dict) -> Optional[ToolPlugin]:
        """
        Find the best tool for a given task.
        Returns None if no tool scores > 0.2 (fallback to generic execution).
        """
        self._ensure_loaded()
        
        best_tool = None
        best_score = 0.2  # Minimum threshold
        
        for tool in self._tools:
            try:
                score = tool.match_score(task_data)
                if score > best_score:
                    best_score = score
                    best_tool = tool
            except Exception as e:
                print(f"  ⚠️ Tool {tool.name} match error: {e}", file=sys.stderr)
        
        if best_tool:
            print(f"  🔧 Matched tool: {best_tool.name} (score={best_score:.2f}) for '{task_data.get('titulo', '')[:50]}'", file=sys.stderr)
        
        return best_tool
    
    def classify_execution_mode(self, task_data: dict) -> ExecutionMode:
        """
        Determine if a subtask is research or production.
        
        Priority:
        1. Explicit 'tipo' field ('pesquisa' | 'producao') — set by expand_task_subtasks
        2. 'ferramenta' field — set by expand_task_subtasks for production artifacts
        3. Keyword analysis of title/description (legacy fallback)
        """
        # 1. Explicit tipo field (most reliable — set during subtask generation)
        tipo = task_data.get("tipo", "").lower()
        if tipo == "producao":
            return ExecutionMode.PRODUCAO
        if tipo == "pesquisa":
            return ExecutionMode.PESQUISA
        
        # 2. ferramenta field (strong production signal)
        ferramenta = task_data.get("ferramenta", "").lower().strip()
        if ferramenta in ("formulario", "documento", "planilha", "analise", "estrategia", "conteudo"):
            return ExecutionMode.PRODUCAO
        
        # 3. Keyword fallback (legacy tasks without tipo/ferramenta)
        title = (task_data.get("titulo", "") + " " + task_data.get("descricao", "")).lower()
        
        production_keywords = [
            "criar", "produzir", "escrever", "gerar", "montar", "elaborar",
            "documento", "formulário", "planilha", "template", "script",
            "redigir", "compor", "construir", "desenvolver relatório",
            "criar pesquisa", "criar questionário", "criar conteúdo",
            "aplicar a pesquisa", "aplicar pesquisa", "publicar",
            "calendário editorial", "plano de conteúdo",
        ]
        
        research_keywords = [
            "definir objetivo", "definir escopo", "selecionar ferramenta",
            "identificar", "mapear", "analisar resultado", "pesquisar",
            "avaliar", "comparar", "revisar", "diagnosticar",
        ]
        
        prod_score = sum(1 for kw in production_keywords if kw in title)
        research_score = sum(1 for kw in research_keywords if kw in title)
        
        # If task explicitly says "criar" + noun → production
        if any(kw in title for kw in ["criar documento", "criar formulário", 
                                       "criar pesquisa", "criar plano",
                                       "criar conteúdo", "criar template",
                                       "criar script", "criar calendário",
                                       "montar", "elaborar", "redigir",
                                       "produzir"]):
            return ExecutionMode.PRODUCAO
        
        # Strong production signal: has entregavel and "criar" in title
        has_entregavel = bool(task_data.get("entregavel"))
        if has_entregavel and prod_score > 0:
            return ExecutionMode.PRODUCAO
            
        if prod_score > research_score:
            return ExecutionMode.PRODUCAO
        
        return ExecutionMode.PESQUISA
    
    def execute_with_tool(self, ctx: ToolContext, model_provider: str = "groq") -> Optional[ToolResult]:
        """
        Match a tool and execute it.
        Returns None if no tool matches (caller should fall back to generic).
        """
        tool = self.match_tool(ctx.task_data)
        if not tool:
            return None
        
        try:
            from app.core.llm_router import call_llm
            
            # Build the production prompt from the tool
            prompt = tool.build_production_prompt(ctx)
            
            print(f"  🏭 Producing with {tool.name}: {ctx.task_data.get('titulo', '')[:50]}...", file=sys.stderr)
            print(f"  📝 Production prompt: {len(prompt)} chars", file=sys.stderr)
            
            result = call_llm(
                provider=model_provider,
                prompt=prompt,
                temperature=0.4,
                json_mode=True,
            )
            
            # Handle raw_response fallback (when JSON constraint was relaxed by LLM router)
            if isinstance(result, dict) and "raw_response" in result and not result.get("conteudo"):
                result["conteudo"] = result["raw_response"][:16000]
                result.setdefault("entregavel_titulo", "Resultado gerado")
                result.setdefault("entregavel_tipo", "documento")
            
            # Validate minimum content — production tools always need substantial output
            content = result.get("conteudo", "")
            content_len = len(str(content))
            if content_len < 1500:
                print(f"  ⚠️ Production content too short ({content_len} chars), retrying with explicit length requirement...", file=sys.stderr)
                retry_prompt = prompt + "\n\n⚠️ ATENÇÃO: Sua resposta anterior tinha apenas " + str(content_len) + " caracteres no campo 'conteudo'. ISSO É INACEITÁVEL. O campo 'conteudo' DEVE ter MÍNIMO 1000 palavras com dados reais. Reescreva AGORA com o documento COMPLETO."
                result = call_llm(
                    provider=model_provider,
                    prompt=retry_prompt,
                    temperature=0.3,
                    json_mode=True,
                    prefer_small=False,
                )
                # Handle raw_response on retry too
                if isinstance(result, dict) and "raw_response" in result and not result.get("conteudo"):
                    result["conteudo"] = result["raw_response"][:16000]
                    result.setdefault("entregavel_titulo", "Resultado gerado")
            
            # Normalize text fields (same as generic execution)
            def _to_str(v):
                if v is None:
                    return ""
                if isinstance(v, str):
                    return v
                if isinstance(v, dict):
                    import json as _json
                    return _json.dumps(v, ensure_ascii=False)
                if isinstance(v, list):
                    return "\n".join(str(i) for i in v)
                return str(v)

            for _field in ("conteudo", "opiniao", "como_aplicar", "proximos_passos",
                           "entregavel_titulo", "entregavel_tipo", "impacto_estimado"):
                if _field in result:
                    result[_field] = _to_str(result[_field])
            
            # Normalize fontes_consultadas
            if "fontes_consultadas" in result:
                raw_fontes = result["fontes_consultadas"]
                if isinstance(raw_fontes, list):
                    result["fontes_consultadas"] = [
                        f.get("url", f.get("link", str(f))) if isinstance(f, dict) else str(f)
                        for f in raw_fontes if f
                    ]
                elif raw_fontes:
                    result["fontes_consultadas"] = [str(raw_fontes)]
                else:
                    result["fontes_consultadas"] = []
            
            # Post-process through the tool for structured_data extraction
            tool_result = tool.post_process(result, ctx)
            
            print(f"  ✅ Tool {tool.name} produced: {tool_result.entregavel_titulo[:60]}", file=sys.stderr)
            return tool_result
            
        except Exception as e:
            error_msg = str(e)
            # Propagate cancellation errors
            if "Task cancelled by user" in error_msg:
                raise
            print(f"  ❌ Tool execution error ({tool.name}): {e}", file=sys.stderr)
            return None


# Singleton
tool_registry = ToolRegistry.get_instance()
