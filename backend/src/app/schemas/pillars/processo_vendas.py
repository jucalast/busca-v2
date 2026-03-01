"""
Schema definitions for Pilar 7: Processo de Vendas.
Focus: Sales strategies and execution - "How do we sell and close?"
"""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

from ..base_schema import BasePillarSchema


class EtapaFunil(BaseModel):
    """Funnel stage definition."""
    
    etapa: str = Field(..., description="Descoberta/Qualificação/Apresentação/Negociação/Fechamento")
    atividades_principais: List[str] = Field(default_factory=list, description="Atividades principais desta etapa")
    taxa_conversao_esperada: str = Field(..., description="Taxa de conversão esperada em %")
    tempo_medio_etapa: str = Field(..., description="Tempo médio em dias")
    responsavel: str = Field(..., description="Vendedor/SDR/Gerente")


class ScriptAbordagem(BaseModel):
    """Sales approach script."""
    
    situacao: str = Field(..., description="Primeiro contato telefônico/WhatsApp/Email")
    script_completo: str = Field(..., description="Script detalhado com abertura, qualificação e agendamento")
    elementos_diferencial: List[str] = Field(default_factory=list, description="Como usar o diferencial técnico do Pilar 2")
    gatilhos_psicologicos: List[str] = Field(default_factory=list, description="Gatilhos psicológicos para persuasão")


class QuebraObjecoes(BaseModel):
    """Objection handling techniques."""
    
    objecao_comum: str = Field(..., description="Objeção mais comum")
    tecnica_resposta: str = Field(..., description="Técnica específica de resposta")
    argumento_diferencial: str = Field(..., description="Como o diferencial técnico justifica o preço")
    alternativa_fechamento: str = Field(..., description="Opção de fechamento alternativa")


class ScriptPorIndustria(BaseModel):
    """Industry-specific sales scripts."""
    
    industria: str = Field(..., description="Nome da indústria")
    cargo_alvo: str = Field(..., description="Cargo do decisor")
    scripts_abordagem: List[ScriptAbordagem] = Field(default_factory=list, description="Scripts de abordagem")
    quebra_objecoes: List[QuebraObjecoes] = Field(default_factory=list, description="Técnicas de quebra de objeções")


class TemplateComunicacao(BaseModel):
    """Communication templates."""
    
    tipo: str = Field(..., description="Apresentação/Seguimento/Fechamento")
    template_texto: str = Field(..., description="Template estruturado")
    variaveis_personalizacao: List[str] = Field(default_factory=list, description="Variáveis para personalização")


class EstruturaPrecificacao(BaseModel):
    """Pricing structure."""
    
    modelo_precificacao: str = Field(..., description="Valor percebido/Competitiva/Premium")
    ticket_medio_setorial: Dict[str, str] = Field(default_factory=dict, description="Ticket médio por indústria")
    estrutura_comissao: Dict[str, str] = Field(default_factory=dict, description="Estrutura de comissões")
    politica_descontos: Dict[str, Any] = Field(default_factory=dict, description="Política de descontos e aprovações")


class ProcessoVendasSchema(BasePillarSchema):
    """
    Schema for Pilar 7: Processo de Vendas
    
    SCOPE: Sales strategies and execution (ONLY pillar with scripts)
    RESPONSIBILITY: Generate complete sales materials using upstream data
    INPUTS: Personas (P1) + Positioning (P2) + Channels (P4) + Traffic (P5/6)
    """
    
    funil_vendas_estruturado: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured sales funnel with stages and conversion rates"
    )
    scripts_estrategicos: Dict[str, Any] = Field(
        default_factory=dict,
        description="Strategic scripts by industry and role"
    )
    estrutura_precificacao: EstruturaPrecificacao = Field(
        ..., 
        description="Pricing structure and commission policies"
    )
    gestao_pos_venda: Dict[str, Any] = Field(
        default_factory=dict,
        description="Post-sale management and customer success"
    )


# Schema definition for pillar configuration
PROCESSO_VENDAS_SCHEMA = {
    "funil_vendas_estruturado": {
        "etapas_mapeadas": [
            {
                "etapa": "Descoberta/Qualificação/Apresentação/Negociação/Fechamento",
                "atividades_principais": ["Atividade 1", "Atividade 2"],
                "taxa_conversao_esperada": "X%",
                "tempo_medio_etapa": "X dias",
                "responsavel": "Vendedor/SDR/Gerente"
            }
        ],
        "gargalos_criticos": ["Gargalo 1", "Gargalo 2"],
        "oportunidades_otimizacao": ["Oportunidade 1", "Oportunidade 2"]
    },
    "scripts_estrategicos": {
        "scripts_por_industria": [
            {
                "industria": "Indústria Moveleira",
                "cargo_alvo": "Gerente de Logística",
                "scripts_abordagem": [
                    {
                        "situacao": "Primeiro contato telefônico",
                        "script_completo": "Script detalhado com abertura, qualificação e agendamento",
                        "elementos_diferencial": ["Como usar o diferencial técnico do Pilar 2"],
                        "gatilhos_psicologicos": ["Gatilho 1", "Gatilho 2"]
                    }
                ],
                "quebra_objecoes": [
                    {
                        "objecao_comum": "Preço muito alto",
                        "tecnica_resposta": "Técnica específica de resposta",
                        "argumento_diferencial": "Como o diferencial técnico justifica o preço",
                        "alternativa_fechamento": "Opção de fechamento alternativa"
                    }
                ]
            }
        ],
        "templates_comunicacao": {
            "whatsapp_templates": [
                {
                    "tipo": "Apresentação/Seguimento/Fechamento",
                    "template_texto": "Template estruturado",
                    "variaveis_personalizacao": ["[Nome]", "[Empresa]", "[Dor específica]"]
                }
            ],
            "email_templates": [
                {
                    "assunto": "Assunto estratégico",
                    "corpo_email": "Estrutura do email",
                    "call_to_action": "CTA específico"
                }
            ]
        }
    },
    "estrutura_precificacao": {
        "modelo_precificacao": "Valor percebido/Competitiva/Premium",
        "ticket_medio_setorial": {"Indústria": "R$ X"},
        "estrutura_comissao": {"Vendedor": "X%", "Gerente": "Y%"},
        "politica_descontos": {
            "desconto_maximo_autorizado": "X%",
            "regras_aprovacao": ["Regra 1", "Regra 2"],
            "condicoes_especiais": ["Condição 1", "Condição 2"]
        }
    },
    "gestao_pos_venda": {
        "estrategia_fidelizacao": {
            "programa_retencao": "Descrição do programa",
            "frequencia_contato": "Diário/Semanal/Mensal",
            "indicadores_sucesso": ["NPS", "Taxa retenção", "LTV"]
        },
        "oportunidades_expansao": [
            {
                "tipo": "Upsell/Cross-sell",
                "produto_servico": "Produto adicional",
                "momento_oferta": "Quando oferecer",
                "argumento_venda": "Como apresentar"
            }
        ],
        "processo_sucesso_cliente": {
            "onboarding": "Estrutura de onboarding",
            "suporte_continuado": "Tipo de suporte",
            "reunias_estrategicas": "Frequência e formato"
        }
    }
}


def validate_processo_vendas_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate processo vendas data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, ProcessoVendasSchema)


def get_processo_vendas_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(PROCESSO_VENDAS_SCHEMA)
