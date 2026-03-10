"""
Unified Research Service - Modularização Inteligente de Pesquisa
Centraliza search_duckduckgo e scrape_page com cache hierárquico
"""

import json
import sys
import time
import hashlib
from typing import Dict, List, Any, Optional, Tuple, Callable
from datetime import datetime, timedelta

from app.services.common import log_cache, log_research

from app.core.web_utils import search_duckduckgo, scrape_page
from app.core import database as db


class UnifiedResearchEngine:
    """Motor de pesquisa unificado com cache hierárquico e contexto inteligente."""
    
    def __init__(self):
        self.cache = {}  # Cache em memória
        self.cache_ttl = {
            'market': timedelta(hours=6),      # Market research dura 6h
            'task': timedelta(hours=2),       # Task research dura 2h  
            'subtask': timedelta(minutes=30),  # Subtask research dura 30min
            'discovery': timedelta(hours=4)    # Discovery dura 4h
        }
        self.rate_limits = {
            'last_search': 0,
            'min_interval': 1.0  # 1 segundo entre buscas
        }
    
    def search_market(
        self,
        segmento: str,
        categorias: List[str],
        localizacao: str = "",
        region: str = "br-pt",
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Pesquisa de mercado (macro level).
        Usado na análise inicial do negócio.
        """
        cache_key = self._generate_cache_key("market", {
            "segmento": segmento,
            "categorias": categorias,
            "localizacao": localizacao,
            "region": region
        })
        
        # Verificar cache
        if not force_refresh:
            cached = self._get_cache(cache_key, "market")
            if cached:
                log_cache(f"📦 Market cache: {len(cached.get('categories', []))} cats")
                return cached
        
        # Executar pesquisa
        log_research(f"🔍 Market: {segmento[:30]}... | {len(categorias)} cats")
        
        results = {
            "segmento": segmento,
            "localizacao": localizacao,
            "categories": [],
            "sources": [],
            "generated_at": datetime.now().isoformat(),
            "research_type": "market"
        }
        
        # Pesquisar cada categoria
        for categoria in categorias:
            category_result = self._search_category(
                categoria, segmento, localizacao, region
            )
            if category_result:
                results["categories"].append(category_result)
                results["sources"].extend(category_result.get("sources", []))
        
        # Salvar cache
        self._set_cache(cache_key, "market", results)
        
        # Salvar no banco para persistência
        self._save_research_to_db("market", cache_key, results)
        
        print(f"  ✅ Market research completed: {len(results['categories'])} categories", file=sys.stderr)
        return results
    
    def search_tasks(
        self,
        pillar_key: str,
        score: int,
        diagnostic: Dict[str, Any],
        segmento: str,
        market_context: Optional[Dict] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Pesquisa de tarefas (meso level).
        Usado na geração de tarefas context-aware.
        """
        cache_key = self._generate_cache_key("task", {
            "pillar_key": pillar_key,
            "score": score,
            "diagnostic": diagnostic.get("justificativa", ""),
            "segmento": segmento
        })
        
        # Verificar cache
        if not force_refresh:
            cached = self._get_cache(cache_key, "task")
            if cached:
                print(f"  📦 Task research from cache: {pillar_key}", file=sys.stderr)
                return cached
        
        # Construir query inteligente
        query = self._build_task_query(pillar_key, score, diagnostic, segmento)
        
        print(f"  🔍 Task research: {pillar_key} (score: {score})", file=sys.stderr)
        print(f"    Query: {query[:80]}...", file=sys.stderr)
        
        # Executar pesquisa
        search_results = search_duckduckgo(query, max_results=4, region='br-pt')
        
        research_data = {
            "pillar_key": pillar_key,
            "score": score,
            "diagnostic": diagnostic,
            "query": query,
            "results": [],
            "sources": [],
            "content": "",
            "market_context": market_context,
            "generated_at": datetime.now().isoformat(),
            "research_type": "task"
        }
        
        # Processar resultados
        for i, result in enumerate(search_results or []):
            url = result.get("href", "")
            title = result.get("title", "")
            snippet = result.get("body", "")
            
            research_data["results"].append({
                "url": url,
                "title": title,
                "snippet": snippet
            })
            
            research_data["sources"].append(url)
            
            # Scraping apenas do TOP 1 resultado usando web_extractor (trafilatura)
            if i == 0:  # Apenas o primeiro resultado
                try:
                    from app.services.intelligence.intelligence_hub import intel_hub
                    content = intel_hub.extract_content(url, timeout=2, max_chars=1500)
                except Exception:
                    content = scrape_page(url, timeout=2)
                if content:
                    research_data["content"] += f"Fonte: {title}\n{snippet}\n{content[:1500]}\n\n"
        
        # ── ENRIQUECIMENTO INTELIGENTE (intel_hub) ────────────────
        # Todas as ferramentas de inteligência são aplicadas por pilar
        tools_used = []
        try:
            from app.services.intelligence.intelligence_hub import intel_hub
            
            # ── TRENDS: Disponível para TODOS os pilares ─────────────
            if pillar_key in ("publico_alvo", "branding", "trafego_organico", "trafego_pago", "canais_venda", "processo_vendas", "presenca_online"):
                try:
                    print(f"  📈 [Intel] Trends: analisando demanda para {pillar_key}...", file=sys.stderr)
                    trends_data = intel_hub.trends.analyze_demand(segmento, geo="BR")
                    if "error" not in trends_data:
                        research_data["intelligence_trends"] = {
                            "current_interest": trends_data.get("current_interest"),
                            "growth_rate_3m": trends_data.get("growth_rate_3m"),
                            "trend_direction": trends_data.get("trend_direction"),
                        }
                        research_data["content"] += (
                            f"\n[DADOS TRENDS] Demanda de busca: interesse={trends_data.get('current_interest')}, "
                            f"crescimento={trends_data.get('growth_rate_3m', 0):+.1f}% (3 meses), "
                            f"tendência={trends_data.get('trend_direction')}\n"
                        )
                        tools_used.append({"tool": "trend_analyzer", "status": "success", "detail": f"interesse={trends_data.get('current_interest')}, trend={trends_data.get('trend_direction')}"})
                    else:
                        tools_used.append({"tool": "trend_analyzer", "status": "error", "detail": str(trends_data.get("error", ""))[:100]})
                except Exception as te:
                    tools_used.append({"tool": "trend_analyzer", "status": "error", "detail": str(te)[:100]})
            
            # ── RISING QUERIES: Para pilares de tráfego e conteúdo ───
            if pillar_key in ("trafego_organico", "trafego_pago", "presenca_online", "branding"):
                try:
                    print(f"  🔥 [Intel] Trends: buscando termos em alta para {pillar_key}...", file=sys.stderr)
                    rising = intel_hub.trends.get_rising_queries(segmento, geo="BR")
                    if rising.get("rising_queries"):
                        queries_text = ", ".join([q["query"] for q in rising["rising_queries"][:5]])
                        research_data["intelligence_rising_queries"] = rising["rising_queries"][:5]
                        research_data["content"] += f"\n[TERMOS EM ALTA] {queries_text}\n"
                        tools_used.append({"tool": "trend_analyzer_rising", "status": "success", "detail": f"{len(rising['rising_queries'])} termos encontrados"})
                    else:
                        tools_used.append({"tool": "trend_analyzer_rising", "status": "no_data", "detail": "Nenhum termo em alta"})
                except Exception as re:
                    tools_used.append({"tool": "trend_analyzer_rising", "status": "error", "detail": str(re)[:100]})
            
            # ── NEWS: Para todos os pilares ──────────────────────────
            if pillar_key in ("publico_alvo", "branding", "canais_venda", "processo_vendas", "trafego_organico", "trafego_pago"):
                try:
                    print(f"  📰 [Intel] News: buscando notícias do setor para {pillar_key}...", file=sys.stderr)
                    news_data = intel_hub.news.search_sector_news(segmento, period="30d", max_results=5)
                    if news_data.get("news"):
                        news_summary = "; ".join([n["title"] for n in news_data["news"][:3]])
                        research_data["intelligence_news"] = news_data["news"][:3]
                        research_data["content"] += f"\n[NOTÍCIAS SETOR] {news_summary}\n"
                        tools_used.append({"tool": "news_extractor", "status": "success", "detail": f"{len(news_data['news'])} notícias"})
                    else:
                        tools_used.append({"tool": "news_extractor", "status": "no_data", "detail": "Nenhuma notícia encontrada"})
                    
                    if news_data.get("opportunities"):
                        opp_summary = "; ".join([o["title"] for o in news_data["opportunities"][:2]])
                        research_data["intelligence_opportunities"] = news_data["opportunities"][:2]
                        research_data["content"] += f"\n[OPORTUNIDADES] {opp_summary}\n"
                except Exception as ne:
                    tools_used.append({"tool": "news_extractor", "status": "error", "detail": str(ne)[:100]})
            
            # ── SALES TRIGGERS: Para pilares de vendas ───────────────
            if pillar_key in ("processo_vendas", "canais_venda"):
                try:
                    print(f"  🎯 [Intel] News: detectando gatilhos de venda para {pillar_key}...", file=sys.stderr)
                    triggers = intel_hub.news.detect_sales_triggers(segmento, period="14d", max_results=5)
                    if triggers:
                        triggers_text = "; ".join([t.get("title", "") for t in triggers[:3]] if isinstance(triggers, list) else [])
                        if triggers_text:
                            research_data["intelligence_triggers"] = triggers[:3] if isinstance(triggers, list) else triggers
                            research_data["content"] += f"\n[GATILHOS DE VENDA] {triggers_text}\n"
                            tools_used.append({"tool": "sales_triggers", "status": "success", "detail": f"{len(triggers) if isinstance(triggers, list) else 1} gatilhos"})
                except Exception as ste:
                    tools_used.append({"tool": "sales_triggers", "status": "error", "detail": str(ste)[:100]})
                
            print(f"  🧠 Intel enrichment applied for {pillar_key}: {[t['tool'] for t in tools_used]}", file=sys.stderr)
                
        except Exception as e:
            print(f"  ⚠️ Intel enrichment skipped: {e}", file=sys.stderr)
        
        # Salvar ferramentas usadas nos dados da pesquisa
        research_data["intelligence_tools_used"] = tools_used
        
        # Só cachear se obteve resultados úteis (evita cache de resultados vazios)
        has_useful_data = (
            len(research_data["sources"]) > 0
            or research_data.get("intelligence_trends")
            or research_data.get("intelligence_news")
            or len(research_data.get("content", "")) > 100
        )
        if has_useful_data:
            self._set_cache(cache_key, "task", research_data)
            self._save_research_to_db("task", cache_key, research_data)
        else:
            print(f"  ⚠️ Task research returned empty — NOT caching to avoid stale empty cache", file=sys.stderr)
        
        print(f"  ✅ Task research completed: {len(research_data['results'])} sources", file=sys.stderr)
        return research_data
    
    def search_subtasks(
        self,
        task_title: str,
        task_desc: str,
        pillar_key: str,
        segmento: str,
        task_context: Optional[Dict] = None,
        force_refresh: bool = False,
        subtask_index: int = 0,
        cancellation_check: Optional[Callable[[], None]] = None
    ) -> Dict[str, Any]:
        """
        Pesquisa de subtarefas (micro level).
        Usado na expansão e execução de subtarefas.
        """
        # Extrair ferramenta sugerida pelo Auditor
        ferramenta_hint = ""
        if task_context:
            ferramenta_hint = task_context.get("ferramenta", "")
            
        # Cache key DEVE incluir subtask_index e ferramenta_hint
        cache_key = self._generate_cache_key("subtask", {
            "task_title": task_title[:50],
            "pillar_key": pillar_key,
            "segmento": segmento,
            "subtask_index": subtask_index,
            "ferramenta": ferramenta_hint
        })
        
        # Verificar cache
        if not force_refresh:
            cached = self._get_cache(cache_key, "subtask")
            if cached:
                print(f"  📦 Subtask research from cache: {task_title[:30]}...", file=sys.stderr)
                return cached
        
        # Construir query específica
        query = self._build_subtask_query(task_title, task_desc, pillar_key, segmento, subtask_index, ferramenta_hint=ferramenta_hint)
        
        print(f"  🔍 Subtask research: {task_title[:30]}...", file=sys.stderr)
        if ferramenta_hint:
            print(f"    💎 Elite Tool Hint: {ferramenta_hint}", file=sys.stderr)
        print(f"    Query: {query[:80]}...", file=sys.stderr)
        
        # Executar pesquisa
        search_results = search_duckduckgo(query, max_results=5, region='br-pt', cancellation_check=cancellation_check)
        
        research_data = {
            "task_title": task_title,
            "task_desc": task_desc,
            "pillar_key": pillar_key,
            "query": query,
            "results": [],
            "sources": [],
            "content": "",
            "task_context": task_context,
            "generated_at": datetime.now().isoformat(),
            "research_type": "subtask"
        }
        
        # Processar resultados
        for i, result in enumerate(search_results or []):
            url = result.get("href", "")
            title = result.get("title", "")
            snippet = result.get("body", "")
            
            research_data["results"].append({
                "url": url,
                "title": title,
                "snippet": snippet
            })
            
            research_data["sources"].append(url)
            
            # Extração de conteúdo via web_extractor (trafilatura) com fallback
            if i < 3:
                # Check cancellation BEFORE each scrape
                if cancellation_check:
                    cancellation_check()
                    
                try:
                    from app.services.intelligence.intelligence_hub import intel_hub
                    content = intel_hub.extract_content(url, timeout=5, max_chars=4000)
                except Exception:
                    content = scrape_page(url, timeout=5)
                if content:
                    research_data["content"] += f"Fonte: {title}\n{snippet}\n{content[:4000]}\n\n"
                
                # Check cancellation between scrapes
                if cancellation_check:
                    cancellation_check()
        
        # ── ENRIQUECIMENTO INTEL para subtarefas (TODOS os pilares) ──
        subtask_tools_used = []
        try:
            from app.services.intelligence.intelligence_hub import intel_hub
            
            # Notícias contextuais da subtarefa — para todos os pilares com foco em dados
            if pillar_key in ("publico_alvo", "branding", "canais_venda", "processo_vendas", "trafego_organico", "trafego_pago"):
                try:
                    print(f"  📰 [Intel] Subtask news: {task_title[:30]}...", file=sys.stderr)
                    news = intel_hub.news.search_sector_news(
                        f"{segmento} {task_title[:30]}", period="14d", max_results=3
                    )
                    if news.get("news"):
                        for n in news["news"][:2]:
                            research_data["content"] += f"\n[NOTÍCIA] {n['title']}\n"
                        research_data["intelligence_news"] = news["news"][:2]
                        subtask_tools_used.append({"tool": "news_extractor", "status": "success", "detail": f"{len(news['news'])} notícias"})
                    else:
                        subtask_tools_used.append({"tool": "news_extractor", "status": "no_data"})
                except Exception as ne:
                    subtask_tools_used.append({"tool": "news_extractor", "status": "error", "detail": str(ne)[:80]})
            
            # Rising queries para subtarefas de tráfego/SEO
            if pillar_key in ("trafego_organico", "trafego_pago"):
                try:
                    print(f"  🔥 [Intel] Subtask rising queries: {pillar_key}...", file=sys.stderr)
                    rising = intel_hub.trends.get_rising_queries(segmento, geo="BR")
                    if rising.get("rising_queries"):
                        queries_text = ", ".join([q["query"] for q in rising["rising_queries"][:3]])
                        research_data["content"] += f"\n[TERMOS EM ALTA] {queries_text}\n"
                        research_data["intelligence_rising_queries"] = rising["rising_queries"][:3]
                        subtask_tools_used.append({"tool": "trend_analyzer_rising", "status": "success", "detail": f"{len(rising['rising_queries'])} termos"})
                except Exception as tre:
                    subtask_tools_used.append({"tool": "trend_analyzer_rising", "status": "error", "detail": str(tre)[:80]})
            
        except Exception as e:
            print(f"  ⚠️ Subtask intel enrichment skipped: {e}", file=sys.stderr)
        
        research_data["intelligence_tools_used"] = subtask_tools_used
        
        # Salvar cache
        self._set_cache(cache_key, "subtask", research_data)
        
        # Salvar no banco
        self._save_research_to_db("subtask", cache_key, research_data)
        
        print(f"  ✅ Subtask research completed: {len(research_data['results'])} sources", file=sys.stderr)
        return research_data
    
    def search_discovery(
        self,
        business_name: str,
        segmento: str,
        localizacao: str = "",
        region: str = "br-pt",
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Pesquisa de discovery (validação do negócio).
        Usado no business discovery.
        """
        cache_key = self._generate_cache_key("discovery", {
            "business_name": business_name,
            "segmento": segmento,
            "localizacao": localizacao
        })
        
        # Verificar cache
        if not force_refresh:
            cached = self._get_cache(cache_key, "discovery")
            if cached:
                log_cache(f"📦 Cache: {business_name[:30]}...")
                return cached
        
        # Queries específicas para discovery (sem Instagram/LinkedIn — não retornam dados sem API)
        queries = [
            f"{business_name} {segmento} site oficial",
            f"{business_name} google maps {localizacao}",
            f"{business_name} reviews clientes avaliações"
        ]
        
        print(f"  🔍 Discovery research: {business_name}", file=sys.stderr)
        
        discovery_data = {
            "business_name": business_name,
            "segmento": segmento,
            "localizacao": localizacao,
            "queries": queries,
            "results": {},
            "sources": [],
            "found": False,
            "generated_at": datetime.now().isoformat(),
            "research_type": "discovery"
        }
        
        # Executar múltiplas queries
        for query in queries:
            query_key = query.replace(" ", "_")[:20]
            
            search_results = search_duckduckgo(query, max_results=3, region='br-pt')
            
            if search_results:
                discovery_data["found"] = True
                
                # Processar resultados
                query_results = []
                for result in search_results:
                    url = result.get("href", "")
                    title = result.get("title", "")
                    snippet = result.get("body", "")
                    
                    query_results.append({
                        "url": url,
                        "title": title,
                        "snippet": snippet
                    })
                    
                    if url not in discovery_data["sources"]:
                        discovery_data["sources"].append(url)
                
                discovery_data["results"][query_key] = query_results
                
                # Scraping do primeiro resultado
                if query_results:
                    content = scrape_page(query_results[0]["url"], timeout=4)
                    if content:
                        discovery_data["results"][query_key][0]["content"] = content[:2000]
        
        # Salvar cache
        self._set_cache(cache_key, "discovery", discovery_data)
        
        # Salvar no banco
        self._save_research_to_db("discovery", cache_key, discovery_data)
        
        print(f"  ✅ Discovery research completed: found={discovery_data['found']}", file=sys.stderr)
        return discovery_data
    
    def _search_category(
        self,
        categoria: str,
        segmento: str,
        localizacao: str,
        region: str
    ) -> Optional[Dict[str, Any]]:
        """Pesquisa individual de categoria."""
        query = f"{categoria} {segmento} {localizacao}".strip()
        
        try:
            results = search_duckduckgo(query, max_results=4, region=region)
            
            if not results:
                return None
            
            category_data = {
                "id": categoria.lower().replace(" ", "_"),
                "nome": categoria,
                "query": query,
                "results": [],
                "sources": [],
                "resumo": {
                    "visao_geral": "",
                    "pontos_chave": [],
                    "recomendacoes": [],
                    "dados_relevantes": {}
                }
            }
            
            # Processar resultados
            for i, result in enumerate(results):
                url = result.get("href", "")
                title = result.get("title", "")
                snippet = result.get("body", "")
                
                category_data["results"].append({
                    "url": url,
                    "title": title,
                    "snippet": snippet
                })
                
                category_data["sources"].append(url)
                
                # Scraping do top 2 resultados
                if i < 2:
                    content = scrape_page(url, timeout=3)
                    if content:
                        if i == 0:
                            category_data["resumo"]["visao_geral"] = content[:1000]
                        else:
                            # Extrair pontos chave do segundo resultado
                            lines = content.split('\n')
                            category_data["resumo"]["pontos_chave"] = [
                                line.strip() for line in lines[:5] if line.strip() and len(line.strip()) > 20
                            ]
            
            return category_data
            
        except Exception as e:
            print(f"  ⚠️ Error searching category {categoria}: {e}", file=sys.stderr)
            return None
    
    def _build_task_query(
        self,
        pillar_key: str,
        score: int,
        diagnostic: Dict[str, Any],
        segmento: str
    ) -> str:
        """Constrói query inteligente para pesquisa de tarefas."""
        
        # Mapear pilares para termos específicos
        pillar_terms = {
            "publico_alvo": ["persona", "público alvo", "segmentação"],
            "branding": ["branding", "marca", "posicionamento"],
            "identidade_visual": ["identidade visual", "logo", "design"],
            "canais_venda": ["canais venda", "vendas online", "e-commerce"],
            "trafego_organico": ["tráfego orgânico", "seo", "conteúdo"],
            "trafego_pago": ["tráfego pago", "anúncios", "mídia paga"],
            "processo_vendas": ["processo vendas", "funil", "conversão"]
        }
        
        terms = pillar_terms.get(pillar_key, [pillar_key])
        main_term = terms[0] if terms else pillar_key
        
        # Extrair problema do diagnóstico
        problem = diagnostic.get("justificativa", "")[:50]
        
        # Construir query baseada no score
        if score < 40:
            # Crítico - foco em soluções urgentes
            query = f"{main_term} {segmento} problemas soluções urgentes 2025"
        elif score < 70:
            # Atenção - foco em melhorias
            query = f"{main_term} {segmento} estratégias melhorias 2025"
        else:
            # Forte - foco em otimização
            query = f"{main_term} {segmento} otimização avançada 2025"
        
        # Adicionar contexto específico se houver
        if problem and len(problem) > 10:
            query += f" {problem}"
        
        return query
    
    def _build_subtask_query(
        self,
        task_title: str,
        task_desc: str,
        pillar_key: str,
        segmento: str,
        subtask_index: int = 0,
        ferramenta_hint: str = ""
    ) -> str:
        """Constrói query de INTELIGÊNCIA SETORIAL para subtarefa.
        
        Objetivo: encontrar DADOS REAIS sobre o setor e compradores.
        
        Usa o ferramenta_hint para direcionar a busca se disponível.
        """
        import unicodedata
        def _norm(text: str) -> str:
            return ''.join(
                c for c in unicodedata.normalize('NFD', text.lower())
                if unicodedata.category(c) != 'Mn'
            )
        
        # Stop words
        stop_words = {
            "o", "a", "os", "as", "de", "do", "da", "dos", "das", "em", "para",
            "com", "sem", "um", "uma", "que", "por", "no", "na", "nos", "nas",
            "ao", "pelo", "pela", "se", "e", "ou", "mas", "como", "sua",
            "seu", "seus", "suas", "este", "esta", "esse", "essa", "isto",
            "sao", "ser", "ter", "mais", "sobre", "entre", "apos", "ate",
            "criar", "desenvolver", "implementar", "definir", "analisar",
            "pesquisar", "coletar", "identificar", "elaborar", "estabelecer",
            "mapear", "levantar", "realizar", "executar", "gerar", "produzir",
            "selecionar", "aplicar", "montar", "estruturar", "planejar",
            "consolidar", "validar", "compilar", "detalhar", "formatar",
            "documento", "relatorio", "questionario", "formulario", "ferramenta",
            "template", "modelo", "plano", "guia", "manual", "lista",
            "online", "digital", "resultados", "insights", "estrategia",
            "pesquisa", "fontes", "dados", "escopo", "objetivos",
            "perguntas", "respostas", "analise", "etapas", "passos",
            "conteudo", "informacoes", "criterios", "tabela", "estudo",
        }
        
        # Combine title and desc
        base_text = task_title + " " + task_desc
        if ferramenta_hint:
            base_text = f"{ferramenta_hint} {base_text}"
            
        all_words = base_text.lower().split()
        keywords = [w for w in all_words if _norm(w) not in stop_words and len(w) > 2]
        
        seen = set()
        unique_kw = []
        for w in keywords:
            nw = _norm(w)
            if nw not in seen:
                seen.add(nw)
                unique_kw.append(w)
        
        # Inteligência setorial por pilar
        pillar_intel_variants = {
            "publico_alvo": [
                "perfil comprador B2B necessidades comportamento decisão",
                "jornada compra industrial critérios seleção fornecedor",
                "segmentação mercado industrial tendências compradores",
            ],
            "branding": [
                "marca posicionamento concorrentes diferenciação mercado",
                "proposta valor competitiva análise benchmark setor",
                "estratégia marca cases sucesso indústria",
            ],
            "identidade_visual": [
                "identidade visual design tendências referências",
                "comunicação visual corporativa catálogo profissional",
                "design embalagem materiais gráficos industriais",
            ],
            "canais_venda": [
                "canais venda distribuição B2B marketplace",
                "representantes comerciais prospecção ativa industrial",
                "logística distribuição cadeia suprimentos vendas",
            ],
            "trafego_organico": [
                "SEO palavras-chave conteúdo tráfego orgânico",
                "marketing conteúdo B2B LinkedIn artigos técnicos",
                "Google Meu Negócio presença digital local",
            ],
            "trafego_pago": [
                "anúncios Google Ads mídia paga benchmarks",
                "LinkedIn Ads segmentação B2B decisores compras",
                "remarketing industrial custo aquisição leads",
            ],
            "processo_vendas": [
                "vendas funil B2B jornada compra industrial",
                "script vendas objeções negociação contratos",
                "CRM pipeline comercial taxas conversão B2B",
            ],
        }
        variants = pillar_intel_variants.get(pillar_key, [["dados setor mercado análise"]])
        variant_idx = subtask_index % len(variants)
        intel = variants[variant_idx]
        intel_words = intel.split()[:3]
        
        parts = []
        used_norms = set()
        
        if segmento:
            parts.append(segmento)
            for sw in segmento.lower().split():
                used_norms.add(_norm(sw))
        
        # Add tool hint early if present
        if ferramenta_hint:
            parts.append(ferramenta_hint)
            for hw in ferramenta_hint.lower().split():
                used_norms.add(_norm(hw))
        
        added = 0
        for kw in unique_kw:
            if _norm(kw) not in used_norms and added < 3:
                parts.append(kw)
                used_norms.add(_norm(kw))
                added += 1
        
        for iw in intel_words:
            if _norm(iw) not in used_norms:
                parts.append(iw)
                used_norms.add(_norm(iw))
        
        query = " ".join(parts)
        if len(query.split()) < 4:
            query = f"{segmento} {intel} {ferramenta_hint}".strip()
        
        return query
    
    def _generate_cache_key(self, research_type: str, params: Dict[str, Any]) -> str:
        """Gera chave única para cache."""
        # Ordenar parâmetros para consistência
        sorted_params = json.dumps(params, sort_keys=True, ensure_ascii=False)
        cache_string = f"{research_type}:{sorted_params}"
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def _get_cache(self, cache_key: str, research_type: str) -> Optional[Dict[str, Any]]:
        """Obtém dados do cache (memória + banco)."""
        
        def _is_useful(data: dict) -> bool:
            """Verifica se o dado cacheado tem conteúdo útil (não é resultado vazio)."""
            if not data:
                return False
            return (
                len(data.get("sources", [])) > 0
                or data.get("intelligence_trends")
                or data.get("intelligence_news")
                or len(data.get("content", "")) > 100
            )

        # Verificar cache em memória primeiro
        if cache_key in self.cache:
            cached_data = self.cache[cache_key]
            if self._is_cache_valid(cached_data, research_type):
                data = cached_data["data"]
                if _is_useful(data):
                    return data
                else:
                    # Cache vazio — descartar e forçar nova busca
                    del self.cache[cache_key]
            else:
                # Remover cache expirado
                del self.cache[cache_key]
        
        # Verificar cache no banco
        try:
            db_cache = db.get_research_cache(cache_key)
            if db_cache and self._is_cache_valid(db_cache, research_type):
                data = db_cache["data"]
                if _is_useful(data):
                    # Restaurar para cache em memória
                    self.cache[cache_key] = db_cache
                    return data
                # Cache vazio no banco — não usar
        except:
            pass
        
        return None
    
    def _set_cache(self, cache_key: str, research_type: str, data: Dict[str, Any]):
        """Salva dados no cache (memória + banco)."""
        
        cache_entry = {
            "data": data,
            "cached_at": datetime.now(),
            "research_type": research_type
        }
        
        # Salvar em memória
        self.cache[cache_key] = cache_entry
        
        # Salvar no banco para persistência
        try:
            db.save_research_cache(cache_key, cache_entry)
        except Exception as e:
            print(f"  ⚠️ Failed to save cache to DB: {e}", file=sys.stderr)
    
    def _is_cache_valid(self, cache_entry: Dict[str, Any], research_type: str) -> bool:
        """Verifica se cache ainda é válido."""
        if not cache_entry or "cached_at" not in cache_entry:
            return False
        
        cached_at = cache_entry["cached_at"]
        ttl = self.cache_ttl.get(research_type, timedelta(hours=1))
        
        return datetime.now() - cached_at < ttl
    
    def _save_research_to_db(self, research_type: str, cache_key: str, data: Dict[str, Any]):
        """Salva pesquisa no banco para análise."""
        try:
            db.save_research_result(research_type, cache_key, data)
        except Exception as e:
            print(f"  ⚠️ Failed to save research to DB: {e}", file=sys.stderr)
    
    def get_research_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache."""
        stats = {
            "cache_size": len(self.cache),
            "cache_by_type": {},
            "total_saved": 0
        }
        
        for cache_entry in self.cache.values():
            research_type = cache_entry.get("research_type", "unknown")
            stats["cache_by_type"][research_type] = stats["cache_by_type"].get(research_type, 0) + 1
        
        try:
            db_stats = db.get_research_stats()
            stats["total_saved"] = db_stats.get("total_researches", 0)
        except:
            pass
        
        return stats


# Instância global do motor de pesquisa
research_engine = UnifiedResearchEngine()
