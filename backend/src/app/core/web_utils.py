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

# ═══════════════════════════════════════════════════════════════════
# PYPDF — Extração de conteúdo de PDFs
# ═══════════════════════════════════════════════════════════════════
_pypdf = None
_pypdf_checked = False

def _get_pypdf():
    """Lazy import do pypdf."""
    global _pypdf, _pypdf_checked
    if not _pypdf_checked:
        try:
            import pypdf
            _pypdf = pypdf
        except ImportError:
            _pypdf = None
        _pypdf_checked = True
    return _pypdf

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
    """Scrape text content from a webpage URL with cancellation support and caching."""
    from app.core.llm_cache import get_web_cache, set_web_cache
    
    # Check cache first (24h TTL)
    cached = get_web_cache(url)
    if cached:
        return cached

    # Skip social media sites
    url_lower = url.lower()
    for blocked in _SCRAPE_BLOCKLIST:
        if blocked in url_lower:
            return ""
    
    try:
        # (resto da lógica original de request e extração ...)
        content = _perform_scrape(url, timeout) # Helper para não repetir código
        if content:
            set_web_cache(url, content)
        return content
    except Exception:
        return ""

def _perform_scrape(url: str, timeout: int) -> str:
    """Internal helper to perform the actual scraping logic."""
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    response = requests.get(url, headers=headers, timeout=timeout, verify=False)
    response.raise_for_status()
    
    url_lower = url.lower()
    content_type = response.headers.get('Content-Type', '').lower()
    is_pdf = 'application/pdf' in content_type or url_lower.endswith('.pdf')
    
    if not is_pdf and len(response.content) > 4:
        if response.content[:4] == b'%PDF':
            is_pdf = True

    if is_pdf:
        pdf_lib = _get_pypdf()
        if pdf_lib:
            import io
            try:
                f = io.BytesIO(response.content)
                reader = pdf_lib.PdfReader(f)
                text = ""
                for i, page in enumerate(reader.pages[:10]):
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text[:5000].strip() or "[PDF sem texto extraível]"
            except Exception: return ""
        return ""

    # Tentar trafilatura primeiro
    traf = _get_trafilatura()
    if traf:
        text = traf.extract(response.text, include_comments=False, include_tables=True, favor_recall=True, deduplicate=True)
        if text: return text[:5000]
    
    # Fallback BS4
    soup = BeautifulSoup(response.text, 'html.parser')
    for script in soup(["script", "style", "nav", "footer", "header"]):
        script.decompose()
    text = soup.get_text()
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    return '\n'.join(chunk for chunk in chunks if chunk)[:5000]
