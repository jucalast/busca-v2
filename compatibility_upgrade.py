"""
Como substituir o pillar_agent por enhanced_agent mantendo 100% compatibilidade
"""

# No arquivo growth.py, basta mudar o import:

# ANTIGO:
# from app.services.agents.pillar_agent import run_pillar_agent

# NOVO:
from app.services.agents.enhanced_pillar_agents import run_enhanced_pillar_agent as run_pillar_agent

# E pronto! O resto do código continua exatamente igual:

@router.post("/pillar")
def run_pillar(req: BaseGrowthRequest):
    """Executa pilar com inteligência avançada (mesma interface, melhor resultado)"""
    return run_pillar_agent(
        pillar_key=req.pillar_key,
        business_id=req.business_id,
        profile=req.profile,
        user_command=req.user_command
    )

# O frontend não precisa mudar NADA!
# A resposta tem a mesma estrutura, só que mais rica.
