"""
Advanced Web Scraping Service using Jina Reader.
Converte sites inteiros em Markdown limpo para LLMs - 100% gratuito.
"""

import requests
import json
import time
import sys
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import re

from app.core.web_utils import scrape_page  # Fallback para scraping tradicional


class JinaReaderService:
    """
    Serviço de scraping avançado usando Jina Reader API.
    Converte qualquer URL em Markdown limpo e estruturado.
    """
    
    def __init__(self):
        self.base_url = "https://r.jina.ai/"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; BusinessAnalyzer/1.0)'
        })
    
    def scrape_url(self, url: str, timeout: int = 30) -> Dict[str, Any]:
        """
        Converte URL em Markdown limpo usando Jina Reader.
        
        Args:
            url: URL para scraping
            timeout: Timeout em segundos
        
        Returns:
            Dicionário com conteúdo e metadados
        """
        try:
            # Construir URL do Jina Reader
            jina_url = f"{self.base_url}{url}"
            
            print(f"🔍 Jina Reader: Processando {url[:50]}...", file=sys.stderr)
            
            response = self.session.get(jina_url, timeout=timeout)
            response.raise_for_status()
            
            markdown_content = response.text
            
            # Extrair metadados básicos
            metadata = self._extract_metadata(markdown_content, url)
            
            return {
                "success": True,
                "url": url,
                "content": markdown_content,
                "content_length": len(markdown_content),
                "metadata": metadata,
                "source": "jina_reader"
            }
            
        except requests.exceptions.Timeout:
            print(f"⏰ Timeout no Jina Reader para {url}, tentando scraping tradicional...", file=sys.stderr)
            return self._fallback_scrape(url, timeout)
        
        except requests.exceptions.RequestException as e:
            print(f"❌ Erro Jina Reader para {url}: {str(e)}, tentando fallback...", file=sys.stderr)
            return self._fallback_scrape(url, timeout)
        
        except Exception as e:
            print(f"❌ Erro inesperado no Jina Reader para {url}: {str(e)}", file=sys.stderr)
            return {
                "success": False,
                "url": url,
                "error": str(e),
                "source": "jina_reader_error"
            }
    
    def _fallback_scrape(self, url: str, timeout: int) -> Dict[str, Any]:
        """
        Fallback para scraping tradicional usando BeautifulSoup.
        
        Args:
            url: URL para scraping
            timeout: Timeout em segundos
        
        Returns:
            Dicionário com conteúdo e metadados
        """
        try:
            print(f"🔄 Fallback: Scraping tradicional de {url[:50]}...", file=sys.stderr)
            
            # Usar scraper existente
            html_content = scrape_page(url, timeout)
            
            if not html_content:
                return {
                    "success": False,
                    "url": url,
                    "error": "Failed to scrape content",
                    "source": "fallback_failed"
                }
            
            # Converter HTML para texto limpo
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Remover scripts e styles
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Extrair texto principal
            text_content = soup.get_text()
            
            # Limpar texto
            text_content = re.sub(r'\s+', ' ', text_content).strip()
            
            # Extrair metadados básicos
            title = soup.find('title')
            title_text = title.get_text().strip() if title else ""
            
            description = soup.find('meta', attrs={'name': 'description'})
            description_text = description.get('content', '') if description else ""
            
            metadata = {
                "title": title_text,
                "description": description_text,
                "content_type": "html_to_text"
            }
            
            return {
                "success": True,
                "url": url,
                "content": text_content,
                "content_length": len(text_content),
                "metadata": metadata,
                "source": "fallback_scraping"
            }
            
        except Exception as e:
            print(f"❌ Fallback também falhou para {url}: {str(e)}", file=sys.stderr)
            return {
                "success": False,
                "url": url,
                "error": f"Fallback failed: {str(e)}",
                "source": "fallback_error"
            }
    
    def _extract_metadata(self, markdown_content: str, url: str) -> Dict[str, Any]:
        """
        Extrai metadados do conteúdo Markdown.
        
        Args:
            markdown_content: Conteúdo em Markdown
            url: URL original
        
        Returns:
            Metadados extraídos
        """
        metadata = {
            "url": url,
            "domain": urlparse(url).netloc,
            "content_type": "markdown"
        }
        
        # Extrair título (primeiro # ou primeira linha)
        lines = markdown_content.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('# '):
                metadata["title"] = line[2:].strip()
                break
            elif line and not line.startswith('#') and not line.startswith('!'):
                metadata["title"] = line[:100]  # Primeira linha como título
                break
        
        # Contar seções
        metadata["sections_count"] = len(re.findall(r'^#+ ', markdown_content, re.MULTILINE))
        
        # Contar links
        metadata["links_count"] = len(re.findall(r'\[([^\]]+)\]\(([^)]+)\)', markdown_content))
        
        # Contar imagens
        metadata["images_count"] = len(re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', markdown_content))
        
        return metadata
    
    def scrape_multiple_urls(self, urls: List[str], max_concurrent: int = 3) -> List[Dict[str, Any]]:
        """
        Faz scraping de múltiplas URLs com controle de concorrência.
        
        Args:
            urls: Lista de URLs
            max_concurrent: Máximo de requisições simultâneas
        
        Returns:
            Lista de resultados
        """
        results = []
        
        for i, url in enumerate(urls):
            print(f"📄 Processando URL {i+1}/{len(urls)}: {url[:50]}...", file=sys.stderr)
            
            result = self.scrape_url(url)
            results.append(result)
            
            # Rate limiting entre requisições
            if i < len(urls) - 1:  # Não esperar após a última
                time.sleep(1)
        
        return results
    
    def analyze_competitor_site(self, competitor_url: str, industry: str = "") -> Dict[str, Any]:
        """
        Analisa site de concorrente para extração estratégica.
        
        Args:
            competitor_url: URL do concorrente
            industry: Indústria para contexto
        
        Returns:
            Análise estruturada do concorrente
        """
        # Fazer scraping completo
        scrape_result = self.scrape_url(competitor_url)
        
        if not scrape_result["success"]:
            return scrape_result
        
        content = scrape_result["content"]
        metadata = scrape_result["metadata"]
        
        # Análise básica do conteúdo
        analysis = {
            "competitor_url": competitor_url,
            "domain": metadata.get("domain", ""),
            "title": metadata.get("title", ""),
            "content_analysis": {
                "word_count": len(content.split()),
                "sections": metadata.get("sections_count", 0),
                "links": metadata.get("links_count", 0),
                "images": metadata.get("images_count", 0)
            },
            "strategic_insights": self._extract_strategic_insights(content, industry),
            "raw_content": content[:5000],  # Primeiros 5000 caracteres
            "scrape_metadata": metadata
        }
        
        return {
            "success": True,
            "analysis": analysis,
            "source": "competitor_analysis"
        }
    
    def _extract_strategic_insights(self, content: str, industry: str = "") -> List[str]:
        """
        Extrai insights estratégicos do conteúdo.
        
        Args:
            content: Conteúdo do site
            industry: Indústria para contexto
        
        Returns:
            Lista de insights estratégicos
        """
        insights = []
        
        # Buscar menções a produtos/serviços
        product_keywords = ['produto', 'serviço', 'solução', 'tecnologia', 'sistema']
        for keyword in product_keywords:
            if keyword.lower() in content.lower():
                insights.append(f"Menciona {keyword}s específicos")
        
        # Buscar menções a diferenciais
        differential_keywords = ['diferencial', 'vantagem', 'benefício', 'único', 'exclusivo']
        for keyword in differential_keywords:
            if keyword.lower() in content.lower():
                insights.append(f"Destaca {keyword}s competitivos")
        
        # Buscar menções a preços
        price_keywords = ['preço', 'valor', 'custo', 'investimento', 'orçamento']
        for keyword in price_keywords:
            if keyword.lower() in content.lower():
                insights.append(f"Aborda {keyword}s e valores")
        
        # Buscar menções a casos/clientes
        client_keywords = ['cliente', 'caso', 'projeto', 'resultado', 'sucesso']
        for keyword in client_keywords:
            if keyword.lower() in content.lower():
                insights.append(f"Apresenta {keyword}s e resultados")
        
        # Se indústria especificada, buscar menções
        if industry and industry.lower() in content.lower():
            insights.append(f"Focado especificamente em {industry}")
        
        return insights[:5]  # Limitar a 5 insights


# Instância global
_jina_service = None

def get_jina_reader() -> JinaReaderService:
    """
    Retorna instância do serviço Jina Reader (singleton).
    
    Returns:
        Instância do JinaReaderService
    """
    global _jina_service
    if _jina_service is None:
        _jina_service = JinaReaderService()
    return _jina_service


# Funções de conveniência para uso nos pilares
def scrape_competitor_site(url: str, industry: str = "") -> Dict[str, Any]:
    """
    Analisa site de concorrente usando Jina Reader.
    
    Args:
        url: URL do concorrente
        industry: Indústria para contexto
    
    Returns:
        Análise estruturada
    """
    service = get_jina_reader()
    return service.analyze_competitor_site(url, industry)


def scrape_multiple_competitors(urls: List[str], industry: str = "") -> List[Dict[str, Any]]:
    """
    Analisa múltiplos concorrentes.
    
    Args:
        urls: Lista de URLs dos concorrentes
        industry: Indústria para contexto
    
    Returns:
        Lista de análises
    """
    service = get_jina_reader()
    results = service.scrape_multiple_urls(urls)
    
    # Converter para análises estruturadas
    analyses = []
    for result in results:
        if result["success"]:
            analysis = service._extract_strategic_insights(result["content"], industry)
            analyses.append({
                "url": result["url"],
                "success": True,
                "insights": analysis,
                "metadata": result["metadata"]
            })
        else:
            analyses.append({
                "url": result["url"],
                "success": False,
                "error": result.get("error", "Unknown error")
            })
    
    return analyses


def enhance_research_with_jina(research_queries: List[str], industry: str = "") -> Dict[str, Any]:
    """
    Enhance research usando Jina Reader para URLs encontradas.
    
    Args:
        research_queries: Queries de pesquisa
        industry: Indústria para contexto
    
    Returns:
        Research enhancement com conteúdo profundo
    """
    from app.core.web_utils import search_duckduckgo
    
    enhanced_content = []
    processed_urls = []
    
    for query in research_queries:
        # Buscar URLs com DuckDuckGo
        results = search_duckduckgo(query, max_results=3, region='br-pt')
        
        if results:
            for result in results:
                url = result.get("href", "")
                if url and url not in processed_urls:
                    # Usar Jina Reader para conteúdo profundo
                    jina_result = scrape_competitor_site(url, industry)
                    
                    if jina_result["success"]:
                        enhanced_content.append({
                            "query": query,
                            "url": url,
                            "title": jina_result["analysis"]["title"],
                            "insights": jina_result["analysis"]["strategic_insights"],
                            "content_sample": jina_result["analysis"]["raw_content"][:1000]
                        })
                        processed_urls.append(url)
        
        # Rate limiting
        time.sleep(1)
    
    return {
        "enhanced_content": enhanced_content,
        "processed_urls": processed_urls,
        "total_insights": sum(len(c["insights"]) for c in enhanced_content)
    }
