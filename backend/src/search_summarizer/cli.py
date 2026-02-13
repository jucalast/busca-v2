import argparse
import json
import sys
import os
import time
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ==============================================================================
# Utility Functions
# ==============================================================================

def mock_summarize(query, error_message="Chave da API Groq não detectada."):
    return {
        "aviso": f"Resumo simulado para '{query}'. Motivo: {error_message}",
        "detalhes": [
            "A funcionalidade de busca está operando.",
            "Verifique os logs do servidor para mais detalhes sobre o erro."
        ],
    }

def search_duckduckgo(query, max_results=8, region='br-pt'):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results, region=region))
        return results
    except Exception as e:
        print(f"Erro na busca DuckDuckGo: {e}", file=sys.stderr)
        return []

def scrape_page(url, timeout=5):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text[:5000]
    except Exception:
        return ""

def call_groq(api_key, prompt, temperature=0.5, max_retries=3, model=None, force_json=True):
    """Generic Groq API call with retry + exponential backoff + model fallback."""
    client = Groq(api_key=api_key)
    
    # Prioritizes model if provided, otherwise default list
    models = [model] if model else ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    # Ensure fallback models if the first one fails
    if "llama-3.1-8b-instant" not in models:
        models.append("llama-3.1-8b-instant")

    for model in models:
        for attempt in range(max_retries):
            try:
                completion_params = {
                    "messages": [{"role": "user", "content": prompt}],
                    "model": model,
                    "temperature": temperature,
                }
                
                if force_json:
                    completion_params["response_format"] = {"type": "json_object"}
                
                completion = client.chat.completions.create(**completion_params)
                
                if model != models[0]:
                    print(f"  ⚡ Usando modelo fallback: {model}", file=sys.stderr)
                
                content = completion.choices[0].message.content
                
                # Return parsed JSON if force_json, otherwise raw text
                return json.loads(content) if force_json else content
                
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    print(f"  ⏳ Rate limit ({model}). Aguardando {wait_time}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                elif "429" in error_msg and model != models[-1]:
                    print(f"  🔄 Rate limit esgotado em {model}. Tentando modelo menor...", file=sys.stderr)
                    break  # break inner loop, try next model
                raise

# ==============================================================================
# Simple Search Mode (original)
# ==============================================================================

def summarize_with_groq(text, query, api_key):
    if not api_key:
        return mock_summarize(query, "Chave da API não fornecida.")

    try:
        prompt = f"""
        Você é um assistente de pesquisa avançado. Seu objetivo é criar um resumo estruturado e abrangente sobre "{query}" com base no texto fornecido abaixo.
        
        Regras de Resposta:
        1. Retorne APENAS um JSON válido. Não use blocos de código markdown.
        2. A estrutura do JSON deve ser hierárquica e semântica.
        3. Use chaves em Português.
        4. O JSON deve conter uma visão geral, principais pontos, detalhes técnicos (se aplicável), e controvérsias ou opiniões diversas (se houver).
        5. Seja direto e informativo.
        
        Texto Base:
        {text[:25000]} 
        """
        return call_groq(api_key, prompt)
    except Exception as e:
        error_msg = str(e)
        print(f"Erro na API Groq: {error_msg}", file=sys.stderr)
        if "401" in error_msg:
            return mock_summarize(query, "Chave da API inválida (401).")
        if "400" in error_msg:
            return mock_summarize(query, "Requisição inválida (400).")
        if "429" in error_msg:
            return mock_summarize(query, "Muitas requisições (429). Aguarde.")
        return mock_summarize(query, f"Erro na API: {error_msg}")

def run_simple_search(args):
    """Original simple search mode."""
    results = search_duckduckgo(args.query, args.max_results, args.region)
    
    if not results:
        return {"structured": {"erro": "Nenhum resultado encontrado"}, "sources": []}

    aggregated_text = ""
    sources = []
    
    for i, result in enumerate(results):
        sources.append(result.get('href'))
        snippet = result.get('body', '')
        aggregated_text += f"Fonte {i+1} ({result.get('title')}): {snippet}\n"
        
        if i < args.max_pages and not args.no_groq:
            content = scrape_page(result.get('href'))
            if content:
                aggregated_text += f"Conteúdo extra da Fonte {i+1}: {content}\n"
    
    groq_api_key = os.environ.get("GROQ_API_KEY")
    
    if args.no_groq:
        summary_data = {"aviso": "Resumo via Groq desativado."}
    else:
        summary_data = summarize_with_groq(aggregated_text, args.query, groq_api_key)

    return {"structured": summary_data, "sources": sources}

# ==============================================================================
# Business Intelligence Mode
# ==============================================================================

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

def generate_business_queries(description, api_key):
    """Use Groq to generate targeted search queries for each business category."""
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
    return call_groq(api_key, prompt, temperature=0.2)

def search_and_summarize_category(category, query, business_description, api_key, region, max_results=6, max_pages=2):
    """Search and summarize for a single business category."""
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
    
    # Small delay to avoid rate limits
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
        
        resumo = call_groq(api_key, prompt, temperature=0.3)
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

def run_business_analysis(args):
    """Run multi-category business intelligence analysis."""
    description = args.query
    api_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key:
        return {
            "businessMode": True,
            "categories": [],
            "allSources": [],
            "erro": "Chave da API Groq não configurada. Adicione GROQ_API_KEY no arquivo .env."
        }
    
    # Step 1: Generate search queries using AI
    print("🧠 Gerando queries de busca inteligentes...", file=sys.stderr)
    try:
        query_result = generate_business_queries(description, api_key)
        queries = query_result.get("queries", {})
        print(f"  ✅ Queries geradas: {json.dumps(queries, ensure_ascii=False)}", file=sys.stderr)
    except Exception as e:
        print(f"❌ Erro ao gerar queries: {e}", file=sys.stderr)
        return {
            "businessMode": True,
            "categories": [],
            "allSources": [],
            "erro": f"Erro ao gerar queries de busca: {str(e)[:200]}"
        }
    
    # Step 2: Search and summarize SEQUENTIALLY to avoid rate limits
    print("🔍 Executando buscas e análises por categoria...", file=sys.stderr)
    categories_result = []
    all_sources = []
    
    for cat in BUSINESS_CATEGORIES:
        q = queries.get(cat["id"], f"{cat['nome']} {description[:50]}")
        try:
            result = search_and_summarize_category(
                cat, q, description, api_key, args.region,
                max_results=6, max_pages=2
            )
            categories_result.append(result)
            all_sources.extend(result.get("fontes", []))
        except Exception as e:
            print(f"  ❌ Erro na categoria {cat['id']}: {e}", file=sys.stderr)
            categories_result.append({
                "id": cat["id"],
                "nome": cat["nome"],
                "icone": cat["icone"],
                "cor": cat["cor"],
                "query_usada": q,
                "resumo": {"erro": f"Falha ao processar: {str(e)[:150]}"},
                "fontes": []
            })
    
    unique_sources = list(dict.fromkeys(all_sources))
    
    print(f"✅ Análise completa! {len(categories_result)} categorias, {len(unique_sources)} fontes.", file=sys.stderr)
    
    return {
        "businessMode": True,
        "descricao": description,
        "categories": categories_result,
        "allSources": unique_sources
    }

# ==============================================================================
# Main
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Search and Summarize CLI")
    parser.add_argument("query", help="Search query or business description")
    parser.add_argument("--max-results", type=int, default=8)
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--max-sentences", type=int, default=5)
    parser.add_argument("--region", type=str, default="br-pt")
    parser.add_argument("--business", action="store_true", help="Enable business intelligence mode")
    parser.add_argument("--list-sources", action="store_true")
    parser.add_argument("--no-groq", action="store_true")
    parser.add_argument("--verbose", action="store_true")

    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    if args.business:
        output = run_business_analysis(args)
    else:
        output = run_simple_search(args)

    print("--- Resumo ---")
    print(json.dumps(output, indent=2, ensure_ascii=False))
    
    sources = output.get("sources", output.get("allSources", []))
    print("Fontes utilizadas:")
    for url in (sources or []):
        print(url)

if __name__ == "__main__":
    main()
