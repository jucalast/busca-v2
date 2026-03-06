"""
Strategic Feedback Loop — "Resultado = Novo Dado"
Allows AI specialists to update business profile and pillar scores based on execution findings.
"""

from app.services.common import (
    json, call_llm, db, log_info, log_error, log_success, log_debug
)
from typing import Dict, Any, Optional

def extract_strategic_insights(
    analysis_id: str,
    pillar_key: str,
    task_title: str,
    execution_content: str,
    current_profile: dict,
    model_provider: str = "groq"
) -> Dict[str, Any]:
    """
    Analyzes the execution result to find profile corrections or score adjustments.
    """
    
    perfil = current_profile.get("perfil", current_profile)
    
    prompt = f"""Você é um Auditor Estratégico de Negócios. Sua tarefa é analisar o resultado de uma tarefa técnica e verificar se ela traz informações que CORRIGEM ou ATUALIZAM o perfil do negócio ou o score do pilar.

NEGÓCIO: {perfil.get('nome', '?')} | Segmento: {perfil.get('segmento', '?')}
PILAR SENDO EXECUTADO: {pillar_key}
TAREFA EXECUTADA: {task_title}

RESULTADO DA EXECUÇÃO (Diferencial, Concorrentes, Mercado, etc):
{execution_content[:5000]}

COM BASE NO TEXTO ACIMA, identifique:
1. ATUALIZAÇÕES DE PERFIL: Algum dado (ex: concorrente novo, ticket médio real, canal de venda descoberto) que difere do que o cliente contou inicialmente?
2. AJUSTE DE SCORE: O pilar parece estar PIOR ou MELHOR do que o score original sugeria? (Se for pior, sugira uma redução. Se for melhor, um aumento).
3. INSIGHT CRÍTICO: Alguma descoberta que muda o jogo (ex: o diferencial do cliente não é único, o mercado está saturado, etc)?

ATENÇÃO: Extraia APENAS dados concretos e fundamentados no texto do resultado.

RETORNE APENAS JSON VÁLIDO:
{{
    "profile_updates": {{ "campo": "novo_valor_ou_correcao" }},
    "score_adjustment": {{ "delta": -15 a +15, "motivo": "justificativa curta" }},
    "critical_insights": ["lista de descobertas estratégicas"],
    "requires_reanalysis": true/false
}}
"""

    try:
        log_info(f"🔄 Executando Feedback Loop para {pillar_key}...")
        result = call_llm(provider=model_provider, prompt=prompt, temperature=0.1, json_mode=True)
        
        if not isinstance(result, dict):
            return {}
            
        return result
    except Exception as e:
        log_error(f"Erro no Feedback Loop: {e}")
        return {}

def apply_feedback_loop(analysis_id: str, pillar_key: str, insight_data: dict):
    """
    Applies the extracted insights to the database (Profile and Diagnostic).
    """
    if not insight_data:
        return
        
    # 1. Update Profile if needed
    updates = insight_data.get("profile_updates")
    if updates:
        analysis = db.get_analysis(analysis_id)
        if analysis and analysis.get("profile_data"):
            profile = analysis["profile_data"]
            perfil = profile.get("perfil", profile)
            
            changes_made = False
            for k, v in updates.items():
                if v and str(v).lower() not in ("null", "none", "?"):
                    perfil[k] = v
                    changes_made = True
            
            if changes_made:
                db.update_analysis_profile(analysis_id, profile)
                log_success(f"📈 Perfil da análise {analysis_id} atualizado via Feedback Loop ({len(updates)} campos)")

    # 2. Adjust Pillar Score if needed
    adj = insight_data.get("score_adjustment")
    if adj and abs(adj.get("delta", 0)) > 2:
        diag = db.get_pillar_diagnostic(analysis_id, pillar_key)
        if diag:
            diag_data = diag.get("diagnostic_data", diag)
            old_score = diag_data.get("score", 50)
            new_score = max(0, min(100, old_score + adj["delta"]))
            
            if new_score != old_score:
                diag_data["score"] = new_score
                diag_data["justificativa_feedback"] = adj.get("motivo", "")
                db.update_pillar_diagnostic(analysis_id, pillar_key, diag_data)
                log_success(f"⚖️ Score do pilar {pillar_key} ajustado: {old_score} -> {new_score} ({adj.get('motivo')})")
