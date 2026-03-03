"""
Lead Validator — Validação de contatos (email + telefone).
Valida emails e telefones antes de exportar para CRM/Sheets.

Uso:
    from app.services.intelligence.b2b.lead_validator import lead_validator
    
    result = lead_validator.validate_email("contato@empresa.com.br")
    result = lead_validator.validate_phone("+5511999998888")
    results = lead_validator.validate_leads(leads_list)
"""

import sys
from typing import Dict, Any, List, Optional
from datetime import datetime


class LeadValidator:
    """Validador de contatos de leads (email + telefone)."""
    
    def __init__(self):
        self._email_validator = None
        self._phonenumbers = None
        self._email_available = None
        self._phone_available = None
    
    def _ensure_email(self):
        """Lazy import do email_validator."""
        if self._email_validator is None:
            try:
                import email_validator
                self._email_validator = email_validator
                self._email_available = True
            except ImportError:
                self._email_available = False
    
    def _ensure_phone(self):
        """Lazy import do phonenumbers."""
        if self._phonenumbers is None:
            try:
                import phonenumbers
                self._phonenumbers = phonenumbers
                self._phone_available = True
            except ImportError:
                self._phone_available = False
    
    def validate_email(self, email: str) -> Dict[str, Any]:
        """
        Valida um endereço de email.
        
        Args:
            email: Endereço de email para validar
            
        Returns:
            Dict com is_valid, normalized_email, error
        """
        if not email or not email.strip():
            return {"is_valid": False, "email": email, "error": "Vazio"}
        
        self._ensure_email()
        
        if not self._email_available:
            # Fallback: regex básica
            import re
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            is_valid = bool(re.match(pattern, email.strip()))
            return {
                "is_valid": is_valid,
                "email": email.strip(),
                "normalized": email.strip().lower(),
                "method": "regex_fallback",
            }
        
        try:
            result = self._email_validator.validate_email(
                email.strip(),
                check_deliverability=True,
            )
            return {
                "is_valid": True,
                "email": email.strip(),
                "normalized": result.normalized,
                "domain": result.domain,
                "method": "email_validator",
            }
        except self._email_validator.EmailNotValidError as e:
            return {
                "is_valid": False,
                "email": email.strip(),
                "error": str(e)[:200],
                "method": "email_validator",
            }
    
    def validate_phone(
        self,
        phone: str,
        country_code: str = "BR",
    ) -> Dict[str, Any]:
        """
        Valida um número de telefone e identifica se é móvel (WhatsApp).
        
        Args:
            phone: Número de telefone (qualquer formato)
            country_code: Código do país (BR padrão)
            
        Returns:
            Dict com is_valid, is_mobile, formatted, whatsapp_ready
        """
        if not phone or not phone.strip():
            return {"is_valid": False, "phone": phone, "error": "Vazio"}
        
        self._ensure_phone()
        
        if not self._phone_available:
            # Fallback: limpeza básica
            import re
            cleaned = re.sub(r'[^0-9+]', '', phone.strip())
            return {
                "is_valid": len(cleaned) >= 10,
                "phone": phone.strip(),
                "cleaned": cleaned,
                "is_mobile": None,
                "whatsapp_ready": None,
                "method": "basic_cleanup",
            }
        
        try:
            pn = self._phonenumbers
            
            # Tentar parsear
            parsed = pn.parse(phone.strip(), country_code)
            
            is_valid = pn.is_valid_number(parsed)
            
            if not is_valid:
                return {
                    "is_valid": False,
                    "phone": phone.strip(),
                    "error": "Número inválido",
                    "method": "phonenumbers",
                }
            
            # Formatar
            formatted_international = pn.format_number(
                parsed, pn.PhoneNumberFormat.INTERNATIONAL
            )
            formatted_national = pn.format_number(
                parsed, pn.PhoneNumberFormat.NATIONAL
            )
            formatted_e164 = pn.format_number(
                parsed, pn.PhoneNumberFormat.E164
            )
            
            # Verificar se é móvel
            number_type = pn.number_type(parsed)
            is_mobile = number_type in (
                pn.PhoneNumberType.MOBILE,
                pn.PhoneNumberType.FIXED_LINE_OR_MOBILE,
            )
            
            return {
                "is_valid": True,
                "phone": phone.strip(),
                "formatted_international": formatted_international,
                "formatted_national": formatted_national,
                "formatted_e164": formatted_e164,
                "is_mobile": is_mobile,
                "whatsapp_ready": is_mobile,  # Móvel = potencialmente WhatsApp
                "country_code": pn.region_code_for_number(parsed),
                "method": "phonenumbers",
            }
            
        except Exception as e:
            return {
                "is_valid": False,
                "phone": phone.strip(),
                "error": str(e)[:200],
                "method": "phonenumbers",
            }
    
    def validate_leads(
        self,
        leads: List[Dict[str, Any]],
        email_key: str = "email",
        phone_key: str = "telefone_1",
    ) -> List[Dict[str, Any]]:
        """
        Valida contatos de uma lista de leads.
        
        Args:
            leads: Lista de dicts com dados de leads
            email_key: Chave do email no dict
            phone_key: Chave do telefone no dict
            
        Returns:
            Lista de leads com dados de validação adicionados
        """
        validated = []
        
        for lead in leads:
            enriched = dict(lead)
            
            # Validar email
            email = lead.get(email_key, "")
            if email:
                enriched["email_validation"] = self.validate_email(email)
            
            # Validar telefone
            phone = lead.get(phone_key, "")
            if phone:
                enriched["phone_validation"] = self.validate_phone(phone)
            
            # Score de contato (0-100)
            contact_score = 0
            if enriched.get("email_validation", {}).get("is_valid"):
                contact_score += 50
            if enriched.get("phone_validation", {}).get("is_valid"):
                contact_score += 30
            if enriched.get("phone_validation", {}).get("whatsapp_ready"):
                contact_score += 20
            
            enriched["contact_score"] = contact_score
            enriched["contact_quality"] = (
                "excellent" if contact_score >= 80 else
                "good" if contact_score >= 50 else
                "partial" if contact_score > 0 else
                "none"
            )
            
            validated.append(enriched)
        
        return validated


# Instância global
lead_validator = LeadValidator()
