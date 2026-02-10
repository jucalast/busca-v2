import argparse
import json
import sys
import os
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from groq import Groq

# Mock implementation fallback if API key missing
def mock_summarize(query):
    return {
        "resumo": f"Este é um resumo simulado para '{query}' pois a chave da API Groq não foi detectada.",
        "detalhes": [
            "A funcionalidade de busca está operando.",
            "Para ver o resumo real, configure a variável de ambiente GROQ_API_KEY."
        ],
        "topicos_relacionados": [
            {"titulo": "Configuração", "conteudo": "Adicione sua chave no arquivo .env ou no sistema."},
            {"titulo": "Arquitetura", "conteudo": "Next.js + Python + Groq + DuckDuckGo."}
        ]
    }

def search_duckduckgo(query, max_results=8):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
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
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        # Get text
        text = soup.get_text()
        
        # Break into lines and remove leading and trailing space on each
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text[:5000] # Limit characters per page
    except Exception as e:
        # print(f"Erro ao fazer scraping de {url}: {e}", file=sys.stderr)
        return ""

def summarize_with_groq(text, query, api_key):
    if not api_key:
        return mock_summarize(query)

    try:
        client = Groq(api_key=api_key)
        
        prompt = f"""
        Você é um assistente de pesquisa avançado. Seu objetivo é criar um resumo estruturado e abrangente sobre "{query}" com base no texto fornecido abaixo.
        
        Regras de Resposta:
        1. Retorne APENAS um JSON válido. Não use blocos de código markdown (```json).
        2. A estrutura do JSON deve ser hierárquica e semântica.
        3. Use chaves em Português.
        4. O JSON deve conter uma visão geral, principais pontos, detalhes técnicos (se aplicável), e controvérsias ou opiniões diversas (se houver).
        5. Seja direto e informativo.
        
        Texto Base:
        {text[:25000]} 
        """
        
        completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.2-90b-vision-preview", # Using a fast implementation
            temperature=0.5,
            response_format={"type": "json_object"},
        )

        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"Erro na API Groq: {e}", file=sys.stderr)
        return mock_summarize(query)

def main():
    parser = argparse.ArgumentParser(description="Search and Summarize CLI")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--max-results", type=int, default=8)
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--max-sentences", type=int, default=5)
    parser.add_argument("--list-sources", action="store_true")
    parser.add_argument("--no-groq", action="store_true")
    parser.add_argument("--verbose", action="store_true")

    args = parser.parse_args()

    # 1. Search
    if args.verbose:
        print(f"Buscando por: {args.query}...", file=sys.stderr)
        
    results = search_duckduckgo(args.query, args.max_results)
    
    if not results:
        print(json.dumps({"structured": {"erro": "Nenhum resultado encontrado"}, "sources": [], "rawOutput": "Sem resultados."}))
        return

    # 2. Scrape (Parallel or limits)
    aggregated_text = ""
    sources = []
    
    for i, result in enumerate(results):
        sources.append(result.get('href'))
        snippet = result.get('body', '')
        aggregated_text += f"Fonte {i+1} ({result.get('title')}): {snippet}\n"
        
        # Scrape full content for top pages only
        if i < args.max_pages and not args.no_groq:
            content = scrape_page(result.get('href'))
            if content:
                aggregated_text += f"Conteúdo extra da Fonte {i+1}: {content}\n"
    
    # 3. Summarize
    groq_api_key = os.environ.get("GROQ_API_KEY")
    
    if args.no_groq:
        summary_data = {"aviso": "Resumo via Groq desativado."}
    else:
        if args.verbose:
            print("Gerando resumo com Groq...", file=sys.stderr)
        summary_data = summarize_with_groq(aggregated_text, args.query, groq_api_key)

    # 4. Output
    output = {
        "structured": summary_data,
        "sources": sources,
    }
    
    # Print Output with markers for the frontend to parse
    # Using utf-8 explicitly for stdout
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass
        
    print("--- Resumo ---")
    print(json.dumps(output, indent=2, ensure_ascii=False))
    print("Fontes utilizadas:")
    for url in sources:
        print(url)

if __name__ == "__main__":
    main()
