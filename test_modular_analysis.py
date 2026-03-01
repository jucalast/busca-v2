#!/usr/bin/env python3
"""
Test script for the new modular analysis system
"""

import sys
import os

# Add the backend src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'src'))

def test_modular_analysis():
    """Test the new modular analysis system"""
    try:
        print("🧪 Testing Modular Analysis System...")
        
        # Test imports
        from app.services.analysis.analysis_orchestrator import AnalysisOrchestrator
        from app.services.core.growth_service import do_analyze
        print("✅ All imports successful")
        
        # Test orchestrator instantiation
        orchestrator = AnalysisOrchestrator()
        print("✅ AnalysisOrchestrator created")
        
        # Test minimal data
        test_data = {
            "user_id": "test_user",
            "business_id": None,
            "analysis_id": None,
            "profile": {
                "nome_negocio": "Test Business",
                "segmento": "technology",
                "categorias_relevantes": [
                    {"id": "publico_alvo", "nome": "Público-Alvo", "icone": "👥"},
                    {"id": "canais_venda", "nome": "Canais de Venda", "icone": "🛒"}
                ],
                "queries_sugeridas": {
                    "publico_alvo": "publico alvo tecnologia",
                    "canais_venda": "canais venda tecnologia"
                }
            },
            "aiModel": "groq",
            "region": "br-pt"
        }
        
        print("✅ Test data prepared")
        print("🚀 Starting analysis test...")
        
        # This would normally run the full analysis, but we'll just test the setup
        # result = do_analyze(test_data)
        # print(f"✅ Analysis result: {result.get('success', False)}")
        
        print("✅ Modular analysis system is ready!")
        print("📝 Note: Full analysis test requires API keys and network access")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_modular_analysis()
    sys.exit(0 if success else 1)
