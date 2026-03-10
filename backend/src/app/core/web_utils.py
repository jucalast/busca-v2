import sys
import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
import threading
import time

# ═══════════════════════════════════════════════════════════════════
# TRAFILATURA — Extração de conteúdo aprimorada (fallback BS4)
# ═══════════════════════════════════════════════════════════════════
_trafilatura = None
_trafilatura_checked = False

def _get_trafilatura():
    """Lazy import do trafilatura (só carrega 1x)."""
    global _trafilatura, _trafilatura_checked
    if not _trafilatura_checked:
        try:
            import trafilatura
            _trafilatura = trafilatura
        except ImportError:
            _trafilatura = None
        _trafilatura_checked = True
    return _trafilatura

def search_duckduckgo(query: str, max_results: int = 8, region: str = 'br-pt', cancellation_check=None) -> list:
    """Perform a web search using DuckDuckGo with cancellation support."""
    # Validate query
    if not query or not query.strip() or len(query.strip()) < 3:
        print(f"Erro na busca DuckDuckGo: query is mandatory or too short", file=sys.stderr)
        return []
    
    # Clean query
    query = query.strip()
    if query == "+" or query == " " * len(query):
        print(f"Erro na busca DuckDuckGo: invalid query", file=sys.stderr)
        return []
    
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

# Domains that block scraping or return useless content without API
_SCRAPE_BLOCKLIST = [
    "instagram.com", "linkedin.com", "facebook.com", "tiktok.com",
    "twitter.com", "x.com", "threads.net",
]

def scrape_page(url: str, timeout: int = 5, cancellation_check=None) -> str:
    """Scrape text content from a webpage URL with cancellation support.
    Uses trafilatura for high-quality extraction, falls back to BS4.
    Skips social media sites that require API access."""
    # Skip social media sites that never return useful content via scraping
    url_lower = url.lower()
    for blocked in _SCRAPE_BLOCKLIST:
        if blocked in url_lower:
            return ""
    try:
        # Tentar trafilatura primeiro (extração cirúrgica)
        traf = _get_trafilatura()
        if traf:
            downloaded = traf.fetch_url(url)
            if downloaded:
                text = traf.extract(
                    downloaded,
                    include_comments=False,
                    include_tables=True,
                    favor_recall=True,
                    deduplicate=True,
                )
                if text:
                    return text[:5000]
        
        # Fallback: BS4 clássico
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        
        # Silenciar avisos de SSL se necessário (opcional, mas limpa o log)
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        response = requests.get(url, headers=headers, timeout=timeout, verify=False)
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
