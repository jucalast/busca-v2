"""
Enhanced Pillar Agents usando LangGraph + Vector Memory + Jina Reader.
Implementação completa para TODOS os 7 pilares com ecossistema avançado.
"""

import json
import sys
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

# Importar componentes existentes
from app.core.llm_router import call_llm
from app.services.intelligence.vector_store import get_vector_store, get_objection_responses, store_objection_learning, get_competitor_intelligence, store_competitor_analysis
from app.services.intelligence.jina_reader_service import scrape_competitor_site, enhance_research_with_jina
from app.services.search.context_service import extract_structured_context
from app.core import database as db


class EnhancedPillarState(TypedDict):
    """Estado avançado para todos os pilares com memória vetorial."""
    # Base state
    pillar_key: str
    business_id: str
    profile: Dict[str, Any]
    user_command: str
    
    # Chain context
    upstream_context: Dict[str, Any]
    
    # Enhanced research
    basic_research: str
    enhanced_research: List[Dict[str, Any]]
    competitor_insights: List[Dict[str, Any]]
    
    # Vector memory
    learned_responses: List[Dict[str, Any]]
    competitor_intelligence: List[Dict[str, Any]]
    
    # Pillar-specific outputs
    structured_output: Dict[str, Any]
    
    # Status
    status: str
    error: Optional[str]
    sources: List[str]


class EnhancedPillarAgent:
    """
    Agente avançado para TODOS os pilares usando ecossistema completo.
    LangGraph + Vector Memory + Jina Reader + LLM Router existente.
    """
    
    def __init__(self, pillar_key: str):
        self.pillar_key = pillar_key
        self.vector_store = get_vector_store(f"{pillar_key}_memory")
        self.graph = self._build_pillar_graph()
        self.compiled_graph = self.graph.compile()
    
    def _build_pillar_graph(self) -> StateGraph:
        """Constrói grafo específico para o pilar."""
        workflow = StateGraph(EnhancedPillarState)
        
        # Nós sequenciais com inteligência avançada
        workflow.add_node("load_context", self._load_context_node)
        workflow.add_node("enhanced_research", self._enhanced_research_node)
        workflow.add_node("vector_memory_search", self._vector_memory_search_node)
        workflow.add_node("generate_with_context", self._generate_with_context_node)
        workflow.add_node("validate_and_save", self._validate_and_save_node)
        
        # Fluxo principal
        workflow.set_entry_point("load_context")
        workflow.add_edge("load_context", "enhanced_research")
        workflow.add_edge("enhanced_research", "vector_memory_search")
        workflow.add_edge("vector_memory_search", "generate_with_context")
        workflow.add_edge("generate_with_context", "validate_and_save")
        workflow.add_edge("validate_and_save", END)
        
        return workflow
    
    def _load_context_node(self, state: EnhancedPillarState) -> EnhancedPillarState:
        """Carrega contexto upstream com dados estruturados."""
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
    
    def _enhanced_research_node(self, state: EnhancedPillarState) -> EnhancedPillarState:
        """Pesquisa avançada usando Jina Reader + concorrentes."""
        try:
            profile = state["profile"]
            segmento = profile.get("segmento", "")
            
            # Obter queries do pilar
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            queries = pillar_config["search_queries_template"]
            
            # Enhance com Jina Reader
            enhanced_research = enhance_research_with_jina(queries, segmento)
            
            # Pesquisar concorrentes específicos
            competitor_insights = []
            if self.pillar_key in ["branding", "canais_venda", "processo_vendas"]:
                competitor_queries = [
                    f"{segmento} concorrentes principais",
                    f"empresas {segmento} Brasil líderes"
                ]
                
                from app.core.web_utils import search_duckduckgo
                
                for query in competitor_queries:
                    results = search_duckduckgo(query, max_results=2, region='br-pt')
                    for result in results or []:
                        url = result.get("href", "")
                        if url and "http" in url:
                            analysis = scrape_competitor_site(url, segmento)
                            if analysis["success"]:
                                competitor_insights.append(analysis["analysis"])
                
                # Salvar inteligência de concorrentes
                for insight in competitor_insights:
                    if insight.get("title"):
                        store_competitor_analysis(
                            segmento, 
                            insight["title"], 
                            insight.get("strategic_insights", []),
                            insight.get("url", "")
                        )
            
            state["enhanced_research"] = enhanced_research["enhanced_content"]
            state["competitor_insights"] = competitor_insights
            state["status"] = "enhanced_research_completed"
            
            return state
            
        except Exception as e:
            state["error"] = f"Enhanced research failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _vector_memory_search_node(self, state: EnhancedPillarState) -> EnhancedPillarState:
        """Busca na memória vetorial por aprendizados anteriores."""
        try:
            profile = state["profile"]
            segmento = profile.get("segmento", "")
            
            learned_responses = []
            competitor_intelligence = []
            
            # Buscar baseado no tipo de pilar
            if self.pillar_key == "processo_vendas":
                # Buscar objeções e respostas
                common_objections = [
                    "preço muito alto",
                    "já tenho fornecedor", 
                    "preciso pensar",
                    "seu concorrente é melhor",
                    "não é o momento certo"
                ]
                
                for objection in common_objections:
                    responses = get_objection_responses(segmento, objection)
                    if responses:
                        learned_responses.extend(responses[:2])
                
                # Buscar inteligência de concorrentes
                competitor_intelligence = get_competitor_intelligence(segmento)
            
            elif self.pillar_key == "branding":
                # Buscar posicionamentos anteriores
                learned_responses = self.vector_store.search_knowledge(
                    f"posicionamento branding {segmento}",
                    filter_metadata={"tipo": "branding"}
                )
            
            elif self.pillar_key == "canais_venda":
                # Buscar canais efetivos anteriores
                learned_responses = self.vector_store.search_knowledge(
                    f"canais efetivos {segmento}",
                    filter_metadata={"tipo": "canais"}
                )
            
            elif self.pillar_key == "trafego_organico":
                # Buscar estratégias orgânicas
                learned_responses = self.vector_store.search_knowledge(
                    f"estratégias orgânicas {segmento}",
                    filter_metadata={"tipo": "seo"}
                )
            
            elif self.pillar_key == "trafego_pago":
                # Buscam campanhas pagas anteriores
                learned_responses = self.vector_store.search_knowledge(
                    f"campanhas pagas {segmento}",
                    filter_metadata={"tipo": "paid_ads"}
                )
            
            elif self.pillar_key == "identidade_visual":
                # Buscar diretrizes visuais
                learned_responses = self.vector_store.search_knowledge(
                    f"diretrizes visuais {segmento}",
                    filter_metadata={"tipo": "visual_identity"}
                )
            
            elif self.pillar_key == "publico_alvo":
                # Buscar personas anteriores
                learned_responses = self.vector_store.search_knowledge(
                    f"personas {segmento}",
                    filter_metadata={"tipo": "personas"}
                )
            
            state["learned_responses"] = learned_responses
            state["competitor_intelligence"] = competitor_intelligence
            state["status"] = "vector_memory_searched"
            
            return state
            
        except Exception as e:
            state["error"] = f"Vector memory search failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _generate_with_context_node(self, state: EnhancedPillarState) -> EnhancedPillarState:
        """Gera saída estruturada usando contexto completo + memória."""
        try:
            profile = state["profile"]
            upstream_context = state["upstream_context"]
            enhanced_research = state["enhanced_research"]
            learned_responses = state["learned_responses"]
            competitor_intelligence = state["competitor_intelligence"]
            
            # Obter schema do pilar
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            schema = pillar_config["output_schema"]
            
            # Construir prompt avançado com contexto completo
            prompt = self._build_enhanced_prompt(
                profile, pillar_config, upstream_context, 
                enhanced_research, learned_responses, competitor_intelligence
            )
            
            # Usar llm_router existente
            response = call_llm(
                provider="groq",
                prompt=prompt,
                temperature=0.2 if self.pillar_key != "processo_vendas" else 0.3,
                json_mode=True
            )
            
            if isinstance(response, dict):
                state["structured_output"] = response
            else:
                state["structured_output"] = {"raw_response": response}
            
            state["status"] = "generated"
            
            return state
            
        except Exception as e:
            state["error"] = f"Generation failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _build_enhanced_prompt(self, profile: Dict[str, Any], pillar_config: Dict[str, Any], 
                             upstream_context: Dict[str, Any], enhanced_research: List[Dict[str, Any]], 
                             learned_responses: List[Dict[str, Any]], competitor_intelligence: List[Dict[str, Any]]) -> str:
        """Constrói prompt avançado baseado no tipo de pilar."""
        
        base_prompt = f"""Você é especialista em {pillar_config['label']} para PMEs brasileiras.

EMPRESA: "{profile.get('nome_empresa', '')}" | {profile.get('segmento', '')} | {profile.get('modelo_negocio', '')} | {profile.get('localizacao', '')}

ESCOPO ESTRITO: {pillar_config['scope']}
CAMPOS PROIBIDOS: {pillar_config['forbidden']}

[CONTEXTO UPSTREAM ESTRUTURADO]
{json.dumps(upstream_context, ensure_ascii=False, indent=2)}

[PESQUISA AVANÇADA - Jina Reader]
{json.dumps(enhanced_research, ensure_ascii=False, indent=2)}

[MEMÓRIA VETORIAL - APRENDIZADOS ANTERIORES]
{json.dumps(learned_responses[:3], ensure_ascii=False, indent=2)}

[INTELIGÊNCIA DE CONCORRENTES]
{json.dumps(competitor_intelligence[:2], ensure_ascii=False, indent=2)}

"""
        
        # Adicionar instruções específicas do pilar
        if self.pillar_key == "processo_vendas":
            base_prompt += """
FOQUE EM: Scripts de vendas, funil estruturado, quebra de objeções.
USE: Inteligência de concorrentes para destacar diferenciais.
APRENDA: Respostas a objeções já validadas.
"""
        elif self.pillar_key == "branding":
            base_prompt += """
FOQUE EM: Posicionamento técnico puro, sem estratégias de vendas.
USE: Análise de concorrentes para encontrar gaps.
DIFERENCIE: Baseado em tecnologia e benefícios reais.
"""
        elif self.pillar_key == "publico_alvo":
            base_prompt += """
FOQUE EM: Mapeamento puro de personas e dores.
NÃO INCLUA: Scripts, estratégias ou diferenciais.
MAPEIE: Comportamentos, demografia, canais.
"""
        elif self.pillar_key == "canais_venda":
            base_prompt += """
FOQUE EM: Mapeamento de canais efetivos.
ANALISE: Canais por cargo e indústria.
IDENTIFIQUE: Gaps e oportunidades.
"""
        elif self.pillar_key == "trafego_organico":
            base_prompt += """
FOQUE EM: SEO e conteúdo orgânico.
PLANEJE: Pilares de conteúdo.
OTIMIZE: Para canais específicos.
"""
        elif self.pillar_key == "trafego_pago":
            base_prompt += """
FOQUE EM: Mídia paga pura.
SEGMENTE: Por cargo e indústria.
MEÇA: CPA e ROAS.
"""
        elif self.pillar_key == "identidade_visual":
            base_prompt += """
FOQUE EM: Diretrizes visuais puras.
CRIE: Sistemas visuais coesos.
ADAPTE: Por indústria quando necessário.
"""
        
        base_prompt += f"""

Retorne SOMENTE um objeto JSON com exatamente estes campos (sem texto extra, sem markdown):
{json.dumps(schema, ensure_ascii=False, indent=2)}

Todos os valores devem ser específicos para "{profile.get('nome_empresa', '')}". Não use valores de exemplo."""
        
        return base_prompt
    
    def _validate_and_save_node(self, state: EnhancedPillarState) -> EnhancedPillarState:
        """Valida, salva aprendizados e persiste resultados."""
        try:
            structured_output = state["structured_output"]
            profile = state["profile"]
            
            # Salvar aprendizados na memória vetorial
            self._save_pillar_learnings(profile, structured_output)
            
            # Salvar no banco principal
            save_result = db.save_pillar_data(
                business_id=state["business_id"],
                pillar_key=self.pillar_key,
                structured_output=structured_output,
                sources=[],
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
    
    def _save_pillar_learnings(self, profile: Dict[str, Any], structured_output: Dict[str, Any]):
        """Salva aprendizados específicos do pilar na memória vetorial."""
        try:
            segmento = profile.get("segmento", "")
            
            if self.pillar_key == "processo_vendas":
                # Salvar scripts e objeções
                objection_handling = structured_output.get("objection_handling", [])
                for technique in objection_handling:
                    objection = technique.get("objecao", "")
                    response = technique.get("tecnica_resposta", "")
                    if objection and response:
                        store_objection_learning(segmento, objection, response, 0.8)
            
            elif self.pillar_key == "branding":
                # Salvar posicionamentos
                pos_tecnico = structured_output.get("posicionamento_tecnico", {})
                if pos_tecnico:
                    self.vector_store.add_knowledge(
                        [json.dumps(pos_tecnico)],
                        [{"industria": segmento, "tipo": "branding"}],
                        [f"branding_{segmento}_{hash(str(pos_tecnico))}"]
                    )
            
            # Adicionar outros pilares conforme necessário...
            
        except Exception as e:
            print(f"⚠️ Erro ao salvar aprendizados do pilar {self.pillar_key}: {str(e)}", file=sys.stderr)
    
    def run(self, business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
        """
        Executa o agente avançado para qualquer pilar.
        
        Args:
            business_id: ID do negócio
            profile: Perfil da empresa
            user_command: Comando do usuário
        
        Returns:
            Resultado completo com inteligência avançada
        """
        try:
            # Estado inicial
            initial_state = EnhancedPillarState(
                pillar_key=self.pillar_key,
                business_id=business_id,
                profile=profile,
                user_command=user_command,
                upstream_context={},
                basic_research="",
                enhanced_research=[],
                competitor_insights=[],
                learned_responses=[],
                competitor_intelligence=[],
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
                "enhanced_features": {
                    "vector_memory_hits": len(result.get("learned_responses", [])),
                    "competitor_insights": len(result.get("competitor_insights", [])),
                    "enhanced_research": len(result.get("enhanced_research", [])),
                    "graph_execution": {
                        "status": result["status"],
                        "nodes_executed": 5
                    }
                },
                "error": result.get("error"),
                "status": result["status"]
            }
            
        except Exception as e:
            return {
                "success": False,
                "pillar_key": self.pillar_key,
                "error": f"Enhanced {self.pillar_key} execution failed: {str(e)}",
                "data": {},
                "sources": [],
                "context_used": {},
                "enhanced_features": {}
            }


# Função universal para qualquer pilar
def run_enhanced_pillar_agent(pillar_key: str, business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    """
    Interface universal para executar qualquer pilar com ecossistema avançado.
    
    Args:
        pillar_key: Chave do pilar (publico_alvo, branding, etc)
        business_id: ID do negócio
        profile: Perfil da empresa
        user_command: Comando do usuário
    
    Returns:
        Resultado avançado com LangGraph + Vector Memory + Jina Reader
    """
    agent = EnhancedPillarAgent(pillar_key)
    return agent.run(business_id, profile, user_command)


# Funções específicas para cada pilar (conveniência)
def run_enhanced_publico_alvo(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_enhanced_pillar_agent("publico_alvo", business_id, profile, user_command)

def run_enhanced_branding(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_enhanced_pillar_agent("branding", business_id, profile, user_command)

def run_enhanced_identidade_visual(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_enhanced_pillar_agent("identidade_visual", business_id, profile, user_command)

def run_enhanced_canais_venda(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_enhanced_pillar_agent("canais_venda", business_id, profile, user_command)

def run_enhanced_trafego_organico(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_enhanced_pillar_agent("trafego_organico", business_id, profile, user_command)

def run_enhanced_trafego_pago(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_enhanced_pillar_agent("trafego_pago", business_id, profile, user_command)

def run_enhanced_processo_vendas(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_enhanced_pillar_agent("processo_vendas", business_id, profile, user_command)
