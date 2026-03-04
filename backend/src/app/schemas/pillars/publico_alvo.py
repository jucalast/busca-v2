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


# ═══════════════════════════════════════════════════════════════════
# MELHORIA: Schema específico para negócios B2B
# ═══════════════════════════════════════════════════════════════════

PUBLICO_ALVO_SCHEMA_B2B = {
    "segmentos_mapeados": [
        {
            "segmento_industrial": "Nome do segmento industrial específico",
            "volume_estimado_mercado": "Estimativa de volume do mercado",
            "cargo_decisor_primario": "Cargo do decisor principal (ex: Gerente de Compras)",
            "cargo_influenciador": "Cargo do influenciador técnico (ex: Engenheiro de Produção)",
            "cargo_aprovador_final": "Cargo do aprovador final (ex: Diretor Industrial)",
            "dores_operacionais": [
                "Dor específica 1 relacionada a operações",
                "Dor específica 2 relacionada a custos",
                "Dor específica 3 relacionada a qualidade"
            ],
            "gatilhos_de_compra": [
                "Evento que dispara necessidade de compra",
                "Sazonalidade ou ciclo de demanda",
                "Mudança regulatória ou de mercado"
            ],
            "criterios_de_homologacao": [
                "Capacidade produtiva mínima",
                "Certificações exigidas",
                "Prazo de entrega esperado",
                "Condições comerciais exigidas"
            ],
            "ciclo_venda_mapeado": {
                "etapas": ["Prospecção", "Qualificação técnica", "Amostra/Teste", "Negociação comercial", "Fechamento"],
                "tempo_medio_total": "60-90 dias",
                "gargalos_identificados": ["Amostragem lenta", "Aprovação de crédito"]
            },
            "objecoes_mais_comuns": [
                "Objeção 1 e como contornar",
                "Objeção 2 e como contornar"
            ],
            "concorrentes_neste_segmento": [
                "Concorrente A (ponto forte: X, fraco: Y)",
                "Concorrente B (ponto forte: X, fraco: Y)"
            ]
        }
    ],
    "perfil_geral_mercado": {
        "descricao": "Descrição detalhada do mercado B2B atendido",
        "ticket_medio_tipico": "Faixa de ticket médio (ex: R$ 15.000 - R$ 50.000)",
        "ciclo_compra_medio": "Tempo médio do ciclo de compra",
        "concentracao_geografica": ["Região 1", "Região 2"],
        "sazonalidade": "Meses de pico e baixa demanda",
        "tendencias_mercado": ["Tendência 1", "Tendência 2"]
    },
    "matriz_decisores": {
        "decisor_economico": "Quem aprova o orçamento",
        "decisor_tecnico": "Quem avalia especificações",
        "usuario_final": "Quem efetivamente usa o produto",
        "influenciadores_internos": ["Departamento 1", "Departamento 2"],
        "bloqueadores_potenciais": ["Quem pode vetar a compra e por quê"]
    },
    "insights_comportamento_b2b": [
        "Insight sobre processo decisório B2B",
        "Insight sobre relacionamento com fornecedores",
        "Insight sobre sensibilidade a preço vs qualidade"
    ]
}


def get_schema_by_model(business_model: str) -> dict:
    """Retorna o schema apropriado baseado no modelo de negócio."""
    if business_model and business_model.lower() in ['b2b', 'industria', 'industrial', 'corporativo']:
        return PUBLICO_ALVO_SCHEMA_B2B
    return PUBLICO_ALVO_SCHEMA


def validate_publico_alvo_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate publico alvo data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, PublicoAlvoSchema)


def get_publico_alvo_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(PUBLICO_ALVO_SCHEMA)
