"""
Business Scorer — Calculates a business health score (0-100) and identifies opportunities.
Uses profile data + market research data to generate quantified assessments.

IMPROVED VERSION: Now considers business constraints (no inventory, solo entrepreneur, 
low capital) when calculating scores and identifying opportunities.
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


def extract_restrictions(profile: dict) -> dict:
    """Extract business restrictions from profile for context-aware scoring."""
    restricoes = profile.get("restricoes_criticas", {})
    perfil = profile.get("perfil", {})
    
    # Build restrictions dict
    return {
        "modelo_operacional": restricoes.get("modelo_operacional", perfil.get("modelo_operacional", "")),
        "capital_disponivel": restricoes.get("capital_disponivel", "medio"),
        "equipe_solo": restricoes.get("equipe_solo", perfil.get("num_funcionarios", "").lower() in ["1", "solo", "só eu", "sozinho"]),
        "canais_existentes": restricoes.get("canais_existentes", []),
        "tem_estoque": restricoes.get("modelo_operacional", "") not in ["sob_encomenda", "dropshipping"],
        "dificuldades": perfil.get("dificuldades", ""),
    }


def calculate_business_score(profile: dict, market_data: dict, api_key: str) -> dict:
    """
    Calculate a comprehensive business health score based on profile + market research.
    NOW: Uses restrictions to provide context-aware scoring and opportunities.
    """
    
    # Extract restrictions for context
    restricoes = extract_restrictions(profile)
    restricoes_texto = json.dumps(restricoes, ensure_ascii=False)

    prompt = f"""Você é um analista de negócios quantitativo PRAGMÁTICO. Analise o perfil e dados de mercado e gere um SCORE de saúde do negócio que seja REALISTA e ÚTIL.

PERFIL DO NEGÓCIO:
{json.dumps(profile, ensure_ascii=False, indent=2)}

RESTRIÇÕES CRÍTICAS DO NEGÓCIO:
{restricoes_texto}

DADOS DE MERCADO COLETADOS:
{json.dumps(market_data, ensure_ascii=False, indent=2)[:15000]}

REGRAS CRÍTICAS DE CONTEXTO:
1. Se "modelo_operacional" = "sob_encomenda" ou "dropshipping":
   - NÃO penalize em "maturidade_operacional" por falta de estoque — isso é INTENCIONAL
   - NÃO sugira ERP de estoque como oportunidade
   - VALORIZE: prazos de entrega, fornecedores confiáveis, credibilidade online

2. Se "capital_disponivel" = "zero" ou "baixo":
   - NÃO sugira oportunidades que exigem investimento alto
   - Oportunidades devem ser GRATUITAS ou de muito baixo custo
   - Ex: depoimentos de cliente, Instagram Shopping (grátis), parcerias

3. Se "equipe_solo" = true:
   - NÃO sugira estratégias que exigem equipe
   - Oportunidades devem ser EXECUTÁVEIS por uma pessoa só
   - Ex: automações simples, respostas prontas, templates

4. Se já usa Instagram/WhatsApp (verificar "canais_existentes"):
   - NÃO sugira "criar presença nas redes sociais" — ele já tem
   - Sugira OTIMIZAÇÃO do que já existe

REGRAS RÍGIDAS:
1. Retorne APENAS JSON válido.
2. Cada score deve ser de 0-100, sendo 0 = crítico e 100 = excelente.  
3. Os scores devem refletir a REALIDADE do negócio CONSIDERANDO O MODELO que ele escolheu operar.
4. Se não houver dados suficientes para avaliar uma dimensão, dê um score de 50 (neutro).
5. Oportunidades devem ser CONCRETAS, VIÁVEIS e ESPECÍFICAS para este negócio.
6. MÁXIMO 3 oportunidades — qualidade > quantidade.

REGRAS ANTI-GENÉRICO (OBRIGATÓRIO):
- Cada oportunidade DEVE ser viável considerando as restrições de capital e equipe.
- PROIBIDO sugerir: ERP caro para quem não tem capital, equipe de vendas para quem é solo, gestão de estoque para quem não tem estoque.
- Cada oportunidade deve ter uma AÇÃO CONCRETA que ele pode fazer ESTA SEMANA, com ferramenta/plataforma gratuita ou de baixo custo.
- Exemplo BOM para capital zero: "Peça depoimentos em vídeo para 3 clientes satisfeitos e poste nos Stories do Instagram. Isso aumenta credibilidade sem custo."
- Exemplo RUIM: "Implemente um CRM para gestão de relacionamento." (muito vago e possivelmente caro)

ESTRUTURA DO JSON:
{{
    "score_geral": 0-100,
    "classificacao": "Crítico / Em Risco / Estável / Saudável / Forte",
    "dimensoes": {{
        "presenca_digital": {{
            "score": 0-100,
            "peso": 0.20,
            "status": "critico / atencao / forte",
            "justificativa": "considere os canais que ele JÁ usa",
            "acoes_imediatas": ["ação concreta e gratuita/barata"]
        }},
        "competitividade": {{
            "score": 0-100,
            "peso": 0.20,
            "status": "critico / atencao / forte",
            "justificativa": "baseada em dados reais de concorrentes",
            "concorrentes_identificados": ["nome se encontrado"],
            "acoes_imediatas": ["ação"]
        }},
        "diversificacao_canais": {{
            "score": 0-100,
            "peso": 0.15,
            "status": "critico / atencao / forte",
            "justificativa": "considere canais atuais e restrições",
            "canais_sugeridos": ["canal viável para adicionar"],
            "acoes_imediatas": ["ação"]
        }},
        "precificacao": {{
            "score": 0-100,
            "peso": 0.15,
            "status": "critico / atencao / forte",
            "justificativa": "baseada em margem e posicionamento",
            "acoes_imediatas": ["ação"]
        }},
        "potencial_mercado": {{
            "score": 0-100,
            "peso": 0.15,
            "status": "critico / atencao / forte",
            "justificativa": "TAM/oportunidade no segmento",
            "tendencias": ["tendência encontrada"],
            "acoes_imediatas": ["ação"]
        }},
        "maturidade_operacional": {{
            "score": 0-100,
            "peso": 0.15,
            "status": "critico / atencao / forte",
            "justificativa": "ADAPTE ao modelo operacional — se não tem estoque por escolha, não penalize",
            "acoes_imediatas": ["ação viável para solo entrepreneur"]
        }}
    }},
    "oportunidades": [
        {{
            "titulo": "título acionável e específico",
            "descricao": "o que é e por que importa PARA ESTE NEGÓCIO",
            "impacto_potencial": "alto / medio / baixo",
            "esforco": "baixo / medio / alto — DEVE ser compatível com restrições",
            "urgencia": "alta / media / baixa",
            "dados_suporte": "dado real que justifica",
            "acao_imediata": "O QUE FAZER ESTA SEMANA — concreto, com ferramenta gratuita",
            "custo_estimado": "R$ 0 / baixo (até R$ 100) / médio (R$ 100-500)",
            "prioridade_calculada": 1-10
        }}
    ],
    "resumo_executivo": "2-3 frases resumindo a situação REAL e as top 2 prioridades VIÁVEIS"
}}"""

    return call_groq(api_key, prompt, temperature=0.2)


def run_scorer(profile: dict, market_data: dict) -> dict:
    """
    Main entry point. Takes profile + market data, returns score + opportunities.
    """
    api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        return {
            "success": False,
            "erro": "Chave da API Groq não configurada."
        }

    try:
        print("📊 Calculando score do negócio...", file=sys.stderr)
        score = calculate_business_score(profile, market_data, api_key)
        print(f"  ✅ Score geral: {score.get('score_geral', '?')}/100", file=sys.stderr)

        return {
            "success": True,
            "score": score
        }

    except Exception as e:
        print(f"❌ Erro ao calcular score: {e}", file=sys.stderr)
        return {
            "success": False,
            "erro": f"Erro ao calcular score: {str(e)[:200]}"
        }


if __name__ == "__main__":
    # Test with mock data
    mock_profile = {
        "perfil": {"nome": "Test", "segmento": "Embalagens", "modelo_negocio": "B2B"},
        "diagnostico_inicial": {"maturidade": {"vendas": 2, "marketing_digital": 1}},
    }
    mock_market = {"categories": [{"id": "mercado", "resumo": {"visao_geral": "Mercado de R$50bi"}}]}
    
    result = run_scorer(mock_profile, mock_market)
    print(json.dumps(result, indent=2, ensure_ascii=False))
