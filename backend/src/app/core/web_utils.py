import sys
import requests
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS
import threading
import time

def search_duckduckgo(query: str, max_results: int = 8, region: str = 'br-pt', cancellation_check=None) -> list:
    """Perform a web search using DuckDuckGo with cancellation support."""
    try:
        with DDGS() as ddgs:
            results = []
            for i, result in enumerate(ddgs.text(query, max_results=max_results, region=region)):
                # Check cancellation every few results
                if cancellation_check and i % 2 == 0:
                    try:
                        cancellation_check()
                    except Exception:
                        break
                results.append(result)
                if len(results) >= max_results:
                    break
        return results
    except Exception as e:
        print(f"Erro na busca DuckDuckGo: {e}", file=sys.stderr)
        return []

def scrape_page(url: str, timeout: int = 2, cancellation_check=None) -> str:
    """Scrape text content from a webpage URL with cancellation support."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        
        # Use a shorter timeout and check cancellation during request
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
