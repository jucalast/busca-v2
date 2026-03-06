"""
Prompt Loader — Centralizes LLM instruction management via YAML.
"""
import os
import yaml
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Base directory for prompts
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Cache for loaded prompts to avoid repeated I/O
_PROMPT_CACHE: Dict[str, Any] = {}

def load_prompt_file(filename: str) -> Dict[str, Any]:
    """Load a YAML prompt file with caching."""
    if filename in _PROMPT_CACHE:
        return _PROMPT_CACHE[filename]
    
    file_path = PROMPTS_DIR / filename
    if not file_path.exists():
        logger.error(f"Prompt file not found: {file_path}")
        return {}
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            _PROMPT_CACHE[filename] = data
            return data
    except Exception as e:
        logger.error(f"Error loading prompt file {filename}: {e}")
        return {}

def get_pillar_prompt(pillar_key: str, model_key: str) -> Dict[str, Any]:
    """
    Get the specific prompt data for a pillar and business model.
    Pillar files can be standalone (publico_alvo.yaml) or grouped.
    """
    # Mapping of keys to files
    mapping = {
        "publico_alvo": "publico_alvo.yaml",
        "branding": "branding_visual.yaml",
        "identidade_visual": "branding_visual.yaml",
        "canais_venda": "canais_trafego.yaml",
        "trafego_organico": "canais_trafego.yaml",
        "trafego_pago": "pago_vendas.yaml",
        "processo_vendas": "pago_vendas.yaml"
    }
    
    filename = mapping.get(pillar_key)
    if not filename:
        return {}
    
    data = load_prompt_file(filename)
    
    # Check if the file is pillar-keyed (like publico_alvo.yaml) or model-keyed
    if pillar_key in data:
        pillar_data = data[pillar_key]
        return pillar_data.get(model_key, pillar_data.get("b2c", {}))
    
    # Otherwise it's the file root (like publico_alvo.yaml structure I created)
    return data.get(model_key, data.get("b2c", {}))

def get_engine_prompt(id: str) -> str:
    """Get a generic engine prompt by ID from engine.yaml."""
    data = load_prompt_file("engine.yaml")
    return data.get(id, "")
