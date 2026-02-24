"""
Task Generator — Creates AI-powered, prioritized action tasks from business profile + score + market data.
Each task references real data, has a priority score, and optional AI assistance support.

IMPROVED VERSION: Now generates tasks that are:
1. Non-redundant (each task covers a unique area)
2. Constraint-aware (respects capital/team/model restrictions)
3. Highly specific (actionable THIS WEEK)
4. Contextually relevant (addresses real problems, not generic advice)
"""

import json
import os
import sys
import time
try:
    from .llm_router import call_llm
except ImportError:
    from llm_router import call_llm
from dotenv import load_dotenv

load_dotenv()




def extract_restrictions(profile: dict) -> dict:
    """Extract business restrictions from profile."""
    restricoes = profile.get("restricoes_criticas", {})
    perfil = profile.get("perfil", {})
    
    return {
        "modelo_operacional": restricoes.get("modelo_operacional", perfil.get("modelo_operacional", "")),
        "capital_disponivel": restricoes.get("capital_disponivel", "medio"),
        "equipe_solo": restricoes.get("equipe_solo", False),
        "canais_existentes": restricoes.get("canais_existentes", []),
        "dificuldades": perfil.get("dificuldades", ""),
    }


def generate_tasks(profile: dict, score: dict, market_data: dict, api_key: str) -> dict:
    """
    Generate prioritized action tasks based on comprehensive business analysis.
    NOW: Generates non-redundant, constraint-aware, highly specific tasks.
    """
    
    # Extract restrictions
    restricoes = extract_restrictions(profile)
    perfil = profile.get("perfil", {})
    
    # Build restriction warnings
    restriction_warnings = []
    
    if restricoes.get("modelo_operacional") in ["sob_encomenda", "dropshipping"]:
        restriction_warnings.append("⛔ PROIBIDO: tarefas sobre gestão de estoque, ERP de estoque, controle de inventário. O negócio opera sob encomenda.")
    
    if restricoes.get("capital_disponivel") in ["zero", "baixo"]:
        restriction_warnings.append("⛔ PROIBIDO: ferramentas pagas (HubSpot, RD Station, Bling pago), anúncios pagos caros. Apenas opções GRATUITAS ou muito baratas (até R$50/mês).")
    
    if restricoes.get("equipe_solo"):
        restriction_warnings.append("⛔ PROIBIDO: estratégias que exigem equipe, processos complexos, múltiplas reuniões. Tudo deve ser executável por UMA PESSOA em poucas horas.")
    
    canais = restricoes.get("canais_existentes", [])
    if any("instagram" in c.lower() for c in canais):
        restriction_warnings.append("⚠️ ATENÇÃO: Já usa Instagram. NÃO sugira 'criar presença no Instagram'. Sugira OTIMIZAÇÃO: Instagram Shopping, Reels, bio otimizada, etc.")
    if any("whatsapp" in c.lower() for c in canais):
        restriction_warnings.append("⚠️ ATENÇÃO: Já usa WhatsApp. NÃO sugira 'usar WhatsApp'. Sugira OTIMIZAÇÃO: catálogo, mensagens automáticas, WhatsApp Business API, etc.")
    
    restriction_text = "\n".join(restriction_warnings) if restriction_warnings else "Sem restrições especiais identificadas."
    
    # Get main difficulty
    dificuldade_principal = perfil.get("dificuldades", restricoes.get("dificuldades", ""))

    prompt = f"""Você é um consultor de negócios sênior criando um PLANO DE AÇÃO ULTRA-ESPECÍFICO e VIÁVEL.

PERFIL DO NEGÓCIO:
{json.dumps(profile, ensure_ascii=False, indent=2)[:5000]}

⛔⛔⛔ RESTRIÇÕES CRÍTICAS (RESPEITAR OBRIGATORIAMENTE):
{restriction_text}

DIFICULDADE PRINCIPAL RELATADA:
"{dificuldade_principal}"

SCORE DE SAÚDE (0-100):
{json.dumps(score, ensure_ascii=False, indent=2)[:5000]}

DADOS DE MERCADO:
{json.dumps(market_data, ensure_ascii=False, indent=2)[:8000]}

REGRAS DE GERAÇÃO DE TAREFAS:

1. CADA TAREFA É ÚNICA — Não pode haver 2 tarefas sobre o mesmo assunto:
   - ❌ ERRADO: "Configurar HubSpot" e "Criar plano de conteúdo no HubSpot" (mesmo tema)
   - ❌ ERRADO: "Implementar redes sociais" e "Criar perfil no Instagram" (sobreposição)
   - ✅ CERTO: Uma tarefa sobre credibilidade, outra sobre conversão, outra sobre precificação

2. ATAQUE A DIFICULDADE PRINCIPAL PRIMEIRO:
   - Se o problema é credibilidade → primeira tarefa deve resolver credibilidade
   - Se o problema é falta de cliente → primeira tarefa deve gerar leads
   - A prioridade máxima vai para o problema REAL relatado pelo usuário

3. RESPEITE AS RESTRIÇÕES:
   - Se capital zero: apenas ferramentas gratuitas (Instagram Shopping, WhatsApp Business, Canva)
   - Se solo: cada tarefa deve levar no máximo 2-4 horas para completar
   - Se sem estoque: NÃO mencione estoque, ERP, inventário

4. SEJA ULTRA-ESPECÍFICO:
   - ❌ ERRADO: "Melhorar presença digital"
   - ✅ CERTO: "Configurar Instagram Shopping com 10 produtos e link na bio"
   - ❌ ERRADO: "Aumentar credibilidade"
   - ✅ CERTO: "Gravar 3 depoimentos em vídeo com clientes satisfeitos"

5. CADA TAREFA DEVE SER EXECUTÁVEL ESTA SEMANA:
   - Passos concretos com ferramentas gratuitas/baratas
   - Tempo estimado realista
   - Resultado mensurável

ESTRUTURA DO JSON:
{{
    "tasks": [
        {{
            "id": "task_001",
            "titulo": "Título ULTRA-ESPECÍFICO (ex: Gravar 3 depoimentos em vídeo de clientes)",
            "categoria": "publico_alvo / branding / identidade_visual / canais_venda / trafego_organico / trafego_pago / processo_vendas",
            "impacto": 1-10,
            "esforco": 1-10 (considere que é uma pessoa só com pouco tempo),
            "prioridade_calculada": (impacto × 0.7) + ((10 - esforco) × 0.3),
            "prazo_sugerido": "1 semana / 2 semanas / 1 mês",
            "descricao": "Por que essa tarefa resolve o problema ESPECÍFICO do usuário",
            "passos": [
                "Passo 1: [AÇÃO CONCRETA] usando [FERRAMENTA GRATUITA] (tempo: X min)",
                "Passo 2: [PRÓXIMA AÇÃO CONCRETA] (tempo: X min)",
                "Passo 3: [COMO VERIFICAR QUE DEU CERTO]"
            ],
            "tempo_estimado": "X horas no total",
            "custo_estimado": "R$ 0 / até R$ 50 / até R$ 100",
            "ferramentas": ["ferramenta1 (grátis)", "ferramenta2"],
            "suporte_ia": {{
                "tipo": "copywriting / analise_concorrente / lista_leads / script_abordagem / plano_conteudo / precificacao",
                "descricao": "O que a IA pode fazer para acelerar esta tarefa",
                "disponivel": true
            }},
            "dados_suporte": {{
                "dado_chave": "dado real da pesquisa que justifica esta tarefa",
                "fonte_contexto": "de onde veio"
            }},
            "resultado_esperado": "O que melhora depois de completar esta tarefa"
        }}
    ],
    "resumo_plano": "2-3 frases sobre a estratégia — focada na dificuldade principal",
    "meta_principal": "O resultado #1 que o usuário vai alcançar",
    "tempo_estimado_total": "X semanas para completar tudo",
    "investimento_total": "R$ X (ou R$ 0 se tudo gratuito)"
}}

GERE ENTRE 4 E 6 TAREFAS — preferir menos tarefas de alta qualidade do que muitas genéricas."""

    return call_llm(provider=None, prompt=prompt, temperature=0.3)


def deduplicate_tasks(tasks: list) -> list:
    """Remove tasks that are too similar to each other."""
    if not tasks or len(tasks) <= 1:
        return tasks
    
    # Keywords that indicate similar tasks
    similarity_keywords = {
        "estoque": ["estoque", "inventario", "erp", "bling", "tiny"],
        "redes_sociais": ["instagram", "rede social", "facebook", "tiktok", "presença digital"],
        "conteudo": ["conteúdo", "plano de conteúdo", "calendário", "posts"],
        "crm": ["crm", "hubspot", "rd station", "relacionamento"],
        "credibilidade": ["credibilidade", "confiança", "depoimento", "avaliação", "prova social"],
        "precificacao": ["preço", "precificação", "margem", "desconto"],
    }
    
    seen_categories = set()
    deduplicated = []
    
    for task in tasks:
        titulo_lower = task.get("titulo", "").lower()
        descricao_lower = task.get("descricao", "").lower()
        combined = titulo_lower + " " + descricao_lower
        
        # Check which category this task belongs to
        task_category = None
        for category, keywords in similarity_keywords.items():
            if any(kw in combined for kw in keywords):
                task_category = category
                break
        
        # If no category match or category not seen, include the task
        if task_category is None or task_category not in seen_categories:
            deduplicated.append(task)
            if task_category:
                seen_categories.add(task_category)
    
    return deduplicated


def run_task_generator(profile: dict, score: dict, market_data: dict) -> dict:
    """
    Main entry point. Takes profile + score + market data, returns prioritized tasks.
    NOW: Deduplicates and validates tasks against restrictions.
    """
    api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return {
            "success": False,
            "erro": "Chave da API Groq não configurada."
        }

    try:
        print("📋 Gerando tarefas de crescimento...", file=sys.stderr)
        result = generate_tasks(profile, score, market_data, api_key)

        tasks = result.get("tasks", [])
        
        # Sort by priority
        tasks.sort(key=lambda t: t.get("prioridade_calculada", 0), reverse=True)
        
        # Deduplicate similar tasks
        tasks = deduplicate_tasks(tasks)
        
        result["tasks"] = tasks

        print(f"  ✅ {len(tasks)} tarefas geradas (deduplicadas e priorizadas).", file=sys.stderr)

        return {
            "success": True,
            "taskPlan": result
        }

    except Exception as e:
        print(f"❌ Erro ao gerar tarefas: {e}", file=sys.stderr)
        return {
            "success": False,
            "erro": f"Erro ao gerar tarefas: {str(e)[:200]}"
        }
