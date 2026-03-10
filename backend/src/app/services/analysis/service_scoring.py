"""
Scoring Service - Wrapper for the complete business_scorer implementation
Uses the full business_scorer.py with chain context and 7 sequential pillars
"""

import logging
from typing import Dict, Any, Optional
from app.services.analysis.analyzer_business_scorer import run_scorer

logger = logging.getLogger(__name__)

class ScoringService:
    """Service wrapper for the complete business scoring system"""
    
    def __init__(self):
        self.logger = logger
    
    def run_scorer(self, profile: Dict[str, Any], market_data: Dict[str, Any], 
                   discovery_data: Optional[Dict[str, Any]] = None, 
                   strategic_intel: Optional[Dict[str, Any]] = None,
                   model_provider: str = "groq",
                   generate_tasks: bool = True,
                   is_reanalysis: bool = False) -> Dict[str, Any]:
        """
        Run complete business scoring using business_scorer.py
        
        Args:
            profile: Business profile data
            market_data: Market research data
            discovery_data: Business discovery data
            strategic_intel: Trends, news and real market patterns
            model_provider: AI model provider
            
        Returns:
            Complete scoring results with 7 pillars and task plan
        """
        self.logger.info("Running complete business scoring with chain context and real market intel")
        
        # Use the complete business_scorer implementation
        result = run_scorer(
            profile=profile,
            market_data=market_data,
            discovery_data=discovery_data,
            strategic_intel=strategic_intel,
            model_provider=model_provider,
            generate_tasks=generate_tasks,
            is_reanalysis=is_reanalysis
        )
        
        return result
