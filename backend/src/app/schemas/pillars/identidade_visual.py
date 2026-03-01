"""
Schema definitions for Pilar 3: Identidade Visual.
Focus: Pure visual guidelines - "How do we look visually?"
"""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

from ..base_schema import BasePillarSchema


class SistemaVisual(BaseModel):
    """Core visual system elements."""
    
    estilo_principal: str = Field(..., description="Tecnológico/Industrial/Moderno/etc")
    conceito_visual: str = Field(..., description="Conceito central que representa o diferencial técnico")
    paleta_cores_primaria: List[str] = Field(default_factory=list, description="Cores primárias em hex")
    paleta_cores_secundaria: List[str] = Field(default_factory=list, description="Cores secundárias em hex")
    tipografia_sistema: Dict[str, str] = Field(default_factory=dict, description="Sistema tipográfico")


class ElementosVisuais(BaseModel):
    """Visual elements and applications."""
    
    logo_conceito: str = Field(..., description="Conceito para logo baseado no diferencial técnico")
    iconografia_sistema: str = Field(..., description="Estilo de ícones que representa a tecnologia")
    imagens_corporativas: str = Field(..., description="Estilo de imagens que reforçam o posicionamento")
    elementos_graficos: List[str] = Field(default_factory=list, description="Elementos gráficos distintivos")


class AplicacoesPorIndustria(BaseModel):
    """Industry-specific visual applications."""
    
    industria: str = Field(..., description="Nome da indústria")
    adaptacoes_visuais: List[str] = Field(default_factory=list, description="Adaptações visuais específicas")
    cores_especificas: List[str] = Field(default_factory=list, description="Cores específicas para o setor")
    imagens_setoriais: List[str] = Field(default_factory=list, description="Tipos de imagens setoriais")


class GuidelinesImplementacao(BaseModel):
    """Implementation guidelines."""
    
    consistencia_marca: str = Field(..., description="Regras para manter coerência visual")
    flexibilidade_setorial: str = Field(..., description="Como adaptar para cada indústria")
    restricoes_visuais: List[str] = Field(default_factory=list, description="O que evitar visualmente")


class IdentidadeVisualSchema(BasePillarSchema):
    """
    Schema for Pilar 3: Identidade Visual
    
    STRICT SCOPE: Pure visual guidelines only
    FORBIDDEN: Sales strategies, marketing tactics, content creation
    FOCUS: "How do we look visually?"
    """
    
    sistema_visual: SistemaVisual = Field(..., description="Core visual system")
    elementos_visuais: ElementosVisuais = Field(..., description="Visual elements and applications")
    aplicacoes_por_industria: List[AplicacoesPorIndustria] = Field(default_factory=list, description="Industry-specific applications")
    guidelines_implementacao: GuidelinesImplementacao = Field(..., description="Implementation guidelines")


# Schema definition for pillar configuration
IDENTIDADE_VISUAL_SCHEMA = {
    "sistema_visual": {
        "estilo_principal": "Tecnológico/Industrial/Moderno/etc",
        "conceito_visual": "Conceito central que representa o diferencial técnico",
        "paleta_cores_primaria": ["#hex1", "#hex2", "#hex3"],
        "paleta_cores_secundaria": ["#hex4", "#hex5"],
        "tipografia_sistema": {
            "familia_principal": "Fonte para títulos",
            "familia_secundaria": "Fonte para corpo",
            "hierarquia_tipografica": "Estrutura de tamanhos"
        }
    },
    "elementos_visuais": {
        "logo_conceito": "Conceito para logo baseado no diferencial técnico",
        "iconografia_sistema": "Estilo de ícones que representa a tecnologia",
        "imagens_corporativas": "Estilo de imagens que reforçam o posicionamento",
        "elementos_graficos": ["Elemento 1", "Elemento 2"]
    },
    "aplicacoes_por_industria": [
        {
            "industria": "Indústria Moveleira",
            "adaptacoes_visuais": ["Adaptação 1", "Adaptação 2"],
            "cores_especificas": ["#hex1", "#hex2"],
            "imagens_setoriais": ["Tipo de imagem 1"]
        }
    ],
    "guidelines_implementacao": {
        "consistencia_marca": "Regras para manter coerência visual",
        "flexibilidade_setorial": "Como adaptar para cada indústria",
        "restricoes_visuais": ["O que evitar visualmente"]
    }
}


def validate_identidade_visual_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate identidade visual data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, IdentidadeVisualSchema)


def get_identidade_visual_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(IDENTIDADE_VISUAL_SCHEMA)
