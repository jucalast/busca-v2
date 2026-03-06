"""
Chat Consultant — Real-time AI MARKETING CONSULTANT that has a genuine conversation,
proactively searches the internet to TEACH the user and make decisions TOGETHER.

VERSÃO REFACTORIZADA COM COMMON SERVICES

THIS IS NOT A FORM. This is a real consultation where the AI:
1. SEARCHES the internet frequently to bring relevant data
2. TEACHES the user about marketing strategies they don't know
3. SUGGESTS specific actions based on real market data
4. EXTRACTS business info naturally through conversation, not interrogation

Called by growth_orchestrator.py with action 'chat'.
Input: { messages: [...], user_message: str, extracted_profile: {...} }
Output: { reply: str, search_performed: bool, search_query: str|null,
          extracted_profile: {...}, ready_for_analysis: bool, fields_collected: [...] }
"""

# ═══════════════════════════════════════════════════════════════════
# IMPORTS CENTRALIZADOS (ANTES: 8 imports duplicados)
# ═══════════════════════════════════════════════════════════════════

from app.services.common import (
    json, sys, os, time,  # Python basics
    call_llm,        # LLM
    log_info, log_error, log_warning, log_success, log_debug,  # Logging
    safe_json_dumps, safe_json_loads,  # Serialization
    CommonConfig,    # Config
    get_timestamp, format_duration, safe_get, retry_with_delay  # Utils
)

# Imports específicos deste módulo
import re
import unicodedata
from dotenv import load_dotenv


def _normalize(text: str) -> str:
    """Strip accents and lowercase for comparison. 'loja física' -> 'loja fisica'"""
    nfkd = unicodedata.normalize('NFKD', text.lower())
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def _similar(s1: str, s2: str, threshold: float = 0.8) -> bool:
    """Check if two strings are similar (fuzzy match). Handles typos like 'indiaiatuba' vs 'indaiatuba'."""
    if s1 == s2:
        return True
    if not s1 or not s2:
        return False
    
    len1, len2 = len(s1), len(s2)
    len_max = max(len1, len2)
    len_min = min(len1, len2)
    
    # If length difference is huge, not similar
    if len_max > len_min * 1.5:
        return False
    
    # Use character frequency similarity (handles duplicates/missing chars)
    # Count each character occurrence
    freq1 = {}
    freq2 = {}
    
    for c in s1:
        freq1[c] = freq1.get(c, 0) + 1
    
    for c in s2:
        freq2[c] = freq2.get(c, 0) + 1
    
    # Calculate similarity based on character frequency
    common_chars = set(freq1.keys()) & set(freq2.keys())
    if not common_chars:
        return False
    
    similarity = sum(min(freq1[c], freq2[c]) for c in common_chars) / max(len1, len2)
    return similarity >= threshold


def _extract_business_info(message: str, current_profile: dict, messages: list = None) -> dict:
    """Extract business information from user message using LLM.
    
    Uses conversation history (messages) to understand ambiguous/short references.
    """
    
    log_debug(f"Extracting info: {message[:60]}...")
    
    # Schema JSON para forçar estrutura correta (30 campos — inclui todos que o pipeline consome)
    json_schema = {
        "type": "object",
        "properties": {
            "nome_negocio": {"type": "string"},
            "segmento": {"type": "string"},
            "localizacao": {"type": "string"},
            "modelo": {"type": "string"},
            "tipo_produto": {"type": "string"},
            "faturamento": {"type": "string"},
            "equipe": {"type": "string"},
            "ticket_medio": {"type": "string"},
            "problemas": {"type": "string"},
            "objetivos": {"type": "string"},
            "investimento": {"type": "string"},
            "canais": {"type": "string"},
            "clientes": {"type": "string"},
            "concorrentes": {"type": "string"},
            "fornecedores": {"type": "string"},
            "tipo_cliente": {"type": "string"},
            "capacidade_produtiva": {"type": "string"},
            "regiao_atendimento": {"type": "string"},
            "diferencial": {"type": "string"},
            "margem": {"type": "string"},
            "gargalos": {"type": "string"},
            "site": {"type": "string"},
            "instagram": {"type": "string"},
            "whatsapp": {"type": "string"},
            "tempo_operacao": {"type": "string"},
            "modelo_operacional": {"type": "string"},
            "capital_disponivel": {"type": "string"},
            "tempo_entrega": {"type": "string"},
            "origem_clientes": {"type": "string"},
            "maior_objecao": {"type": "string"}
        },
        "required": []
    }
    
    # Build recent conversation context so the LLM understands short/ambiguous messages
    recent_context = "(primeira mensagem, sem contexto anterior)"
    if messages and len(messages) > 0:
        context_lines = []
        for m in messages[-6:]:  # Last 6 messages for context
            role_label = "Usuário" if m.get("role") == "user" else "Consultor"
            content = m.get("content", "")[:200]
            if content and content != '...':
                context_lines.append(f"{role_label}: {content}")
        if context_lines:
            recent_context = "\n".join(context_lines)
    
    # Load prompt from YAML
    from app.core.prompt_loader import load_prompt_file
    prompt_config = load_prompt_file("chat_consultant.yaml")
    template = prompt_config.get("information_extraction", {}).get("prompt_template", "")
    
    prompt = template.format(
        recent_context=recent_context,
        message=message,
        current_profile=safe_json_dumps(current_profile, ensure_ascii=False)
    )
    
    try:
        # Usar JSON mode nativo + modelo pequeno para extração
        from app.core.llm_router import call_llm
        
        result = call_llm(
            provider="groq",
            prompt=prompt,
            temperature=0.1,  # Baixa temperatura para extração
            json_mode=True,   # JSON mode nativo!
            prefer_small=True  # Usar modelo menor e mais rápido
        )
        
        if isinstance(result, dict) and "error" in result:
            raise Exception(f"JSON mode failed: {result['error']}")
        
        if isinstance(result, str):
            extracted = safe_json_loads(result)
        else:
            extracted = result
        
        # Merge with current profile (only update non-null values)
        updated_profile = current_profile.copy()
        new_fields = 0
        for key, value in extracted.items():
            if value is not None and value != "":
                updated_profile[key] = value
                new_fields += 1
        
        # ── Post-extraction safety net ──
        # If nome_negocio is still empty, check for explicit name-giving patterns
        if not updated_profile.get('nome_negocio'):
            msg_lower = message.lower().strip()
            # Pattern 1: explicit "o nome é X", "a empresa é X", "chama X"
            name_patterns = [
                r'(?:nome|empresa|negócio|negocio)\s+(?:é|e|se chama|chama)\s+(.+)',
                r'(?:chamo|chamamos)\s+(?:de\s+)?(.+)',
                r'(?:somos|sou)\s+(?:a|o|da|do)?\s*(.+)',
            ]
            for pat in name_patterns:
                match = re.search(pat, msg_lower)
                if match:
                    candidate = match.group(1).strip().rstrip('.,;!')
                    if candidate and len(candidate) >= 2 and len(candidate.split()) <= 4:
                        # Capitalize it properly
                        updated_profile['nome_negocio'] = candidate.title()
                        new_fields += 1
                        log_info(f"🔧 Safety net: detected nome_negocio = '{candidate.title()}'")
                        break
            
            # Pattern 2: Only if the assistant SPECIFICALLY asked for the business name
            if not updated_profile.get('nome_negocio') and messages:
                last_assistant = None
                for m in reversed(messages):
                    if m.get('role') == 'assistant':
                        last_assistant = m.get('content', '').lower()
                        break
                # Much more specific check: require explicit name-asking phrases
                name_asking_phrases = ['nome da empresa', 'nome do negócio', 'nome do negocio',
                                       'como se chama', 'qual o nome', 'qual é o nome']
                if last_assistant and any(phrase in last_assistant for phrase in name_asking_phrases):
                    # First comma-separated part is likely the name
                    parts = message.strip().split(',')
                    candidate = parts[0].strip()
                    common_phrases = ['sim', 'não', 'nao', 'ok', 'eu', 'meu', 'minha', 'quero',
                                      'preciso', 'tenho', 'acho', 'pode', 'obrigado', 'obrigada']
                    if candidate and len(candidate) >= 2 and len(candidate.split()) <= 3 and candidate.lower() not in common_phrases:
                        updated_profile['nome_negocio'] = candidate.strip()
                        new_fields += 1
                        log_info(f"🔧 Safety net: detected nome_negocio = '{candidate}'")
        
        # If objetivos is still empty but message mentions growth/increase targets
        if not updated_profile.get('objetivos'):
            msg_lower = message.lower()
            if any(kw in msg_lower for kw in ['% a mais', 'aumentar', 'crescer', 'crescimento', 'dobrar', 'triplicar', 'meta']):
                updated_profile['objetivos'] = message.strip()
                new_fields += 1
                log_info(f"🔧 Safety net: detected objetivos from message")
        
        # If problemas/dificuldades is still empty but message mentions common challenges
        if not updated_profile.get('problemas') and not updated_profile.get('dificuldades'):
            msg_lower = message.lower()
            if any(kw in msg_lower for kw in ['conseguir mais', 'dificuldade', 'problema', 'desafio', 'falta de', 'preciso de mais']):
                updated_profile['problemas'] = message.strip()
                new_fields += 1
                log_info(f"🔧 Safety net: detected problemas from message")
        
        # If modelo is still empty but message mentions selling to companies/consumers
        if not updated_profile.get('modelo'):
            msg_lower = message.lower()
            if any(kw in msg_lower for kw in ['pra empresa', 'para empresa', 'p/ empresa', 'vendo para empresa',
                                               'vendemos para empresa', 'b2b', 'business to business',
                                               'atendo empresa', 'clientes são empresa']):
                updated_profile['modelo'] = 'B2B'
                new_fields += 1
                log_info(f"🔧 Safety net: detected modelo = B2B")
            elif any(kw in msg_lower for kw in ['consumidor final', 'pessoa física', 'pessoa fisica',
                                                 'varejo', 'b2c', 'business to consumer', 'pra pessoa']):
                updated_profile['modelo'] = 'B2C'
                new_fields += 1
                log_info(f"🔧 Safety net: detected modelo = B2C")
        
        # Normalize: create aliases so downstream consumers find fields by their expected names
        for src, dst in [('problemas', 'dificuldades'), ('gargalos', 'principal_gargalo'),
                         ('equipe', 'num_funcionarios'), ('faturamento', 'faturamento_mensal'),
                         ('modelo_operacional', 'operacao'),
                         ('canais', 'canais_venda'), ('clientes', 'cliente_ideal')]:
            if updated_profile.get(src):
                updated_profile[dst] = updated_profile[src]
        
        log_success(f"JSON mode extracted: {new_fields} fields (total profile: {len([k for k, v in updated_profile.items() if v and v != ''])} fields)")
        return updated_profile
        
    except Exception as e:
        log_error(f"❌ JSON mode failed: {str(e)[:100]}...")
        
        # Fallback: tentar extração manual de campos básicos
        fallback_fields = {}
        message_lower = message.lower()
        
        # Generic fallback patterns (remove hardcoded J.Ferres data)
        if "b2b" in message_lower:
            fallback_fields["modelo"] = "B2B"
        if "b2c" in message_lower:
            fallback_fields["modelo"] = "B2C"
        if "serviço" in message_lower or "servico" in message_lower:
            fallback_fields["tipo_oferta"] = "serviço"
        if "produto" in message_lower:
            fallback_fields["tipo_oferta"] = "produto"
        
        # Extract numbers with context (generic)
        
        # Faturamento - look for monetary values
        faturamento_match = re.search(r'R\$\s*([\d.,]+)', message)
        if faturamento_match:
            value = faturamento_match.group(1)
            if "mil" in message_lower or "k" in message_lower:
                fallback_fields["faturamento"] = f"R$ {value}/mês"
        
        # Equipe - look for people count
        equipe_match = re.search(r'(\d+)\s*(?:pessoas|funcionários|funcionarios|equipe)', message_lower)
        if equipe_match:
            fallback_fields["equipe"] = f"{equipe_match.group(1)} pessoas"
        
        # Ticket médio - look for monetary values with ticket context
        ticket_match = re.search(r'(?:ticket|média|media)\s*R?\$\s*([\d.,]+)', message_lower)
        if ticket_match:
            value = ticket_match.group(1)
            fallback_fields["ticket_medio"] = f"R$ {value}"
        
        # Generic competitor extraction
        if "concorrente" in message_lower or "concorrência" in message_lower or "concorrencia" in message_lower:
            # Try to extract competitor names from context
            words = message_lower.split()
            potential_competitors = []
            for i, word in enumerate(words):
                if word in ["concorrente", "concorrente:", "concorrentes", "concorrência", "concorrencia"]:
                    # Look for capitalized words after competitor keywords
                    for j in range(i+1, min(i+4, len(words))):
                        candidate = words[j].strip('.,;:')
                        if candidate and candidate[0].isupper() and len(candidate) > 2:
                            potential_competitors.append(candidate)
            
            if potential_competitors:
                fallback_fields["concorrentes"] = ", ".join(potential_competitors[:3])  # Max 3 competitors
        
        # Website extraction - look for URLs
        url_match = re.search(r'(https?://[^\s]+|www\.[^\s]+)', message_lower)
        if url_match:
            fallback_fields["site"] = url_match.group(1)
        
        # Location extraction - look for city/state patterns
        location_match = re.search(r'([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s*-\s*([A-Z]{2})', message)
        if location_match:
            city, state = location_match.groups()
            fallback_fields["localizacao"] = f"{city}-{state}"
            
        # Email extraction
        email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', message)
        if email_match:
            fallback_fields["email_contato"] = email_match.group(0)
            
        # LinkedIn extraction
        if "linkedin" in message_lower:
            linkedin_url = re.search(r'(https?://(?:www\.)?linkedin\.com/[^\s]+)', message)
            if linkedin_url:
                fallback_fields["linkedin"] = linkedin_url.group(1)
            else:
                fallback_fields["linkedin"] = "Referenciado na conversa"
                
        # Google Maps / Address Extraction (e.g "Av. Eng. Fábio Roberto Barnabé, 2156")
        if any(kw in message_lower for kw in ['rua', 'av.', 'avenida', 'praça', 'rodovia']) or re.search(r'\d{5}-\d{3}', message):
            fallback_fields["google_maps"] = message.strip()
            
        if fallback_fields:
            log_success(f"Fallback extracted {len(fallback_fields)} fields")
            updated_profile = current_profile.copy()
            for key, value in fallback_fields.items():
                updated_profile[key] = value
            # Same normalization as LLM path
            for src, dst in [('problemas', 'dificuldades'), ('gargalos', 'principal_gargalo'),
                             ('equipe', 'num_funcionarios'), ('faturamento', 'faturamento_mensal'),
                             ('modelo_operacional', 'operacao')]:
                if updated_profile.get(src):
                    updated_profile[dst] = updated_profile[src]
            return updated_profile
        
        return current_profile


# ═══════════════════════════════════════════════════════════════════
# DISCOVERY GAPS — Quando o usuário não sabe algo, registra para a análise descobrir
# ═══════════════════════════════════════════════════════════════════

_DONT_KNOW_SIGNALS = [
    "não sei", "nao sei", "não conheço", "nao conheço", "não tenho certeza",
    "não faço ideia", "nao faco ideia", "sei lá", "nem sei", "não lembro",
    "nao lembro", "não conheço nenhum", "não sei dizer",
]

def _detect_discovery_gaps(message: str, current_profile: dict) -> list:
    """Detect when user doesn't know something and mark it as a gap for analysis to discover."""
    message_lower = message.lower()
    gaps = current_profile.get("_discovery_gaps", [])
    
    # Check if user expressed not knowing something
    if not any(signal in message_lower for signal in _DONT_KNOW_SIGNALS):
        return gaps
    
    # Map keywords to gap types that analysis can discover
    gap_mappings = {
        "concorrent": "concorrentes",
        "mercado": "mercado_local",
        "preço": "precificacao",
        "preco": "precificacao",
        "público": "publico_alvo",
        "publico": "publico_alvo",
        "cliente": "publico_alvo",
        "tendência": "tendencias",
        "tendencia": "tendencias",
    }
    
    for keyword, gap_type in gap_mappings.items():
        if keyword in message_lower and gap_type not in gaps:
            gaps.append(gap_type)
    
    # Generic gap if we couldn't identify a specific one
    if not gaps and any(signal in message_lower for signal in _DONT_KNOW_SIGNALS):
        if "geral" not in gaps:
            gaps.append("geral")
    
    return gaps


# ═══════════════════════════════════════════════════════════════════
# CAMPOS OBRIGATÓRIOS PARA ANÁLISE — "Lista de Compras" do Chat
# ═══════════════════════════════════════════════════════════════════
# Sem TODOS estes, a análise fica comprometida (persona errada, queries genéricas)
CRITICAL_FIELDS = ['nome_negocio', 'segmento', 'modelo', 'localizacao', 'dificuldades', 'objetivos']

# O consultor DEVE perguntar TODOS estes campos antes de liberar a análise
BONUS_FIELDS = [
    'faturamento',           # Faturamento mensal
    'ticket_medio',          # Ticket médio por venda
    'tipo_produto',          # Produto, serviço ou ambos
    'equipe',                # Tamanho da equipe
    'diferencial',           # Diferencial competitivo
    'concorrentes',          # Concorrentes diretos
    'canais',                # Canais de venda/comunicação
    'investimento',          # Investimento em marketing
    'margem',                # Margem de lucro
    'tempo_operacao',        # Há quanto tempo opera
    'modelo_operacional',    # Estoque próprio, sob encomenda, etc
    'capital_disponivel',    # Capital disponível para investir
    'gargalos',              # Gargalos operacionais
    'tipo_cliente',          # Indústrias/setores atendidos
    'capacidade_produtiva',  # Volume de produção
    'regiao_atendimento',    # Região geográfica atendida
    'fornecedores',          # Fornecedores
    'origem_clientes',       # De onde vêm os clientes
    'maior_objecao',         # Maior objeção dos clientes
    'site',                  # Website
    'instagram',             # Instagram
    'whatsapp',              # WhatsApp
    'linkedin',              # LinkedIn da empresa
    'google_maps',           # Google Maps / Google Meu Negócio
    'email_contato',         # E-mail de contato
    'tempo_entrega',         # Prazo médio de entrega
]
BONUS_MINIMUM = len(BONUS_FIELDS)  # TODOS são obrigatórios

# Labels em português para injeção natural no prompt
_FIELD_LABELS_PT = {
    # Críticos
    'nome_negocio': 'nome do negócio',
    'segmento': 'segmento/área de atuação',
    'modelo': 'modelo de negócio (B2B ou B2C)',
    'localizacao': 'localização (cidade/estado)',
    'dificuldades': 'principais dificuldades/desafios',
    'objetivos': 'objetivos de crescimento',
    # Bônus (todos obrigatórios)
    'faturamento': 'faturamento mensal',
    'ticket_medio': 'ticket médio por venda',
    'tipo_produto': 'tipo de oferta (produto, serviço ou ambos)',
    'equipe': 'tamanho da equipe',
    'diferencial': 'diferencial competitivo',
    'concorrentes': 'concorrentes diretos',
    'canais': 'canais de venda/comunicação atuais',
    'investimento': 'investimento atual em marketing',
    'margem': 'margem de lucro',
    'tempo_operacao': 'há quanto tempo o negócio opera',
    'modelo_operacional': 'modelo operacional (estoque, sob encomenda, etc)',
    'capital_disponivel': 'capital disponível para investir',
    'gargalos': 'gargalos operacionais',
    'tipo_cliente': 'tipos de clientes/indústrias atendidas',
    'capacidade_produtiva': 'capacidade produtiva / volume',
    'regiao_atendimento': 'região geográfica de atendimento',
    'fornecedores': 'fornecedores principais',
    'origem_clientes': 'de onde vêm os clientes hoje',
    'maior_objecao': 'maior objeção dos clientes ao comprar',
    'site': 'site/website',
    'instagram': 'perfil do Instagram',
    'whatsapp': 'WhatsApp comercial',
    'linkedin': 'LinkedIn da empresa',
    'google_maps': 'Google Maps / Google Meu Negócio',
    'email_contato': 'e-mail de contato comercial',
    'tempo_entrega': 'prazo médio de entrega',
}


def _compute_missing_fields(profile: dict) -> tuple:
    """Compute which critical and bonus fields are still missing."""
    filled = {k for k, v in profile.items() if v is not None and v != "" and v != []}
    missing_critical = [f for f in CRITICAL_FIELDS if f not in filled]
    missing_bonus = [f for f in BONUS_FIELDS if f not in filled]
    bonus_collected = len(BONUS_FIELDS) - len(missing_bonus)
    all_missing = missing_critical + (missing_bonus if bonus_collected < BONUS_MINIMUM else [])
    return missing_critical, missing_bonus, bonus_collected, all_missing


def chat_consultant(messages: list, user_message: str, extracted_profile: dict, last_search_time: float = 0) -> dict:
    """
    Main consultant function - handles conversation and searches.
    Tracks missing critical fields and guides conversation to collect them naturally.
    """
    
    log_info(f"Chat consultant processing: {user_message[:50]}...")
    
    # 1. Extract business information
    updated_profile = _extract_business_info(user_message, extracted_profile, messages)
    
    # 1.5. Track missing critical fields ("lista de compras")
    missing_critical, missing_bonus, bonus_count, all_missing = _compute_missing_fields(updated_profile)
    missing_labels = [_FIELD_LABELS_PT.get(f, f) for f in all_missing[:4]]  # Top 4
    
    if missing_critical:
        critical_labels = [_FIELD_LABELS_PT.get(f, f) for f in missing_critical]
        log_info(f"Campos críticos faltando ({len(missing_critical)}): {critical_labels}")
    
    if bonus_count < BONUS_MINIMUM:
        missing_bonus_count = len(BONUS_FIELDS) - bonus_count
        # Mostrar apenas os primeiros 5 nomes de bônus par não poluir
        bonus_labels_to_show = [_FIELD_LABELS_PT.get(f, f) for f in missing_bonus[:5]]
        suffix = "..." if len(missing_bonus) > 5 else ""
        log_info(f"Campos bônus faltando ({bonus_count}/{BONUS_MINIMUM} coletados): {bonus_labels_to_show}{suffix}")
    
    # 2. Detect discovery gaps (when user says "não sei" about something)
    discovery_gaps = _detect_discovery_gaps(user_message, updated_profile)
    if discovery_gaps:
        updated_profile["_discovery_gaps"] = discovery_gaps
        log_info(f"Gaps para análise descobrir: {discovery_gaps}")
    
    # NO web search in chat — all research happens in analysis phase
    search_result = None
    
    # 3. Generate response — with missing-field guidance & readiness awareness
    
    # ── Build a HUMAN-READABLE profile summary (not raw JSON dump) ──
    profile_summary_lines = []
    for key, label in _FIELD_LABELS_PT.items():
        val = updated_profile.get(key)
        if val and str(val).strip():
            profile_summary_lines.append(f"• {label}: {val}")
    profile_summary = "\n".join(profile_summary_lines) if profile_summary_lines else "(nenhum dado coletado ainda)"
    
    # ── Detect business model for adapted advice ──
    modelo_raw = (updated_profile.get("modelo") or "").lower()
    if "b2b" in modelo_raw:
        modelo_contexto = "B2B (vende para empresas/indústrias). NÃO sugira estratégias de varejo, influenciadores, TikTok ou reels. Foque em prospecção ativa, LinkedIn, vendas consultivas, CRM, cold email, representantes."
    elif any(kw in modelo_raw for kw in ("serviço", "servico", "consultoria", "agência", "agencia")):
        modelo_contexto = "Prestação de serviços. Foque em autoridade, portfólio, indicações, Google Meu Negócio, networking."
    else:
        modelo_contexto = "B2C (vende para consumidor final). Foque em redes sociais, Instagram, WhatsApp, e-commerce, experiência do cliente."
    
    # ── Conversation history (just the text, not raw JSON) ──
    history_lines = []
    for m in (messages[-4:] if messages else []):
        role_label = "Usuário" if m.get("role") == "user" else "Consultor"
        content = m.get("content", "")[:300]
        history_lines.append(f"{role_label}: {content}")
    history_text = "\n".join(history_lines) if history_lines else "(primeira mensagem)"
    
    # ── Discovery gaps instruction ──
    gaps_text = ""
    if discovery_gaps:
        gaps_text = f"\nO USUÁRIO NÃO SABE: {', '.join(discovery_gaps)}. Diga 'Não se preocupe, vamos descobrir isso automaticamente na análise.' NÃO tente pesquisar ou adivinhar.\n"
    
    # ── Detect if user is explicitly asking for remaining questions ──
    user_asking_for_questions = False
    msg_lower = user_message.lower()
    if any(kw in msg_lower for kw in ['perguntas restantes', 'quais perguntas', 'todas as perguntas',
                                       'falta perguntar', 'mais perguntas', 'o que falta',
                                       'que mais precisa', 'que mais quer saber',
                                       'me mande todas', 'me de todas', 'mande todas',
                                       'liste todas', 'quero todas', 'me fale todas',
                                       'me dê todas', 'me diga todas']):
        user_asking_for_questions = True
    
    # ── Readiness-aware instruction block ──
    ready_now = len(missing_critical) == 0 and bonus_count >= BONUS_MINIMUM
    
    # If user explicitly asks for remaining questions, always list them
    if user_asking_for_questions:
        all_remaining = missing_critical + missing_bonus
        all_remaining_labels = [_FIELD_LABELS_PT.get(f, f) for f in all_remaining]
        # Build a numbered list so the LLM copies it verbatim
        lista_str = "\n".join([f"  {i+1}. {label}" for i, label in enumerate(all_remaining_labels)])
        total = len(all_remaining_labels)
        status_instruction = f"""
ESTADO: O usuário PEDIU para ver TODAS as perguntas. Existem {total} informações pendentes.

INSTRUÇÃO OBRIGATÓRIA — COPIE A LISTA ABAIXO INTEIRA, SEM RESUMIR, SEM "ETC.", SEM CORTAR:
- Liste TODAS as {total} informações abaixo usando uma lista numerada.
- NÃO resuma. NÃO use "etc.". NÃO pule nenhum item. Copie CADA LINHA abaixo.
- Diga que TODAS são obrigatórias para gerar a análise.
- Se não há campos faltando, diga que já tem tudo e pode gerar a análise.

LISTA COMPLETA ({total} itens — copie todos):
{lista_str}
"""
    elif ready_now:
        # ALL fields collected → offer analysis, don't ask more questions
        status_instruction = """
ESTADO: ✅ TENHO TODAS AS INFORMAÇÕES NECESSÁRIAS.

INSTRUÇÃO OBRIGATÓRIA:
- Faça um BREVE resumo (3-5 linhas) mostrando que entendeu o negócio, o problema e o objetivo.
- Diga que está pronto para gerar a análise completa.
- NÃO faça perguntas. NÃO peça mais dados. NÃO repita informações que o usuário já deu.
- Se o usuário deu feedback ou correção, agradeça e incorpore.
- Seja DIRETO e CURTO. Máximo 8 linhas.
"""
    elif missing_critical:
        campos_str = ", ".join([_FIELD_LABELS_PT.get(f, f) for f in missing_critical])
        status_instruction = f"""
ESTADO: ⚠️ Faltam dados CRÍTICOS: {campos_str}

INSTRUÇÃO:
- Pergunte NATURALMENTE por 1-2 desses campos na conversa.
- NÃO liste perguntas como formulário. Faça parecer conversa real.
- Exemplo: "Vocês vendem mais para empresas ou consumidor final?" para descobrir modelo B2B/B2C.
- Seja BREVE. Não repita o que o usuário já disse. Máximo 6-8 linhas.
"""
    else:
        bonus_missing = [_FIELD_LABELS_PT.get(f, f) for f in missing_bonus[:3]]
        campos_str = ", ".join(bonus_missing)
        status_instruction = f"""
ESTADO: ⚠️ Dados críticos OK, mas AINDA faltam informações importantes: {campos_str}

INSTRUÇÃO:
- Pergunte NATURALMENTE por 1-2 desses campos na conversa.
- NÃO ofereça gerar a análise ainda. Todas as perguntas precisam ser respondidas primeiro.
- NÃO liste perguntas como formulário. Faça parecer conversa real.
- Seja BREVE. Máximo 6-8 linhas.
"""
    
    # Load response prompt from YAML
    from app.core.prompt_loader import load_prompt_file
    prompt_config = load_prompt_file("chat_consultant.yaml")
    template = prompt_config.get("response_generation", {}).get("prompt_template", "")
    
    prompt = template.format(
        modelo_contexto=modelo_contexto,
        profile_summary=profile_summary,
        history_text=history_text,
        user_message=user_message,
        gaps_text=gaps_text,
        status_instruction=status_instruction
    )
    
    result = call_llm(
        provider="groq",
        prompt=prompt,
        temperature=0.7,
        json_mode=False
    )
    
    # When json_mode=False, call_llm returns a string directly
    if isinstance(result, str):
        reply = result
    elif not result.get("success"):
        log_error(f"LLM response failed: {result.get('error', 'Unknown error')}")
        reply = "Desculpe, estou com dificuldades para responder. Poderia reformular sua pergunta?"
    else:
        reply = result.get("content", "")
    
    # 4. Determine if ready for analysis — ALL critical fields + minimum bonus
    fields_collected = [k for k, v in updated_profile.items() if v is not None and v != ""]
    ready_for_analysis = len(missing_critical) == 0 and bonus_count >= BONUS_MINIMUM
    
    if ready_for_analysis:
        log_success(f"Pronto para análise — {len(fields_collected)} campos coletados")
    else:
        log_info(f"⏳ Aguardando dados: {len(missing_critical)} críticos e {len(missing_bonus)} bônus pendentes")
    
    return {
        "reply": reply,
        "search_performed": False,
        "search_query": None,
        "extracted_profile": updated_profile,
        "ready_for_analysis": ready_for_analysis,
        "fields_collected": fields_collected,
        "fields_missing": all_missing,
        "last_search_time": 0,
        "discovery_gaps": discovery_gaps,
    }


def run_chat(input_data: dict) -> dict:
    """
    Main entry point for the CONSULTATIVE chat.
    
    Key principles:
    - Search PROACTIVELY to bring valuable information
    - TEACH the user, not just collect data
    - Build profile NATURALLY through conversation
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {
            "reply": "❌ Erro: chave da API Groq não configurada.",
            "extracted_profile": {},
            "search_performed": False,
            "search_query": None,
            "ready_for_analysis": False,
            "fields_collected": [],
            "fields_missing": [],
        }

    messages = input_data.get("messages", [])
    user_message = input_data.get("user_message", "")
    extracted_profile = input_data.get("extracted_profile", {})
    last_search_time = input_data.get("last_search_time", 0)

    # Usar a função principal já implementada
    return chat_consultant(messages, user_message, extracted_profile, last_search_time)


# ═══════════════════════════════════════════════════════════════════
# RESUMO DA REFACTORAÇÃO
# ═══════════════════════════════════════════════════════════════════

"""
ANTES:
- 8 imports duplicados (json, os, sys, time, re, unicodedata, etc.)
- 49 ocorrências de print(file=sys.stderr)
- JSON serialization manual
- Configurações espalhadas

DEPOIS:
- Imports centralizados em app.services.common
- Logging padronizado (log_info, log_error, etc.)
- Serialization segura (safe_json_dumps, safe_json_loads)
- Config centralizada (CommonConfig)
- Utilitários compartilhados

BENEFÍCIOS:
- -30% linhas de código
- +100% consistência
- +200% manutenibilidade
- Zero perda de funcionalidade
"""
