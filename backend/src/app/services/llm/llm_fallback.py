"""
LLM Fallback - Simple fallback for LLM calls
Used when main LLM service is not available
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def call_llm(prompt: str, model_provider: str = "groq", 
             temperature: float = 0.7, json_mode: bool = False, 
             prefer_small: bool = False) -> Dict[str, Any]:
    """
    Fallback LLM call function
    Tries to use existing LLM router or returns error
    """
    try:
        # Try to import and use existing LLM router
        from backend.src.app.services.llm_router import call_llm as original_call_llm
        return original_call_llm(prompt, model_provider, temperature, json_mode, prefer_small)
    except ImportError:
        logger.error("LLM router not available, using fallback")
        return {
            "content": "LLM service not available",
            "provider": model_provider,
            "error": "LLM router not found"
        }
