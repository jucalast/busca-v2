"""
Schema definitions for Pilar 2: Branding e Posicionamento.
Focus: Pure technical positioning - "How do we differentiate technically?"
"""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

from ..base_schema import BasePillarSchema, BasePosicionamentoSchema


class PosicionamentoTecnico(BaseModel):
    """Core technical positioning elements."""
    
    declaracao_diferencial: str = Field(..., description="Como nossa tecnologia resolve as dores mapeadas")
    proposta_valor_tecnica: str = Field(..., description="Benefício técnico exclusivo para cada indústria")
    vantagem_competitiva: str = Field(..., description="O que nos torna únicos tecnicamente")
    promessa_tecnica: str = Field(..., description="Compromisso técnico com cada setor")


class PosicionamentoPorIndustria(BasePosicionamentoSchema):
    """Industry-specific technical positioning."""
    
    # Inherits all fields from BasePosicionamentoSchema
    pass


class AnaliseTecnicaConcorrente(BaseModel):
    """Technical analysis of competitors."""
    
    concorrente: str = Field(..., description="Nome do concorrente")
    pontos_fortes_tecnicos: List[str] = Field(default_factory=list, description="Pontos técnicos fortes")
    vulnerabilidades_tecnicas: List[str] = Field(default_factory=list, description="Fraquezas técnicas")
    oportunidade_diferencial: str = Field(..., description="Como superar tecnicamente")


class PosicionamentoMercado(BaseModel):
    """Market positioning overview."""
    
    segmento_foco: str = Field(..., description="Onde atuamos tecnicamente")
    nivel_tecnologico: str = Field(..., description="Básico/Intermediário/Avançado")
    diferencial_escala: str = Field(..., description="Como escalamos nossa solução técnica")


class BrandingSchema(BasePillarSchema):
    """
    Schema for Pilar 2: Branding e Posicionamento
    
    STRICT SCOPE: Pure technical positioning only
    FORBIDDEN: Sales scripts, communication strategies, visual elements
    FOCUS: "How do we differentiate technically?"
    """
    
    posicionamento_tecnico: PosicionamentoTecnico = Field(
        ..., 
        description="Core technical positioning and value proposition"
    )
    posicionamentos_por_industria: List[PosicionamentoPorIndustria] = Field(
        default_factory=list,
        description="Industry-specific technical positioning"
    )
    analise_tecnica_concorrentes: List[AnaliseTecnicaConcorrente] = Field(
        default_factory=list,
        description="Technical analysis of competitor strengths/weaknesses"
    )
    posicionamento_mercado: PosicionamentoMercado = Field(
        ..., 
        description="Market positioning and technology level"
    )


# Schema definition for pillar configuration
BRANDING_SCHEMA = {
    "posicionamento_tecnico": {
        "declaracao_diferencial": "Como nossa tecnologia resolve as dores mapeadas",
        "proposta_valor_tecnica": "Benefício técnico exclusivo para cada indústria",
        "vantagem_competitiva": "O que nos torna únicos tecnicamente",
        "promessa_tecnica": "Compromisso técnico com cada setor"
    },
    "posicionamentos_por_industria": [
        {
            "industria": "Indústria Moveleira",
            "diferencial_tecnico": "Solução técnica específica para este setor",
            "proposta_valor_setorial": "Benefício técnico direto para as dores desta indústria",
            "vantagens_vs_concorrentes": ["Vantagem 1", "Vantagem 2"],
            "promessa_setorial": "Compromisso técnico específico"
        }
    ],
    "analise_tecnica_concorrentes": [
        {
            "concorrente": "Nome do concorrente",
            "pontos_fortes_tecnicos": ["Ponto técnico 1"],
            "vulnerabilidades_tecnicas": ["Fraqueza técnica 1"],
            "oportunidade_diferencial": "Como superar tecnicamente"
        }
    ],
    "posicionamento_mercado": {
        "segmento_foco": "Onde atuamos tecnicamente",
        "nivel_tecnologico": "Básico/Intermediário/Avançado",
        "diferencial_escala": "Como escalamos nossa solução técnica"
    }
}


def validate_branding_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate branding data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, BrandingSchema)


def get_branding_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(BRANDING_SCHEMA)
