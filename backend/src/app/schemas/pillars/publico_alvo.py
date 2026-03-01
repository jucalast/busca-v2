"""
Schema definitions for Pilar 1: Público-Alvo e Personas.
Focus: Pure market mapping - "Who is the target and what do they suffer?"
"""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

from ..base_schema import BasePillarSchema, BaseSegmentoSchema


class PerfilGeralMercado(BaseModel):
    """General market profile overview."""
    
    descricao: str = Field(..., description="Visão geral do mercado atendido")
    ticket_medio_tipico: str = Field(..., description="Ticket médio típico do mercado")
    ciclo_compra_medio: str = Field(..., description="Ciclo médio de compra em dias")
    concentracao_geografica: List[str] = Field(default_factory=list, description="Regiões de concentração")


class SegmentoMapeado(BaseSegmentoSchema):
    """Detailed mapping of a specific industry segment."""
    
    # Inherits all fields from BaseSegmentoSchema
    pass


class PublicoAlvoSchema(BasePillarSchema):
    """
    Schema for Pilar 1: Público-Alvo e Personas
    
    STRICT SCOPE: Pure market mapping only
    FORBIDDEN: Sales strategies, scripts, competitive advantages, proposals
    FOCUS: "Who is the target and what do they suffer?"
    """
    
    segmentos_mapeados: List[SegmentoMapeado] = Field(
        default_factory=list,
        description="Array of mapped industry segments with decision makers and pains"
    )
    perfil_geral_mercado: PerfilGeralMercado = Field(
        ..., 
        description="General market overview and characteristics"
    )
    insights_comportamento: List[str] = Field(
        default_factory=list,
        description="Behavioral insights about purchase decisions"
    )


# Schema definition for pillar configuration
PUBLICO_ALVO_SCHEMA = {
    "segmentos_mapeados": [
        {
            "segmento_industrial": "Indústria Moveleira",
            "cargo_decisor": "Gerente de Logística",
            "dores_operacionais": [
                "Caixas de papelão que cedem no empilhamento",
                "Avarias no transporte",
                "Gestão complexa de múltiplos fornecedores"
            ],
            "criterios_de_homologacao": [
                "Capacidade produtiva",
                "Certificações ISO 9001",
                "Prazo de entrega < 48h",
                "Condicões de pagamento"
            ],
            "concorrentes_identificados": [
                "Embraembalagens Sul",
                "PackCenter",
                "Logística Total"
            ]
        }
    ],
    "perfil_geral_mercado": {
        "descricao": "Mercado B2B industrial com necessidade de embalagens customizadas",
        "ticket_medio_típico": "R$ 15.000 - R$ 50.000",
        "ciclo_compra_medio": "45-90 dias",
        "concentracao_geografica": ["Sudeste", "Sul", "Nordeste"]
    },
    "insights_comportamento": [
        "Decisões baseadas em confiança e histórico do fornecedor",
        "Preferência por fornecedores locais com capacidade técnica",
        "Sensibilidade a prazos mas qualidade é fator decisivo"
    ]
}


def validate_publico_alvo_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate publico alvo data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, PublicoAlvoSchema)


def get_publico_alvo_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(PUBLICO_ALVO_SCHEMA)
