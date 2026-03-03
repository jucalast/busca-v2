"""
Web Extractor — Trafilatura-powered content extraction.
Substitui scrape_page básico por extração cirúrgica de texto.

Uso:
    from app.services.intelligence.extractors.web_extractor import web_extractor
    
    text = web_extractor.extract(url)
    text = web_extractor.extract_with_metadata(url)
    texts = web_extractor.extract_batch(urls)
"""

import sys
import time
from typing import Dict, Any, Optional, List
from datetime import datetime

# Blocklist de domínios que nunca retornam conteúdo útil via scraping
_SCRAPE_BLOCKLIST = [
    "instagram.com", "linkedin.com", "facebook.com", "tiktok.com",
    "twitter.com", "x.com", "threads.net", "youtube.com",
]


class WebExtractor:
    """Extrator de conteúdo web usando trafilatura (state-of-the-art)."""
    
    def __init__(self):
        self._trafilatura = None
        self._requests = None
        self._available = None
    
    def _ensure_loaded(self):
        """Lazy import do trafilatura (pesado, só carrega quando usado)."""
        if self._trafilatura is None:
            try:
                import trafilatura
                self._trafilatura = trafilatura
                self._available = True
            except ImportError:
                self._available = False
                print("⚠️ trafilatura não instalado. Usando fallback BS4.", file=sys.stderr)
        
        if self._requests is None:
            import requests as req
            self._requests = req
    
    @property
    def is_available(self) -> bool:
        """Verifica se trafilatura está disponível."""
        self._ensure_loaded()
        return self._available
    
    def extract(
        self,
        url: str,
        timeout: int = 5,
        include_comments: bool = False,
        include_tables: bool = True,
        max_chars: int = 8000,
        favor_recall: bool = True,
    ) -> str:
        """
        Extrai texto limpo de uma URL.
        
        Args:
            url: URL para extrair conteúdo
            timeout: Timeout em segundos
            include_comments: Incluir comentários da página
            include_tables: Incluir tabelas
            max_chars: Máximo de caracteres no resultado
            favor_recall: True = mais conteúdo, False = mais precisão
            
        Returns:
            Texto limpo extraído da página
        """
        # Skip domínios bloqueados
        url_lower = url.lower()
        for blocked in _SCRAPE_BLOCKLIST:
            if blocked in url_lower:
                return ""
        
        self._ensure_loaded()
        
        try:
            if self._available:
                return self._extract_trafilatura(
                    url, timeout, include_comments, include_tables,
                    max_chars, favor_recall
                )
            else:
                return self._extract_fallback(url, timeout, max_chars)
        except Exception as e:
            print(f"  ⚠️ WebExtractor error ({url[:50]}): {e}", file=sys.stderr)
            return ""
    
    def extract_with_metadata(
        self,
        url: str,
        timeout: int = 5,
        max_chars: int = 8000,
    ) -> Dict[str, Any]:
        """
        Extrai texto + metadados (título, autor, data, descrição).
        
        Returns:
            Dict com keys: text, title, author, date, description, sitename, url
        """
        url_lower = url.lower()
        for blocked in _SCRAPE_BLOCKLIST:
            if blocked in url_lower:
                return {"text": "", "url": url, "error": "blocked_domain"}
        
        self._ensure_loaded()
        
        result = {
            "text": "",
            "title": "",
            "author": "",
            "date": "",
            "description": "",
            "sitename": "",
            "url": url,
            "extracted_at": datetime.now().isoformat(),
        }
        
        try:
            if not self._available:
                result["text"] = self._extract_fallback(url, timeout, max_chars)
                return result
            
            # Download da página
            downloaded = self._trafilatura.fetch_url(url)
            if not downloaded:
                return result
            
            # Extrair metadados
            try:
                metadata = self._trafilatura.extract_metadata(downloaded)
                if metadata:
                    result["title"] = metadata.title or ""
                    result["author"] = metadata.author or ""
                    result["date"] = str(metadata.date) if metadata.date else ""
                    result["description"] = metadata.description or ""
                    result["sitename"] = metadata.sitename or ""
            except Exception:
                pass
            
            # Extrair texto
            text = self._trafilatura.extract(
                downloaded,
                include_comments=False,
                include_tables=True,
                favor_recall=True,
                deduplicate=True,
            )
            
            result["text"] = (text or "")[:max_chars]
            
        except Exception as e:
            result["error"] = str(e)[:200]
        
        return result
    
    def extract_batch(
        self,
        urls: List[str],
        timeout: int = 4,
        max_chars_per_url: int = 5000,
        max_total_chars: int = 20000,
        delay: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Extrai conteúdo de múltiplas URLs com limite total.
        
        Returns:
            Lista de dicts com {url, text, title, error}
        """
        results = []
        total_chars = 0
        
        for url in urls:
            if total_chars >= max_total_chars:
                break
            
            remaining = max_total_chars - total_chars
            chars_limit = min(max_chars_per_url, remaining)
            
            data = self.extract_with_metadata(url, timeout=timeout, max_chars=chars_limit)
            results.append(data)
            
            text_len = len(data.get("text", ""))
            total_chars += text_len
            
            if delay > 0 and text_len > 0:
                time.sleep(delay)
        
        return results
    
    def _extract_trafilatura(
        self, url, timeout, include_comments, include_tables,
        max_chars, favor_recall
    ) -> str:
        """Extração via trafilatura (melhor qualidade)."""
        # Download da página
        downloaded = self._trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        
        # Extrair texto principal
        text = self._trafilatura.extract(
            downloaded,
            include_comments=include_comments,
            include_tables=include_tables,
            favor_recall=favor_recall,
            deduplicate=True,
        )
        
        return (text or "")[:max_chars]
    
    def _extract_fallback(self, url: str, timeout: int, max_chars: int) -> str:
        """Fallback com BeautifulSoup (caso trafilatura não esteja disponível)."""
        from bs4 import BeautifulSoup
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                          'AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        }
        
        response = self._requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text[:max_chars]


# Instância global (singleton)
web_extractor = WebExtractor()
