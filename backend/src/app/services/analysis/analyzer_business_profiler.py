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
from app.core.llm_router import call_llm
from app.services.common import log_info, log_debug, log_warning, log_error, log_llm
from dotenv import load_dotenv

load_dotenv()


def generate_business_profile(onboarding_data: dict, api_key: str, model_provider: str = "groq") -> dict:
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
3. Gere EXATAMENTE 7 CATEGORIAS DE ANÁLISE — uma para CADA pilar abaixo (TODOS obrigatórios):
   IDs FIXOS (use EXATAMENTE estes 7, NÃO invente outros, NÃO omita nenhum):
     "publico_alvo" — quem compra, personas, segmentos, comportamento de compra
     "branding" — posicionamento, diferencial, concorrência, proposta de valor
     "identidade_visual" — presença visual, design, credibilidade, prova social
     "canais_venda" — canais de venda, distribuição, logística, prospecção
     "trafego_organico" — SEO, conteúdo, redes sociais orgânico, presença online
     "trafego_pago" — anúncios, Google Ads, Meta Ads, campanhas pagas
     "processo_vendas" — funil, conversão, precificação, objeções, pós-venda
   REGRAS:
   - SEMPRE gere TODAS as 7 categorias — o sistema precisa de dados de mercado para cada pilar
   - O campo "id" DEVE ser um dos 7 IDs acima — NUNCA crie IDs novos como "credibilidade_e_confianca"
   - Adapte "nome" e "foco" para o contexto específico do negócio
   - Se não tem estoque → coloque logística no foco de "canais_venda"
   - Se já usa Instagram → foco em otimização dentro de "trafego_organico"
   - Se credibilidade é problema → coloque no foco de "branding" e/ou "identidade_visual"
   - Se capital é zero → em "trafego_pago" foque em estratégias orgânicas e gratuitas que compensem
4. Gere QUERIES de busca usando os MESMOS IDs como chave (EXATAMENTE os mesmos IDs das categorias).
   REGRAS DAS QUERIES (CRÍTICO — a finalidade do sistema é fazer o negócio VENDER MAIS):
   - Cada query deve responder UMA das perguntas: "o que impede de vender neste pilar?", "o que melhores players fazem para vender neste pilar?", "como converter mais neste pilar?"
   - Use as `dificuldades`, `principal_gargalo` e o segmento do negócio para tornar a query específica ao problema REAL
   - Exemplo ruim: "branding marketing digital PME" → genérico, não resolve nada
   - Exemplo bom: "como superar concorrentes preço baixo embalagens papelão proposta de valor diferenciação ganhar cliente" → específico ao problema
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

EXEMPLOS DE COMO ADAPTAR O FOCO (SEMPRE gere TODOS os 7 IDs):
- Autopeças B2B sem estoque:
  → id="publico_alvo", nome="Personas B2B Automotivo", foco="perfil de compradores industriais e revendedores"
  → id="branding", nome="Credibilidade e Confiança", foco="depoimentos, garantias, prova social B2B"
  → id="identidade_visual", nome="Presença Visual Profissional", foco="catálogo digital, fotos profissionais"
  → id="canais_venda", nome="Logística e Distribuição", foco="prazos, fornecedores, modelo sob encomenda"
  → id="trafego_organico", nome="SEO e Conteúdo Técnico", foco="conteúdo técnico, SEO para autopeças"
  → id="trafego_pago", nome="Anúncios B2B", foco="Google Ads para termos técnicos, LinkedIn Ads"
  → id="processo_vendas", nome="Funil B2B", foco="prospecção, negociação, contratos recorrentes"

- Solo + capital zero:
  → id="trafego_pago", nome="Alternativas a Tráfego Pago", foco="estratégias gratuitas, parcerias, permutas"
  (NUNCA omita um pilar — adapte o foco às restrições)

NUNCA invente IDs como "credibilidade_e_confianca", "logistica_sob_encomenda", "marketing_organico_de_baixo_custo".
SEMPRE use EXATAMENTE: publico_alvo, branding, identidade_visual, canais_venda, trafego_organico, trafego_pago, processo_vendas."""

    return call_llm(provider=model_provider, prompt=prompt, temperature=0.2)


_VALID_PILLAR_IDS = {
    "publico_alvo", "branding", "identidade_visual", "canais_venda",
    "trafego_organico", "trafego_pago", "processo_vendas",
}

# Maps common LLM-invented IDs back to valid pillar keys
_ID_REMAP = {
    "credibilidade": "branding",
    "credibilidade_e_confianca": "branding",
    "prova_social": "branding",
    "confianca": "branding",
    "concorrentes": "branding",
    "mapa_concorrentes": "branding",
    "logistica": "canais_venda",
    "logistica_sob_encomenda": "canais_venda",
    "distribuicao": "canais_venda",
    "canais": "canais_venda",
    "como_vender": "canais_venda",
    "prospectar": "canais_venda",
    "marketing_organico": "trafego_organico",
    "marketing_organico_de_baixo_custo": "trafego_organico",
    "presenca_online": "trafego_organico",
    "otimizacao_conversao_instagram": "trafego_organico",
    "otimizacao_de_conversao_no_instagram": "trafego_organico",
    "seo": "trafego_organico",
    "conteudo": "trafego_organico",
    "anuncios": "trafego_pago",
    "ads": "trafego_pago",
    "midia_paga": "trafego_pago",
    "precificacao": "processo_vendas",
    "funil": "processo_vendas",
    "conversao": "processo_vendas",
    "mercado": "publico_alvo",
    "potencial_mercado": "publico_alvo",
    "personas": "publico_alvo",
    "cliente_ideal": "publico_alvo",
    "design": "identidade_visual",
    "visual": "identidade_visual",
}


def identify_dynamic_categories(profile: dict) -> list:
    """
    Extract the ordered list of relevant categories from the LLM-generated profile.
    Safety net: remaps invalid IDs to the closest valid pillar key.
    """
    categories = profile.get("categorias_relevantes", [])

    if not categories:
        log_warning("Nenhuma categoria no perfil. Gerando 7 pilares padrão...")
        # Instead of crashing, generate all 7 defaults so the pipeline can continue
        categories = []

    # Remap invalid IDs to valid pillar keys
    seen_ids = set()
    fixed = []
    for cat in categories:
        cat_id = cat.get("id", "").lower().strip()
        if cat_id not in _VALID_PILLAR_IDS:
            new_id = _ID_REMAP.get(cat_id)
            if not new_id:
                # Try substring match against remap keys
                for remap_key, remap_val in _ID_REMAP.items():
                    if remap_key in cat_id or cat_id in remap_key:
                        new_id = remap_val
                        break
            if new_id:
                log_debug(f"Remapped category ID: '{cat_id}' → '{new_id}'")
                cat["id"] = new_id
                cat_id = new_id
            else:
                log_warning(f"Unknown category ID '{cat_id}', keeping as-is")

        # Prevent duplicate pillar IDs (keep highest priority)
        if cat_id in seen_ids:
            log_debug(f"Duplicate pillar ID '{cat_id}', skipping")
            continue
        seen_ids.add(cat_id)
        fixed.append(cat)

    # Auto-fill missing pillars with defaults so all 7 always get market data
    _DEFAULT_PILLAR_META = {
        "publico_alvo": {"nome": "Público-Alvo e Personas", "icone": "👥", "cor": "#3B82F6",
                         "foco": "quem compra, personas, segmentos, comportamento de compra"},
        "branding": {"nome": "Branding e Posicionamento", "icone": "🎯", "cor": "#8B5CF6",
                     "foco": "posicionamento, diferencial competitivo, proposta de valor"},
        "identidade_visual": {"nome": "Identidade Visual", "icone": "🎨", "cor": "#EC4899",
                              "foco": "presença visual, design, credibilidade, prova social"},
        "canais_venda": {"nome": "Canais de Venda", "icone": "🛒", "cor": "#10B981",
                         "foco": "canais de venda, distribuição, logística, prospecção"},
        "trafego_organico": {"nome": "Tráfego Orgânico", "icone": "📈", "cor": "#F59E0B",
                             "foco": "SEO, conteúdo, redes sociais orgânico, presença online"},
        "trafego_pago": {"nome": "Tráfego Pago", "icone": "💰", "cor": "#EF4444",
                         "foco": "anúncios, Google Ads, Meta Ads, campanhas pagas"},
        "processo_vendas": {"nome": "Processo de Vendas", "icone": "🤝", "cor": "#6366F1",
                            "foco": "funil, conversão, precificação, objeções, pós-venda"},
    }

    present_ids = {c.get("id") for c in fixed}
    for pid, meta in _DEFAULT_PILLAR_META.items():
        if pid not in present_ids:
            log_debug(f"Auto-adicionando pilar ausente: '{pid}'")
            fixed.append({
                "id": pid,
                "nome": meta["nome"],
                "icone": meta["icone"],
                "cor": meta["cor"],
                "foco": meta["foco"],
                "prioridade": 3,
                "justificativa": "Pilar obrigatório — adicionado automaticamente",
                "nao_falar": "",
            })

    # Sort by priority descending
    fixed.sort(key=lambda c: c.get("prioridade", 5), reverse=True)
    cat_ids = [c.get("id", "?") for c in fixed]
    log_info(f"Categorias identificadas: {cat_ids}")

    # Also fix queries_sugeridas keys to match remapped IDs
    queries = profile.get("queries_sugeridas", {})
    if queries:
        new_queries = {}
        for qk, qv in queries.items():
            remapped = _ID_REMAP.get(qk.lower().strip(), qk.lower().strip())
            new_queries[remapped] = qv
        profile["queries_sugeridas"] = new_queries
    else:
        profile.setdefault("queries_sugeridas", {})

    # Generate targeted queries for pillars missing from queries_sugeridas
    perfil_data = profile.get("perfil", profile)
    segmento = perfil_data.get("segmento", perfil_data.get("tipo_produto", ""))
    localizacao = perfil_data.get("localizacao", perfil_data.get("cidade_estado", ""))
    dificuldade = perfil_data.get("dificuldades", "")[:60]

    # Queries orientadas à pergunta real do dono: "por que não vendo mais e o que fazer?"
    _dif_snippet = dificuldade[:50] if dificuldade else ""
    _loc_snippet = localizacao[:30] if localizacao else ""
    _QUERY_TEMPLATES = {
        "publico_alvo": f"quem compra {segmento} perfil comprador ideal como conquistar clientes {segmento} {_loc_snippet}".strip(),
        "branding": f"como se diferenciar concorrência {segmento} proposta de valor única ganhar credibilidade vender mais",
        "identidade_visual": f"como apresentação visual aumenta vendas {segmento} credibilidade profissional converter clientes",
        "canais_venda": f"melhores canais para vender {segmento} onde clientes compram {_loc_snippet} como aumentar vendas {_dif_snippet}".strip(),
        "trafego_organico": f"como atrair clientes sem pagar anúncio {segmento} SEO local conteúdo que gera leads orgânicos",
        "trafego_pago": f"anúncios que vendem {segmento} Meta Ads Google Ads como reduzir custo por cliente adquirido",
        "processo_vendas": f"como vender mais {segmento} contornar objeções técnicas fechamento {_dif_snippet} converter leads".strip(),
    }

    queries = profile["queries_sugeridas"]
    for pid in _VALID_PILLAR_IDS:
        if pid not in queries:
            template = _QUERY_TEMPLATES.get(pid, f"{pid} {segmento}")
            queries[pid] = template
            log_debug(f"Query gerada para '{pid}': {template[:60]}...")

    # Update profile's categorias_relevantes to match the fixed list
    profile["categorias_relevantes"] = fixed

    return fixed


def run_profiler(onboarding_data: dict, model_provider: str = "groq") -> dict:
    """
    Main entry point. Takes onboarding data, returns full profile + categories.
    """
    # Check for appropriate API key based on provider
    if model_provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {
                "success": False,
                "erro": "Chave da API Gemini não configurada. Adicione GEMINI_API_KEY no arquivo .env."
            }
    elif model_provider == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            return {
                "success": False,
                "erro": "Chave da API OpenRouter não configurada. Adicione OPENROUTER_API_KEY no arquivo .env."
            }
    else:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return {
                "success": False,
                "erro": "Chave da API Groq não configurada. Adicione GROQ_API_KEY no arquivo .env."
            }

    try:
        log_info("Gerando perfil de negócio...")
        profile = generate_business_profile(onboarding_data, api_key, model_provider)

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
            log_debug(f"Restrições: modelo={modelo_op}, capital={capital}, solo={solo}")

        return {
            "success": True,
            "profile": profile,
            "categories": categories,
            "queries": queries,
            "restricoes": restricoes  # Pass restrictions to scorer/task generator
        }

    except Exception as e:
        log_error(f"Erro ao gerar perfil: {e}")
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
