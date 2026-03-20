"""
Intelligence Hub — Orquestrador central de inteligência.
Combina todas as ferramentas (web, B2B, trends, news) em uma API unificada.

Este é o ponto de entrada para qualquer módulo do sistema que precise
de inteligência avançada. Módulos como UnifiedResearch, engine_specialist
e task generators usam o hub ao invés de chamar ferramentas individuais.

Uso:
    from app.services.intelligence.intelligence_hub import intel_hub
    
    # Pesquisa profunda de público-alvo
    result = intel_hub.research_target_audience(
        segmento="embalagens industriais",
        localizacao="São Paulo - SP",
        business_model="b2b"
    )
    
    # Pesquisa genérica com todas as ferramentas
    result = intel_hub.deep_research(
        query="mercado de autopeças Brasil",
        tools=["web", "news", "trends"]
    )
"""

import sys
import time
from typing import Dict, Any, Optional, List
from datetime import datetime


class IntelligenceHub:
    """
    Orquestrador central — combina web, B2B, trends e news
    em uma interface unificada e cacheable.
    """
    
    def __init__(self):
        self._web = None
        self._news = None
        self._cnpj = None
        self._trends = None
        self._lead_val = None
        self._cache = {}
    
    # ═══════════════════════════════════════════════════════════════
    # LAZY LOADING — só importa quando usado
    # ═══════════════════════════════════════════════════════════════
    
    @property
    def web(self):
        if self._web is None:
            from app.services.intelligence.extractors.web_extractor import web_extractor
            self._web = web_extractor
        return self._web
    
    @property
    def news(self):
        if self._news is None:
            from app.services.intelligence.extractors.news_extractor import news_extractor
            self._news = news_extractor
        return self._news
    
    @property
    def cnpj(self):
        if self._cnpj is None:
            from app.services.intelligence.b2b.cnpj_lookup import cnpj_service
            self._cnpj = cnpj_service
        return self._cnpj
    
    @property
    def trends(self):
        if self._trends is None:
            from app.services.intelligence.trends.trend_analyzer import trend_analyzer
            self._trends = trend_analyzer
        return self._trends
    
    @property
    def lead_validator(self):
        if self._lead_val is None:
            from app.services.intelligence.b2b.lead_validator import lead_validator
            self._lead_val = lead_validator
        return self._lead_val
    
    def get_available_tools(self) -> Dict[str, bool]:
        """Retorna quais ferramentas estão disponíveis."""
        return {
            "web_extractor": self.web.is_available,
            "news_extractor": self.news.is_available,
            "trend_analyzer": self.trends.is_available,
            "cnpj_service": True,  # Sempre disponível (usa requests)
            "lead_validator": True,  # Sempre disponível
        }
    
    # ═══════════════════════════════════════════════════════════════
    # PÚBLICO-ALVO — Pesquisa completa de target audience
    # ═══════════════════════════════════════════════════════════════
    
    def research_target_audience(
        self,
        segmento: str,
        localizacao: str = "",
        business_model: str = "b2b",
        include_trends: bool = True,
        include_news: bool = True,
        include_companies: bool = True,
    ) -> Dict[str, Any]:
        """
        Pesquisa profunda de público-alvo combinando múltiplas fontes.
        
        Fluxo:
        1. Trends: Volume de busca e demanda real
        2. News: Movimentações do setor e gatilhos de venda  
        3. Web: Perfil de compradores e comportamento
        4. B2B/Companies: Empresas reais que compram o produto (se B2B)
        
        Args:
            segmento: Produto/serviço do cliente
            localizacao: Cidade/Estado
            business_model: "b2b" ou "b2c"
            include_trends: Incluir dados de Google Trends
            include_news: Incluir notícias do setor
            include_companies: Incluir busca de empresas compradoras
            
        Returns:
            Dict unificado com toda a inteligência coletada
        """
        start_time = time.time()
        
        print(f"\n🧠 Intel Hub: Pesquisando público-alvo para '{segmento}'", file=sys.stderr)
        print(f"   Modelo: {business_model} | Local: {localizacao}", file=sys.stderr)
        
        result = {
            "segmento": segmento,
            "localizacao": localizacao,
            "business_model": business_model,
            "generated_at": datetime.now().isoformat(),
            "intelligence": {},
            "summary": {},
            "data_quality": {},
        }
        
        # ── 1. TRENDS: Demanda real ──────────────────────────────────
        if include_trends:
            try:
                print(f"   📈 [1/4] Analisando tendências de busca...", file=sys.stderr)
                
                # Geolocalização para trends
                geo = self._location_to_geo(localizacao)
                
                # Add jitter to avoid 429
                import random
                time.sleep(random.uniform(0.2, 1.0))
                
                # Análise de demanda principal
                demand = self.trends.analyze_demand(segmento, geo=geo)
                
                # Queries em ascensão
                rising = self.trends.get_rising_queries(segmento, geo=geo)
                
                # Interesse regional  
                regional = self.trends.get_regional_interest(segmento, geo="BR")
                
                result["intelligence"]["trends"] = {
                    "demand": demand,
                    "rising_queries": rising,
                    "regional_interest": regional,
                }
                
                result["data_quality"]["trends"] = "error" not in demand
                
            except Exception as e:
                print(f"   ⚠️ Trends error: {e}", file=sys.stderr)
                result["intelligence"]["trends"] = {"error": str(e)[:200]}
                result["data_quality"]["trends"] = False
        
        # ── 2. NEWS: Movimentações e gatilhos ────────────────────────
        if include_news:
            try:
                print(f"   📰 [2/4] Buscando notícias e gatilhos...", file=sys.stderr)
                
                sector_news = self.news.search_sector_news(
                    segmento, location=localizacao, period="30d", max_results=8
                )
                
                triggers = self.news.detect_sales_triggers(
                    segmento, period="14d", max_results=5
                )
                
                result["intelligence"]["news"] = {
                    "sector_news": sector_news,
                    "sales_triggers": triggers,
                }
                
                result["data_quality"]["news"] = len(sector_news.get("news", [])) > 0
                
            except Exception as e:
                print(f"   ⚠️ News error: {e}", file=sys.stderr)
                result["intelligence"]["news"] = {"error": str(e)[:200]}
                result["data_quality"]["news"] = False
        
        # ── 3. WEB: Perfil e comportamento ───────────────────────────
        try:
            print(f"   🔍 [3/4] Pesquisando perfil de compradores...", file=sys.stderr)
            
            from app.core.web_utils import search_duckduckgo
            
            # Queries específicas para público-alvo
            if business_model == "b2b":
                queries = [
                    f"quem compra {segmento} empresas setores",
                    f"{segmento} compradores B2B perfil decisor",
                    f"{segmento} critérios fornecedor seleção",
                    f"empresas que usam {segmento} {localizacao}",
                ]
            else:
                queries = [
                    f"{segmento} perfil consumidor quem compra",
                    f"{segmento} comportamento cliente tendências",
                    f"{segmento} público alvo faixa etária renda",
                ]
            
            web_results = []
            for query in queries[:3]:
                search_results = search_duckduckgo(query, max_results=4, region='br-pt')
                
                if search_results:
                    # Extrair conteúdo dos top resultados usando trafilatura
                    for i, sr in enumerate(search_results[:2]):
                        url = sr.get("href", "")
                        title = sr.get("title", "")
                        snippet = sr.get("body", "")
                        
                        content = ""
                        if i == 0:  # Só scrape do primeiro
                            content = self.web.extract(url, timeout=4, max_chars=3000)
                        
                        web_results.append({
                            "query": query,
                            "title": title,
                            "snippet": snippet,
                            "url": url,
                            "content": content[:2000] if content else "",
                        })
                
                time.sleep(0.5)
            
            result["intelligence"]["web_research"] = {
                "results": web_results,
                "total_sources": len(web_results),
            }
            
            result["data_quality"]["web"] = len(web_results) > 0
            
        except Exception as e:
            print(f"   ⚠️ Web research error: {e}", file=sys.stderr)
            result["intelligence"]["web_research"] = {"error": str(e)[:200]}
            result["data_quality"]["web"] = False
        
        # ── 4. B2B COMPANIES: Empresas reais ─────────────────────────
        if include_companies and business_model == "b2b":
            try:
                print(f"   🏢 [4/4] Buscando empresas compradoras...", file=sys.stderr)
                
                companies = self.cnpj.search_companies_by_web(
                    segmento=segmento,
                    localizacao=localizacao,
                    max_results=5,
                )
                
                # Enriquecer leads
                if companies.get("empresas"):
                    enriched = []
                    for emp in companies["empresas"]:
                        enriched.append(self.cnpj.enrich_lead(emp))
                    companies["empresas"] = enriched
                
                result["intelligence"]["b2b_companies"] = companies
                result["data_quality"]["companies"] = len(companies.get("empresas", [])) > 0
                
            except Exception as e:
                print(f"   ⚠️ B2B companies error: {e}", file=sys.stderr)
                result["intelligence"]["b2b_companies"] = {"error": str(e)[:200]}
                result["data_quality"]["companies"] = False
        
        # ── RESUMO ───────────────────────────────────────────────────
        elapsed = time.time() - start_time
        
        result["summary"] = self._build_audience_summary(result)
        result["elapsed_seconds"] = round(elapsed, 1)
        result["tools_used"] = [
            k for k, v in result["data_quality"].items() if v
        ]
        
        print(f"\n✅ Intel Hub: Completo em {elapsed:.1f}s | Fontes: {', '.join(result['tools_used'])}", file=sys.stderr)
        
        return result
    
    # ═══════════════════════════════════════════════════════════════
    # DEEP RESEARCH — Pesquisa genérica (qualquer pilar)
    # ═══════════════════════════════════════════════════════════════
    
    def deep_research(
        self,
        query: str,
        segmento: str = "",
        localizacao: str = "",
        tools: Optional[List[str]] = None,
        max_web_results: int = 6,
    ) -> Dict[str, Any]:
        """
        Pesquisa profunda genérica usando múltiplas ferramentas.
        Pode ser chamada por qualquer pilar.
        
        Args:
            query: Query de pesquisa principal
            segmento: Segmento do negócio
            localizacao: Localização
            tools: Lista de ferramentas a usar ["web", "news", "trends"]
                   None = todas disponíveis
            max_web_results: Máximo de resultados web
            
        Returns:
            Dict com dados coletados de todas as fontes
        """
        tools = tools or ["web", "news", "trends"]
        
        result = {
            "query": query,
            "segmento": segmento,
            "generated_at": datetime.now().isoformat(),
            "data": {},
            "all_sources": [],
        }
        
        # Web research com trafilatura
        if "web" in tools:
            try:
                from app.core.web_utils import search_duckduckgo
                
                search_results = search_duckduckgo(query, max_results=max_web_results, region='br-pt')
                
                web_data = []
                for i, sr in enumerate(search_results or []):
                    url = sr.get("href", "")
                    result["all_sources"].append(url)
                    
                    content = ""
                    if i < 3:  # Scrape top 3
                        content = self.web.extract(url, timeout=4, max_chars=4000)
                    
                    web_data.append({
                        "title": sr.get("title", ""),
                        "snippet": sr.get("body", ""),
                        "url": url,
                        "content": content,
                    })
                
                result["data"]["web"] = web_data
                
            except Exception as e:
                result["data"]["web"] = {"error": str(e)[:200]}
        
        # News
        if "news" in tools:
            try:
                news = self.news.search_sector_news(
                    query, location=localizacao, period="30d", max_results=5
                )
                result["data"]["news"] = news
            except Exception as e:
                result["data"]["news"] = {"error": str(e)[:200]}
        
        # Trends
        if "trends" in tools:
            try:
                geo = self._location_to_geo(localizacao)
                trends = self.trends.analyze_demand(query, geo=geo)
                result["data"]["trends"] = trends
            except Exception as e:
                result["data"]["trends"] = {"error": str(e)[:200]}
        
        return result
    
    # ═══════════════════════════════════════════════════════════════
    # EXTRACT — Extração de conteúdo aprimorada
    # ═══════════════════════════════════════════════════════════════
    
    def extract_content(self, url: str, timeout: int = 5, max_chars: int = 8000) -> str:
        """
        Extrai conteúdo de URL usando trafilatura (ou fallback BS4).
        Drop-in replacement para scrape_page.
        """
        return self.web.extract(url, timeout=timeout, max_chars=max_chars)
    
    def extract_with_metadata(self, url: str, timeout: int = 5) -> Dict[str, Any]:
        """Extrai conteúdo + metadados (título, autor, data)."""
        return self.web.extract_with_metadata(url, timeout=timeout)
    
    # ═══════════════════════════════════════════════════════════════
    # HELPERS
    # ═══════════════════════════════════════════════════════════════
    
    def _location_to_geo(self, localizacao: str) -> str:
        """Converte localização texto para código geo do Google Trends."""
        if not localizacao:
            return "BR"
        
        loc = localizacao.upper()
        
        # Mapeamento de estados brasileiros
        states = {
            "SP": "BR-SP", "SÃO PAULO": "BR-SP", "SAO PAULO": "BR-SP",
            "RJ": "BR-RJ", "RIO DE JANEIRO": "BR-RJ",
            "MG": "BR-MG", "MINAS GERAIS": "BR-MG",
            "RS": "BR-RS", "RIO GRANDE DO SUL": "BR-RS",
            "PR": "BR-PR", "PARANÁ": "BR-PR", "PARANA": "BR-PR",
            "SC": "BR-SC", "SANTA CATARINA": "BR-SC",
            "BA": "BR-BA", "BAHIA": "BR-BA",
            "PE": "BR-PE", "PERNAMBUCO": "BR-PE",
            "CE": "BR-CE", "CEARÁ": "BR-CE", "CEARA": "BR-CE",
            "GO": "BR-GO", "GOIÁS": "BR-GO", "GOIAS": "BR-GO",
            "PA": "BR-PA", "PARÁ": "BR-PA", "PARA": "BR-PA",
            "MA": "BR-MA", "MARANHÃO": "BR-MA",
            "AM": "BR-AM", "AMAZONAS": "BR-AM",
            "ES": "BR-ES", "ESPÍRITO SANTO": "BR-ES",
            "MT": "BR-MT", "MATO GROSSO": "BR-MT",
            "MS": "BR-MS", "MATO GROSSO DO SUL": "BR-MS",
            "DF": "BR-DF", "DISTRITO FEDERAL": "BR-DF", "BRASÍLIA": "BR-DF",
            "PB": "BR-PB", "PARAÍBA": "BR-PB",
            "RN": "BR-RN", "RIO GRANDE DO NORTE": "BR-RN",
            "AL": "BR-AL", "ALAGOAS": "BR-AL",
            "SE": "BR-SE", "SERGIPE": "BR-SE",
            "PI": "BR-PI", "PIAUÍ": "BR-PI",
            "TO": "BR-TO", "TOCANTINS": "BR-TO",
            "AC": "BR-AC", "ACRE": "BR-AC",
            "AP": "BR-AP", "AMAPÁ": "BR-AP",
            "RO": "BR-RO", "RONDÔNIA": "BR-RO",
            "RR": "BR-RR", "RORAIMA": "BR-RR",
        }
        
        # Tentar match direto
        for key, geo in states.items():
            if key in loc:
                return geo
        
        return "BR"
    
    def _build_audience_summary(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Constrói resumo executivo da pesquisa de público-alvo."""
        summary = {
            "key_findings": [],
            "opportunities": [],
            "data_sources_count": 0,
        }
        
        intel = result.get("intelligence", {})
        
        # Trends findings
        trends = intel.get("trends", {})
        demand = trends.get("demand", {})
        if demand.get("trend_direction"):
            direction_map = {
                "rising": "📈 Demanda CRESCENTE",
                "declining": "📉 Demanda em QUEDA",
                "stable": "➡️ Demanda ESTÁVEL",
            }
            label = direction_map.get(demand["trend_direction"], "")
            if label:
                growth = demand.get("growth_rate_3m", 0)
                summary["key_findings"].append(
                    f"{label} ({growth:+.1f}% nos últimos 3 meses)"
                )
        
        # Regional findings
        regional = trends.get("regional_interest", {})
        if regional.get("regions"):
            top_regions = [r["region"] for r in regional["regions"][:3]]
            summary["key_findings"].append(
                f"🗺️ Maior demanda em: {', '.join(top_regions)}"
            )
        
        # Rising queries
        rising = trends.get("rising_queries", {})
        if rising.get("rising_queries"):
            top_rising = [q["query"] for q in rising["rising_queries"][:3]]
            summary["opportunities"].append(
                f"🔥 Termos em alta: {', '.join(top_rising)}"
            )
        
        # News findings
        news = intel.get("news", {})
        triggers = news.get("sales_triggers", [])
        if triggers:
            summary["opportunities"].append(
                f"📰 {len(triggers)} gatilhos de venda detectados"
            )
        
        # B2B companies
        companies = intel.get("b2b_companies", {})
        if companies.get("empresas"):
            summary["key_findings"].append(
                f"🏢 {len(companies['empresas'])} empresas compradoras identificadas"
            )
        
        # Web sources
        web = intel.get("web_research", {})
        summary["data_sources_count"] = len(web.get("results", []))
        
        return summary


# Instância global (singleton)
intel_hub = IntelligenceHub()
