"""
Context extraction service for structured chain context passing.
Replaces inline context extraction with clean, testable service.
"""

import json
from typing import Dict, List, Any, Optional
from functools import lru_cache

from app.exceptions.pillar_exceptions import ContextExtractionError


class ContextExtractionService:
    """
    Service for extracting structured context from pillar outputs.
    
    Replaces the inline _extract_structured_context function with
    a clean, testable, and cacheable service.
    """
    
    @staticmethod
    def extract_context(up_output: Dict[str, Any], pillar_key: str) -> Dict[str, Any]:
        """
        Extract only primary keys from upstream pillar output for structured context passing.
        This prevents "Persona Frankenstein" by passing clean JSON instead of text summaries.
        """
        try:
            if pillar_key == "publico_alvo":
                return ContextExtractionService._extract_publico_alvo_context(up_output)
            elif pillar_key == "branding":
                return ContextExtractionService._extract_branding_context(up_output)
            elif pillar_key == "identidade_visual":
                return ContextExtractionService._extract_identidade_visual_context(up_output)
            elif pillar_key == "canais_venda":
                return ContextExtractionService._extract_canais_venda_context(up_output)
            elif pillar_key == "trafego_organico":
                return ContextExtractionService._extract_trafego_organico_context(up_output)
            elif pillar_key == "trafego_pago":
                return ContextExtractionService._extract_trafego_pago_context(up_output)
            else:
                return ContextExtractionService._extract_default_context(up_output)
                
        except Exception as e:
            raise ContextExtractionError(f"Failed to extract context for pillar '{pillar_key}': {str(e)}")
    
    @staticmethod
    def _extract_publico_alvo_context(up_output: Dict[str, Any]) -> Dict[str, Any]:
        """Extract context from público-alvo pillar - FOCADO EM MAPEAMENTO PURO."""
        segmentos = up_output.get("segmentos_mapeados", [])
        if not segmentos:
            return ContextExtractionService._empty_publico_alvo_context()
        
        industrias = []
        cargos_decisores = []
        dores_por_industria = {}
        
        for segmento in segmentos:
            industria = segmento.get("segmento_industrial", "")
            cargo = segmento.get("cargo_decisor", "")
            dores = segmento.get("dores_operacionais", [])
            
            if industria:
                industrias.append(industria)
            if cargo:
                cargos_decisores.append(cargo)
            if industria and dores:
                dores_por_industria[industria] = dores
        
        return {
            "industrias_alvo": industrias,
            "cargos_decisores": list(set(cargos_decisores)),  # Remove duplicates
            "dores_por_industria": dores_por_industria,
            "segmentos_count": len(segmentos),
            "perfil_mercado": up_output.get("perfil_geral_mercado", {})
        }
    
    @staticmethod
    def _extract_branding_context(up_output: Dict[str, Any]) -> Dict[str, Any]:
        """Extract context from branding pillar - POSICIONAMENTO TÉCNICO PURO."""
        posicoes_industria = up_output.get("posicionamentos_por_industria", [])
        posicionamento_tecnico = up_output.get("posicionamento_tecnico", {})
        
        return {
            "industrias_posicionamentos": [p.get("industria") for p in posicoes_industria if p.get("industria")],
            "proposta_valor_tecnica": posicionamento_tecnico.get("proposta_valor_tecnica", ""),
            "vantagem_competitiva": posicionamento_tecnico.get("vantagem_competitiva", ""),
            "promessa_tecnica": posicionamento_tecnico.get("promessa_tecnica", "")
        }
    
    @staticmethod
    def _extract_identidade_visual_context(up_output: Dict[str, Any]) -> Dict[str, Any]:
        """Extract context from identidade_visual pillar - DIRETRIZES VISUAIS PURAS."""
        sistema_visual = up_output.get("sistema_visual", {})
        aplicacoes_industria = up_output.get("aplicacoes_por_industria", [])
        
        return {
            "estilo_principal": sistema_visual.get("estilo_principal", ""),
            "paleta_cores_primaria": sistema_visual.get("paleta_cores_primaria", []),
            "conceito_visual": sistema_visual.get("conceito_visual", ""),
            "industrias_aplicacoes": [a.get("industria") for a in aplicacoes_industria if a.get("industria")]
        }
    
    @staticmethod
    def _extract_canais_venda_context(up_output: Dict[str, Any]) -> Dict[str, Any]:
        """Extract context from canais_venda pillar - MAPEAMENTO DE CANAIS PURO."""
        canais_industria = up_output.get("canais_por_industria", [])
        mapeamento_canais = up_output.get("mapeamento_canais", {})
        
        return {
            "industrias_canais": [c.get("industria") for c in canais_industria if c.get("industria")],
            "cargos_decisores_por_industria": {
                c.get("industria"): c.get("cargos_decisor_alvo", []) 
                for c in canais_industria if c.get("industria")
            },
            "canais_efetivos": [
                canal["canal"] 
                for c in canais_industria 
                for canal in c.get("canais_efetivos", [])
            ],
            "canais_existentes": [
                c.get("canal") 
                for c in mapeamento_canais.get("canais_existentes", [])
            ]
        }
    
    @staticmethod
    def _extract_trafego_organico_context(up_output: Dict[str, Any]) -> Dict[str, Any]:
        """Extract context from trafego_organico pillar - SEO E CONTEÚDO PURO."""
        otimizacao_busca = up_output.get("otimizacao_busca", {})
        plataformas_organicas = up_output.get("plataformas_organicas", {})
        
        return {
            "keywords_setoriais": {
                kw.get("industria"): kw.get("keywords_primarias", []) 
                for kw in otimizacao_busca.get("palavras_chave_setoriais", [])
            },
            "plataformas_prioritarias": [
                p.get("plataforma") 
                for p in plataformas_organicas.get("redes_prioritarias", [])
            ],
            "google_meu_negocio_status": otimizacao_busca.get("google_meu_negocio", {}).get("status_atual", ""),
            "pilares_conteudo": [
                p.get("pilar") 
                for p in up_output.get("ecosistema_conteudo", {}).get("pilares_estrategicos", [])
            ]
        }
    
    @staticmethod
    def _extract_trafego_pago_context(up_output: Dict[str, Any]) -> Dict[str, Any]:
        """Extract context from trafego_pago pillar - MÍDIA PAGA PURA."""
        plataformas_midia = up_output.get("plataformas_midia", {})
        estrutura_campanhas = up_output.get("estrutura_campanhas", {})
        
        return {
            "plataformas_principais": [
                p.get("plataforma") 
                for p in plataformas_midia.get("plataformas_principais", [])
            ],
            "plataformas_alinhamento": {
                p.get("plataforma"): p.get("alinhamento_setorial", []) 
                for p in plataformas_midia.get("plataformas_principais", [])
            },
            "orcamento_total": estrutura_campanhas.get("orcamento_distribuicao", {}).get("orcamento_total_sugerido", ""),
            "campanhas_por_industria": {
                c.get("industria"): c.get("campanhas_principais", []) 
                for c in estrutura_campanhas.get("campanhas_por_industria", [])
            }
        }
    
    @staticmethod
    def _extract_default_context(up_output: Dict[str, Any]) -> Dict[str, Any]:
        """Default context extraction for unknown pillars."""
        return {"output_keys": list(up_output.keys())}
    
    @staticmethod
    def _empty_publico_alvo_context() -> Dict[str, Any]:
        """Empty context for público-alvo when no segments found."""
        return {
            "industrias_alvo": [],
            "cargos_decisores": [],
            "dores_por_industria": {},
            "segmentos_count": 0,
            "perfil_mercado": {}
        }
    
    @staticmethod
    def clear_cache():
        """Clear the context extraction cache."""
        ContextExtractionService.extract_context.cache_clear()


# Convenience function for backward compatibility
def extract_structured_context(up_output: Dict[str, Any], pillar_key: str) -> Dict[str, Any]:
    """
    Backward compatibility function.
    
    This function maintains the same interface as the original _extract_structured_context
    but uses the new service-based implementation.
    """
    import hashlib
    import json
    
    # Create hash for caching
    output_str = json.dumps(up_output, sort_keys=True)
    output_hash = hashlib.md5(output_str.encode()).hexdigest()
    
    return ContextExtractionService.extract_context(up_output, pillar_key)
