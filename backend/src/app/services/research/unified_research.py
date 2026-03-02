"""
Unified Research Service - Modularização Inteligente de Pesquisa
Centraliza search_duckduckgo e scrape_page com cache hierárquico
"""

import json
import sys
import time
import hashlib
from typing import Dict, List, Any, Optional, Tuple
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
            
            # Scraping apenas do TOP 1 resultado com timeout reduzido
            if i == 0:  # Apenas o primeiro resultado
                content = scrape_page(url, timeout=2)  # Reduzido de 4 para 2 segundos
                if content:
                    research_data["content"] += f"Fonte: {title}\n{snippet}\n{content[:1500]}\n\n"  # Reduzido de 2000 para 1500
        
        # Salvar cache
        self._set_cache(cache_key, "task", research_data)
        
        # Salvar no banco
        self._save_research_to_db("task", cache_key, research_data)
        
        print(f"  ✅ Task research completed: {len(research_data['results'])} sources", file=sys.stderr)
        return research_data
    
    def search_subtasks(
        self,
        task_title: str,
        task_desc: str,
        pillar_key: str,
        segmento: str,
        task_context: Optional[Dict] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Pesquisa de subtarefas (micro level).
        Usado na expansão e execução de subtarefas.
        """
        cache_key = self._generate_cache_key("subtask", {
            "task_title": task_title,
            "task_desc": task_desc[:100],  # Limitar para cache
            "pillar_key": pillar_key,
            "segmento": segmento
        })
        
        # Verificar cache
        if not force_refresh:
            cached = self._get_cache(cache_key, "subtask")
            if cached:
                print(f"  📦 Subtask research from cache: {task_title[:30]}...", file=sys.stderr)
                return cached
        
        # Construir query específica
        query = self._build_subtask_query(task_title, task_desc, pillar_key, segmento)
        
        print(f"  🔍 Subtask research: {task_title[:30]}...", file=sys.stderr)
        print(f"    Query: {query[:80]}...", file=sys.stderr)
        
        # Executar pesquisa
        search_results = search_duckduckgo(query, max_results=3, region='br-pt')
        
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
            
            # Scraping do top resultado
            if i < 1:
                content = scrape_page(url, timeout=3)
                if content:
                    research_data["content"] += f"Fonte: {title}\n{snippet}\n{content[:1500]}\n\n"
        
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
        segmento: str
    ) -> str:
        """Constrói query específica para subtarefa."""
        
        # Extrair palavras-chave da tarefa
        title_words = task_title.lower().split()
        desc_words = task_desc.lower().split()
        
        # Identificar ação principal
        action_verbs = ["criar", "desenvolver", "implementar", "definir", "analisar", "pesquisar"]
        main_action = "implementar"
        
        for verb in action_verbs:
            if verb in title_words or verb in desc_words:
                main_action = verb
                break
        
        # Identificar assunto principal
        stop_words = {"o", "a", "os", "as", "de", "do", "da", "em", "para", "com", "um", "uma"}
        keywords = [w for w in title_words + desc_words if w not in stop_words and len(w) > 2]
        main_subject = " ".join(keywords[:3]) if keywords else task_title
        
        # Construir query
        query = f"{main_action} {main_subject} {segmento} guia passo passo 2025"
        
        return query
    
    def _generate_cache_key(self, research_type: str, params: Dict[str, Any]) -> str:
        """Gera chave única para cache."""
        # Ordenar parâmetros para consistência
        sorted_params = json.dumps(params, sort_keys=True, ensure_ascii=False)
        cache_string = f"{research_type}:{sorted_params}"
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def _get_cache(self, cache_key: str, research_type: str) -> Optional[Dict[str, Any]]:
        """Obtém dados do cache (memória + banco)."""
        
        # Verificar cache em memória primeiro
        if cache_key in self.cache:
            cached_data = self.cache[cache_key]
            if self._is_cache_valid(cached_data, research_type):
                return cached_data["data"]
            else:
                # Remover cache expirado
                del self.cache[cache_key]
        
        # Verificar cache no banco
        try:
            db_cache = db.get_research_cache(cache_key)
            if db_cache and self._is_cache_valid(db_cache, research_type):
                # Restaurar para cache em memória
                self.cache[cache_key] = db_cache
                return db_cache["data"]
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
