"""
CNPJ Lookup — Inteligência B2B via BrasilAPI (gratuita).
Consulta CNPJ, descobre porte, CNAE, capital social, sócios.

Uso:
    from app.services.intelligence.b2b.cnpj_lookup import cnpj_service
    
    empresa = cnpj_service.lookup("19131243000197")
    empresas = cnpj_service.search_by_cnae("2222600", "SP", "São Paulo")
"""

import sys
import time
import re
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime


# Classificação de porte por capital social
_PORTE_RANGES = [
    (0, 50_000, "MEI/Micro"),
    (50_000, 500_000, "Pequena"),
    (500_000, 5_000_000, "Média"),
    (5_000_000, 50_000_000, "Média-Grande"),
    (50_000_000, float('inf'), "Grande"),
]


class CNPJService:
    """Serviço de consulta CNPJ via BrasilAPI (100% gratuito)."""
    
    BASE_URL = "https://brasilapi.com.br/api"
    
    def __init__(self):
        self._session = None
        self._rate_limit_last = 0
        self._rate_limit_interval = 1.0  # 1s entre requests
    
    def _get_session(self) -> requests.Session:
        if self._session is None:
            self._session = requests.Session()
            self._session.headers.update({
                'User-Agent': 'BuscaV2-IntelligenceEngine/1.0',
                'Accept': 'application/json',
            })
        return self._session
    
    def _rate_limit(self):
        """Respeita rate limit."""
        now = time.time()
        elapsed = now - self._rate_limit_last
        if elapsed < self._rate_limit_interval:
            time.sleep(self._rate_limit_interval - elapsed)
        self._rate_limit_last = time.time()
    
    def _clean_cnpj(self, cnpj: str) -> str:
        """Remove formatação do CNPJ."""
        return re.sub(r'[^0-9]', '', cnpj)
    
    def lookup(self, cnpj: str, timeout: int = 10) -> Dict[str, Any]:
        """
        Consulta dados completos de uma empresa pelo CNPJ.
        
        Args:
            cnpj: CNPJ com ou sem formatação
            timeout: Timeout em segundos
            
        Returns:
            Dict com dados da empresa formatados
        """
        cnpj_clean = self._clean_cnpj(cnpj)
        
        if len(cnpj_clean) != 14:
            return {"error": f"CNPJ inválido: {cnpj}", "cnpj": cnpj}
        
        self._rate_limit()
        
        try:
            session = self._get_session()
            response = session.get(
                f"{self.BASE_URL}/cnpj/v1/{cnpj_clean}",
                timeout=timeout
            )
            
            if response.status_code == 404:
                return {"error": "CNPJ não encontrado", "cnpj": cnpj_clean}
            
            response.raise_for_status()
            data = response.json()
            
            # Formatar resultado limpo
            return self._format_company_data(data)
            
        except requests.exceptions.Timeout:
            return {"error": "Timeout na consulta", "cnpj": cnpj_clean}
        except Exception as e:
            print(f"  ⚠️ CNPJ lookup error: {e}", file=sys.stderr)
            return {"error": str(e)[:200], "cnpj": cnpj_clean}
    
    def lookup_batch(
        self,
        cnpjs: List[str],
        timeout: int = 10,
        delay: float = 1.5,
    ) -> List[Dict[str, Any]]:
        """
        Consulta múltiplos CNPJs em lote.
        
        Args:
            cnpjs: Lista de CNPJs
            timeout: Timeout por consulta
            delay: Delay entre consultas (respeitar rate limit)
            
        Returns:
            Lista de resultados
        """
        results = []
        
        for i, cnpj in enumerate(cnpjs):
            result = self.lookup(cnpj, timeout=timeout)
            results.append(result)
            
            if i < len(cnpjs) - 1:
                time.sleep(delay)
            
            # Log progresso
            if (i + 1) % 5 == 0:
                print(f"  📊 CNPJ batch: {i+1}/{len(cnpjs)}", file=sys.stderr)
        
        return results
    
    def search_companies_by_web(
        self,
        segmento: str,
        localizacao: str = "",
        cnae: str = "",
        max_results: int = 10,
    ) -> Dict[str, Any]:
        """
        Busca empresas por segmento via web scraping inteligente.
        Usa DuckDuckGo para encontrar CNPJs e depois consulta BrasilAPI.
        
        Args:
            segmento: Segmento do negócio
            localizacao: Cidade/Estado
            cnae: Código CNAE (opcional)
            max_results: Máximo de empresas
            
        Returns:
            Dict com empresas encontradas e dados enriquecidos
        """
        from app.core.web_utils import search_duckduckgo
        
        result = {
            "segmento": segmento,
            "localizacao": localizacao,
            "empresas": [],
            "total_found": 0,
            "generated_at": datetime.now().isoformat(),
        }
        
        # Queries para encontrar empresas do setor
        queries = [
            f"{segmento} CNPJ {localizacao} empresas",
            f"empresas de {segmento} {localizacao} lista",
        ]
        
        if cnae:
            queries.append(f"CNAE {cnae} {localizacao} empresas")
        
        found_cnpjs = set()
        
        for query in queries:
            if len(found_cnpjs) >= max_results:
                break
                
            search_results = search_duckduckgo(query, max_results=5, region='br-pt')
            
            for sr in (search_results or []):
                # Extrair CNPJs do snippet
                text = f"{sr.get('title', '')} {sr.get('body', '')}"
                cnpjs_found = re.findall(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}', text)
                
                for cnpj in cnpjs_found:
                    if len(found_cnpjs) < max_results:
                        found_cnpjs.add(cnpj)
        
        # Consultar cada CNPJ encontrado
        if found_cnpjs:
            for cnpj in found_cnpjs:
                company = self.lookup(cnpj)
                if "error" not in company:
                    result["empresas"].append(company)
        
        result["total_found"] = len(result["empresas"])
        
        print(f"  🏢 Empresas encontradas: {result['total_found']}", file=sys.stderr)
        
        return result
    
    def _format_company_data(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Formata dados brutos do BrasilAPI em formato limpo e útil."""
        
        capital = raw.get("capital_social", 0) or 0
        
        # Classificar porte
        porte_label = "Desconhecido"
        for min_val, max_val, label in _PORTE_RANGES:
            if min_val <= capital < max_val:
                porte_label = label
                break
        
        # Extrair sócios (QSA)
        socios = []
        for socio in (raw.get("qsa") or []):
            socios.append({
                "nome": socio.get("nome_socio", ""),
                "qualificacao": socio.get("qualificacao_socio", ""),
            })
        
        # Extrair CNAEs secundários
        cnaes = []
        for cnae in (raw.get("cnaes_secundarios") or []):
            if cnae.get("codigo") and cnae.get("codigo") != 0:
                cnaes.append({
                    "codigo": cnae.get("codigo"),
                    "descricao": cnae.get("descricao", ""),
                })
        
        return {
            "cnpj": raw.get("cnpj", ""),
            "razao_social": raw.get("razao_social", ""),
            "nome_fantasia": raw.get("nome_fantasia", ""),
            "situacao": raw.get("descricao_situacao_cadastral", ""),
            
            # Localização
            "uf": raw.get("uf", ""),
            "municipio": raw.get("municipio", ""),
            "bairro": raw.get("bairro", ""),
            "logradouro": raw.get("logradouro", ""),
            "cep": raw.get("cep", ""),
            
            # Atividade
            "cnae_principal": raw.get("cnae_fiscal", ""),
            "cnae_descricao": raw.get("cnae_fiscal_descricao", ""),
            "cnaes_secundarios": cnaes[:5],  # Top 5
            
            # Porte e financeiro
            "porte": raw.get("porte", ""),
            "porte_classificacao": porte_label,
            "capital_social": capital,
            "capital_social_formatado": f"R$ {capital:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "natureza_juridica": raw.get("natureza_juridica", ""),
            
            # Contato
            "telefone_1": raw.get("ddd_telefone_1", ""),
            "telefone_2": raw.get("ddd_telefone_2", ""),
            "email": raw.get("email", ""),
            
            # Dados temporais
            "data_inicio": raw.get("data_inicio_atividade", ""),
            "data_situacao": raw.get("data_situacao_cadastral", ""),
            
            # Sócios
            "socios": socios[:5],  # Top 5
            
            # Flags úteis para prospecção
            "is_ativa": raw.get("descricao_situacao_cadastral", "").upper() == "ATIVA",
            "is_matriz": raw.get("identificador_matriz_filial", 0) == 1,
            "opcao_simples": raw.get("opcao_pelo_simples", None),
            "opcao_mei": raw.get("opcao_pelo_mei", None),
        }
    
    def enrich_lead(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enriquece dados de um lead com informações adicionais.
        Adiciona score de potencial, classificação, etc.
        """
        enriched = dict(company_data)
        
        # Score de potencial (0-100)
        score = 50  # Base
        
        capital = company_data.get("capital_social", 0) or 0
        if capital > 5_000_000:
            score += 20
        elif capital > 500_000:
            score += 10
        elif capital > 50_000:
            score += 5
        
        # Empresa ativa
        if company_data.get("is_ativa"):
            score += 10
        else:
            score -= 30
        
        # Matriz (vs filial)
        if company_data.get("is_matriz"):
            score += 5
        
        # Tem telefone
        if company_data.get("telefone_1"):
            score += 5
        
        # Tem email
        if company_data.get("email"):
            score += 5
        
        # Tem sócios identificados
        if company_data.get("socios"):
            score += 5
        
        enriched["lead_score"] = min(100, max(0, score))
        enriched["lead_classification"] = (
            "hot" if score >= 75 else
            "warm" if score >= 50 else
            "cold"
        )
        
        return enriched


# Instância global
cnpj_service = CNPJService()
