"""
Smart Content Processor - Mitiga Rate Limits do Groq.
Usa Gemini como "mastigador" para processar conteúdo pesado do Jina Reader.
"""

import json
import sys
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

from app.core.llm_router import call_llm


@dataclass
class ProcessedContent:
    """Conteúdo processado e otimizado para LLMs."""
    original_length: int
    processed_length: int
    compression_ratio: float
    key_insights: List[str]
    structured_data: Dict[str, Any]
    confidence_score: float
    processing_time: float


class SmartContentProcessor:
    """
    Processador inteligente que usa Gemini para mastigar conteúdo pesado
    e enviar extratos otimizados para o Groq.
    """
    
    def __init__(self):
        self.max_tokens_for_groq = 4000  # Limite seguro para Groq
        self.max_tokens_for_gemini = 2000000  # Gemini 1.5 Flash capability
    
    def process_jina_content(self, raw_content: str, content_type: str = "competitor_analysis", 
                           industry: str = "", focus_areas: List[str] = None) -> ProcessedContent:
        """
        Processa conteúdo bruto do Jina Reader usando Gemini como mastigador.
        
        Args:
            raw_content: Conteúdo bruto do Jina Reader (pode ser 100k+ tokens)
            content_type: Tipo de conteúdo (competitor_analysis, market_research, etc)
            industry: Indústria para contextualização
            focus_areas: Áreas de foco específicas
        
        Returns:
            ProcessedContent com insights estruturados e otimizados
        """
        import time
        start_time = time.time()
        
        original_length = len(raw_content.split())
        
        # Se conteúdo já está pequeno, retorna direto
        if original_length <= 1000:
            return ProcessedContent(
                original_length=original_length,
                processed_length=original_length,
                compression_ratio=1.0,
                key_insights=[raw_content],
                structured_data={"raw_content": raw_content},
                confidence_score=0.9,
                processing_time=time.time() - start_time
            )
        
        try:
            # Usar Gemini como mastigador
            processed = self._process_with_gemini(raw_content, content_type, industry, focus_areas)
            
            processing_time = time.time() - start_time
            
            return ProcessedContent(
                original_length=original_length,
                processed_length=len(processed["summary"].split()),
                compression_ratio=original_length / len(processed["summary"].split()),
                key_insights=processed["key_insights"],
                structured_data=processed["structured_data"],
                confidence_score=processed.get("confidence_score", 0.8),
                processing_time=processing_time
            )
            
        except Exception as e:
            print(f"⚠️ Smart processing failed: {str(e)}", file=sys.stderr)
            
            # Fallback: truncamento simples
            truncated = self._simple_truncate(raw_content)
            
            return ProcessedContent(
                original_length=original_length,
                processed_length=len(truncated.split()),
                compression_ratio=original_length / len(truncated.split()),
                key_insights=[truncated],
                structured_data={"truncated_content": truncated},
                confidence_score=0.5,
                processing_time=time.time() - start_time
            )
    
    def _process_with_gemini(self, raw_content: str, content_type: str, 
                           industry: str, focus_areas: List[str]) -> Dict[str, Any]:
        """Usa Gemini para processar e extrair insights do conteúdo bruto."""
        
        focus_areas_str = ", ".join(focus_areas or ["geral"])
        
        prompt = f"""Você é um analista de inteligência competitiva especializado em {industry}.

CONTEÚDO BRUTO PARA ANÁLISE:
{raw_content[:150000]}  # Limitar para não exceder contexto do Gemini

TIPO DE ANÁLISE: {content_type}
INDÚSTRIA: {industry}
FOCO: {focus_areas_str}

TAREFA: Processar e extrair apenas informações estrategicamente relevantes.

Retorne JSON com:
{{
  "confidence_score": 0.0-1.0,
  "key_insights": [
    "Insight 1 específico e acionável",
    "Insight 2 específico e acionável"
  ],
  "structured_data": {{
    "company_overview": {{
      "name": "Nome da empresa",
      "industry": "Setor",
      "size": "Porte (pequena/média/grande)",
      "location": "Localização"
    }},
    "strategic_insights": {{
      "value_proposition": "Proposta de valor principal",
      "target_audience": ["Público-alvo 1", "Público-alvo 2"],
      "key_differentiators": ["Diferencial 1", "Diferencial 2"],
      "pricing_model": "Modelo de precificação",
      "market_position": "Posicionamento no mercado"
    }},
    "competitive_threats": {{
      "strengths": ["Força 1", "Força 2"],
      "weaknesses": ["Fraqueza 1", "Fraqueza 2"],
      "market_share_indicators": "Indicadores de share"
    }},
    "actionable_intelligence": {{
      "opportunities": ["Oportunidade 1", "Oportunidade 2"],
      "threats": ["Ameaça 1", "Ameaça 2"],
      "recommendations": ["Recomendação 1", "Recomendação 2"]
    }}
  }},
  "summary": "Resumo executivo de máximo 500 caracteres com as informações mais críticas"
}}

IMPORTANTE:
- Seja extremamente seletivo - apenas informações verdadeiramente relevantes
- Se não houver informações relevantes, retorne arrays vazios
- Mantenha o summary conciso e focado em insights acionáveis
- A confidence_score deve refletir a qualidade das informações extraídas"""
        
        response = call_llm(
            provider="gemini",
            prompt=prompt,
            temperature=0.1,
            json_mode=True
        )
        
        if isinstance(response, dict):
            return response
        else:
            raise Exception("Invalid response from Gemini")
    
    def _simple_truncate(self, content: str) -> str:
        """Fallback: truncamento simples mantendo estrutura."""
        words = content.split()
        max_words = 800  # ~4000 tokens
        
        if len(words) <= max_words:
            return content
        
        # Manter início e fim para contexto
        start_words = words[:400]
        end_words = words[-400:]
        
        truncated = " ".join(start_words) + " [...] " + " ".join(end_words)
        return truncated
    
    def batch_process_contents(self, contents: List[str], content_type: str = "competitor_analysis",
                              industry: str = "", focus_areas: List[str] = None) -> List[ProcessedContent]:
        """
        Processa múltiplos conteúdos em batch, otimizando chamadas à API.
        
        Args:
            contents: Lista de conteúdos brutos
            content_type: Tipo de conteúdo
            industry: Indústria
            focus_areas: Áreas de foco
        
        Returns:
            Lista de ProcessedContent
        """
        results = []
        
        for content in contents:
            processed = self.process_jina_content(content, content_type, industry, focus_areas)
            results.append(processed)
        
        return results
    
    def get_optimized_prompt_context(self, processed_contents: List[ProcessedContent], 
                                    max_total_tokens: int = 3000) -> str:
        """
        Gera contexto otimizado para prompts do Groq baseado nos conteúdos processados.
        
        Args:
            processed_contents: Lista de conteúdos já processados
            max_total_tokens: Limite máximo de tokens para o Groq
        
        Returns:
            String formatada para uso em prompts
        """
        if not processed_contents:
            return "Nenhum conteúdo processado disponível."
        
        context_parts = []
        current_tokens = 0
        
        # Adicionar insights mais relevantes primeiro
        sorted_contents = sorted(processed_contents, key=lambda x: x.confidence_score, reverse=True)
        
        for processed in sorted_contents:
            # Estimar tokens (1 token ≈ 4 caracteres)
            content_tokens = len(processed.structured_data.get("summary", "")) / 4
            
            if current_tokens + content_tokens <= max_total_tokens:
                context_parts.append(f"""
INTELLIGÊNCIA [{processed.confidence_score:.2f}]:
{processed.structured_data.get("summary", "")}

INSIGHTS CHAVE:
{chr(10).join(f"• {insight}" for insight in processed.key_insights[:3])}
""")
                current_tokens += content_tokens
            else:
                break
        
        return "\n".join(context_parts)


# Instância global para uso em todo o sistema
smart_processor = SmartContentProcessor()


def process_enhanced_research_smart(raw_contents: List[str], industry: str, 
                                  content_type: str = "competitor_analysis") -> Dict[str, Any]:
    """
    Interface principal para processamento inteligente de research.
    
    Args:
        raw_contents: Conteúdos brutos do Jina Reader
        industry: Indústria alvo
        content_type: Tipo de análise
    
    Returns:
        Dicionário com conteúdos processados e contexto otimizado
    """
    # Processar todos os conteúdos
    processed_contents = smart_processor.batch_process_contents(
        raw_contents, content_type, industry
    )
    
    # Gerar contexto otimizado para Groq
    optimized_context = smart_processor.get_optimized_prompt_context(processed_contents)
    
    # Estatísticas de processamento
    total_original = sum(p.original_length for p in processed_contents)
    total_processed = sum(p.processed_length for p in processed_contents)
    avg_compression = total_original / total_processed if total_processed > 0 else 1
    
    return {
        "processed_contents": [
            {
                "original_length": p.original_length,
                "processed_length": p.processed_length,
                "compression_ratio": p.compression_ratio,
                "confidence_score": p.confidence_score,
                "key_insights": p.key_insights,
                "structured_data": p.structured_data
            }
            for p in processed_contents
        ],
        "optimized_context": optimized_context,
        "processing_stats": {
            "total_original_tokens": total_original,
            "total_processed_tokens": total_processed,
            "average_compression_ratio": avg_compression,
            "rate_limit_risk": "LOW" if avg_compression > 5 else "MEDIUM",
            "gemini_calls_used": len(processed_contents),
            "estimated_groq_tokens": len(optimized_context.split())
        }
    }
