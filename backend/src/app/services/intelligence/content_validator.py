"""
Content Validator - Evita alucinações no ChromaDB.
Valida dados antes de salvar na memória vetorial.
"""

import json
import sys
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from app.core.llm_router import call_llm


class ValidationStatus(Enum):
    """Status de validação do conteúdo."""
    FACT = "fact"           # Fato verificável
    INSIGHT = "insight"     # Insight baseado em dados
    ASSUMPTION = "assumption"  # Suposição/hipótese
    HALLUCINATION = "hallucination"  # Alucinação/invenção
    UNCLEAR = "unclear"     # Não foi possível determinar


@dataclass
class ValidationResult:
    """Resultado da validação de conteúdo."""
    status: ValidationStatus
    confidence: float
    reasoning: str
    verified_claims: List[str]
    unverified_claims: List[str]
    recommendation: str
    should_save: bool


class ContentValidator:
    """
    Validador inteligente que usa LLM como "juiz" para verificar
    se o conteúdo é fato, insight ou alucinação antes de salvar.
    """
    
    def __init__(self):
        self.min_confidence_to_save = 0.7
        self.validator_llm = "gemini"  # Gemini é melhor para verificação
    
    def validate_content_before_save(self, content: str, context: Dict[str, Any], 
                                   content_type: str = "general") -> ValidationResult:
        """
        Valida conteúdo antes de salvar no ChromaDB.
        
        Args:
            content: Conteúdo a ser validado
            context: Contexto adicional (indústria, fonte, etc)
            content_type: Tipo de conteúdo (objection_response, positioning, etc)
        
        Returns:
            ValidationResult com análise detalhada
        """
        try:
            # Análise principal com LLM
            analysis = self._analyze_with_llm(content, context, content_type)
            
            # Validações adicionais baseadas em regras
            rule_validation = self._validate_with_rules(content, context, content_type)
            
            # Combinar resultados
            final_status = self._combine_validations(analysis, rule_validation)
            
            return final_status
            
        except Exception as e:
            print(f"⚠️ Content validation failed: {str(e)}", file=sys.stderr)
            
            # Fallback conservador
            return ValidationResult(
                status=ValidationStatus.UNCLEAR,
                confidence=0.3,
                reasoning=f"Validation failed: {str(e)}",
                verified_claims=[],
                unverified_claims=[content],
                recommendation="Manual review required",
                should_save=False
            )
    
    def _analyze_with_llm(self, content: str, context: Dict[str, Any], 
                         content_type: str) -> Dict[str, Any]:
        """Usa LLM para analisar e validar o conteúdo."""
        
        industry = context.get("industry", "")
        source = context.get("source", "unknown")
        
        prompt = f"""Você é um fact-checker especialista em {industry}.

CONTEÚDO PARA VALIDAR:
"{content}"

CONTEXTO:
- Indústria: {industry}
- Fonte: {source}
- Tipo: {content_type}

TAREFA: Analise este conteúdo e determine sua natureza.

Retorne JSON com:
{{
  "status": "fact|insight|assumption|hallucination|unclear",
  "confidence": 0.0-1.0,
  "reasoning": "Explicação detalhada da classificação",
  "verified_claims": [
    "Afirmação 1 que pode ser verificada",
    "Afirmação 2 que pode ser verificada"
  ],
  "unverified_claims": [
    "Afirmação 1 não verificável",
    "Afirmação 2 não verificável"
  ],
  "red_flags": [
    "Sinal 1 de possível alucinação",
    "Sinal 2 de possível alucinação"
  ],
  "recommendation": "save|reject|review"
}}

CRITÉRIOS:
- FACT: Afirmações verificáveis, dados concretos, estatísticas reais
- INSIGHT: Análise baseada em fatos, conclusões lógicas
- ASSUMPTION: Suposições razoáveis, hipóteses baseadas em experiência
- HALLUCINATION: Invenções, dados impossíveis, contradições
- UNCLEAR: Não é possível determinar com segurança

RED FLAGS (indicam possível alucinação):
- Números muito específicos sem fonte
- Afirmações absolutas ("sempre", "nunca", "100%")
- Datas futuras como se fossem fatos
- Comparações impossíveis
- Informações muito boas para serem verdade

Seja rigoroso: em dúvida, classifique como UNCLEAR."""
        
        response = call_llm(
            provider=self.validator_llm,
            prompt=prompt,
            temperature=0.1,
            json_mode=True
        )
        
        if isinstance(response, dict):
            return response
        else:
            raise Exception("Invalid response from validator LLM")
    
    def _validate_with_rules(self, content: str, context: Dict[str, Any], 
                           content_type: str) -> Dict[str, Any]:
        """Validações baseadas em regras específicas."""
        
        issues = []
        confidence = 1.0
        
        # Regra 1: Verificar se há números muito específicos sem fonte
        import re
        
        # Procurar por porcentagens exatas
        percentages = re.findall(r'\b\d+\.?\d*%\b', content)
        for pct in percentages:
            if "fonte" not in content.lower() and "segundo" not in content.lower():
                issues.append(f"Percentage {pct} without source")
                confidence -= 0.1
        
        # Regra 2: Verificar afirmações absolutas
        absolute_words = ["sempre", "nunca", "100%", "garantido", "certo"]
        for word in absolute_words:
            if word.lower() in content.lower():
                issues.append(f"Absolute claim: {word}")
                confidence -= 0.15
        
        # Regra 3: Verificar conteúdo muito curto (pode ser vago)
        if len(content.split()) < 10:
            issues.append("Very short content")
            confidence -= 0.2
        
        # Regra 4: Verificar se há contradições internas
        if self._has_internal_contradictions(content):
            issues.append("Internal contradictions detected")
            confidence -= 0.3
        
        # Regra específica por tipo de conteúdo
        if content_type == "objection_response":
            if "preço" in content.lower() and not any(word in content.lower() for word in ["r$", "custo", "investimento"]):
                issues.append("Price discussion without monetary context")
                confidence -= 0.1
        
        return {
            "rule_issues": issues,
            "rule_confidence": max(0.1, confidence),
            "should_save": confidence >= 0.6 and len(issues) <= 2
        }
    
    def _has_internal_contradictions(self, content: str) -> bool:
        """Verifica se há contradições internas no conteúdo."""
        
        # Simples verificação de contradições
        contradictions = [
            ("barato", "caro"),
            ("rápido", "lento"),
            ("grande", "pequeno"),
            ("alto", "baixo"),
            ("fácil", "difícil")
        ]
        
        content_lower = content.lower()
        
        for word1, word2 in contradictions:
            if word1 in content_lower and word2 in content_lower:
                return True
        
        return False
    
    def _combine_validations(self, llm_analysis: Dict[str, Any], 
                           rule_validation: Dict[str, Any]) -> ValidationResult:
        """Combina análise do LLM com validações por regras."""
        
        # Extrair status do LLM
        llm_status_str = llm_analysis.get("status", "unclear")
        llm_confidence = llm_analysis.get("confidence", 0.5)
        llm_recommendation = llm_analysis.get("recommendation", "review")
        
        # Converter string para enum
        status_map = {
            "fact": ValidationStatus.FACT,
            "insight": ValidationStatus.INSIGHT,
            "assumption": ValidationStatus.ASSUMPTION,
            "hallucination": ValidationStatus.HALLUCINATION,
            "unclear": ValidationStatus.UNCLEAR
        }
        
        llm_status = status_map.get(llm_status_str, ValidationStatus.UNCLEAR)
        
        # Combinar confianças
        rule_confidence = rule_validation.get("rule_confidence", 0.5)
        combined_confidence = (llm_confidence + rule_confidence) / 2
        
        # Regras de decisão
        if llm_status == ValidationStatus.HALLUCINATION:
            should_save = False
            final_status = ValidationStatus.HALLUCINATION
        elif llm_status == ValidationStatus.FACT and combined_confidence >= 0.8:
            should_save = True
            final_status = ValidationStatus.FACT
        elif llm_status == ValidationStatus.INSIGHT and combined_confidence >= 0.7:
            should_save = True
            final_status = ValidationStatus.INSIGHT
        elif llm_status == ValidationStatus.ASSUMPTION and combined_confidence >= 0.6:
            should_save = True
            final_status = ValidationStatus.ASSUMPTION
        else:
            should_save = False
            final_status = ValidationStatus.UNCLEAR
        
        # Construir reasoning
        reasoning_parts = [llm_analysis.get("reasoning", "")]
        
        rule_issues = rule_validation.get("rule_issues", [])
        if rule_issues:
            reasoning_parts.append(f"Rule issues: {', '.join(rule_issues)}")
        
        final_reasoning = " | ".join(reasoning_parts)
        
        return ValidationResult(
            status=final_status,
            confidence=combined_confidence,
            reasoning=final_reasoning,
            verified_claims=llm_analysis.get("verified_claims", []),
            unverified_claims=llm_analysis.get("unverified_claims", []),
            recommendation=llm_recommendation,
            should_save=should_save and combined_confidence >= self.min_confidence_to_save
        )
    
    def batch_validate_contents(self, contents: List[Dict[str, Any]]) -> List[ValidationResult]:
        """
        Valida múltiplos conteúdos em batch.
        
        Args:
            contents: Lista de dicionários com content, context, type
        
        Returns:
            Lista de ValidationResult
        """
        results = []
        
        for item in contents:
            content = item.get("content", "")
            context = item.get("context", {})
            content_type = item.get("type", "general")
            
            validation = self.validate_content_before_save(content, context, content_type)
            results.append(validation)
        
        return results
    
    def get_validation_summary(self, results: List[ValidationResult]) -> Dict[str, Any]:
        """Gera resumo estatístico das validações."""
        
        total = len(results)
        if total == 0:
            return {"total": 0, "approved": 0, "rejected": 0, "review_needed": 0}
        
        approved = sum(1 for r in results if r.should_save)
        rejected = sum(1 for r in results if r.status == ValidationStatus.HALLUCINATION)
        review_needed = total - approved - rejected
        
        # Distribuição por status
        status_counts = {}
        for result in results:
            status = result.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Confiança média
        avg_confidence = sum(r.confidence for r in results) / total
        
        return {
            "total": total,
            "approved": approved,
            "rejected": rejected,
            "review_needed": review_needed,
            "approval_rate": approved / total,
            "average_confidence": avg_confidence,
            "status_distribution": status_counts,
            "risk_level": self._assess_validation_risk(rejected / total)
        }
    
    def _assess_validation_risk(self, rejection_rate: float) -> str:
        """Avalia o nível de risco baseado na taxa de rejeição."""
        
        if rejection_rate > 0.3:
            return "HIGH"
        elif rejection_rate > 0.1:
            return "MEDIUM"
        else:
            return "LOW"


# Instância global
content_validator = ContentValidator()


def validate_before_chroma_save(content: str, context: Dict[str, Any], 
                               content_type: str = "general") -> ValidationResult:
    """Interface principal para validação antes de salvar no ChromaDB."""
    return content_validator.validate_content_before_save(content, context, content_type)
