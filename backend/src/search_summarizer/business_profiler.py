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


def _parse_retry_wait(error_msg):
    """Extract wait time in seconds from Groq rate limit error message."""
    import re as _re
    match = _re.search(r"try again in (\d+)m([\d.]+)s", error_msg)
    if match:
        return int(match.group(1)) * 60 + int(float(match.group(2)))
    match = _re.search(r"try again in ([\d.]+)s", error_msg)
    if match:
        return int(float(match.group(1)))
    return 0


def call_groq(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 2) -> dict:
    """Generic Groq API call with multi-model fallback across separate TPD quotas."""
    client = Groq(api_key=api_key)
    models = [
        "llama-3.1-8b-instant",
        "llama3-8b-8192",
        "llama3-70b-8192",
        "llama-3.3-70b-versatile",
    ]

    for mi, model in enumerate(models):
        for attempt in range(max_retries):
            try:
                completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=model,
                    temperature=temperature,
                    response_format={"type": "json_object"},
                )
                if mi > 0:
                    print(f"  ⚡ Usando modelo fallback: {model}", file=sys.stderr)
                return json.loads(completion.choices[0].message.content)
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg
                is_tpd = "tokens per day" in error_msg.lower() or "TPD" in error_msg

                is_model_error = "400" in error_msg and ("does not exist" in error_msg or "not supported" in error_msg or "decommissioned" in error_msg or "The model" in error_msg)

                if is_model_error and mi < len(models) - 1:
                    print(f"  ⚠️ Modelo {model} indisponível. Trocando...", file=sys.stderr)
                    break

                if is_rate_limit and is_tpd:
                    retry_secs = _parse_retry_wait(error_msg)
                    if attempt < max_retries - 1 and retry_secs <= 30:
                        print(f"  ⏳ Rate limit (TPD) em {model}. Aguardando {retry_secs}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                        time.sleep(retry_secs or 5)
                        continue
                    elif mi < len(models) - 1:
                        print(f"  🔄 TPD esgotado em {model}. Trocando modelo...", file=sys.stderr)
                        break
                    raise
                elif is_rate_limit and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    print(f"  ⏳ Rate limit ({model}). Aguardando {wait_time}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                elif is_rate_limit and mi < len(models) - 1:
                    print(f"  🔄 Rate limit esgotado em {model}. Trocando modelo...", file=sys.stderr)
                    break
                raise
    raise Exception("Todos os modelos esgotaram o rate limit diário.")


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
3. Gere EXATAMENTE 6 CATEGORIAS — uma para cada dimensão obrigatória abaixo.
   Cada categoria DEVE ter o "id" exato indicado. Adapte o "nome", "foco" e "query" para o negócio específico.
4. Gere QUERIES de busca específicas para cada categoria.
5. Seja preciso e direto — não invente dados, apenas interprete os fornecidos.

AS 6 DIMENSÕES OBRIGATÓRIAS (use estes IDs exatos):
1. id="presenca_digital"  → Presença online, redes sociais, SEO, conteúdo, reputação
2. id="competitividade"   → Concorrentes diretos, diferenciais, posicionamento, benchmarks
3. id="diversificacao_canais" → Canais de venda atuais e novos, marketplaces, prospecção
4. id="precificacao"      → Estratégia de preços, margem, percepção de valor vs concorrentes
5. id="potencial_mercado" → Tamanho do mercado, tendências, nichos, crescimento do setor
6. id="maturidade_operacional" → Processos, logística, fornecedores, eficiência, escalabilidade

ADAPTE o nome e foco de cada categoria ao contexto real do negócio. Exemplos:
- B2B logística: "presenca_digital" → nome="LinkedIn e Presença B2B Digital", foco="SEO técnico, LinkedIn, catálogos digitais"
- Solo sem capital: "diversificacao_canais" → nome="Novos Canais Sem Custo", foco="WhatsApp, indicações, parcerias"
- Já usa Instagram: "presenca_digital" → nome="Otimização do Instagram", foco="conversão, bio, stories, reels"

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
        "pontos_fortes": ["aspecto positivo identificado"],
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
            "id": "presenca_digital",
            "nome": "Nome adaptado ao negócio",
            "icone": "emoji",
            "cor": "#hex",
            "foco": "o que buscar especificamente para ESTE negócio nesta dimensão",
            "prioridade": 1-10,
            "nao_falar": "o que NÃO recomendar por conta das restrições"
        }},
        {{
            "id": "competitividade",
            "nome": "Nome adaptado ao negócio",
            "icone": "emoji",
            "cor": "#hex",
            "foco": "concorrentes específicos deste segmento, diferenciais reais",
            "prioridade": 1-10,
            "nao_falar": ""
        }},
        {{
            "id": "diversificacao_canais",
            "nome": "Nome adaptado ao negócio",
            "icone": "emoji",
            "cor": "#hex",
            "foco": "canais viáveis considerando capital e equipe disponíveis",
            "prioridade": 1-10,
            "nao_falar": "canais que exigem capital alto se capital for baixo"
        }},
        {{
            "id": "precificacao",
            "nome": "Nome adaptado ao negócio",
            "icone": "emoji",
            "cor": "#hex",
            "foco": "preços praticados no segmento, margem, posicionamento vs concorrentes",
            "prioridade": 1-10,
            "nao_falar": ""
        }},
        {{
            "id": "potencial_mercado",
            "nome": "Nome adaptado ao negócio",
            "icone": "emoji",
            "cor": "#hex",
            "foco": "tamanho e tendências do mercado específico deste negócio",
            "prioridade": 1-10,
            "nao_falar": ""
        }},
        {{
            "id": "maturidade_operacional",
            "nome": "Nome adaptado ao negócio",
            "icone": "emoji",
            "cor": "#hex",
            "foco": "processos, gargalos operacionais e logísticos específicos deste negócio",
            "prioridade": 1-10,
            "nao_falar": ""
        }}
    ],
    "queries_sugeridas": {{
        "presenca_digital": "query de busca específica para presença digital deste negócio",
        "competitividade": "query sobre concorrentes e diferenciais deste segmento",
        "diversificacao_canais": "query sobre canais de venda para este tipo de negócio",
        "precificacao": "query sobre preços e margens neste segmento",
        "potencial_mercado": "query sobre tamanho e tendências deste mercado",
        "maturidade_operacional": "query sobre processos e logística deste tipo de negócio"
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
}}"""

    return call_groq(api_key, prompt, temperature=0.2)


def identify_dynamic_categories(profile: dict) -> list:
    """
    From a generated profile, extract the ordered list of relevant categories.
    Validates that all 6 required dimension IDs are present; injects defaults for any missing.
    """
    REQUIRED_IDS = [
        "presenca_digital",
        "competitividade",
        "diversificacao_canais",
        "precificacao",
        "potencial_mercado",
        "maturidade_operacional",
    ]

    DEFAULTS = {
        "presenca_digital": {
            "nome": "Presença Digital", "icone": "📱", "cor": "#3b82f6", "prioridade": 7,
            "foco": "redes sociais, SEO, conteúdo, reputação online", "nao_falar": "",
        },
        "competitividade": {
            "nome": "Competitividade e Concorrência", "icone": "🎯", "cor": "#f59e0b", "prioridade": 7,
            "foco": "concorrentes diretos, diferenciais, posicionamento, benchmarks", "nao_falar": "",
        },
        "diversificacao_canais": {
            "nome": "Canais de Venda", "icone": "�", "cor": "#ef4444", "prioridade": 6,
            "foco": "canais atuais e novos, marketplaces, prospecção", "nao_falar": "",
        },
        "precificacao": {
            "nome": "Precificação e Margem", "icone": "�", "cor": "#ec4899", "prioridade": 6,
            "foco": "estratégia de preços, margem, percepção de valor vs concorrentes", "nao_falar": "",
        },
        "potencial_mercado": {
            "nome": "Potencial de Mercado", "icone": "�", "cor": "#10b981", "prioridade": 6,
            "foco": "tamanho do mercado, tendências, nichos, crescimento do setor", "nao_falar": "",
        },
        "maturidade_operacional": {
            "nome": "Maturidade Operacional", "icone": "⚙️", "cor": "#6366f1", "prioridade": 6,
            "foco": "processos, logística, fornecedores, eficiência, escalabilidade", "nao_falar": "",
        },
    }

    categories = profile.get("categorias_relevantes", [])

    # Build index of existing IDs
    existing_ids = {c.get("id", ""): c for c in categories}

    # Inject any missing required dimension
    for dim_id in REQUIRED_IDS:
        if dim_id not in existing_ids:
            print(f"  ⚠️ Categoria '{dim_id}' ausente — injetando padrão", file=sys.stderr)
            default = dict(DEFAULTS[dim_id])
            default["id"] = dim_id
            categories.append(default)

    # Sort by priority descending
    categories.sort(key=lambda c: c.get("prioridade", 5), reverse=True)
    return categories


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
