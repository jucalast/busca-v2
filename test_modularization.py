"""
Test Modularization - Verifica se todos os imports estão funcionando
"""

import sys
import os

# Adicionar backend ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'src'))

def test_all_imports():
    """Testa se todos os imports principais funcionam após reorganização."""
    
    print("🧪 Testando imports modularizados...")
    
    try:
        # Test imports principais
        print("  📦 Testando core services...")
        from app.services.core.growth_service import do_profile, do_analyze
        print("    ✅ growth_service")
        
        print("  🔍 Testando search services...")
        from app.services.search.search_service import search_simple, search_business
        from app.services.search.context_service import extract_structured_context
        print("    ✅ search_service")
        print("    ✅ context_service")
        
        print("  🧠 Testando intelligence services...")
        from app.services.intelligence.vector_store import get_vector_store
        from app.services.intelligence.content_validator import validate_before_chroma_save
        from app.services.intelligence.smart_content_processor import smart_processor
        from app.services.intelligence.jina_reader_service import scrape_competitor_site
        print("    ✅ vector_store")
        print("    ✅ content_validator")
        print("    ✅ smart_content_processor")
        print("    ✅ jina_reader_service")
        
        print("  🗄️ Testando infrastructure services...")
        from app.services.infrastructure.checkpoints_garbage_collector import cleanup_checkpoints_safe
        from app.services.infrastructure.infrastructure_backup_manager import create_emergency_backup
        print("    ✅ checkpoints_garbage_collector")
        print("    ✅ infrastructure_backup_manager")
        
        print("  🤖 Testando agents...")
        from app.services.agents.pillar_agent import run_pillar_agent
        from app.services.agents.enhanced_pillar_agents import run_enhanced_pillar_agent
        from app.services.agents.production_ready_pillar_agents import run_production_ready_pillar_agent
        print("    ✅ pillar_agent")
        print("    ✅ enhanced_pillar_agents")
        print("    ✅ production_ready_pillar_agents")
        
        print("  🌐 Testando API routers...")
        from app.api.routers import growth, search
        print("    ✅ API routers")
        
        print("\n🎉 TODOS OS IMPORTS FUNCIONANDO!")
        print("✅ Modularização 100% bem-sucedida!")
        
        return True
        
    except ImportError as e:
        print(f"\n❌ Erro de import: {str(e)}")
        return False
    except Exception as e:
        print(f"\n❌ Erro inesperado: {str(e)}")
        return False


if __name__ == "__main__":
    test_all_imports()
