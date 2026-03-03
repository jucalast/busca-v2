import os
import sys
import time
import json
from typing import Dict, Any

from app.core.web_utils import search_duckduckgo, scrape_page
from app.core.llm_router import call_llm

class Struct:
    def __init__(self, **entries):
        self.__dict__.update(entries)

def summarize_with_groq(text, query, api_key, model_provider="groq"):
    if not api_key:
        raise ValueError("Chave da API não configurada. Adicione GROQ_API_KEY ou GEMINI_API_KEY no .env.")

    prompt = f"""Você é um assistente de pesquisa avançado. Crie um resumo estruturado sobre "{query}" com base no texto abaixo.

Regras:
1. Retorne APENAS JSON válido.
2. Use chaves em Português.
3. Inclua: visão geral, principais pontos, detalhes técnicos (se aplicável).
4. Seja direto e informativo. Cite dados concretos encontrados no texto.

Texto Base:
{text[:20000]}"""

    return call_llm(provider=model_provider, prompt=prompt)

def run_simple_search(args, model_provider="groq"):
    """Original simple search mode."""
    results = search_duckduckgo(args.query, getattr(args, 'max_results', 8), getattr(args, 'region', 'br-pt'))
    
    if not results:
        return {"structured": {"erro": "Nenhum resultado encontrado"}, "sources": []}

    aggregated_text = ""
    sources = []
    
    max_pages = getattr(args, 'max_pages', 3)
    no_groq = getattr(args, 'no_groq', False)
    
    for i, result in enumerate(results):
        sources.append(result.get('href'))
        snippet = result.get('body', '')
        aggregated_text += f"Fonte {i+1} ({result.get('title')}): {snippet}\n"
        
        if i < max_pages and not no_groq:
            content = scrape_page(result.get('href'))
            if content:
                aggregated_text += f"Conteúdo extra da Fonte {i+1}: {content}\n"
    
    if model_provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
    else:
        api_key = os.environ.get("GROQ_API_KEY")
    
    if no_groq or not api_key:
        summary_data = {"aviso": "Resumo via IA desativado."}
    else:
        summary_data = summarize_with_groq(aggregated_text, args.query, api_key, model_provider)

    return {"structured": summary_data, "sources": sources}


BUSINESS_CATEGORIES = [
    {
        "id": "mercado",
        "nome": "Panorama do Mercado",
        "icone": "📊",
        "cor": "#10b981",
        "foco": "tamanho do mercado em R$, taxa de crescimento (CAGR), tendências de consumo, sazonalidade, oportunidades de nicho",
        "nao_falar": "NÃO repita o que o usuário já disse sobre o próprio negócio. Foque em dados EXTERNOS que ele ainda não sabe."
    },
    {
        "id": "concorrentes",
        "nome": "Mapa de Concorrentes",
        "icone": "🎯",
        "cor": "#f59e0b",
        "foco": "nomes dos concorrentes diretos na região, diferenciais de cada um, pontos fracos exploráveis, comparação de serviços",
        "nao_falar": "NÃO liste apenas nomes. Para CADA concorrente cite: o que ele faz bem, o que faz mal, e como o usuário pode superá-lo."
    },
    {
        "id": "publico_alvo",
        "nome": "Quem Compra de Você",
        "icone": "👥",
        "cor": "#8b5cf6",
        "foco": "nomes e perfis de EMPRESAS COMPRADORAS (não fornecedoras) do produto, setores que mais consomem, critérios que esses compradores usam para escolher fornecedor, onde encontrá-los",
        "nao_falar": "NÃO busque empresas do mesmo ramo do usuário. Busque empresas que COMPRAM o produto do usuário (seus potenciais clientes)."
    },
    {
        "id": "como_vender",
        "nome": "Como Prospectar Clientes",
        "icone": "💰",
        "cor": "#ef4444",
        "foco": "técnicas concretas de prospecção para esse nicho, scripts de abordagem, canais que realmente funcionam para B2B industrial, como montar lista de leads",
        "nao_falar": "NÃO dê conselhos vagos como 'invista em marketing'. Dê PASSOS CONCRETOS com ferramentas e canais específicos."
    },
    {
        "id": "presenca_online",
        "nome": "Presença Online",
        "icone": "📱",
        "cor": "#3b82f6",
        "foco": "palavras-chave que clientes desse nicho pesquisam no Google, exemplos de Google Ads funcionais, como usar LinkedIn para B2B industrial, tipo de conteúdo que gera leads nesse setor",
        "nao_falar": "NÃO fale sobre tarifas de importação, feiras internacionais ou coisas não relacionadas a marketing digital. Foque APENAS em ações online."
    },
    {
        "id": "precificacao",
        "nome": "Preços e Margens",
        "icone": "💎",
        "cor": "#ec4899",
        "foco": "faixa de preço B2B/industrial (NÃO varejo), margem de lucro típica do setor, modelos de contrato recorrente, como precificar para ser competitivo sem sacrificar margem",
        "nao_falar": "NÃO mostre preços de lojas como Kalunga ou Leroy Merlin (isso é varejo). Foque em preços entre EMPRESAS (B2B)."
    },
]

def generate_business_queries(description, api_key, model_provider="groq"):
    categories_detail = ""
    for cat in BUSINESS_CATEGORIES:
        categories_detail += f'    "{cat["id"]}": {cat["foco"]} (CUIDADO: {cat["nao_falar"]})\n'
    
    prompt = f"""Você é um especialista em pesquisa de mercado B2B brasileiro.

Gere UMA query de busca para cada categoria baseada no negócio descrito.

REGRAS PARA AS QUERIES:
- 5 a 10 palavras cada
- Use o NOME TÉCNICO do produto/serviço (ex: "cartonagem" ou "papelão ondulado", não "embalagem")
- Inclua cidade/estado quando relevante
- Cada query deve buscar ALGO DIFERENTE — sem sobreposição entre categorias
- publico_alvo: busque quem COMPRA esse produto (os clientes potenciais), NÃO quem fabrica
- precificacao: busque tabelas de preço INDUSTRIAIS/B2B, não de varejo
- presenca_online: busque palavras-chave que COMPRADORES pesquisam quando precisam do produto
- como_vender: busque técnicas de prospecção B2B para o setor INDUSTRIAL

Negócio:
"{description}"

Categorias:
{categories_detail}

JSON:
{{
    "queries": {{
        "mercado": "query",
        "concorrentes": "query",
        "publico_alvo": "query",
        "como_vender": "query",
        "presenca_online": "query",
        "precificacao": "query"
    }}
}}"""
    return call_llm(provider=model_provider, prompt=prompt, temperature=0.2)

def search_and_summarize_category(category, query, business_description, api_key, region, max_results=6, max_pages=2, model_provider="groq"):
    print(f"  [{category['icone']}] Buscando: {query}", file=sys.stderr)
    
    results = search_duckduckgo(query, max_results=max_results, region=region)
    
    if not results:
        return {
            "id": category["id"],
            "nome": category["nome"],
            "icone": category["icone"],
            "cor": category["cor"],
            "query_usada": query,
            "resumo": {"info": "Nenhum resultado encontrado para esta categoria."},
            "fontes": []
        }
    
    aggregated_text = ""
    sources = []
    
    for i, result in enumerate(results):
        url = result.get('href', '')
        sources.append(url)
        snippet = result.get('body', '')
        title = result.get('title', '')
        aggregated_text += f"Fonte {i+1} ({title}): {snippet}\n"
        
        if i < max_pages:
            content = scrape_page(url)
            if content:
                aggregated_text += f"Conteúdo completo Fonte {i+1}: {content}\n"
    
    # --- Intelligence Hub enrichment for specific categories ---
    try:
        from app.services.intelligence.intelligence_hub import intel_hub
        cat_id = category["id"]
        
        if cat_id == "publico_alvo":
            # Trends: demand analysis for the query terms
            try:
                keywords = [kw.strip() for kw in query.split()[:5] if len(kw.strip()) > 3]
                if keywords:
                    trends_data = intel_hub.trends.analyze_demand(keywords[:3])
                    if trends_data:
                        aggregated_text += "\n\n[DADOS DE TENDÊNCIAS GOOGLE - DEMANDA REAL]\n"
                        for kw, info in trends_data.items():
                            direction = info.get("trend_direction", "N/A")
                            growth = info.get("growth_rate_3m", 0)
                            avg = info.get("average_interest", 0)
                            aggregated_text += f"- '{kw}': tendência {direction}, crescimento 3m: {growth:.1f}%, interesse médio: {avg:.0f}/100\n"
                            peaks = info.get("peak_periods", [])
                            if peaks:
                                aggregated_text += f"  Picos: {', '.join(peaks[:3])}\n"
            except Exception as e:
                print(f"  ⚠ Trends enrichment skipped: {e}", file=sys.stderr)
            
            # News: sector news and sales triggers
            try:
                short_desc = business_description[:200]
                news = intel_hub.news.search_sector_news(short_desc, max_results=5)
                if news:
                    aggregated_text += "\n\n[NOTÍCIAS RECENTES DO SETOR]\n"
                    for n in news[:5]:
                        aggregated_text += f"- {n.get('title', '')} ({n.get('published_date', '')})\n"
                        if n.get('description'):
                            aggregated_text += f"  {n['description'][:200]}\n"
                
                triggers = intel_hub.news.detect_sales_triggers(short_desc, max_results=5)
                if triggers:
                    aggregated_text += "\n[GATILHOS DE VENDAS DETECTADOS]\n"
                    for t in triggers[:5]:
                        aggregated_text += f"- [{t.get('trigger_type', 'info')}] {t.get('title', '')} → {t.get('relevance', '')}\n"
            except Exception as e:
                print(f"  ⚠ News enrichment skipped: {e}", file=sys.stderr)
        
        elif cat_id == "mercado":
            # Trends: demand analysis for market sizing
            try:
                keywords = [kw.strip() for kw in query.split()[:5] if len(kw.strip()) > 3]
                if keywords:
                    trends_data = intel_hub.trends.analyze_demand(keywords[:3])
                    if trends_data:
                        aggregated_text += "\n\n[DADOS DE TENDÊNCIAS GOOGLE - MERCADO]\n"
                        for kw, info in trends_data.items():
                            direction = info.get("trend_direction", "N/A")
                            growth = info.get("growth_rate_3m", 0)
                            aggregated_text += f"- '{kw}': tendência {direction}, crescimento 3m: {growth:.1f}%\n"
                    
                    rising = intel_hub.trends.get_rising_queries(keywords[:2])
                    if rising:
                        aggregated_text += "\n[TERMOS EM ALTA NO GOOGLE]\n"
                        for kw, queries_list in rising.items():
                            if queries_list:
                                aggregated_text += f"- Relacionados a '{kw}': {', '.join(queries_list[:5])}\n"
            except Exception as e:
                print(f"  ⚠ Trends enrichment (mercado) skipped: {e}", file=sys.stderr)
        
        elif cat_id == "como_vender":
            # News: detect sales triggers / opportunities
            try:
                short_desc = business_description[:200]
                triggers = intel_hub.news.detect_sales_triggers(short_desc, max_results=5)
                if triggers:
                    aggregated_text += "\n\n[GATILHOS DE VENDAS - OPORTUNIDADES ATUAIS]\n"
                    for t in triggers[:5]:
                        aggregated_text += f"- [{t.get('trigger_type', 'info')}] {t.get('title', '')} → {t.get('relevance', '')}\n"
            except Exception as e:
                print(f"  ⚠ News triggers (como_vender) skipped: {e}", file=sys.stderr)
        
        elif cat_id == "presenca_online":
            # Rising queries for SEO/content opportunities
            try:
                keywords = [kw.strip() for kw in query.split()[:5] if len(kw.strip()) > 3]
                if keywords:
                    rising = intel_hub.trends.get_rising_queries(keywords[:2])
                    if rising:
                        aggregated_text += "\n\n[TERMOS EM ALTA - OPORTUNIDADES DE CONTEÚDO]\n"
                        for kw, queries_list in rising.items():
                            if queries_list:
                                aggregated_text += f"- Buscas em alta para '{kw}': {', '.join(queries_list[:5])}\n"
            except Exception as e:
                print(f"  ⚠ Rising queries (presenca_online) skipped: {e}", file=sys.stderr)
    
    except ImportError:
        pass  # intelligence module not available, continue without enrichment
    
    time.sleep(2)
    
    try:
        prompt = f"""Você é um consultor sênior de negócios. Analise dados reais da internet e gere um relatório ÚTIL.

O CLIENTE:
{business_description}

SEU FOCO NESTA SEÇÃO: {category['foco']}

REGRAS CRÍTICAS — LEIA ANTES DE RESPONDER:
1. Retorne APENAS JSON válido.
2. {category.get('nao_falar', '')}
3. NÃO REPITA o que o cliente já disse sobre o próprio negócio. Ele já sabe que faz consultoria técnica, que atende B2B, etc. Traga informações NOVAS que ele não tem.
4. Fale em SEGUNDA PESSOA: "Você pode...", "Seu mercado...", "Seus concorrentes...". Nunca diga "o cliente" ou "a empresa".
5. Cite nomes reais, valores em R$, percentuais — dados CONCRETOS dos textos abaixo. 
6. Se um dado não existir nos textos, simplesmente NÃO inclua esse campo. NÃO escreva "dado não disponível".
7. CNPJ (XX.XXX.XXX/XXXX-XX) NÃO é faturamento. Ignore CNPJs.
8. Cada recomendação deve ser uma AÇÃO CONCRETA executável em 1-2 semanas, com nome de ferramenta/canal/empresa quando possível.
9. NÃO repita recomendações que já foram dadas em outras seções. Cada seção deve trazer VALOR ÚNICO.

ESTRUTURA DO JSON:
{{
    "visao_geral": "2-3 frases com a principal conclusão NOVA para o cliente, sem repetir o que ele já sabe",
    "pontos_chave": [
        "Fato descoberto nos dados com número ou nome concreto",
        "(mínimo 3, máximo 5 — só inclua se for informação NOVA e ÚTIL)"
    ],
    "recomendacoes": [
        "Ação concreta: o quê fazer + como + com qual ferramenta/canal (mínimo 2, máximo 4)"
    ],
    "dados_relevantes": {{
        "chave": "valor concreto encontrado nos dados (SÓ inclua se tiver valor real, NUNCA coloque 'dado não disponível')"
    }}
}}

DADOS DA INTERNET:
{aggregated_text[:18000]}"""
        
        resumo = call_llm(provider=model_provider, prompt=prompt, temperature=0.3)
    except Exception as e:
        print(f"  ❌ Erro ao resumir {category['nome']}: {e}", file=sys.stderr)
        resumo = {"erro": f"Não foi possível gerar resumo: {str(e)[:200]}"}
    
    return {
        "id": category["id"],
        "nome": category["nome"],
        "icone": category["icone"],
        "cor": category["cor"],
        "query_usada": query,
        "resumo": resumo,
        "fontes": sources
    }

def run_business_analysis(args, model_provider="groq"):
    description = args.query
    
    if model_provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"businessMode": True, "categories": [], "allSources": [], "erro": "Chave Gemini ausente"}
    else:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            return {"businessMode": True, "categories": [], "allSources": [], "erro": "Chave Groq ausente"}
    
    try:
        query_result = generate_business_queries(description, api_key, model_provider)
        queries = query_result.get("queries", {})
    except Exception as e:
        return {"businessMode": True, "categories": [], "allSources": [], "erro": f"Erro nas queries: {str(e)[:200]}"}
    
    categories_result = []
    all_sources = []
    
    for cat in BUSINESS_CATEGORIES:
        q = queries.get(cat["id"], f"{cat['nome']} {description[:50]}")
        try:
            result = search_and_summarize_category(
                cat, q, description, api_key, getattr(args, 'region', 'br-pt'),
                max_results=6, max_pages=2, model_provider=model_provider
            )
            categories_result.append(result)
            all_sources.extend(result.get("fontes", []))
        except Exception as e:
            categories_result.append({"id": cat["id"], "nome": cat["nome"], "resumo": {"erro": f"Falha: {str(e)[:150]}"}, "fontes": []})
    
    unique_sources = list(dict.fromkeys(all_sources))
    
    return {
        "businessMode": True,
        "descricao": description,
        "categories": categories_result,
        "allSources": unique_sources
    }


def search_simple(data: Dict[str, Any]) -> Dict[str, Any]:
    args = Struct(**data)
    result = run_simple_search(args, model_provider=getattr(args, 'modelProvider', 'groq'))
    return result

def search_business(data: Dict[str, Any]) -> Dict[str, Any]:
    args = Struct(**data)
    result = run_business_analysis(args, model_provider=getattr(args, 'modelProvider', 'groq'))
    return result
