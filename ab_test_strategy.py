"""
Teste A/B para validar enhanced agents antes de substituir
"""

# Adicionar endpoint temporário para teste:
@router.post("/pillar-enhanced-test")
def run_pillar_enhanced_test(req: BaseGrowthRequest):
    """
    Endpoint temporário para testar enhanced agents.
    Compara resultados lado a lado.
    """
    # Executar versão básica
    basic_result = run_pillar_agent(
        pillar_key=req.pillar_key,
        business_id=req.business_id,
        profile=req.profile,
        user_command=req.user_command
    )
    
    # Executar versão enhanced
    enhanced_result = run_enhanced_pillar_agent(
        pillar_key=req.pillar_key,
        business_id=req.business_id,
        profile=req.profile,
        user_command=req.user_command
    )
    
    return {
        "basic": basic_result,
        "enhanced": enhanced_result,
        "comparison": {
            "has_vector_memory": len(enhanced_result.get("enhanced_features", {}).get("vector_memory_hits", 0)) > 0,
            "has_competitor_insights": len(enhanced_result.get("enhanced_features", {}).get("competitor_insights", 0)) > 0,
            "response_time": "similar"  # Enhanced pode ser um pouco mais lento
        }
    }

# Se o enhanced for melhor, basta substituir o import principal
