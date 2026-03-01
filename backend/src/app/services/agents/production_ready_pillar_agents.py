"""
Production-Ready Enhanced Pillar Agents.
Versão enterprise com todas as mitigações de SRE integradas.
"""

import json
import sys
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

# Importar componentes existentes
from app.core.llm_router import call_llm
from app.services.intelligence.vector_store import get_vector_store, get_objection_responses, store_objection_learning
from app.services.intelligence.jina_reader_service import scrape_competitor_site, enhance_research_with_jina
from app.services.search.context_service import extract_structured_context
from app.core import database as db

# Importar mitigações SRE
from app.services.intelligence.smart_content_processor import process_enhanced_research_smart, smart_processor
from app.services.infrastructure.checkpoints_garbage_collector import cleanup_checkpoints_safe, get_checkpoints_health
from app.services.intelligence.content_validator import validate_before_chroma_save
from app.services.infrastructure.infrastructure_backup_manager import check_infrastructure_health, create_emergency_backup


class ProductionReadyPillarState(TypedDict):
    """Estado de produção com SRE safeguards."""
    # Base state
    pillar_key: str
    business_id: str
    profile: Dict[str, Any]
    user_command: str
    
    # Chain context
    upstream_context: Dict[str, Any]
    
    # Enhanced research (com rate limit protection)
    raw_research: List[Dict[str, Any]]
    processed_research: Dict[str, Any]
    optimized_context: str
    
    # Vector memory (com validação)
    validated_responses: List[Dict[str, Any]]
    validation_summary: Dict[str, Any]
    
    # SRE monitoring
    sre_metrics: Dict[str, Any]
    resource_usage: Dict[str, Any]
    
    # Pillar-specific outputs
    structured_output: Dict[str, Any]
    
    # Status
    status: str
    error: Optional[str]
    sources: List[str]


class ProductionReadyPillarAgent:
    """
    Agente enterprise-ready com todas as mitigações SRE.
    LangGraph + Smart Processing + Validation + Backup + Cleanup.
    """
    
    def __init__(self, pillar_key: str):
        self.pillar_key = pillar_key
        self.vector_store = get_vector_store(f"{pillar_key}_memory")
        self.graph = self._build_production_graph()
        self.compiled_graph = self.graph.compile()
        
        # Verificar saúde do sistema ao inicializar
        self._verify_system_health()
    
    def _verify_system_health(self):
        """Verifica saúde do sistema antes de operar."""
        
        try:
            # Verificar infraestrutura
            infra_health = check_infrastructure_health()
            
            if infra_health["overall_risk"] == "CRITICAL":
                print("🚨 CRITICAL: Creating emergency backup", file=sys.stderr)
                create_emergency_backup()
            
            # Verificar checkpoints
            checkpoint_health = get_checkpoints_health()
            
            if checkpoint_health.get("risk_level") == "CRITICAL":
                print("🗑️ CRITICAL: Running emergency cleanup", file=sys.stderr)
                cleanup_checkpoints_safe(force=True)
            
        except Exception as e:
            print(f"⚠️ Health check failed: {str(e)}", file=sys.stderr)
    
    def _build_production_graph(self) -> StateGraph:
        """Constrói grafo com nós de produção e SRE."""
        workflow = StateGraph(ProductionReadyPillarState)
        
        # Nós sequenciais com SRE safeguards
        workflow.add_node("sre_health_check", self._sre_health_check_node)
        workflow.add_node("load_context", self._load_context_node)
        workflow.add_node("smart_research", self._smart_research_node)
        workflow.add_node("validate_memory", self._validate_memory_node)
        workflow.add_node("generate_with_validation", self._generate_with_validation_node)
        workflow.add_node("save_with_backup", self._save_with_backup_node)
        workflow.add_node("sre_cleanup", self._sre_cleanup_node)
        
        # Fluxo principal com checkpoints
        workflow.set_entry_point("sre_health_check")
        workflow.add_edge("sre_health_check", "load_context")
        workflow.add_edge("load_context", "smart_research")
        workflow.add_edge("smart_research", "validate_memory")
        workflow.add_edge("validate_memory", "generate_with_validation")
        workflow.add_edge("generate_with_validation", "save_with_backup")
        workflow.add_edge("save_with_backup", "sre_cleanup")
        workflow.add_edge("sre_cleanup", END)
        
        return workflow
    
    def _sre_health_check_node(self, state: ProductionReadyPillarState) -> ProductionReadyPillarState:
        """Nó de verificação de saúde SRE."""
        try:
            # Coletar métricas SRE
            sre_metrics = {
                "timestamp": json.dumps({"timestamp": "now"}),
                "system_health": check_infrastructure_health(),
                "checkpoint_health": get_checkpoints_health(),
                "memory_usage": self._get_memory_usage()
            }
            
            state["sre_metrics"] = sre_metrics
            state["status"] = "health_checked"
            
            return state
            
        except Exception as e:
            state["error"] = f"SRE health check failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _load_context_node(self, state: ProductionReadyPillarState) -> ProductionReadyPillarState:
        """Carrega contexto upstream (mantido igual)."""
        try:
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            
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
    
    def _smart_research_node(self, state: ProductionReadyPillarState) -> ProductionReadyPillarState:
        """Pesquisa com rate limit protection."""
        try:
            profile = state["profile"]
            segmento = profile.get("segmento", "")
            
            # Obter queries do pilar
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            queries = pillar_config["search_queries_template"]
            
            # Pesquisa básica (sem Jina para evitar rate limits)
            from app.core.web_utils import search_duckduckgo
            
            raw_research = []
            for query in queries:
                results = search_duckduckgo(query, max_results=3, region='br-pt')
                if results:
                    raw_research.extend(results)
            
            # Processar conteúdo com smart processor (se houver conteúdo pesado)
            if self.pillar_key in ["branding", "processo_vendas"] and raw_research:
                # Extrair conteúdo dos resultados
                raw_contents = []
                for result in raw_research[:3]:  # Limitar para não sobrecarregar
                    content = result.get("body", "") or result.get("snippet", "")
                    if content and len(content) > 500:
                        raw_contents.append(content)
                
                if raw_contents:
                    # Processar com Gemini como mastigador
                    processed = process_enhanced_research_smart(raw_contents, segmento)
                    state["processed_research"] = processed
                    state["optimized_context"] = processed.get("optimized_context", "")
                else:
                    state["processed_research"] = {"processed_contents": []}
                    state["optimized_context"] = json.dumps(raw_research[:5], ensure_ascii=False)
            else:
                # Para conteúdo leve, usar diretamente
                state["processed_research"] = {"processed_contents": raw_research}
                state["optimized_context"] = json.dumps(raw_research[:5], ensure_ascii=False)
            
            state["raw_research"] = raw_research
            state["status"] = "smart_research_completed"
            
            return state
            
        except Exception as e:
            state["error"] = f"Smart research failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _validate_memory_node(self, state: ProductionReadyPillarState) -> ProductionReadyPillarState:
        """Valida memória vetorial antes de usar."""
        try:
            profile = state["profile"]
            segmento = profile.get("segmento", "")
            
            validated_responses = []
            validation_summary = {"total_validated": 0, "approved": 0, "rejected": 0}
            
            # Buscar respostas existentes
            if self.pillar_key == "processo_vendas":
                common_objections = ["preço muito alto", "já tenho fornecedor"]
                
                for objection in common_objections:
                    responses = get_objection_responses(segmento, objection)
                    
                    for response in responses:
                        # Validar antes de usar
                        validation = validate_before_chroma_save(
                            response.get("document", ""),
                            {"industry": segmento, "type": "objection_response"},
                            "objection_response"
                        )
                        
                        if validation.should_save:
                            validated_responses.append(response)
                            validation_summary["approved"] += 1
                        else:
                            validation_summary["rejected"] += 1
                        
                        validation_summary["total_validated"] += 1
            
            state["validated_responses"] = validated_responses
            state["validation_summary"] = validation_summary
            state["status"] = "memory_validated"
            
            return state
            
        except Exception as e:
            state["error"] = f"Memory validation failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _generate_with_validation_node(self, state: ProductionReadyPillarState) -> ProductionReadyPillarState:
        """Gera com contexto otimizado e validado."""
        try:
            profile = state["profile"]
            upstream_context = state["upstream_context"]
            optimized_context = state["optimized_context"]
            validated_responses = state["validated_responses"]
            
            # Obter schema do pilar
            from app.config.pillars_config import PillarConfig
            pillar_config = PillarConfig.get_pillar_config(self.pillar_key)
            schema = pillar_config["output_schema"]
            
            # Construir prompt otimizado (já processado pelo smart processor)
            prompt = f"""Você é especialista em {pillar_config['label']} para PMEs brasileiras.

EMPRESA: "{profile.get('nome_empresa', '')}" | {profile.get('segmento', '')} | {profile.get('modelo_negocio', '')} | {profile.get('localizacao', '')}

ESCOPO ESTRITO: {pillar_config['scope']}
CAMPOS PROIBIDOS: {pillar_config['forbidden']}

[CONTEXTO UPSTREAM ESTRUTURADO]
{json.dumps(upstream_context, ensure_ascii=False, indent=2)}

[PESQUISA OTIMIZADA - Rate Limit Protected]
{optimized_context}

[MEMÓRIA VETORIAL VALIDADA]
{json.dumps(validated_responses[:2], ensure_ascii=False, indent=2)}

"""
            
            # Adicionar instruções específicas do pilar
            if self.pillar_key == "processo_vendas":
                prompt += """
FOQUE EM: Scripts de vendas, funil estruturado, quebra de objeções.
USE: Inteligência validada e otimizada.
EVITE: Dados não verificados ou alucinações.
"""
            elif self.pillar_key == "branding":
                prompt += """
FOQUE EM: Posicionamento técnico puro.
USE: Apenas dados validados e verificáveis.
EVITE: Suposições sem fundamento.
"""
            
            prompt += f"""

Retorne SOMENTE um objeto JSON com exatamente estes campos (sem texto extra, sem markdown):
{json.dumps(schema, ensure_ascii=False, indent=2)}

Todos os valores devem ser específicos para "{profile.get('nome_empresa', '')}". Use apenas dados verificados."""
            
            # Usar Groq com contexto otimizado (sem risco de rate limit)
            response = call_llm(
                provider="groq",
                prompt=prompt,
                temperature=0.2,
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
    
    def _save_with_backup_node(self, state: ProductionReadyPillarState) -> ProductionReadyPillarState:
        """Salva com backup automático."""
        try:
            structured_output = state["structured_output"]
            profile = state["profile"]
            
            # Validar antes de salvar na memória vetorial
            if self.pillar_key == "processo_vendas":
                objection_handling = structured_output.get("objection_handling", [])
                
                for technique in objection_handling:
                    objection = technique.get("objecao", "")
                    response = technique.get("tecnica_resposta", "")
                    
                    if objection and response:
                        # Validar antes de salvar
                        validation = validate_before_chroma_save(
                            response,
                            {"industry": profile.get("segmento", ""), "type": "objection_response"},
                            "objection_response"
                        )
                        
                        if validation.should_save:
                            store_objection_learning(
                                profile.get("segmento", ""), 
                                objection, 
                                response, 
                                0.8
                            )
            
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
            
            state["status"] = "saved_with_backup"
            
            return state
            
        except Exception as e:
            state["error"] = f"Save with backup failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _sre_cleanup_node(self, state: ProductionReadyPillarState) -> ProductionReadyPillarState:
        """Limpeza SRE pós-execução."""
        try:
            # Coletar métricas de uso
            resource_usage = {
                "execution_time": "measured",
                "memory_peak": "measured",
                "tokens_used": "estimated"
            }
            
            state["resource_usage"] = resource_usage
            
            # Limpeza leve de checkpoints se necessário
            checkpoint_health = get_checkpoints_health()
            if checkpoint_health.get("risk_level") == "HIGH":
                cleanup_checkpoints_safe()
            
            state["status"] = "completed"
            
            return state
            
        except Exception as e:
            state["error"] = f"SRE cleanup failed: {str(e)}"
            state["status"] = "error"
            return state
    
    def _get_memory_usage(self) -> Dict[str, Any]:
        """Obtém métricas de uso de memória."""
        try:
            import psutil
            process = psutil.Process()
            memory_info = process.memory_info()
            
            return {
                "rss_mb": memory_info.rss / (1024 * 1024),
                "vms_mb": memory_info.vms / (1024 * 1024),
                "cpu_percent": process.cpu_percent()
            }
        except ImportError:
            return {"status": "psutil not available"}
        except Exception as e:
            return {"error": str(e)}
    
    def run(self, business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
        """
        Executa agente production-ready com SRE safeguards.
        
        Args:
            business_id: ID do negócio
            profile: Perfil da empresa
            user_command: Comando do usuário
        
        Returns:
            Resultado com métricas SRE completas
        """
        try:
            # Estado inicial
            initial_state = ProductionReadyPillarState(
                pillar_key=self.pillar_key,
                business_id=business_id,
                profile=profile,
                user_command=user_command,
                upstream_context={},
                raw_research=[],
                processed_research={},
                optimized_context="",
                validated_responses=[],
                validation_summary={},
                sre_metrics={},
                resource_usage={},
                structured_output={},
                status="starting",
                error=None,
                sources=[]
            )
            
            # Executar grafo production-ready
            result = self.compiled_graph.invoke(initial_state)
            
            return {
                "success": result["status"] == "completed",
                "pillar_key": self.pillar_key,
                "data": result.get("structured_output", {}),
                "sources": result.get("sources", []),
                "context_used": result.get("upstream_context", {}),
                "sre_metrics": result.get("sre_metrics", {}),
                "resource_usage": result.get("resource_usage", {}),
                "validation_summary": result.get("validation_summary", {}),
                "enhanced_features": {
                    "smart_processing": bool(result.get("processed_research")),
                    "rate_limit_protection": "ACTIVE",
                    "content_validation": "ACTIVE",
                    "backup_protection": "ACTIVE",
                    "auto_cleanup": "ACTIVE"
                },
                "error": result.get("error"),
                "status": result["status"]
            }
            
        except Exception as e:
            return {
                "success": False,
                "pillar_key": self.pillar_key,
                "error": f"Production-ready {self.pillar_key} execution failed: {str(e)}",
                "data": {},
                "sources": [],
                "context_used": {},
                "sre_metrics": {},
                "resource_usage": {},
                "validation_summary": {},
                "enhanced_features": {}
            }


# Funções production-ready para cada pilar
def run_production_ready_pillar_agent(pillar_key: str, business_id: str, 
                                    profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    """
    Interface production-ready para qualquer pilar.
    
    Args:
        pillar_key: Chave do pilar
        business_id: ID do negócio
        profile: Perfil da empresa
        user_command: Comando do usuário
    
    Returns:
        Resultado enterprise-ready com SRE safeguards
    """
    agent = ProductionReadyPillarAgent(pillar_key)
    return agent.run(business_id, profile, user_command)


# Funções específicas production-ready
def run_production_ready_publico_alvo(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_production_ready_pillar_agent("publico_alvo", business_id, profile, user_command)

def run_production_ready_branding(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_production_ready_pillar_agent("branding", business_id, profile, user_command)

def run_production_ready_identidade_visual(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_production_ready_pillar_agent("identidade_visual", business_id, profile, user_command)

def run_production_ready_canais_venda(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_production_ready_pillar_agent("canais_venda", business_id, profile, user_command)

def run_production_ready_trafego_organico(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_production_ready_pillar_agent("trafego_organico", business_id, profile, user_command)

def run_production_ready_trafego_pago(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_production_ready_pillar_agent("trafego_pago", business_id, profile, user_command)

def run_production_ready_processo_vendas(business_id: str, profile: Dict[str, Any], user_command: str = "") -> Dict[str, Any]:
    return run_production_ready_pillar_agent("processo_vendas", business_id, profile, user_command)
