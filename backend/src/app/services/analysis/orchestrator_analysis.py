"""
Analysis Orchestrator - Main orchestration service
Coordinates all analysis services: Discovery → Market Search → Scoring → Task Generation
"""

import logging
from typing import Dict, Any, Optional
from app.services.analysis.analyzer_business_discovery import discover_business
from app.services.analysis.service_scoring import ScoringService
from app.services.analysis.analyzer_business_profiler import identify_dynamic_categories
from app.core import database as db
from app.services.agents.engine_specialist import generate_business_brief
from app.services.core.orchestrator_growth import run_market_search

logger = logging.getLogger(__name__)

class AnalysisOrchestrator:
    """Main orchestration service for business analysis pipeline"""
    
    def __init__(self, progress_callback=None):
        self.logger = logger
        self.scoring_service = ScoringService()
        self.progress_callback = progress_callback
    
    def _send_progress(self, message: str):
        """Send progress update via callback if available"""
        if self.progress_callback:
            self.progress_callback(message)
    
    def run_full_analysis(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute complete business analysis pipeline
        
        Args:
            data: Analysis request data containing profile, business info, etc.
            
        Returns:
            Complete analysis results
        """
        self.logger.info(f"Starting full analysis for business: {data.get('business_id', 'new')}")
        
        try:
            # Extract data
            user_id = data.get("user_id", "default_user")
            business_id = data.get("business_id")
            analysis_id = data.get("analysis_id")
            profile = data.get("profile", {})
            model_provider = data.get("aiModel", "groq")
            region = data.get("region", "br-pt")
            
            # Step 0: Load enriched profile if reanalyzing
            if analysis_id:
                profile = self._load_enriched_profile(analysis_id, profile)
            
            # Step 1: Clear existing data for reanalysis
            if analysis_id:
                self._clear_analysis_data(analysis_id)
            
            # Step 2: Business Discovery
            self._send_progress("🔍 Pesquisando presença digital do negócio...")
            self.logger.info("Step 1: Business Discovery")
            discovery_data = discover_business(profile, region, model_provider)
            discovery_found = discovery_data.get("found", False)
            
            # Step 3: Market Search
            self._send_progress("📊 Analisando mercado e concorrência...")
            self.logger.info("Step 2: Market Search")
            # Ensure categories exist
            identify_dynamic_categories(profile)
            market_data = run_market_search(profile, region, model_provider)
            
            # Step 4: Scoring
            self._send_progress("📈 Calculando score dos 7 pilares de vendas...")
            self.logger.info("Step 3: Business Scoring")
            scoring_result = self.scoring_service.run_scorer(
                profile, market_data, discovery_data, model_provider
            )
            
            if not scoring_result.get("success"):
                raise Exception(f"Scoring failed: {scoring_result.get('error')}")
            
            score_data = scoring_result["score"]
            task_plan = scoring_result["taskPlan"]
            
            # Step 5: Merge research tasks from chat
            task_plan = self._merge_research_tasks(task_plan, profile)
            
            # Step 6: Persist to database
            analysis = self._persist_analysis(
                business_id, user_id, profile, score_data, task_plan, market_data
            )
            analysis_id = analysis["id"]
            business_id = analysis["business_id"]
            
            # Step 7: Generate Business Brief
            brief = self._generate_business_brief(
                business_id, analysis_id, profile, discovery_data, market_data
            )
            
            # Step 8: Save pillar diagnostics
            diagnostics_summary = self._save_pillar_diagnostics(
                analysis_id, score_data["dimensoes"]
            )
            
            # Compile final results
            result = {
                "success": True,
                "discoveryData": discovery_data if discovery_found else None,
                "marketData": market_data,
                "score": score_data,
                "taskPlan": task_plan,
                "specialists": diagnostics_summary,
                "brief": brief,
                "business_id": business_id,
                "analysis_id": analysis_id,
            }
            
            # Step 9: Save to pre-processed cache (Pillar 5)
            db.save_analysis_cache(business_id, analysis_id, result)
            
            self.logger.info(f"Analysis completed successfully: {analysis_id}")
            return result
            
        except Exception as e:
            self.logger.error(f"Analysis failed: {str(e)}")
            import traceback
            return {
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }
    
    def _load_enriched_profile(self, analysis_id: str, current_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Load enriched profile from previous analysis"""
        try:
            previous_analysis = db.get_analysis(analysis_id)
            if previous_analysis and previous_analysis.get("profile_data"):
                self.logger.info("Loaded enriched profile from previous analysis")
                return previous_analysis["profile_data"]
        except Exception as e:
            self.logger.warning(f"Could not load previous profile: {str(e)}")
        
        return current_profile
    
    def _clear_analysis_data(self, analysis_id: str):
        """Clear existing task data for reanalysis"""
        try:
            self.logger.info("Clearing previous analysis data")
            
            # Delete specialist data
            tables_to_clear = [
                "specialist_plans",
                "specialist_executions", 
                "specialist_results",
                "specialist_subtasks",
                "pillar_kpis"
            ]
            
            conn = db.get_connection()
            cursor = conn.cursor()
            for table in tables_to_clear:
                cursor.execute(f"DELETE FROM {table} WHERE analysis_id = %s", (analysis_id,))
            
            conn.commit()
            cursor.close()
            conn.close()
            self.logger.info("Previous analysis data cleared")
            
        except Exception as e:
            self.logger.error(f"Error clearing analysis data: {str(e)}")
    
    def _merge_research_tasks(self, task_plan: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
        """Merge research tasks from chat into task plan"""
        research_tasks = profile.get("_research_tasks", [])
        
        if research_tasks:
            tasks_list = task_plan.setdefault("tasks", [])
            
            for rt in research_tasks:
                task = {
                    "id": f"research_{len(tasks_list) + 1}",
                    "titulo": rt.get("titulo", "Pesquisa pendente"),
                    "categoria": "pesquisa",
                    "pilar": "research",
                    "descricao": rt.get("descricao", ""),
                    "prioridade": "media",
                    "impacto": 5,
                    "prazo_sugerido": "2 semanas",
                    "custo_estimado": "R$ 0",
                    "fonte_referencia": f"Origem: {rt.get('origem', 'chat')}",
                    "complexidade": "baixa"
                }
                tasks_list.append(task)
            
            self.logger.info(f"Merged {len(research_tasks)} research tasks")
        
        return task_plan
    
    def _persist_analysis(self, business_id: Optional[str], user_id: str, 
                         profile: Dict[str, Any], score_data: Dict[str, Any], 
                         task_plan: Dict[str, Any], market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Persist analysis to database"""
        try:
            if business_id:
                # Update existing business
                self.logger.info(f"Creating analysis for existing business: {business_id}")
                analysis = db.create_analysis(business_id, score_data, task_plan, market_data, profile_data=profile, discovery_data=None)
            else:
                # Create new business
                self.logger.info("Creating new business and analysis")
                db.get_or_create_user(user_id)
                
                perfil = profile.get("perfil", profile)
                name = perfil.get("nome", perfil.get("nome_negocio", "Novo Negocio"))
                
                business = db.create_business(user_id, name, profile)
                business_id = business["id"]
                
                analysis = db.create_analysis(business_id, score_data, task_plan, market_data, profile_data=profile, discovery_data=None)
            
            self.logger.info(f"Analysis persisted: {analysis['id']}")
            return {
                "id": analysis["id"],
                "business_id": business_id
            }
            
        except Exception as e:
            self.logger.error(f"Error persisting analysis: {str(e)}")
            raise
    
    def _generate_business_brief(self, business_id: str, analysis_id: str, 
                                profile: Dict[str, Any], discovery_data: Optional[Dict[str, Any]], 
                                market_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generate compact business brief"""
        try:
            self.logger.info("Generating business brief")
            
            brief = generate_business_brief(
                profile,
                discovery_data=discovery_data if discovery_data and discovery_data.get("found") else None,
                market_data=market_data
            )
            
            db.save_business_brief(business_id, analysis_id, brief)
            self.logger.info("Business brief generated and saved")
            return brief
            
        except Exception as e:
            self.logger.error(f"Error generating business brief: {str(e)}")
            return None
    
    def _save_pillar_diagnostics(self, analysis_id: str, dimensions: Dict[str, Any]) -> Dict[str, Any]:
        """Save pillar diagnostics from scoring results"""
        diagnostics_summary = {}
        
        try:
            for pillar_key, pillar_data in dimensions.items():
                try:
                    diag_data = {
                        "score": pillar_data.get("score", 50),
                        "status": pillar_data.get("status", "atencao"),
                        "estado_atual": {
                            "justificativa": pillar_data.get("justificativa", ""),
                            "dado_chave": pillar_data.get("dado_chave", ""),
                            "meta_pilar": pillar_data.get("meta_pilar", ""),
                        },
                        "gaps": [
                            a.get("acao", str(a)) if isinstance(a, dict) else str(a)
                            for a in pillar_data.get("acoes_imediatas", [])
                        ],
                        "oportunidades": [pillar_data.get("dado_chave", "")] if pillar_data.get("dado_chave") else [],
                        "dados_coletados": {
                            "score_llm": pillar_data.get("_score_llm", ""),
                            "score_objetivo": pillar_data.get("_score_objetivo", ""),
                        },
                        "fontes": pillar_data.get("fontes_utilizadas", []),
                        "chain_summary": f"Score {pillar_data.get('score', 50)}/100. {pillar_data.get('justificativa', '')[:200]}",
                    }
                    
                    db.save_pillar_diagnostic(analysis_id, pillar_key, diag_data)
                    
                    diagnostics_summary[pillar_key] = {
                        "score": pillar_data.get("score", 50),
                        "status": pillar_data.get("status", "atencao"),
                        "meta_pilar": pillar_data.get("meta_pilar", ""),
                        "dado_chave": pillar_data.get("dado_chave", ""),
                    }
                    
                except Exception as e:
                    self.logger.error(f"Error saving diagnostic for {pillar_key}: {str(e)}")
            
            self.logger.info(f"Saved {len(diagnostics_summary)} pillar diagnostics")
            return diagnostics_summary
            
        except Exception as e:
            self.logger.error(f"Error saving pillar diagnostics: {str(e)}")
            return {}
