"""
Centralized pillar configuration.
Replaces hardcoded PILLARS dictionary with maintainable configuration.
"""

from typing import Dict, List, Any
from ..schemas.pillars.publico_alvo import PUBLICO_ALVO_SCHEMA
from ..schemas.pillars.branding import BRANDING_SCHEMA
from ..schemas.pillars.identidade_visual import IDENTIDADE_VISUAL_SCHEMA
from ..schemas.pillars.canais_venda import CANAIS_VENDA_SCHEMA
from ..schemas.pillars.trafego_organico import TRAFEGO_ORGANICO_SCHEMA
from ..schemas.pillars.trafego_pago import TRAFEGO_PAGO_SCHEMA
from ..schemas.pillars.processo_vendas import PROCESSO_VENDAS_SCHEMA


class PillarConfig:
    """Centralized configuration for all pillars."""
    
    # Pillar definitions with clean separation of concerns
    PILLARS = {
        "publico_alvo": {
            "label": "Público-Alvo e Personas",
            "ordem": 1,
            "upstream": [],
            "scope": "MAPEAMENTO PURO - Quem é o alvo e o que ele sofre?",
            "forbidden": ["scripts", "vendas", "diferencial", "proposta_valor", "estratégia_marketing", "SEO", "email_marketing", "anúncios", "tráfego", "campanha", "conteúdo_digital", "identidade_visual", "posicionamento", "canais_venda"],
            "output_schema": PUBLICO_ALVO_SCHEMA,
            "search_queries_template": [
                "{segmento} perfil cliente ideal quem compra",
                "{segmento} {localizacao} público-alvo personas",
                "{segmento} comportamento consumidor tendências 2025",
            ],
        },
        "branding": {
            "label": "Branding e Posicionamento",
            "ordem": 2,
            "upstream": ["publico_alvo"],
            "scope": "POSICIONAMENTO TÉCNICO PURO - Como nos diferenciamos tecnicamente?",
            "forbidden": ["scripts", "comunicação", "visual", "vendas"],
            "output_schema": BRANDING_SCHEMA,
            "search_queries_template": [
                "{segmento} {localizacao} concorrentes principais",
                "{segmento} posicionamento marca diferencial",
                "{segmento} proposta de valor cases sucesso",
            ],
        },
        "identidade_visual": {
            "label": "Identidade Visual",
            "ordem": 3,
            "upstream": ["publico_alvo", "branding"],
            "scope": "DIRETRIZES VISUAIS PURAS - Como nos parecemos visualmente?",
            "forbidden": ["estratégia", "marketing", "vendas", "conteúdo"],
            "output_schema": IDENTIDADE_VISUAL_SCHEMA,
            "search_queries_template": [
                "{segmento} identidade visual tendências 2025",
                "{segmento} design marca exemplos",
            ],
        },
        "canais_venda": {
            "label": "Canais de Venda",
            "ordem": 4,
            "upstream": ["publico_alvo", "branding"],
            "scope": "MAPEAMENTO DE CANAIS PURO - Onde vendemos e como chegamos ao cliente?",
            "forbidden": ["conversão", "fechamento", "scripts", "estratégias"],
            "output_schema": CANAIS_VENDA_SCHEMA,
            "search_queries_template": [
                "{segmento} canais de venda mais eficientes",
                "{segmento} {localizacao} como vender mais onde encontrar clientes",
                "{segmento} marketplace ecommerce canais digitais",
            ],
        },
        "trafego_organico": {
            "label": "Tráfego Orgânico",
            "ordem": 5,
            "upstream": ["publico_alvo", "branding", "identidade_visual"],
            "scope": "SEO E CONTEÚDO PURO - Como nos encontram organicamente?",
            "forbidden": ["anúncios", "pagos", "scripts", "vendas"],
            "output_schema": TRAFEGO_ORGANICO_SCHEMA,
            "search_queries_template": [
                "{segmento} SEO local como aparecer Google",
                "{segmento} marketing conteúdo orgânico redes sociais estratégia",
                "{segmento} Google Meu Negócio otimização",
            ],
        },
        "trafego_pago": {
            "label": "Tráfego Pago",
            "ordem": 6,
            "upstream": ["publico_alvo", "branding", "identidade_visual", "canais_venda"],
            "scope": "MÍDIA PAGA PURA - Como compramos atenção?",
            "forbidden": ["fechamento", "scripts", "vendas", "conversão"],
            "output_schema": TRAFEGO_PAGO_SCHEMA,
            "search_queries_template": [
                "{segmento} Meta Ads Google Ads estratégia anúncios",
                "{segmento} custo aquisição cliente anúncios pagos ROI",
            ],
        },
        "processo_vendas": {
            "label": "Processo de Vendas",
            "ordem": 7,
            "upstream": ["publico_alvo", "canais_venda", "trafego_organico", "trafego_pago"],
            "scope": "ESTRATÉGIAS DE VENDAS - Como vendemos e fechamos? (ÚNICO com scripts)",
            "forbidden": [],  # Este pilar TEM scripts e estratégias
            "output_schema": PROCESSO_VENDAS_SCHEMA,
            "search_queries_template": [
                "{segmento} processo vendas funil conversão",
                "{segmento} precificação margem lucro ticket médio",
                "{segmento} scripts vendas contorno objeções",
            ],
        },
    }
    
    @classmethod
    def get_pillar_order(cls) -> List[str]:
        """Get pillars in execution order."""
        return sorted(cls.PILLARS.keys(), key=lambda k: cls.PILLARS[k]["ordem"])
    
    @classmethod
    def get_pillar_config(cls, pillar_key: str) -> Dict[str, Any]:
        """Get configuration for a specific pillar."""
        if pillar_key not in cls.PILLARS:
            raise ValueError(f"Pillar '{pillar_key}' not found in configuration")
        return cls.PILLARS[pillar_key]
    
    @classmethod
    def get_upstream_pillars(cls, pillar_key: str) -> List[str]:
        """Get list of upstream pillars for a given pillar."""
        return cls.PILLARS[pillar_key]["upstream"]
    
    @classmethod
    def validate_scope_compliance(cls, pillar_key: str, data: Dict[str, Any]) -> bool:
        """Validate that pillar output complies with its defined scope."""
        config = cls.get_pillar_config(pillar_key)
        forbidden_fields = config.get("forbidden", [])
        
        data_str = str(data).lower()
        for forbidden in forbidden_fields:
            if forbidden in data_str:
                return False
        return True
    
    @classmethod
    def get_scope_instructions(cls, pillar_key: str) -> str:
        """Get scope instructions for a pillar."""
        config = cls.get_pillar_config(pillar_key)
        return config.get("scope", "")
