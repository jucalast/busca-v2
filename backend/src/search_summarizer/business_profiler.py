"""
Business Profiler — Generates structured business profiles from onboarding data.
Uses Groq LLM to analyze user input and create a comprehensive business profile.

IMPROVED VERSION: Now extracts critical constraints (no inventory, solo entrepreneur, 
low capital) and generates context-aware recommendations.
"""

import json
import os
import sys
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


def call_groq(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 3) -> dict:
    """Generic Groq API call with retry + exponential backoff + model fallback."""
    client = Groq(api_key=api_key)
    models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

    for model in models:
        for attempt in range(max_retries):
            try:
                completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=model,
                    temperature=temperature,
                    response_format={"type": "json_object"},
                )
                if model != models[0]:
                    print(f"  ⚡ Usando modelo fallback: {model}", file=sys.stderr)
                return json.loads(completion.choices[0].message.content)
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    print(f"  ⏳ Rate limit ({model}). Aguardando {wait_time}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                elif "429" in error_msg and model != models[-1]:
                    print(f"  🔄 Rate limit esgotado em {model}. Tentando modelo menor...", file=sys.stderr)
                    break
                raise


def generate_business_profile(onboarding_data: dict, api_key: str) -> dict:
    """
    Generate a structured business profile from onboarding answers.
    NOW: Extracts constraints and generates context-aware categories.
    """

    prompt = f"""Você é um consultor de negócios sênior especializado em PMEs brasileiras.

Analise os dados de onboarding abaixo e gere um perfil estruturado de negócio.

DADOS DO ONBOARDING:
{json.dumps(onboarding_data, ensure_ascii=False, indent=2)}

REGRAS CRÍTICAS:
1. Retorne APENAS JSON válido.
2. DETECTE RESTRIÇÕES CRÍTICAS que afetam as recomendações:
   - "modelo_operacional": se trabalha "sem estoque", "sob encomenda", "dropshipping" → NÃO recomendar ERP de estoque
   - "capital_disponivel": se "zero", "baixo", "pouco" → NÃO recomendar ferramentas caras
   - "equipe_solo": se trabalha sozinho → NÃO recomendar estratégias complexas que exigem equipe
3. Gere CATEGORIAS DE ANÁLISE RELEVANTES para ESTE negócio específico:
   - Se não tem estoque → categoria sobre "Credibilidade e Confiança" em vez de "Gestão de Estoque"
   - Se já usa Instagram → categoria sobre "Otimização de Conversão" em vez de "Criar Presença Digital"
   - Se problema é credibilidade → categoria sobre "Prova Social e Garantias"
4. Gere QUERIES de busca específicas para os PROBLEMAS REAIS do negócio.
5. Seja preciso e direto — não invente dados, apenas interprete os fornecidos.

ESTRUTURA DO JSON:
{{
    "perfil": {{
        "nome": "nome do negócio",
        "segmento": "segmento detalhado",
        "localizacao": "cidade/estado",
        "modelo_negocio": "B2B / B2C / D2C / Misto",
        "tipo_oferta": "produto / serviço / ambos",
        "porte": "micro / pequena / média",
        "tempo_mercado": "tempo em operação",
        "ticket_medio_estimado": "valor",
        "faturamento_faixa": "faixa de faturamento",
        "num_funcionarios": "número ou 'solo'",
        "investimento_marketing": "valor ou 'zero'",
        "dificuldades": "dificuldades principais relatadas"
    }},
    "restricoes_criticas": {{
        "modelo_operacional": "estoque_proprio / sob_encomenda / dropshipping / consignacao / null",
        "capital_disponivel": "zero / baixo / medio / alto",
        "equipe_solo": true/false,
        "canais_existentes": ["lista de canais que JÁ usa"],
        "ferramentas_existentes": ["lista de ferramentas que JÁ usa"],
        "restricoes_texto": "resumo em 1 frase das principais restrições"
    }},
    "diagnostico_inicial": {{
        "problemas_identificados": [
            {{
                "area": "nome da área (ex: credibilidade, precificacao, marketing, operacao)",
                "problema": "descrição clara do problema REAL e ESPECÍFICO",
                "severidade": 1-5,
                "evidencia": "trecho do onboarding que indica isso",
                "restricao_afetada": "qual restrição afeta a solução deste problema"
            }}
        ],
        "pontos_fortes": [
            "aspecto positivo identificado"
        ],
        "maturidade": {{
            "vendas": 1-5,
            "marketing_digital": 1-5,
            "operacoes": 1-5,
            "financeiro": 1-5,
            "posicionamento": 1-5
        }}
    }},
    "categorias_relevantes": [
        {{
            "id": "id_da_categoria",
            "nome": "Nome da Categoria ESPECÍFICA para este negócio",
            "icone": "emoji",
            "cor": "#hex",
            "foco": "o que buscar que seja ÚTIL considerando as restrições",
            "prioridade": 1-10,
            "justificativa": "por que essa categoria é importante PARA ESTE NEGÓCIO ESPECÍFICO",
            "nao_falar": "o que NÃO buscar/recomendar por conta das restrições"
        }}
    ],
    "queries_sugeridas": {{
        "categoria_id": "query de busca otimizada para o problema REAL, não genérica"
    }},
    "objetivos_parseados": [
        {{
            "objetivo": "objetivo claro e mensurável",
            "prazo": "curto / médio / longo prazo",
            "area_relacionada": "vendas / marketing / operação / etc",
            "viabilidade": "alta / media / baixa — considerando restrições",
            "alerta_viabilidade": "se baixa viabilidade, explicar por quê"
        }}
    ]
}}

EXEMPLOS DE CATEGORIAS CONTEXTUAIS:
- Se "sem estoque" + "credibilidade": 
  → "Credibilidade e Confiança" (foco: depoimentos, garantias, prova social)
  → "Logística Sob Encomenda" (foco: prazos, fornecedores confiáveis)
  → NÃO incluir "Gestão de Estoque"

- Se "solo" + "capital zero":
  → "Marketing Orgânico de Baixo Custo" (foco: conteúdo, SEO, parcerias)
  → NÃO incluir "Anúncios Pagos" ou "Contratar Equipe"

- Se já usa Instagram/WhatsApp:
  → "Otimização de Conversão no Instagram" (foco: melhorar o que já faz)
  → NÃO incluir "Criar Presença nas Redes Sociais" (ele já tem)"""

    return call_groq(api_key, prompt, temperature=0.2)


def identify_dynamic_categories(profile: dict) -> list:
    """
    From a generated profile, extract the ordered list of relevant categories.
    NOW: Uses restrictions to generate context-aware fallback categories.
    """
    categories = profile.get("categorias_relevantes", [])
    restricoes = profile.get("restricoes_criticas", {})

    if categories and len(categories) >= 3:
        # Sort by priority descending
        categories.sort(key=lambda c: c.get("prioridade", 5), reverse=True)
        return categories

    # Fallback: generate context-aware categories based on restrictions
    modelo_op = restricoes.get("modelo_operacional", "")
    capital = restricoes.get("capital_disponivel", "medio")
    solo = restricoes.get("equipe_solo", False)
    canais = restricoes.get("canais_existentes", [])
    
    fallback_categories = []
    
    # Always include market overview
    fallback_categories.append({
        "id": "mercado",
        "nome": "Panorama do Mercado",
        "icone": "📊",
        "cor": "#10b981",
        "prioridade": 8,
        "foco": "tamanho do mercado, tendências, oportunidades de nicho",
        "nao_falar": ""
    })
    
    # Competition is always relevant
    fallback_categories.append({
        "id": "concorrentes",
        "nome": "Mapa de Concorrentes",
        "icone": "🎯",
        "cor": "#f59e0b",
        "prioridade": 7,
        "foco": "concorrentes diretos, diferenciais, pontos fracos exploráveis",
        "nao_falar": ""
    })
    
    # Credibility category if model is dropshipping/sob encomenda
    if modelo_op in ["sob_encomenda", "dropshipping"]:
        fallback_categories.append({
            "id": "credibilidade",
            "nome": "Credibilidade e Confiança",
            "icone": "👥",
            "cor": "#8b5cf6",
            "prioridade": 9,  # High priority for this model
            "foco": "como construir confiança online, depoimentos, garantias, prova social, formas de pagamento seguras",
            "nao_falar": "NÃO fale sobre gestão de estoque ou ERP. O negócio trabalha sob encomenda."
        })
    else:
        fallback_categories.append({
            "id": "publico_alvo",
            "nome": "Quem Compra de Você",
            "icone": "👥",
            "cor": "#8b5cf6",
            "prioridade": 7,
            "foco": "perfil de clientes, onde encontrá-los, canais de aquisição",
            "nao_falar": ""
        })
    
    # Marketing category - adapt based on capital and existing channels
    has_instagram = any("instagram" in c.lower() for c in canais) if canais else False
    
    if capital in ["zero", "baixo"] and solo:
        fallback_categories.append({
            "id": "marketing_organico",
            "nome": "Marketing Orgânico de Baixo Custo",
            "icone": "📱",
            "cor": "#3b82f6",
            "prioridade": 8,
            "foco": "estratégias gratuitas, conteúdo, SEO, parcerias, indicações",
            "nao_falar": "NÃO sugira anúncios pagos ou ferramentas caras. O negócio tem capital limitado."
        })
    elif has_instagram:
        fallback_categories.append({
            "id": "otimizacao_conversao",
            "nome": "Otimização de Conversão",
            "icone": "📱",
            "cor": "#3b82f6",
            "prioridade": 8,
            "foco": "como converter mais seguidores em clientes, Instagram Shopping, copywriting, funil de vendas",
            "nao_falar": "NÃO sugira 'criar presença no Instagram'. Ele já usa. Foque em OTIMIZAR."
        })
    else:
        fallback_categories.append({
            "id": "presenca_online",
            "nome": "Presença Online",
            "icone": "📱",
            "cor": "#3b82f6",
            "prioridade": 6,
            "foco": "canais digitais, redes sociais, Google Meu Negócio",
            "nao_falar": ""
        })
    
    # Pricing - always relevant but adapt
    fallback_categories.append({
        "id": "precificacao",
        "nome": "Preços e Margens",
        "icone": "💎",
        "cor": "#ec4899",
        "prioridade": 6,
        "foco": "precificação competitiva, margem de lucro, posicionamento de valor",
        "nao_falar": ""
    })
    
    # Sales/Prospecting - adapt for solo entrepreneur
    if solo:
        fallback_categories.append({
            "id": "vendas_solo",
            "nome": "Vendas para Quem Trabalha Sozinho",
            "icone": "💰",
            "cor": "#ef4444",
            "prioridade": 7,
            "foco": "técnicas de venda escaláveis para uma pessoa só, automações simples, scripts rápidos",
            "nao_falar": "NÃO sugira técnicas que exigem equipe de vendas."
        })
    else:
        fallback_categories.append({
            "id": "como_vender",
            "nome": "Como Prospectar Clientes",
            "icone": "💰",
            "cor": "#ef4444",
            "prioridade": 6,
            "foco": "técnicas de prospecção, abordagem, conversão",
            "nao_falar": ""
        })
    
    # Sort by priority
    fallback_categories.sort(key=lambda c: c.get("prioridade", 5), reverse=True)
    return fallback_categories


def run_profiler(onboarding_data: dict) -> dict:
    """
    Main entry point. Takes onboarding data, returns full profile + categories.
    NOW: Includes restrictions for context-aware recommendations.
    """
    api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return {
            "success": False,
            "erro": "Chave da API Groq não configurada. Adicione GROQ_API_KEY no arquivo .env."
        }

    try:
        print("🧠 Gerando perfil de negócio...", file=sys.stderr)
        profile = generate_business_profile(onboarding_data, api_key)

        # Extract restrictions for downstream components
        restricoes = profile.get("restricoes_criticas", {})
        
        # Generate context-aware categories
        categories = identify_dynamic_categories(profile)
        queries = profile.get("queries_sugeridas", {})

        print(f"  ✅ Perfil gerado. {len(categories)} categorias identificadas.", file=sys.stderr)
        
        # Log restrictions for debugging
        if restricoes:
            modelo_op = restricoes.get("modelo_operacional", "não detectado")
            capital = restricoes.get("capital_disponivel", "não detectado")
            solo = restricoes.get("equipe_solo", False)
            print(f"  📋 Restrições: modelo={modelo_op}, capital={capital}, solo={solo}", file=sys.stderr)

        return {
            "success": True,
            "profile": profile,
            "categories": categories,
            "queries": queries,
            "restricoes": restricoes  # Pass restrictions to scorer/task generator
        }

    except Exception as e:
        print(f"❌ Erro ao gerar perfil: {e}", file=sys.stderr)
        return {
            "success": False,
            "erro": f"Erro ao gerar perfil de negócio: {str(e)[:200]}"
        }


if __name__ == "__main__":
    # Test with sample data
    sample = {
        "nome_negocio": "Embalagens São Paulo",
        "segmento": "Embalagens de papelão ondulado",
        "cidade_estado": "Guarulhos, SP",
        "tempo_operacao": "5 anos",
        "num_funcionarios": "12",
        "modelo": "B2B",
        "tipo_produto": "produto",
        "ticket_medio": "R$ 3.500",
        "faturamento_mensal": "R$ 80.000",
        "canais_venda": ["cold call", "indicação"],
        "dificuldades": "Não consigo prospectar clientes novos, dependo muito de indicação. Acho que meu preço está alto comparado com concorrentes chineses.",
        "objetivos": "Dobrar o faturamento em 12 meses, conseguir contratos recorrentes com indústrias."
    }

    result = run_profiler(sample)
    print(json.dumps(result, indent=2, ensure_ascii=False))
