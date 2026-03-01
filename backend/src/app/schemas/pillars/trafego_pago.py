"""
Schema definitions for Pilar 6: Tráfego Pago.
Focus: Pure paid media - "How do we buy attention?"
"""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

from ..base_schema import BasePillarSchema


class PlataformaPrincipal(BaseModel):
    """Main paid media platform."""
    
    plataforma: str = Field(..., description="Meta Ads/Google Ads/LinkedIn Ads")
    alinhamento_setorial: List[str] = Field(default_factory=list, description="Setores alinhados")
    formatos_anuncio: List[str] = Field(default_factory=list, description="Formatos de anúncio")
    capacidade_segmentacao: str = Field(..., description="Capacidade de segmentação")


class PlataformasMidia(BaseModel):
    """Paid media platforms configuration."""
    
    plataformas_principais: List[PlataformaPrincipal] = Field(default_factory=list, description="Plataformas principais")
    plataformas_secundarias: List[str] = Field(default_factory=list, description="Plataformas secundárias")
    plataformas_evitar: List[str] = Field(default_factory=list, description="Plataformas a evitar")


class CampanhaPrincipal(BaseModel):
    """Main campaign configuration."""
    
    tipo_campanha: str = Field(..., description="Conscientização/Consideração/Conversão")
    objetivo_principal: str = Field(..., description="Objetivo específico para este setor")
    publicos_alvo: List[str] = Field(default_factory=list, description="Públicos-alvo")
    formatos_prioritarios: List[str] = Field(default_factory=list, description="Formatos prioritários")


class CampanhasPorIndustria(BaseModel):
    """Industry-specific campaigns."""
    
    industria: str = Field(..., description="Nome da indústria")
    campanhas_principais: List[CampanhaPrincipal] = Field(default_factory=list, description="Campanhas principais")


class OrcamentoDistribuicao(BaseModel):
    """Budget distribution."""
    
    orcamento_total_sugerido: str = Field(..., description="Orçamento total sugerido")
    alocacao_por_plataforma: Dict[str, str] = Field(default_factory=dict, description="Alocação por plataforma")
    alocacao_por_industria: Dict[str, str] = Field(default_factory=dict, description="Alocação por indústria")


class EstruturaCampanhas(BaseModel):
    """Campaign structure configuration."""
    
    campanhas_por_industria: List[CampanhasPorIndustria] = Field(default_factory=list, description="Campanhas por indústria")
    orcamento_distribuicao: OrcamentoDistribuicao = Field(..., description="Distribuição de orçamento")


class AudienciaCustomizada(BaseModel):
    """Custom audience configuration."""
    
    plataforma: str = Field(..., description="Plataforma do anúncio")
    nome_audiencia: str = Field(..., description="Nome da audiência")
    criterios_segmentacao: List[str] = Field(default_factory=list, description="Critérios de segmentação")
    alinhamento_cargos: List[str] = Field(default_factory=list, description="Alinhamento com cargos")


class SegmentacaoMirada(BaseModel):
    """Targeted segmentation."""
    
    audiencias_customizadas: List[AudienciaCustomizada] = Field(default_factory=list, description="Audiências customizadas")
    palavras_chave_negativas: List[str] = Field(default_factory=list, description="Palavras-chave negativas")
    exclusions_geograficas: List[str] = Field(default_factory=list, description="Exclusões geográficas")


class MetasPerformance(BaseModel):
    """Performance goals."""
    
    cpa_alvo_setorial: Dict[str, str] = Field(default_factory=dict, description="CPA alvo por setor")
    roas_alvo_setorial: Dict[str, str] = Field(default_factory=dict, description="ROAS alvo por setor")
    periodo_avaliacao: str = Field(..., description="Período de avaliação")


class MetricasPagas(BaseModel):
    """Paid metrics configuration."""
    
    kpis_essenciais: List[str] = Field(default_factory=list, description="KPIs essenciais")
    ferramentas_analise: List[str] = Field(default_factory=list, description="Ferramentas de análise")
    metas_performance: MetasPerformance = Field(..., description="Metas de performance")


class TrafegoPagoSchema(BasePillarSchema):
    """
    Schema for Pilar 6: Tráfego Pago
    
    STRICT SCOPE: Pure paid media only
    FORBIDDEN: Sales scripts, closing tactics, organic strategies
    FOCUS: "How do we buy attention?"
    """
    
    plataformas_midia: PlataformasMidia = Field(..., description="Paid media platforms")
    estrutura_campanhas: EstruturaCampanhas = Field(..., description="Campaign structure")
    segmentacao_mirada: SegmentacaoMirada = Field(..., description="Targeted segmentation")
    metricas_pagas: MetricasPagas = Field(..., description="Paid metrics")


# Schema definition for pillar configuration
TRAFEGO_PAGO_SCHEMA = {
    "plataformas_midia": {
        "plataformas_principais": [
            {
                "plataforma": "Meta Ads/Google Ads/LinkedIn Ads",
                "alinhamento_setorial": ["Setor 1", "Setor 2"],
                "formatos_anuncio": ["Formato 1", "Formato 2"],
                "capacidade_segmentacao": "Descrição da capacidade de segmentação"
            }
        ],
        "plataformas_secundarias": ["Plataforma 1", "Plataforma 2"],
        "plataformas_evitar": ["Plataforma que não funciona"]
    },
    "estrutura_campanhas": {
        "campanhas_por_industria": [
            {
                "industria": "Indústria Moveleira",
                "campanhas_principais": [
                    {
                        "tipo_campanha": "Conscientização/Consideração/Conversão",
                        "objetivo_principal": "Objetivo específico para este setor",
                        "publicos_alvo": ["Público 1", "Público 2"],
                        "formatos_prioritarios": ["Formato 1", "Formato 2"]
                    }
                ]
            }
        ],
        "orcamento_distribuicao": {
            "orcamento_total_sugerido": "R$ X",
            "alocacao_por_plataforma": {"Plataforma": "%"},
            "alocacao_por_industria": {"Indústria": "%"}
        }
    },
    "segmentacao_mirada": {
        "audiencias_customizadas": [
            {
                "plataforma": "Meta Ads",
                "nome_audiencia": "Nome da audiência",
                "criterios_segmentacao": ["Critério 1", "Critério 2"],
                "alinhamento_cargos": ["Cargo 1", "Cargo 2"]
            }
        ],
        "palavras_chave_negativas": ["Palavra 1", "Palavra 2"],
        "exclusions_geograficas": ["Região 1", "Região 2"]
    },
    "metricas_pagas": {
        "kpis_essenciais": ["CPA", "ROAS", "CPC", "Taxa conversão"],
        "ferramentas_analise": ["Ferramenta 1", "Ferramenta 2"],
        "metas_performance": {
            "cpa_alvo_setorial": {"Indústria": "R$ X"},
            "roas_alvo_setorial": {"Indústria": "X:1"},
            "periodo_avaliacao": "90 dias"
        }
    }
}


def validate_trafego_pago_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate trafego pago data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, TrafegoPagoSchema)


def get_trafego_pago_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(TRAFEGO_PAGO_SCHEMA)
