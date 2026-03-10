"""
Base schema definitions for all pillars.
Provides common validation and structure patterns.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any
from pydantic import BaseModel, Field


class BasePillarSchema(BaseModel):
    """Base class for all pillar output schemas."""
    
    model_config = {
        "extra": "forbid",  # Prevents additional fields
        "validate_assignment": True
    }


class BaseSegmentoSchema(BaseModel):
    """Base structure for industry segments."""
    
    segmento_industrial: str = Field(..., description="Nome do segmento industrial")
    cargos_decisor_alvo: List[str] = Field(default_factory=list, description="Cargos que tomam decisão")
    dores_operacionais: List[str] = Field(default_factory=list, description="Dores principais do setor")
    criterios_homologacao: List[str] = Field(default_factory=list, description="Critérios para aprovação")
    concorrentes_identificados: List[str] = Field(default_factory=list, description="Concorrentes conhecidos")


class BasePosicionamentoSchema(BaseModel):
    """Base structure for positioning by industry."""
    
    industria: str = Field(..., description="Nome da indústria")
    diferencial_tecnico: str = Field(..., description="Diferencial técnico específico")
    proposta_valor_setorial: str = Field(..., description="Proposta de valor para este setor")
    vantagens_vs_concorrentes: List[str] = Field(default_factory=list, description="Vantagens competitivas")
    promessa_setorial: str = Field(..., description="Promessa técnica específica")


class BaseCanalSchema(BaseModel):
    """Base structure for channel information."""
    
    canal: str = Field(..., description="Nome do canal")
    razao_efetividade: str = Field(..., description="Por que este canal é efetivo")
    frequencia_contato: str = Field(..., description="Frequência ideal de contato")
    formato_interacao: str = Field(..., description="Como acontece a interação")


class SchemaValidator:
    """Utility class for schema validation."""
    
    @staticmethod
    def validate_schema(data: Dict[str, Any], schema_class: type) -> Dict[str, Any]:
        """Validate data against a schema class."""
        try:
            validated = schema_class(**data)
            return validated.model_dump()
        except Exception as e:
            raise ValueError(f"Schema validation failed: {str(e)}")
    
    @staticmethod
    def get_schema_description(schema: Dict[str, Any]) -> str:
        """Generate JSON schema description for LLM prompts."""
        import json
        return json.dumps(schema, ensure_ascii=False, indent=2)
