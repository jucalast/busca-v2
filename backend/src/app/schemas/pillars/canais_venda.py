"""
Schema definitions for Pilar 4: Canais de Venda.
Focus: Pure channel mapping - "Where do we sell and how do we reach customers?"
"""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

from ..base_schema import BasePillarSchema


class CanalExistente(BaseModel):
    """Existing channel information."""
    
    canal: str = Field(..., description="Nome do canal atual")
    tipo: str = Field(..., description="Direto/Indireto/Digital/Presencial")
    status_operacional: str = Field(..., description="Ativo/Inativo/Piloto")
    performance_atual: str = Field(..., description="Descrição objetiva do desempenho")


class MapeamentoCanais(BaseModel):
    """Channel mapping and coverage."""
    
    canais_existentes: List[CanalExistente] = Field(default_factory=list, description="Existing channels")
    cobertura_geografica: str = Field(..., description="Onde os canais atuais cobrem")
    gaps_identificados: List[str] = Field(default_factory=list, description="Gaps na cobertura")


class CanalEfetivo(BaseModel):
    """Effective channel for specific industry."""
    
    canal: str = Field(..., description="Nome do canal")
    razao_efetividade: str = Field(..., description="Por que funciona para este cargo/setor")
    frequencia_contato: str = Field(..., description="Diário/Semanal/Mensal")
    formato_interacao: str = Field(..., description="Presencial/Digital/Híbrido")


class CanaisPorIndustria(BaseModel):
    """Industry-specific channel mapping."""
    
    industria: str = Field(..., description="Nome da indústria")
    cargos_decisor_alvo: List[str] = Field(default_factory=list, description="Cargos que tomam decisão")
    canais_efetivos: List[CanalEfetivo] = Field(default_factory=list, description="Canais efetivos")
    canais_evitar: List[str] = Field(default_factory=list, description="Canais que não funcionam")


class OportunidadeExpansao(BaseModel):
    """Expansion opportunity."""
    
    canal_potencial: str = Field(..., description="Novo canal identificado")
    justificativa_mercado: str = Field(..., description="Por que tem potencial")
    requisitos_implementacao: List[str] = Field(default_factory=list, description="Requisitos para implementação")
    alinhamento_setorial: List[str] = Field(default_factory=list, description="Setores alinhados")


class AnaliseCompetitivaCanais(BaseModel):
    """Competitive channel analysis."""
    
    concorrente: str = Field(..., description="Nome do concorrente")
    canais_utilizados: List[str] = Field(default_factory=list, description="Canais que o concorrente usa")
    vulnerabilidades: List[str] = Field(default_factory=list, description="Onde podemos superar")


class CanaisVendaSchema(BasePillarSchema):
    """
    Schema for Pilar 4: Canais de Venda
    
    STRICT SCOPE: Pure channel mapping only
    FORBIDDEN: Sales strategies, conversion tactics, closing scripts
    FOCUS: "Where do we sell and how do we reach customers?"
    """
    
    mapeamento_canais: MapeamentoCanais = Field(..., description="Current channel mapping")
    canais_por_industria: List[CanaisPorIndustria] = Field(default_factory=list, description="Industry-specific channels")
    oportunidades_expansao: List[OportunidadeExpansao] = Field(default_factory=list, description="Expansion opportunities")
    analise_competitiva_canais: List[AnaliseCompetitivaCanais] = Field(default_factory=list, description="Competitive analysis")


# Schema definition for pillar configuration
CANAIS_VENDA_SCHEMA = {
    "mapeamento_canais": {
        "canais_existentes": [
            {
                "canal": "Nome do canal atual",
                "tipo": "Direto/Indireto/Digital/Presencial",
                "status_operacional": "Ativo/Inativo/Piloto",
                "performance_atual": "Descrição objetiva do desempenho"
            }
        ],
        "cobertura_geografica": "Onde os canais atuais cobrem",
        "gaps_identificados": ["Gap 1", "Gap 2"]
    },
    "canais_por_industria": [
        {
            "industria": "Indústria Moveleira",
            "cargos_decisor_alvo": ["Gerente de Logística", "Comprador"],
            "canais_efetivos": [
                {
                    "canal": "Nome do canal",
                    "razao_efetividade": "Por que funciona para este cargo/setor",
                    "frequencia_contato": "Diário/Semanal/Mensal",
                    "formato_interacao": "Presencial/Digital/Híbrido"
                }
            ],
            "canais_evitar": ["Canal que não funciona para este setor"]
        }
    ],
    "oportunidades_expansao": [
        {
            "canal_potencial": "Novo canal identificado",
            "justificativa_mercado": "Por que tem potencial",
            "requisitos_implementacao": ["Requisito 1", "Requisito 2"],
            "alinhamento_setorial": ["Setor 1", "Setor 2"]
        }
    ],
    "analise_competitiva_canais": [
        {
            "concorrente": "Nome do concorrente",
            "canais_utilizados": ["Canal 1", "Canal 2"],
            "vulnerabilidades": ["Onde podemos superar"]
        }
    ]
}


def validate_canais_venda_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate canais venda data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, CanaisVendaSchema)


def get_canais_venda_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(CANAIS_VENDA_SCHEMA)
