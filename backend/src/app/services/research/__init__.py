"""
Unified Research Module
Modularização inteligente de pesquisa com cache hierárquico
"""

from .unified_research import UnifiedResearchEngine, research_engine
from .research_db import (
    save_research_cache,
    get_research_cache,
    save_research_result,
    get_research_result,
    get_research_stats,
    cleanup_expired_cache,
    create_research_tables
)

__all__ = [
    'UnifiedResearchEngine',
    'research_engine',
    'save_research_cache',
    'get_research_cache',
    'save_research_result',
    'get_research_result',
    'get_research_stats',
    'cleanup_expired_cache',
    'create_research_tables'
]
