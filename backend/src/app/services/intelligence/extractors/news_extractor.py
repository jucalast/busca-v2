"""
News Extractor — GNews-powered news intelligence.
Detecta gatilhos de venda, oportunidades e movimentações de mercado.

Uso:
    from app.services.intelligence.extractors.news_extractor import news_extractor
    
    news = news_extractor.search_sector_news("embalagens industriais", location="São Paulo")
    triggers = news_extractor.detect_sales_triggers("caixas de papelão")
"""

import sys
from typing import Dict, Any, Optional, List
from datetime import datetime


class NewsExtractor:
    """Extrator de notícias e gatilhos de vendas usando GNews."""
    
    def __init__(self):
        self._gnews_cls = None
        self._available = None
    
    def _ensure_loaded(self):
        """Lazy import do gnews."""
        if self._gnews_cls is None:
            try:
                from gnews import GNews
                self._gnews_cls = GNews
                self._available = True
            except ImportError:
                self._available = False
                print("⚠️ gnews não instalado.", file=sys.stderr)
    
    @property
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._available
    
    def _create_client(self, period: str = "30d", max_results: int = 10) -> Any:
        """Cria instância GNews configurada para Brasil."""
        self._ensure_loaded()
        if not self._available:
            return None
        
        return self._gnews_cls(
            language='pt-419',      # Português Brasil
            country='BR',
            period=period,
            max_results=max_results,
        )
    
    def search_sector_news(
        self,
        segmento: str,
        location: str = "",
        period: str = "30d",
        max_results: int = 8,
    ) -> Dict[str, Any]:
        """
        Busca notícias do setor para inteligência de mercado.
        
        Args:
            segmento: Segmento/produto (ex: "embalagens industriais")
            location: Cidade/estado para filtro local
            period: Período (7d, 30d, 3m, 6m, 1y)
            max_results: Máximo de resultados
            
        Returns:
            Dict com news, summary, opportunities
        """
        self._ensure_loaded()
        
        result = {
            "segmento": segmento,
            "location": location,
            "period": period,
            "news": [],
            "opportunities": [],
            "generated_at": datetime.now().isoformat(),
            "source": "gnews",
        }
        
        if not self._available:
            result["error"] = "gnews não disponível"
            return result
        
        if not segmento or not segmento.strip():
            print(f"  ⚠️ NewsExtractor: segmento vazio. Pulando.", file=sys.stderr)
            return result

        try:
            client = self._create_client(period=period, max_results=max_results)
            
            # Query principal: notícias do setor
            query = f"{segmento} {location}".strip()
            news_items = client.get_news(query)
            
            if news_items:
                for item in news_items:
                    result["news"].append({
                        "title": item.get("title", ""),
                        "description": item.get("description", ""),
                        "url": item.get("url", ""),
                        "publisher": item.get("publisher", {}).get("title", "") if isinstance(item.get("publisher"), dict) else str(item.get("publisher", "")),
                        "published_date": item.get("published date", ""),
                    })
            
            # Query de oportunidades: expansão, inauguração, investimento
            opp_queries = [
                f"{segmento} expansão investimento inauguração",
                f"{segmento} nova fábrica ampliação produção",
            ]
            
            for opp_query in opp_queries:
                try:
                    opp_client = self._create_client(period=period, max_results=4)
                    opp_items = opp_client.get_news(opp_query)
                    if opp_items:
                        for item in opp_items:
                            result["opportunities"].append({
                                "title": item.get("title", ""),
                                "url": item.get("url", ""),
                                "publisher": item.get("publisher", {}).get("title", "") if isinstance(item.get("publisher"), dict) else str(item.get("publisher", "")),
                                "published_date": item.get("published date", ""),
                                "trigger_type": "expansion",
                            })
                except Exception:
                    pass
            
            print(f"  📰 News: {len(result['news'])} artigos, {len(result['opportunities'])} oportunidades", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)[:200]
            print(f"  ⚠️ NewsExtractor error: {e}", file=sys.stderr)
        
        return result
    
    def detect_sales_triggers(
        self,
        segmento: str,
        keywords: Optional[List[str]] = None,
        period: str = "7d",
        max_results: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Detecta gatilhos de vendas em notícias recentes.
        
        Gatilhos: expansão de fábricas, novas filiais, mudança de fornecedor,
        investimentos, contratações em massa, etc.
        
        Returns:
            Lista de gatilhos detectados com título, URL e tipo
        """
        self._ensure_loaded()
        
        if not self._available:
            return []
        
        triggers = []
        
        # Palavras-chave de gatilho de venda
        trigger_keywords = keywords or [
            "expansão", "inauguração", "nova fábrica", "ampliação",
            "investimento", "contratação", "licitação", "crescimento",
            "nova unidade", "aquisição", "fusão",
        ]
        
        try:
            for kw in trigger_keywords[:5]:  # Limitar queries
                query = f"{segmento} {kw}"
                client = self._create_client(period=period, max_results=max_results)
                items = client.get_news(query)
                
                if items:
                    for item in items:
                        title = item.get("title", "").lower()
                        # Verificar se o título realmente contém gatilho
                        if any(tk in title for tk in trigger_keywords):
                            triggers.append({
                                "title": item.get("title", ""),
                                "url": item.get("url", ""),
                                "publisher": item.get("publisher", {}).get("title", "") if isinstance(item.get("publisher"), dict) else str(item.get("publisher", "")),
                                "published_date": item.get("published date", ""),
                                "trigger_keyword": kw,
                                "trigger_type": _classify_trigger(title),
                            })
        except Exception as e:
            print(f"  ⚠️ Sales trigger detection error: {e}", file=sys.stderr)
        
        # Deduplica por URL
        seen_urls = set()
        unique_triggers = []
        for t in triggers:
            if t["url"] not in seen_urls:
                seen_urls.add(t["url"])
                unique_triggers.append(t)
        
        return unique_triggers


def _classify_trigger(title: str) -> str:
    """Classifica o tipo de gatilho a partir do título."""
    title = title.lower()
    
    if any(w in title for w in ["expansão", "ampliação", "nova unidade", "nova fábrica"]):
        return "expansion"
    elif any(w in title for w in ["investimento", "aporte", "captação"]):
        return "investment"
    elif any(w in title for w in ["aquisição", "fusão", "compra"]):
        return "acquisition"
    elif any(w in title for w in ["licitação", "edital", "pregão"]):
        return "bidding"
    elif any(w in title for w in ["contratação", "vagas", "emprego"]):
        return "hiring"
    elif any(w in title for w in ["inauguração", "abertura"]):
        return "launch"
    
    return "general"


# Instância global
news_extractor = NewsExtractor()
