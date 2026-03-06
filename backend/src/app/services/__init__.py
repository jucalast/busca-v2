"""
Services Module - Organized Business Logic Components

This module provides organized access to all business services:

🧠 Intelligence Services:
- Content validation and smart processing
- Vector memory and deep scraping
- ML/AI components

🗄️ Infrastructure Services:
- System backup and recovery
- Checkpoints cleanup and maintenance
- SRE and monitoring tools

🔍 Search Services:
- Web search and data discovery
- Context management and extraction

📦 Core Services:
- Main business logic and growth services
- Central data management

🤖 Agent Services:
- Specialized autonomous agents
- LangGraph and enhanced implementations
- Production-ready enterprise agents

Usage Examples:
    # Intelligence services
    from app.services.intelligence import content_validator, vector_store
    
    # Infrastructure services  
    from app.services.infrastructure import backup_manager, cleanup
    
    # Search services
    from app.services.search import search_service, context_service
    
    # Core services
    from app.services.core import growth_service
    
    # Agent services
    from app.services.agents import pillar_agent, enhanced_agents
"""

# Lazy imports to avoid circular dependencies
# Modules are loaded on first access instead of at import time
def __getattr__(name):
    """Lazy-load service functions on demand."""
    if name == "run_pillar_agent":
        from .agents.pillar_agent import run_pillar_agent
        return run_pillar_agent
    if name == "get_vector_store":
        from .intelligence.vector_store import get_vector_store
        return get_vector_store
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    # Agent services
    'run_pillar_agent',
    'run_enhanced_pillar_agent', 
    'run_production_ready_pillar_agent',
    
    # Intelligence services
    'validate_before_chroma_save',
    'process_enhanced_research_smart',
    'get_vector_store',
    'scrape_competitor_site',
    
    # Infrastructure services
    'create_emergency_backup',
    'cleanup_checkpoints_safe',
    'check_infrastructure_health',
    
    # Search services
    'search_duckduckgo',
    'extract_structured_context',
    
    # Core services
    'growth_service'
]
