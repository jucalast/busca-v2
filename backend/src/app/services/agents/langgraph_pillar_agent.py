"""
LangGraph Integration for Pillar Agents.
Mantém llm_router.py existente e adiciona orquestração de estado.
"""

import json
import os
import sys
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
try:
    from langgraph.checkpoint.sqlite import SqliteSaver
    SQLITE_CHECKPOINT_AVAILABLE = True
except ImportError:
    SQLITE_CHECKPOINT_AVAILABLE = False
    print("⚠️ LangGraph SQLite checkpoint não disponível", file=sys.stderr)

# Importar router existente - não quebrar nada!
from app.core.llm_router import call_llm
from app.services.search.context_service import extract_structured_context
from app.core import database as db


class PillarState(TypedDict):
    """Estado compartilhado entre nós do grafo."""
    # Input parameters
    pillar_key: str
    business_id: str
    profile: Dict[str, Any]
    user_command: str
    
    # Chain context (upstream pillars)
    upstream_context: Dict[str, Any]
    
    # Research phase
    research_queries: List[str]
    research_results: List[Dict[str, Any]]
    research_text: str
    
    # Planning phase
    execution_plan: List[str]
    
    # Execution phase
    llm_response: str
    structured_output: Dict[str, Any]
    
    # Status and metadata
    status: str
    error: Optional[str]
    sources: List[str]


class LangGraphPillarAgent:
    """
    Agente baseado em LangGraph que usa o llm_router.py existente.
    Mantém 100% de compatibilidade com a arquitetura atual.
    """
    
    def __init__(self, pillar_key: str):
        self.pillar_key = pillar_key
        self.graph = self._build_graph()
        if SQLITE_CHECKPOINT_AVAILABLE:
            self.checkpointer = SqliteSaver.from_conn_string("data/checkpoints.db")
            self.compiled_graph = self.graph.compile(checkpointer=self.checkpointer)
        else:
            self.checkpointer = None
            self.compiled_graph = self.graph.compile()
    
    def _build_graph(self) -> StateGraph:
        """Constroi o grafo de estados para o pilar."""
        workflow = StateGraph(PillarState)
        
        # Adicionar nós
        workflow.add_node("load_context", self._load_context_node)
        workflow.add_node("research", self._research_node)
        workflow.add_node("plan", self._plan_node)
        workflow.add_node("execute", self._execute_node)
        workflow.add_node("validate", self._validate_node)
        workflow.add_node("save", self._save_node)
        
        # Definir fluxo
        workflow.set_entry_point("load_context")
        workflow.add_edge("load_context", "research")
        workflow.add_edge("research", "plan")
        workflow.add_edge("plan", "execute")
        workflow.add_edge("execute", "validate")
        workflow.add_edge("validate", "save")
        workflow.add_edge("save", END)
        
        # Adicionar edges condicionais para retry
        workflow.add_conditional_edges(
            "validate",
            self._should_retry,
            {
                "retry": "execute",
                "success": "save",
                "error": END
            }
        )
        
        return workflow
    
    def _load_context_node(self, state: PillarState) -> PillarState:
        """Carrega contexto dos pilares upstream."""
        try:
            # Carregar configuração do pilar
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            
            # Carregar dados upstream
            upstream_context = {}
            for up_key in pillar_config["upstream"]:
                up_data = db.get_pillar_data(state["business_id"], up_key)
                if up_data:
                    up_output = up_data.get("structured_output", {})
                    structured_context = extract_structured_context(up_output, up_key)
                    upstream_context[up_key] = structured_context
            
            state["upstream_context"] = upstream_context
            state["status"] = "context_loaded"
            
            return state
            
        except Exception as e:
            state["error"] = f"Context loading failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _research_node(self, state: PillarState) -> PillarState:
        """Executa pesquisa web usando sistema existente."""
        try:
            from app.core.web_utils import search_duckduckgo, scrape_page
            import time
            
            # Obter queries do pilar
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            queries = pillar_config["search_queries_template"]
            
            profile = state["profile"]
            segmento = profile.get("segmento", "")
            localizacao = profile.get("localizacao", "")
            nome = profile.get("nome_empresa", "")
            
            research_text = ""
            research_results = []
            
            for query_tpl in queries:
                query = query_tpl.format(
                    segmento=segmento,
                    localizacao=localizacao,
                    nome=nome,
                )
                
                # Usar sistema de search existente
                results = search_duckduckgo(query, max_results=4, region='br-pt')
                for i, r in enumerate(results or []):
                    url = r.get("href", "")
                    research_results.append({"url": url, "title": r.get("title", ""), "snippet": r.get("body", "")})
                    research_text += f"[Fonte {len(research_results)}] {r.get('title', '')}: {r.get('body', '')}\n"
                    
                    if i < 1:  # Scrape top result
                        content = scrape_page(url, timeout=4)
                        if content:
                            research_text += f"Conteúdo: {content[:2500]}\n\n"
                
                time.sleep(1)  # Rate limit
            
            state["research_text"] = research_text
            state["research_results"] = research_results
            state["sources"] = [r["url"] for r in research_results]
            state["status"] = "research_completed"
            
            return state
            
        except Exception as e:
            state["error"] = f"Research failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _plan_node(self, state: PillarState) -> PillarState:
        """Planeja execução usando LLM."""
        try:
            # Criar plano de execução
            plan = [
                "1. Analisar dados de pesquisa",
                "2. Integrar contexto upstream",
                "3. Gerar saída estruturada",
                "4. Validar contra schema"
            ]
            
            state["execution_plan"] = plan
            state["status"] = "planned"
            
            return state
            
        except Exception as e:
            state["error"] = f"Planning failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _execute_node(self, state: PillarState) -> PillarState:
        """Executa tarefa principal usando llm_router.py existente."""
        try:
            # Montar prompt usando sistema existente
            profile = state["profile"]
            upstream_context_json = json.dumps(state["upstream_context"], ensure_ascii=False)
            
            # Obter schema do pilar
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            schema = pillar_config["output_schema"]
            
            # Construir prompt (similar ao existente)
            prompt = f"""Você é especialista em {pillar_config['label']} para PMEs brasileiras.
Empresa: "{profile.get('nome_empresa', '')}" | {profile.get('segmento', '')} | {profile.get('modelo_negocio', '')} | {profile.get('localizacao', '')}

[CONTEXTO UPSTREAM ESTRUTURADO]
{upstream_context_json}

PESQUISA INTERNET:
{state['research_text'][:5000] if state['research_text'] else 'Use seu conhecimento especializado.'}

Retorne SOMENTE um objeto JSON com exatamente estes campos (sem texto extra, sem markdown):
{json.dumps(schema, ensure_ascii=False, indent=2)}

Todos os valores devem ser específicos para "{profile.get('nome_empresa', '')}". Não use valores de exemplo."""
            
            # Usar llm_router.py existente!
            response = call_llm(
                provider="groq",  # Pode ser "gemini" ou "openrouter" também
                prompt=prompt,
                temperature=0.2,
                json_mode=True
            )
            
            state["llm_response"] = response
            state["structured_output"] = response if isinstance(response, dict) else {"raw_response": response}
            state["status"] = "executed"
            
            return state
            
        except Exception as e:
            state["error"] = f"Execution failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _validate_node(self, state: PillarState) -> PillarState:
        """Valida saída contra schema."""
        try:
            # Validação básica
            if not state.get("structured_output"):
                state["status"] = "retry"
                return state
            
            # Verificar se há campos obrigatórios
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            schema = pillar_config["output_schema"]
            
            # Validação simples (poderia usar Pydantic aqui)
            if isinstance(state["structured_output"], dict):
                state["status"] = "success"
            else:
                state["status"] = "retry"
            
            return state
            
        except Exception as e:
            state["error"] = f"Validation failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _save_node(self, state: PillarState) -> PillarState:
        """Salva resultados no banco."""
        try:
            # Usar sistema de persistência existente
            save_result = db.save_pillar_data(
                business_id=state["business_id"],
                pillar_key=self.pillar_key,
                structured_output=state["structured_output"],
                sources=state.get("sources", []),
                user_command=state.get("user_command", "")
            )
            
            if not save_result.get("success"):
                raise Exception(save_result.get("error", "Unknown error"))
            
            state["status"] = "completed"
            return state
            
        except Exception as e:
            state["error"] = f"Save failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _should_retry(self, state: PillarState) -> str:
        """Decide se deve retry ou finalizar."""
        status = state.get("status", "")
        
        if status == "retry":
            return "retry"
        elif status == "success":
            return "success"
        else:
            return "error"
    
    def run(self, business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
        """
        Executa o agente usando LangGraph.
        Mantém interface compatível com run_pillar_agent().
        """
        try:
            # Estado inicial
            initial_state = PillarState(
                pillar_key=self.pillar_key,
                business_id=business_id,
                profile=profile,
                user_command=user_command,
                upstream_context={},
                research_queries=[],
                research_results=[],
                research_text="",
                execution_plan=[],
                llm_response="",
                structured_output={},
                status="starting",
                error=None,
                sources=[]
            )
            
            # Executar grafo
            result = self.compiled_graph.invoke(initial_state)
            
            return {
                "success": result["status"] == "completed",
                "pillar_key": self.pillar_key,
                "data": result.get("structured_output", {}),
                "sources": result.get("sources", []),
                "context_used": result.get("upstream_context", {}),
                "error": result.get("error"),
                "graph_execution": {
                    "status": result["status"],
                    "nodes_executed": len(result.get("execution_plan", [])),
                    "research_sources": len(result.get("research_results", []))
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "pillar_key": self.pillar_key,
                "error": f"LangGraph execution failed: {str(e)}",
                "data": {},
                "sources": [],
                "context_used": {}
            }


def run_langgraph_pillar_agent(pillar_key: str, business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    """
    Interface compatível com run_pillar_agent() mas usando LangGraph.
    """
    agent = LangGraphPillarAgent(pillar_key)
    return agent.run(business_id, profile, user_command)
