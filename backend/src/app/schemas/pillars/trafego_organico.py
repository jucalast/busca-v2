"""
Schema definitions for Pilar 5: Tráfego Orgânico.
Focus: Pure SEO and content - "How do we get found organically?"
"""

from typing import Dict, List, Any
from pydantic import BaseModel, Field

from ..base_schema import BasePillarSchema


class PalavrasChaveSetorial(BaseModel):
    """Industry-specific keywords."""
    
    industria: str = Field(..., description="Nome da indústria")
    keywords_primarias: List[str] = Field(default_factory=list, description="Keywords primárias")
    keywords_secundarias: List[str] = Field(default_factory=list, description="Keywords secundárias")
    intencao_busca: str = Field(..., description="Informacional/Comercial/Navegação")


class GoogleMeuNegocio(BaseModel):
    """Google Business Profile information."""
    
    status_atual: str = Field(..., description="Não verificado/Verificado/Otimizado")
    oportunidades_melhoria: List[str] = Field(default_factory=list, description="Oportunidades de melhoria")
    categorias_relevantes: List[str] = Field(default_factory=list, description="Categorias relevantes")


class SeoLocal(BaseModel):
    """Local SEO factors."""
    
    areas_geograficas: List[str] = Field(default_factory=list, description="Regiões de atuação")
    fatores_relevancia_local: List[str] = Field(default_factory=list, description="Fatores de relevância local")


class OtimizacaoBusca(BaseModel):
    """Search optimization configuration."""
    
    palavras_chave_setoriais: List[PalavrasChaveSetorial] = Field(default_factory=list, description="Keywords por indústria")
    google_meu_negocio: GoogleMeuNegocio = Field(..., description="Google Business Profile")
    seo_local: SeoLocal = Field(..., description="Local SEO configuration")


class PilarEstrategico(BaseModel):
    """Content pillar strategy."""
    
    pilar: str = Field(..., description="Nome do pilar de conteúdo")
    topicos_relacionados: List[str] = Field(default_factory=list, description="Tópicos relacionados")
    alinhamento_diferencial: str = Field(..., description="Como reforça o posicionamento técnico")


class FormatoEfetivo(BaseModel):
    """Effective content format."""
    
    formato: str = Field(..., description="Blog Post/Video/Infográfico")
    funcao_no_funil: str = Field(..., description="Topo/Mélio/Fundo")
    temas_por_industria: List[str] = Field(default_factory=list, description="Temas por indústria")


class CalendarioSugerido(BaseModel):
    """Content calendar suggestions."""
    
    frequencia_ideal: str = Field(..., description="X posts por semana")
    melhores_dias_horarios: List[str] = Field(default_factory=list, description="Melhores dias e horários")
    sazonalidade_conteudo: List[str] = Field(default_factory=list, description="Épocas sazonais")


class EcosistemaConteudo(BaseModel):
    """Content ecosystem configuration."""
    
    pilares_estrategicos: List[PilarEstrategico] = Field(default_factory=list, description="Pilares estratégicos")
    formatos_efetivos: List[FormatoEfetivo] = Field(default_factory=list, description="Formatos efetivos")
    calendario_sugerido: CalendarioSugerido = Field(..., description="Calendário sugerido")


class RedePrioritaria(BaseModel):
    """Priority social network."""
    
    plataforma: str = Field(..., description="LinkedIn/Instagram/YouTube")
    publico_alvo: str = Field(..., description="Descrição do público nesta plataforma")
    tipo_conteudo_efetivo: List[str] = Field(default_factory=list, description="Tipos de conteúdo efetivos")
    frequencia_otima: str = Field(..., description="X posts/semana")


class PlataformasOrganicas(BaseModel):
    """Organic platform configuration."""
    
    redes_prioritarias: List[RedePrioritaria] = Field(default_factory=list, description="Redes prioritárias")
    plataformas_secundarias: List[str] = Field(default_factory=list, description="Plataformas secundárias")
    plataformas_evitar: List[str] = Field(default_factory=list, description="Plataformas a evitar")


class MetricasOrganic(BaseModel):
    """Organic metrics configuration."""
    
    kpis_principais: List[str] = Field(default_factory=list, description="KPIs principais")
    ferramentas_monitoramento: List[str] = Field(default_factory=list, description="Ferramentas de monitoramento")
    metas_90_dias: List[str] = Field(default_factory=list, description="Metas para 90 dias")


class TrafegoOrganicoSchema(BasePillarSchema):
    """
    Schema for Pilar 5: Tráfego Orgânico
    
    STRICT SCOPE: Pure SEO and content only
    FORBIDDEN: Paid ads, sales scripts, conversion tactics
    FOCUS: "How do we get found organically?"
    """
    
    otimizacao_busca: OtimizacaoBusca = Field(..., description="Search optimization")
    ecossistema_conteudo: EcosistemaConteudo = Field(..., description="Content ecosystem")
    plataformas_organicas: PlataformasOrganicas = Field(..., description="Organic platforms")
    metricas_organic: MetricasOrganic = Field(..., description="Organic metrics")


# Schema definition for pillar configuration
TRAFEGO_ORGANICO_SCHEMA = {
    "otimizacao_busca": {
        "palavras_chave_setoriais": [
            {
                "industria": "Indústria Moveleira",
                "keywords_primarias": ["keyword 1", "keyword 2"],
                "keywords_secundarias": ["keyword 3", "keyword 4"],
                "intenção_busca": "Informacional/Comercial/Navegação"
            }
        ],
        "google_meu_negocio": {
            "status_atual": "Não verificado/Verificado/Otimizado",
            "oportunidades_melhoria": ["Oportunidade 1", "Oportunidade 2"],
            "categorias_relevantes": ["Categoria 1", "Categoria 2"]
        },
        "seo_local": {
            "areas_geograficas": ["Região 1", "Região 2"],
            "fatores_relevancia_local": ["Fator 1", "Fator 2"]
        }
    },
    "ecosistema_conteudo": {
        "pilares_estrategicos": [
            {
                "pilar": "Nome do pilar de conteúdo",
                "topicos_relacionados": ["Tópico 1", "Tópico 2"],
                "alinhamento_diferencial": "Como reforça o posicionamento técnico"
            }
        ],
        "formatos_efetivos": [
            {
                "formato": "Blog Post/Video/Infográfico",
                "funcao_no_funil": "Topo/Mélio/Fundo",
                "temas_por_industria": ["Tema Moveleira", "Tema Automotiva"]
            }
        ],
        "calendario_sugerido": {
            "frequencia_ideal": "X posts por semana",
            "melhores_dias_horarios": ["Dia/Hora"],
            "sazonalidade_conteudo": ["Época 1", "Época 2"]
        }
    },
    "plataformas_organicas": {
        "redes_prioritarias": [
            {
                "plataforma": "LinkedIn/Instagram/YouTube",
                "publico_alvo": "Descrição do público nesta plataforma",
                "tipo_conteudo_efetivo": ["Tipo 1", "Tipo 2"],
                "frequencia_otima": "X posts/semana"
            }
        ],
        "plataformas_secundarias": ["Plataforma 1", "Plataforma 2"],
        "plataformas_evitar": ["Plataforma que não funciona"]
    },
    "metricas_organic": {
        "kpis_principais": ["Tráfego orgânico", "Taxa cliques", "Tempo página"],
        "ferramentas_monitoramento": ["Ferramenta 1", "Ferramenta 2"],
        "metas_90_dias": ["Meta 1", "Meta 2"]
    }
}


def validate_trafego_organico_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate trafego organico data against schema."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.validate_schema(data, TrafegoOrganicoSchema)


def get_trafego_organico_schema_description() -> str:
    """Get schema description for LLM prompts."""
    from ..base_schema import SchemaValidator
    return SchemaValidator.get_schema_description(TRAFEGO_ORGANICO_SCHEMA)
