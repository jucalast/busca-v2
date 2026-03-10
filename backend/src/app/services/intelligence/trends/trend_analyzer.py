"""
Trend Analyzer — PyTrends-powered demand intelligence.
Análise de tendências de busca para detectar demanda real.

Uso:
    from app.services.intelligence.trends.trend_analyzer import trend_analyzer
    
    trends = trend_analyzer.analyze_demand("embalagens industriais", geo="BR-SP")
    rising = trend_analyzer.get_rising_queries("caixas de papelão")
    comparison = trend_analyzer.compare_terms(["papelão", "plástico", "isopor"])
"""

import sys
import time
from typing import Dict, Any, Optional, List
from datetime import datetime


class TrendAnalyzer:
    """Analisador de tendências de busca via Google Trends."""
    
    def __init__(self):
        self._pytrends = None
        self._TrendReq = None
        self._available = None
    
    def _ensure_loaded(self):
        """Lazy import do pytrends."""
        if self._TrendReq is None:
            try:
                from pytrends.request import TrendReq
                self._TrendReq = TrendReq
                self._available = True
            except ImportError:
                self._available = False
                print("⚠️ pytrends não instalado.", file=sys.stderr)
    
    def _get_client(self):
        """Cria/retorna cliente pytrends."""
        self._ensure_loaded()
        if not self._available:
            return None
        
        if self._pytrends is None:
            self._pytrends = self._TrendReq(
                hl='pt-BR',
                tz=180,  # UTC-3 Brasil
                timeout=(10, 25),
                retries=2,
                backoff_factor=0.5,
            )
        return self._pytrends
    
    @property
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._available
    
    def analyze_demand(
        self,
        keyword: str,
        geo: str = "BR",
        timeframe: str = "today 12-m",
    ) -> Dict[str, Any]:
        """
        Analisa demanda de busca para um termo.
        
        Args:
            keyword: Termo para analisar
            geo: Geolocalização (BR, BR-SP, BR-RJ, etc.)
            timeframe: Período ('today 12-m', 'today 3-m', 'today 5-y')
            
        Returns:
            Dict com trend_data, growth_rate, peak_period, current_interest
        """
        client = self._get_client()
        
        result = {
            "keyword": keyword,
            "geo": geo,
            "timeframe": timeframe,
            "generated_at": datetime.now().isoformat(),
            "source": "google_trends",
        }
        
        if not client or not keyword or not keyword.strip():
            if client and (not keyword or not keyword.strip()):
                print(f"  ⚠️ TrendAnalyzer: keyword vazia. Pulando.", file=sys.stderr)
            result["error"] = "pytrends não disponível ou keyword vazia"
            return result
        
        try:
            # Build payload
            client.build_payload(
                [keyword],
                cat=0,
                timeframe=timeframe,
                geo=geo,
            )
            
            # Interest over time
            iot = client.interest_over_time()
            
            if iot.empty:
                result["error"] = "Sem dados de tendências para este termo"
                return result
            
            # Extrair dados
            values = iot[keyword].tolist()
            dates = [str(d.date()) for d in iot.index]
            
            # Calcular métricas
            current = values[-1] if values else 0
            peak = max(values) if values else 0
            peak_idx = values.index(peak) if peak > 0 else 0
            avg = sum(values) / len(values) if values else 0
            
            # Taxa de crescimento (últimos 3 meses vs anteriores)
            if len(values) >= 6:
                recent = sum(values[-3:]) / 3
                older = sum(values[-6:-3]) / 3
                growth_rate = ((recent - older) / older * 100) if older > 0 else 0
            else:
                growth_rate = 0
            
            # Tendência geral
            if len(values) >= 4:
                first_quarter = sum(values[:len(values)//4]) / (len(values)//4)
                last_quarter = sum(values[-len(values)//4:]) / (len(values)//4)
                if last_quarter > first_quarter * 1.1:
                    trend_direction = "rising"
                elif last_quarter < first_quarter * 0.9:
                    trend_direction = "declining"
                else:
                    trend_direction = "stable"
            else:
                trend_direction = "insufficient_data"
            
            result.update({
                "current_interest": current,
                "peak_interest": peak,
                "peak_date": dates[peak_idx] if peak_idx < len(dates) else "",
                "average_interest": round(avg, 1),
                "growth_rate_3m": round(growth_rate, 1),
                "trend_direction": trend_direction,
                "data_points": len(values),
                # Últimos 6 pontos para visualização rápida
                "recent_trend": [
                    {"date": dates[i], "value": values[i]}
                    for i in range(max(0, len(values)-6), len(values))
                ],
            })
            
            print(f"  📈 Trend '{keyword}': interest={current}, growth={growth_rate:+.1f}%, direction={trend_direction}", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)[:300]
            print(f"  ⚠️ TrendAnalyzer error: {e}", file=sys.stderr)
        
        return result
    
    def get_rising_queries(
        self,
        keyword: str,
        geo: str = "BR",
        timeframe: str = "today 3-m",
    ) -> Dict[str, Any]:
        """
        Descobre queries em ascensão relacionadas ao termo.
        Útil para identificar novas oportunidades de mercado.
        
        Returns:
            Dict com rising_queries, top_queries
        """
        client = self._get_client()
        
        result = {
            "keyword": keyword,
            "geo": geo,
            "rising_queries": [],
            "top_queries": [],
            "generated_at": datetime.now().isoformat(),
        }
        
        if not client or not keyword or not keyword.strip():
            if client and (not keyword or not keyword.strip()):
                print(f"  ⚠️ TrendAnalyzer: keyword vazia. Pulando.", file=sys.stderr)
            result["error"] = "pytrends não disponível ou keyword vazia"
            return result
        
        try:
            client.build_payload(
                [keyword],
                cat=0,
                timeframe=timeframe,
                geo=geo,
            )
            
            related = client.related_queries()
            
            if keyword in related:
                # Rising queries (em ascensão)
                rising_df = related[keyword].get("rising")
                if rising_df is not None and not rising_df.empty:
                    for _, row in rising_df.head(10).iterrows():
                        result["rising_queries"].append({
                            "query": row.get("query", ""),
                            "value": str(row.get("value", "")),
                        })
                
                # Top queries (mais populares)
                top_df = related[keyword].get("top")
                if top_df is not None and not top_df.empty:
                    for _, row in top_df.head(10).iterrows():
                        result["top_queries"].append({
                            "query": row.get("query", ""),
                            "value": int(row.get("value", 0)),
                        })
            
            print(f"  🔎 Rising queries for '{keyword}': {len(result['rising_queries'])} rising, {len(result['top_queries'])} top", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)[:300]
            print(f"  ⚠️ Rising queries error: {e}", file=sys.stderr)
        
        return result
    
    def compare_terms(
        self,
        terms: List[str],
        geo: str = "BR",
        timeframe: str = "today 12-m",
    ) -> Dict[str, Any]:
        """
        Compara volume de busca entre múltiplos termos.
        Útil para: qual produto tem mais demanda? qual variação do nome vende mais?
        
        Args:
            terms: Lista de termos (máx 5)
            geo: Geolocalização
            timeframe: Período
            
        Returns:
            Dict com comparison data por termo
        """
        client = self._get_client()
        
        # Pytrends aceita máx 5 termos
        terms = terms[:5]
        
        result = {
            "terms": terms,
            "geo": geo,
            "comparison": {},
            "winner": "",
            "generated_at": datetime.now().isoformat(),
        }
        
        if not client or not keyword or not keyword.strip():
            if client and (not keyword or not keyword.strip()):
                print(f"  ⚠️ TrendAnalyzer: keyword vazia. Pulando.", file=sys.stderr)
            result["error"] = "pytrends não disponível ou keyword vazia"
            return result
        
        try:
            client.build_payload(
                terms,
                cat=0,
                timeframe=timeframe,
                geo=geo,
            )
            
            iot = client.interest_over_time()
            
            if iot.empty:
                result["error"] = "Sem dados para comparação"
                return result
            
            max_avg = 0
            
            for term in terms:
                if term in iot.columns:
                    values = iot[term].tolist()
                    avg = sum(values) / len(values) if values else 0
                    current = values[-1] if values else 0
                    
                    result["comparison"][term] = {
                        "average_interest": round(avg, 1),
                        "current_interest": current,
                        "peak_interest": max(values) if values else 0,
                    }
                    
                    if avg > max_avg:
                        max_avg = avg
                        result["winner"] = term
            
            print(f"  📊 Comparison: winner='{result['winner']}' among {len(terms)} terms", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)[:300]
            print(f"  ⚠️ Compare terms error: {e}", file=sys.stderr)
        
        return result
    
    def get_regional_interest(
        self,
        keyword: str,
        geo: str = "BR",
        resolution: str = "REGION",
        timeframe: str = "today 12-m",
    ) -> Dict[str, Any]:
        """
        Descobre em quais regiões/estados o termo é mais buscado.
        Útil para: onde está a maior demanda? onde prospectar primeiro?
        
        Args:
            keyword: Termo
            geo: País/região base
            resolution: 'REGION' (estados), 'CITY' (cidades)
            timeframe: Período
            
        Returns:
            Dict com ranking de regiões por interesse
        """
        client = self._get_client()
        
        result = {
            "keyword": keyword,
            "geo": geo,
            "resolution": resolution,
            "regions": [],
            "generated_at": datetime.now().isoformat(),
        }
        
        if not client or not keyword or not keyword.strip():
            if client and (not keyword or not keyword.strip()):
                print(f"  ⚠️ TrendAnalyzer: keyword vazia. Pulando.", file=sys.stderr)
            result["error"] = "pytrends não disponível ou keyword vazia"
            return result
        
        try:
            client.build_payload(
                [keyword],
                cat=0,
                timeframe=timeframe,
                geo=geo,
            )
            
            ibr = client.interest_by_region(
                resolution=resolution,
                inc_low_vol=True,
                inc_geo_code=True,
            )
            
            if ibr.empty:
                result["error"] = "Sem dados regionais"
                return result
            
            # Ordenar por interesse decrescente
            ibr_sorted = ibr[ibr[keyword] > 0].sort_values(keyword, ascending=False)
            
            for region_name, row in ibr_sorted.head(15).iterrows():
                result["regions"].append({
                    "region": region_name,
                    "interest": int(row[keyword]),
                })
            
            print(f"  🗺️ Regional interest for '{keyword}': top={result['regions'][0]['region'] if result['regions'] else 'N/A'}", file=sys.stderr)
            
        except Exception as e:
            result["error"] = str(e)[:300]
            print(f"  ⚠️ Regional interest error: {e}", file=sys.stderr)
        
        return result


# Instância global
trend_analyzer = TrendAnalyzer()
