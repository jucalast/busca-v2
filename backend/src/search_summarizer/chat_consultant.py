"""
Chat Consultant — Real-time AI MARKETING CONSULTANT that has a genuine conversation,
proactively searches the internet to TEACH the user and make decisions TOGETHER.

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

import json
import os
import sys
import time
import re
import unicodedata

from groq import Groq
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
    from collections import Counter
    c1 = Counter(s1)
    c2 = Counter(s2)
    
    # Calculate overlap: how many chars match (with frequencies)
    common = sum((c1 & c2).values())  # min counts for each char
    total = sum(c1.values())  # or could use max(sum(c1.values()), sum(c2.values()))
    
    ratio = common / total if total > 0 else 0
    
    return ratio >= threshold


def _extract_number(text: str) -> float:
    """
    Extract numeric value from monetary text.
    Examples:
    - '5 MIL', '5mil', '5 k' -> 5000.0
    - 'R$ 5.000', '5.000', '5,000' -> 5000.0
    - 'QUINHENTOS' -> None (text numbers not supported yet)
    """
    if not text:
        return None
    
    text_lower = text.lower().strip()
    
    # Pattern 0: Number + "milhão/milhões/milhoes" (millions)
    match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:milh[oõ]es|milh[aã]o)', text_lower)
    if match:
        num_str = match.group(1).replace(',', '.')
        try:
            return float(num_str) * 1_000_000
        except ValueError:
            pass
    
    # Pattern 1: Number + "mil" or "k" (thousands)
    match = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b', text_lower)
    if match:
        num_str = match.group(1).replace(',', '.')
        try:
            return float(num_str) * 1000
        except ValueError:
            pass
    
    # Pattern 2: Plain numbers (5000, 5.000, R$ 5.000)
    match = re.search(r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_lower)
    if match:
        num_str = match.group(1)
        # For Brazilian format: 5.000,50 or 5.000
        # Remove thousand separators, keep only last separator as decimal
        if ',' in num_str and '.' in num_str:
            # Both present: assume European format 5.000,50
            num_str = num_str.replace('.', '').replace(',', '.')
        elif '.' in num_str:
            # Check if it's thousand separator or decimal
            parts = num_str.split('.')
            if len(parts[-1]) == 3 and len(parts) > 1:
                # 5.000 - thousand separator
                num_str = num_str.replace('.', '')
            # else: 5.5 - keep as decimal
        elif ',' in num_str:
            # 5,5 or 5,000 - treat as decimal or thousand
            parts = num_str.split(',')
            if len(parts[-1]) == 3 and len(parts) > 1:
                # 5,000 - thousand separator
                num_str = num_str.replace(',', '')
            else:
                # 5,5 - decimal
                num_str = num_str.replace(',', '.')
        
        try:
            return float(num_str)
        except ValueError:
            pass
    
    return None


load_dotenv()

# ── Required profile fields ──────────────────────────────────────
REQUIRED_FIELDS = [
    "nome_negocio", "segmento", "modelo", "localizacao",
    "dificuldades", "objetivos"
]

# Campos opcionais - coletados naturalmente na conversa
OPTIONAL_FIELDS = [
    "tempo_operacao", "num_funcionarios", "tipo_produto",
    "ticket_medio", "faturamento_mensal", "canais_venda",
    "concorrentes", "diferencial", "cliente_ideal",
    "investimento_marketing"
]

# Campos de contexto - detectados automaticamente
CONTEXT_FIELDS = [
    "modelo_operacional",
    "capital_disponivel",
    "principal_gargalo",
    "margem_lucro",
    "tempo_entrega",
    "origem_clientes",
    "maior_objecao"
]

# Campos de presença digital — coletados naturalmente quando o usuário menciona
DIGITAL_PRESENCE_FIELDS = [
    "instagram_handle",   # @handle do Instagram
    "linkedin_url",       # URL ou nome da página no LinkedIn
    "site_url",           # URL do site
    "email_contato",      # E-mail de contato
    "whatsapp_numero",    # Número do WhatsApp de negócio
    "google_maps_url",    # Link ou nome no Google Maps
]

# Campos prioritários para coleta após os obrigatórios
PRIORITY_OPTIONAL = [
    "capital_disponivel",      # Fundamental para recomendações viáveis
    "num_funcionarios",        # Afeta escala das sugestões
    "canais_venda",           # Situação atual de vendas
    "cliente_ideal",          # Para segmentação
    "ticket_medio",           # Para estratégias de preço
    "modelo_operacional",     # Como funciona o negócio
    "faturamento_mensal"      # Porte do negócio
]

ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS + CONTEXT_FIELDS + DIGITAL_PRESENCE_FIELDS
MINIMUM_FOR_ANALYSIS = REQUIRED_FIELDS + PRIORITY_OPTIONAL

FIELD_LABELS_PT = {
    "nome_negocio": "nome do negócio",
    "segmento": "segmento/nicho",
    "modelo": "modelo (B2B/B2C/Misto)",
    "localizacao": "cidade/estado",
    "dificuldades": "maiores dificuldades/desafios",
    "objetivos": "objetivos de crescimento",
    "tempo_operacao": "tempo de operação",
    "num_funcionarios": "tamanho da equipe",
    "tipo_produto": "tipo de produto/serviço",
    "ticket_medio": "ticket médio",
    "faturamento_mensal": "faturamento médio mensal",
    "canais_venda": "canais de venda atuais",
    "concorrentes": "principais concorrentes",
    "diferencial": "seu diferencial competitivo",
    "cliente_ideal": "perfil do cliente ideal",
    "investimento_marketing": "investimento mensal em marketing",
    "capital_disponivel": "quanto pode investir por mês",
    "num_funcionarios": "quantas pessoas na equipe",
    "canais_venda": "onde/como vende hoje",
    "cliente_ideal": "perfil do cliente ideal",
    "ticket_medio": "valor médio por venda",
    "modelo_operacional": "como funciona sua operação",
    "faturamento_mensal": "faturamento médio mensal",
    "principal_gargalo": "principal gargalo",
    "margem_lucro": "margem de lucro",
    "tempo_entrega": "prazo de entrega", 
    "origem_clientes": "origem dos clientes",
    "maior_objecao": "maior objeção dos clientes",
    "instagram_handle": "@ do Instagram",
    "linkedin_url": "LinkedIn da empresa",
    "site_url": "site/URL do negócio",
    "email_contato": "e-mail de contato",
    "whatsapp_numero": "número do WhatsApp",
    "google_maps_url": "link/nome no Google Maps",
}

# ── Fields the AI can RESEARCH when user doesn't know ──────────────────
RESEARCHABLE_FIELDS = {
    "concorrentes": {
        "search_template": "concorrentes de {tipo_produto} {segmento} em {localizacao} lojas similares marcas",
        "description": "Identificar concorrentes na região",
        "task_template": "Realizar estudo aprofundado de concorrência: mapear os principais concorrentes de {nome_negocio}, suas estratégias, preços e diferenciais na região de {localizacao}",
    },
    "cliente_ideal": {
        "search_template": "{segmento} {tipo_produto} {localizacao} perfil cliente típico público-alvo quem compra",
        "description": "Definir perfil do cliente ideal",
        "task_template": "Criar persona detalhada do cliente ideal de {nome_negocio}: mapear demografia, comportamento de compra, dores e desejos",
    },
    "diferencial": {
        "search_template": "{segmento} {tipo_produto} diferencial competitivo como se destacar mercado",
        "description": "Identificar possíveis diferenciais competitivos",
        "task_template": "Definir posicionamento e diferencial competitivo de {nome_negocio}: análise SWOT e proposta de valor",
    },
    "margem_lucro": {
        "search_template": "{segmento} {tipo_produto} margem de lucro média percentual setor brasil",
        "description": "Pesquisar margens típicas do setor",
        "task_template": "Analisar estrutura de custos e margem de {nome_negocio}: identificar oportunidades de melhoria",
    },
    "ticket_medio": {
        "search_template": "{segmento} {tipo_produto} {localizacao} preço médio quanto custa",
        "description": "Pesquisar preços típicos do mercado",
        "task_template": "Realizar análise de precificação para {nome_negocio}: comparar com concorrentes e identificar oportunidades",
    },
    "principal_gargalo": {
        "search_template": "{segmento} {tipo_produto} pequena empresa gargalos operacionais desafios comuns",
        "description": "Identificar gargalos típicos do setor",
        "task_template": "Diagnosticar gargalos operacionais de {nome_negocio}: mapear processos e identificar ineficiências",
    },
    "origem_clientes": {
        "search_template": "{segmento} {tipo_produto} {localizacao} como conseguir clientes canais aquisição",
        "description": "Pesquisar canais típicos de aquisição de clientes",
        "task_template": "Mapear jornada de aquisição de clientes de {nome_negocio}: identificar os melhores canais",
    },
    "maior_objecao": {
        "search_template": "{segmento} {tipo_produto} objeções clientes reclamações motivos não comprar",
        "description": "Pesquisar objeções comuns do setor",
        "task_template": "Identificar e criar estratégias para superar objeções de compra dos clientes de {nome_negocio}",
    },
}

# Complete ordered list of ALL fields to collect
ALL_COLLECTIBLE_FIELDS_ORDER = [
    # Required (must collect first)
    "nome_negocio", "segmento", "modelo", "localizacao", "dificuldades", "objetivos",
    # Priority (collect next)
    "capital_disponivel", "num_funcionarios", "canais_venda", "cliente_ideal",
    "ticket_medio", "modelo_operacional", "faturamento_mensal",
    # Optional (collect after priority)
    "tempo_operacao", "tipo_produto", "concorrentes", "diferencial",
    # Context (collect last, many can be researched)
    "principal_gargalo", "margem_lucro", "origem_clientes", "maior_objecao", "tempo_entrega",
    # Digital presence — collected naturally when mentioned
    "instagram_handle", "linkedin_url", "site_url", "email_contato",
    "whatsapp_numero", "google_maps_url",
]

# Prompts for ALL collectible fields
FIELD_PROMPTS_ALL = {
    "nome_negocio": "Qual o nome do seu negócio?",
    "segmento": "Em que segmento/área você atua?",
    "modelo": "Você atende empresas (B2B) ou pessoas físicas (B2C)?",
    "localizacao": "Em que cidade você atende?",
    "dificuldades": "Qual seu maior desafio hoje no negócio?",
    "objetivos": "Qual sua principal meta para os próximos meses?",
    "capital_disponivel": "Quanto você pode investir por mês em marketing/crescimento?",
    "num_funcionarios": "Você trabalha sozinho ou tem equipe? Quantas pessoas?",
    "canais_venda": "Onde/como você vende hoje? Instagram, loja física, site?",
    "cliente_ideal": "Descreva seu cliente ideal - idade, perfil, características.",
    "ticket_medio": "Qual o valor médio de cada venda?",
    "modelo_operacional": "Como funciona sua operação? Tem estoque, trabalha sob encomenda?",
    "faturamento_mensal": "Qual seu faturamento médio mensal aproximadamente?",
    "tempo_operacao": "Há quanto tempo o negócio está operando?",
    "tipo_produto": "Você vende produto, serviço, ou ambos?",
    "concorrentes": "Quais são seus principais concorrentes?",
    "diferencial": "Qual é o diferencial do seu negócio?",
    "principal_gargalo": "Qual é o principal gargalo da sua operação?",
    "margem_lucro": "Qual é sua margem de lucro aproximada?",
    "origem_clientes": "De onde vêm seus clientes? Como eles te encontram?",
    "maior_objecao": "Qual é a principal objeção dos seus clientes?",
    "tempo_entrega": "Qual é o prazo médio de entrega?",
    "instagram_handle": "Qual o @ do seu Instagram?",
    "linkedin_url": "Tem LinkedIn da empresa? Qual o link ou nome?",
    "site_url": "Qual o endereço do seu site?",
    "email_contato": "Qual o e-mail de contato do negócio?",
    "whatsapp_numero": "Qual o número do WhatsApp do negócio?",
    "google_maps_url": "Está no Google Maps? Qual o link ou nome exato?",
}


def _infer_fields_from_context(messages: list, extracted_profile: dict) -> dict:
    """
    Infer field values from conversation history without asking the user.
    Prevents asking obvious questions like tipo_produto when user said 'fabrico e vendo brownies'.
    """
    inferred = {}
    all_user_text = " ".join(
        m.get("content", "") for m in messages if m.get("role") == "user"
    ).lower()

    # ── tipo_produto ──
    if not extracted_profile.get("tipo_produto"):
        prod_patterns = r"fabric|vend[oe].*(?:brownie|bolo|doce|roupa|sapato|produto|mercadoria|artesanato|comida|salgado|camiseta|acessório|joia|bijuteria|cosmétic|móve[il]|móveis|planta|flor|cerveja|chocolate|pão|queijo|vela|sabonete)"
        serv_patterns = r"presto.*servi[cç]o|consultoria|atendo.*cliente|marido de aluguel|design|fotograf|advogad|conta[db]|coach|personal|aula|curso|mentori|faxin|limpeza|manuten[cç]"
        if re.search(prod_patterns, all_user_text):
            inferred["tipo_produto"] = "produto"
        elif re.search(serv_patterns, all_user_text):
            inferred["tipo_produto"] = "serviço"
        elif re.search(r"(?:vendo|faço|ofereço).{0,15}(?:produto|mercadoria)", all_user_text):
            inferred["tipo_produto"] = "produto"

    # ── modelo_operacional ──
    if not extracted_profile.get("modelo_operacional"):
        if re.search(r"compro.{0,25}ingrediente|fa[cç]o eu mesm|fabrico|produzo|cozinho|fa[cç]o.*caseiro|produ[cç][aã]o pr[oó]pria", all_user_text):
            inferred["modelo_operacional"] = "fabricação própria"
        elif re.search(r"revend|compro.{0,15}pronto|import|atacado", all_user_text):
            inferred["modelo_operacional"] = "revenda"
        elif re.search(r"sob encomenda|encomenda|primeiro.*paga|depois.*fa[cç]o", all_user_text):
            inferred["modelo_operacional"] = "sob encomenda"

    # ── canais_venda ──
    if not extracted_profile.get("canais_venda"):
        canais = []
        if re.search(r"instagram|insta\b", all_user_text):
            canais.append("Instagram")
        if re.search(r"na rua|ambulante|vendo.*rua", all_user_text):
            canais.append("venda na rua")
        if re.search(r"whatsapp|wpp|zap", all_user_text):
            canais.append("WhatsApp")
        if re.search(r"loja\s+f[ií]sica|ponto.*comercial|minha loja", all_user_text):
            canais.append("loja física")
        if re.search(r"site|e-?commerce|loja virtual|shopee|mercado livre|shopify", all_user_text):
            canais.append("online")
        if re.search(r"ifood|rappi|uber eats|delivery", all_user_text):
            canais.append("delivery")
        if canais:
            inferred["canais_venda"] = ", ".join(canais)

    # ── num_funcionarios ──
    if not extracted_profile.get("num_funcionarios"):
        if re.search(r"trabalho sozinho|s[oó] eu|eu mesm[oa]|empreendedor solo|somente eu|apenas eu|toco sozinho", all_user_text):
            inferred["num_funcionarios"] = "sozinho"

    # ── instagram_handle ── extract @handle from any user message
    if not extracted_profile.get("instagram_handle"):
        handle_match = re.search(r"@([a-zA-Z0-9_.]{2,30})", all_user_text)
        if handle_match:
            inferred["instagram_handle"] = "@" + handle_match.group(1)
        else:
            # "meu instagram é spcom.autopecas" style
            ig_match = re.search(r"instagram[^\w]*(?:é|e|:)?\s*([a-zA-Z0-9_.]{3,30})", all_user_text)
            if ig_match:
                inferred["instagram_handle"] = "@" + ig_match.group(1)

    # ── site_url ── extract URL or domain (reject social media URLs)
    SOCIAL_DOMAINS = ["instagram.com", "linkedin.com", "facebook.com", "twitter.com", "x.com", "tiktok.com", "youtube.com"]
    if not extracted_profile.get("site_url"):
        url_match = re.search(r"(https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com\.br|com|net|org|io|app)[^\s]*)", all_user_text)
        if url_match:
            url = url_match.group(1)
            if not url.startswith("http"):
                url = "https://" + url
            # Do NOT accept social media URLs as site_url
            if not any(sd in url.lower() for sd in SOCIAL_DOMAINS):
                inferred["site_url"] = url
    # Also validate if LLM extracted a social media URL as site_url
    existing_site = extracted_profile.get("site_url", "")
    if existing_site and any(sd in existing_site.lower() for sd in SOCIAL_DOMAINS):
        print(f"  ⚠️ site_url rejeitado (é rede social): {existing_site}", file=sys.stderr)
        extracted_profile.pop("site_url", None)

    # ── linkedin_url ── extract LinkedIn URL or company name
    if not extracted_profile.get("linkedin_url"):
        li_match = re.search(r"linkedin\.com/(?:company|in)/([^\s/]+)", all_user_text)
        if li_match:
            inferred["linkedin_url"] = "https://linkedin.com/company/" + li_match.group(1)
        else:
            li_name = re.search(r"linkedin[^\w]*(?:é|e|:)?\s*([a-zA-Z0-9\s-]{3,50})", all_user_text)
            if li_name:
                inferred["linkedin_url"] = li_name.group(1).strip()

    # ── whatsapp_numero ── extract phone number
    if not extracted_profile.get("whatsapp_numero"):
        phone_match = re.search(r"(?:whatsapp|zap|wpp|fone|tel|celular)[^\d]*(\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4})", all_user_text)
        if phone_match:
            inferred["whatsapp_numero"] = phone_match.group(1).strip()
        else:
            # standalone phone number pattern
            bare_phone = re.search(r"\(?\d{2}\)?\s*9\d{4}[-\s]?\d{4}", all_user_text)
            if bare_phone:
                inferred["whatsapp_numero"] = bare_phone.group(0).strip()

    # ── email_contato ── extract email address
    if not extracted_profile.get("email_contato"):
        email_match = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", all_user_text)
        if email_match:
            inferred["email_contato"] = email_match.group(0)

    # ── google_maps_url ── extract Maps link
    if not extracted_profile.get("google_maps_url"):
        maps_match = re.search(r"maps\.google\.[^\s]+|goo\.gl/maps/[^\s]+|maps\.app\.goo\.gl/[^\s]+", all_user_text)
        if maps_match:
            inferred["google_maps_url"] = maps_match.group(0)

    return inferred


def detect_research_response(user_message: str) -> str:
    """Detect if user is confirming, rejecting, or modifying a pending research result.
    Returns: 'confirm', 'reject', or 'other'
    """
    msg_lower = user_message.lower().strip()
    
    confirm_patterns = [
        r"^(sim|ok|tá bom|ta bom|pode ser|concordo|isso|exato|correto|beleza|perfeito|legal|certo|certinho)[\s!.]*$",
        r"(esses mesmo|são esses|sao esses|concordo|isso mesmo|é isso|certinho|faz sentido)",
        r"(pode ser|tá certo|ta certo|isso aí|isso ai|valeu|show|massa|boa)",
    ]
    
    reject_patterns = [
        r"(não|nao).{0,15}(é|são|sao|concordo|certo|isso|esse|essa|faz sentido)",
        r"(discordo|errado|incorreto|melhora|refaz|refaça|pesquisa.{0,10}de novo)",
        r"(na verdade|diferente|não é bem|nao e bem|nada a ver|sem sentido)",
        r"^(não|nao|n)[\s!.]*$",
        r"(não faz sentido|nao faz sentido)",
    ]
    
    # Check reject FIRST — negation takes priority over partial confirm matches
    for pattern in reject_patterns:
        if re.search(pattern, msg_lower):
            return "reject"
    
    for pattern in confirm_patterns:
        if re.search(pattern, msg_lower):
            return "confirm"
    
    return "other"


def get_field_from_context(messages: list) -> str:
    """Detect which field the conversation is currently asking about based on last assistant message."""
    field_keywords = {
        "concorrentes": ["concorrente", "concorrência", "concorrencia", "competidor"],
        "cliente_ideal": ["cliente ideal", "público-alvo", "publico-alvo", "perfil do cliente", "quem compra"],
        "diferencial": ["diferencial", "destaca", "diferencia", "especial do seu"],
        "ticket_medio": ["ticket", "valor médio", "valor medio", "preço médio", "preco medio"],
        "margem_lucro": ["margem", "lucro", "rentabilidade"],
        "principal_gargalo": ["gargalo", "maior problema", "principal problema", "limitação"],
        "origem_clientes": ["origem", "como encontram", "onde encontram", "como te acham"],
        "maior_objecao": ["objeção", "objecao", "por que não compram", "desistência"],
        "capital_disponivel": ["investir", "capital", "orçamento", "orcamento", "quanto pode"],
        "num_funcionarios": ["equipe", "funcionário", "funcionario", "sozinho", "quantas pessoas"],
        "canais_venda": ["onde vende", "como vende", "canal de venda", "canais"],
        "modelo_operacional": ["operação", "operacao", "funciona sua", "estoque", "encomenda"],
        "faturamento_mensal": ["faturamento", "fatura", "receita mensal"],
        "tempo_operacao": ["há quanto tempo", "quando abriu", "quando começou", "tempo de operação"],
        "tipo_produto": ["produto ou serviço", "produto ou servico", "o que vende", "tipo de produto"],
    }
    
    for m in reversed(messages[-3:]):
        if m.get("role") != "assistant":
            continue
        content = m.get("content", "").lower()
        for field, keywords in field_keywords.items():
            if any(kw in content for kw in keywords):
                return field
    
    return None


def _parse_retry_wait_chat(error_msg: str) -> int:
    """Extract wait time in seconds from Groq rate limit error message."""
    match = re.search(r"try again in (\d+)m([\d.]+)s", error_msg)
    if match:
        return int(match.group(1)) * 60 + int(float(match.group(2)))
    match = re.search(r"try again in ([\d.]+)s", error_msg)
    if match:
        return int(float(match.group(1)))
    return 0


def call_groq_single(api_key: str, messages: list, temperature: float = 0.4,
                     max_retries: int = 2, json_mode: bool = True,
                     prefer_small: bool = False) -> str:
    """
    Groq chat completion with multi-model fallback across separate TPD quotas.
    Returns raw content string.
    If prefer_small=True, starts with the small model to save rate limit.
    """
    client = Groq(api_key=api_key)

    if prefer_small:
        models = [
            "llama-3.1-8b-instant",
            "llama3-8b-8192",
            "llama3-70b-8192",
            "llama-3.3-70b-versatile",
        ]
    else:
        models = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "llama3-8b-8192",
            "llama3-70b-8192",
        ]

    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    for mi, model in enumerate(models):
        for attempt in range(max_retries):
            try:
                completion = client.chat.completions.create(
                    messages=messages,
                    model=model,
                    temperature=temperature,
                    **kwargs,
                )
                content = completion.choices[0].message.content
                if mi > 0:
                    print(f"  ⚡ Chat usando fallback: {model}", file=sys.stderr)
                return content
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg
                is_tpd = "tokens per day" in error_msg.lower() or "TPD" in error_msg

                is_model_error = "400" in error_msg and ("does not exist" in error_msg or "not supported" in error_msg or "decommissioned" in error_msg or "The model" in error_msg)

                if is_model_error and mi < len(models) - 1:
                    print(f"  ⚠️ Modelo {model} indisponível. Trocando...", file=sys.stderr)
                    break

                if is_rate_limit and is_tpd and mi < len(models) - 1:
                    print(f"  🔄 TPD esgotado em {model}. Trocando modelo...", file=sys.stderr)
                    break
                elif is_rate_limit and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(f"  ⏳ Rate limit ({model}). Aguardando {wait_time}s...", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                elif is_rate_limit and mi < len(models) - 1:
                    print(f"  🔄 Rate limit esgotado em {model}. Trocando modelo...", file=sys.stderr)
                    break
                raise
    raise Exception("Todos os modelos esgotaram o rate limit diário.")


def should_search_proactively(user_message: str, messages: list, extracted_profile: dict) -> dict:
    """
    RESEARCH-DRIVEN LOGIC - searches when user doesn't know something.
    Now handles field-specific research for ALL researchable fields.
    
    Returns: { should_search: bool, query: str|null, purpose: str, field_being_researched: str|null }
    """
    msg_lower = user_message.lower()
    segmento = extracted_profile.get("segmento", "")
    localizacao = extracted_profile.get("localizacao", "")
    nome = extracted_profile.get("nome_negocio", "")
    tipo_produto = extracted_profile.get("tipo_produto", "")
    
    no_result = {"should_search": False, "query": None, "purpose": None, "field_being_researched": None}
    
    # Count past searches
    past_searches = sum(1 for m in messages if m.get("role") == "assistant" and "🔍" in m.get("content", ""))
    
    # ━━━ 1. USER DOESN'T KNOW OR ASKS FOR HELP ━━━
    dont_know_patterns = [
        r"não sei|nao sei|pesquisa|me ajuda|não conheço|nao conheco",
        r"vish.*não sei|não faço ideia|não tenho certeza|ajuda.*descobrir",
        r"nao tenho ideia|sei lá|sei la|não sei dizer|nao sei dizer",
        r"pode pesquisar|pesquisa pra mim|pesquisa ai|busca pra mim",
    ]
    
    user_doesnt_know = False
    for pattern in dont_know_patterns:
        if re.search(pattern, msg_lower):
            user_doesnt_know = True
            break
    
    if user_doesnt_know:
        # Track already-researched fields to prevent loops
        already_researched = extracted_profile.get("_fields_researched", [])
        
        # Determine the next field we SHOULD be collecting (from ordered list)
        next_collectible = None
        for f in ALL_COLLECTIBLE_FIELDS_ORDER:
            if not extracted_profile.get(f) and f != "investimento_marketing" and not f.startswith("_"):
                next_collectible = f
                break
        
        # Also detect field from last assistant message context
        field_from_context = get_field_from_context(messages)
        
        # Prefer next_collectible if researchable AND not already researched
        field = None
        if next_collectible and next_collectible in RESEARCHABLE_FIELDS and next_collectible not in already_researched:
            field = next_collectible
        elif field_from_context and field_from_context in RESEARCHABLE_FIELDS and field_from_context not in already_researched:
            field = field_from_context
        else:
            # Scan ahead for next researchable field NOT already researched
            for f in ALL_COLLECTIBLE_FIELDS_ORDER:
                if not extracted_profile.get(f) and f in RESEARCHABLE_FIELDS and f not in already_researched:
                    field = f
                    break
        
        if field:
            # Build targeted search query for this specific field
            config = RESEARCHABLE_FIELDS[field]
            query = config["search_template"].format(
                segmento=segmento or "pequenos negócios",
                localizacao=localizacao or "Brasil",
                nome_negocio=nome or "negócio",
                tipo_produto=tipo_produto or segmento or "",
            )
            return {
                "should_search": True,
                "query": query,
                "purpose": config["description"],
                "field_being_researched": field,
            }
        
        # Fallback: try common field patterns from the question
        recent_question = ""
        for m in reversed(messages[-3:]):
            if m.get("role") == "assistant":
                content = m.get("content", "")
                if "?" in content:
                    recent_question = content.split("?")[0].split(". ")[-1].lower()
                    break
        
        # Map question keywords to fields and queries
        keyword_map = [
            ("concorrent", "concorrentes", f"concorrentes {segmento} {localizacao} principais empresas mercado"),
            ("cliente", "cliente_ideal", f"{segmento} {localizacao} perfil cliente típico quem compra"),
            ("público", "cliente_ideal", f"{segmento} {localizacao} perfil cliente típico público-alvo"),
            ("diferencial", "diferencial", f"{segmento} diferencial competitivo como se destacar"),
            ("margem", "margem_lucro", f"{segmento} margem de lucro média setor brasil"),
            ("lucro", "margem_lucro", f"{segmento} margem de lucro média setor brasil"),
            ("ticket", "ticket_medio", f"{segmento} {localizacao} preço médio ticket venda"),
            ("preço", "ticket_medio", f"{segmento} {localizacao} preço médio ticket venda"),
            ("gargalo", "principal_gargalo", f"{segmento} principais problemas gargalos desafios empresas"),
            ("limitação", "principal_gargalo", f"{segmento} principais limitações desafios pequenas empresas"),
            ("origem", "origem_clientes", f"{segmento} {localizacao} canais aquisição clientes marketing"),
            ("objeção", "maior_objecao", f"{segmento} objeções clientes reclamações motivos não comprar"),
            ("desafio", None, f"{segmento} principais desafios problemas comuns empresas"),
            ("objetivo", None, f"{segmento} objetivos crescimento metas comuns empresas"),
        ]
        
        for keyword, field_name, query in keyword_map:
            if keyword in recent_question or keyword in msg_lower:
                return {
                    "should_search": True,
                    "query": query,
                    "purpose": f"Pesquisa sobre {FIELD_LABELS_PT.get(field_name, keyword) if field_name else keyword}",
                    "field_being_researched": field_name,
                }
        
        # Generic fallback research
        if segmento:
            query = f"{segmento} {localizacao} informações mercado características"
        else:
            query = f"{nome} negócio informações mercado"
        return {"should_search": True, "query": query, "purpose": "Pesquisa geral", "field_being_researched": None}
    
    # ━━━ 2. USER MENTIONS PROBLEMS THAT NEED SOLUTIONS ━━━
    problem_patterns = {
        r"mais cliente|poucos cliente|falta.*client|não vend|dificil.*vend|problema.*venda": 
            ("como conseguir mais clientes {segmento} {localizacao} estratégias marketing", "Como conseguir mais clientes"),
        r"não sei.*precific|quanto.*cobr|preço|margem": 
            ("precificação {segmento} como definir preços margem", "Ajuda com precificação"),
        r"concorrênc|competiç|outros.*vendêo": 
            ("concorrentes {segmento} {localizacao} como competir diferenciação", "Análise de concorrência"),
        r"marketing|divulg|promov.*negócio": 
            ("marketing {segmento} {localizacao} estratégias promocionais", "Estratégias de marketing"),
    }
    
    for pattern, (query_template, purpose) in problem_patterns.items():
        if re.search(pattern, msg_lower) and past_searches < 5:
            query = query_template.replace("{segmento}", segmento or "pequenos negócios").replace("{localizacao}", localizacao or "Brasil")
            return {"should_search": True, "query": query, "purpose": purpose, "field_being_researched": None}
    
    # ━━━ 3. EARLY MARKET RESEARCH ━━━
    msg_count = len(messages)
    if msg_count <= 4 and segmento and localizacao and past_searches == 0:
        query = f"{segmento} {localizacao} mercado oportunidades público-alvo"
        return {"should_search": True, "query": query, "purpose": "Pesquisa inicial de mercado", "field_being_researched": None}
    
    return no_result


def search_internet(query: str, region: str = "br-pt") -> dict:
    """Search DuckDuckGo and scrape top results. Returns dict with text and sources."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, script_dir)
    from cli import search_duckduckgo, scrape_page

    print(f"  🔍 Buscando: {query}", file=sys.stderr)
    results = search_duckduckgo(query, max_results=4, region=region)

    if not results:
        return {"text": "Nenhum resultado encontrado.", "sources": []}

    aggregated = ""
    sources = []
    for i, r in enumerate(results):
        url = r.get('href', '')
        title = r.get('title', '')
        snippet = r.get('body', '')
        aggregated += f"[{title}]: {snippet}\n"
        if url:
            sources.append({"title": title, "url": url})
        if i < 2:  # Scrape top 2 results for more depth
            content = scrape_page(url)
            if content:
                aggregated += f"  Detalhes: {content[:1500]}\n"

    return {"text": aggregated[:5000], "sources": sources}


def _check_search_relevance(search_text: str, segmento: str, tipo_produto: str) -> bool:
    """
    Quick relevance check: do the search results actually mention our segment?
    Returns True if results seem relevant, False if garbage (e.g. perfumaria for brownies).
    """
    if not search_text or not segmento:
        return True  # Can't check, assume OK
    
    text_lower = _normalize(search_text)
    seg_words = [w for w in _normalize(segmento).split() if len(w) > 3]
    tp_words = [w for w in _normalize(tipo_produto or "").split() if len(w) > 3]
    
    check_words = seg_words + tp_words
    if not check_words:
        return True
    
    hits = sum(1 for w in check_words if w in text_lower)
    return hits >= 1  # At least one keyword from segment/tipo must appear


def generate_reply(api_key: str, messages: list, user_message: str,
                   extracted_profile: dict, search_context: str = None,
                   search_purpose: str = None, field_being_researched: str = None,
                   research_pending: dict = None) -> dict:
    """
    CONSULTATIVE REPLY GENERATION.
    
    This is NOT a form. The AI must:
    1. TEACH the user when they don't know something
    2. USE search data to give CONCRETE, SPECIFIC advice
    3. Build PROFILE NATURALLY through conversation, not interrogation
    4. Make the user feel like they're getting VALUE, not filling a questionnaire
    """
    collected = [f for f in ALL_FIELDS if extracted_profile.get(f)]
    missing_required = [f for f in REQUIRED_FIELDS if not extracted_profile.get(f)]
    missing_optional = [f for f in OPTIONAL_FIELDS if not extracted_profile.get(f)]
    missing_context = [f for f in CONTEXT_FIELDS if not extracted_profile.get(f)]

    # Build context about what we know
    known_context = ""
    segmento = extracted_profile.get("segmento", "")
    if segmento:
        known_context += f"- Segmento: {segmento}\n"
    if extracted_profile.get("modelo_operacional"):
        known_context += f"- Modelo: {extracted_profile['modelo_operacional']}\n"
    if extracted_profile.get("dificuldades"):
        known_context += f"- Dificuldades: {extracted_profile['dificuldades']}\n"
    if extracted_profile.get("capital_disponivel"):
        known_context += f"- Capital: {extracted_profile['capital_disponivel']}\n"
    if extracted_profile.get("num_funcionarios"):
        known_context += f"- Equipe: {extracted_profile['num_funcionarios']}\n"

    # Build teaching block from search
    teaching_block = ""
    if search_context and search_purpose:
        if field_being_researched:
            field_label = FIELD_LABELS_PT.get(field_being_researched, field_being_researched)
            teaching_block = f"""
🔍 DADOS DA PESQUISA PARA "{field_label}" (propósito: {search_purpose}):
{search_context}

INSTRUÇÃO CRÍTICA - APRESENTE OS ACHADOS PARA CONFIRMAÇÃO:
O usuário NÃO SABE sobre "{field_label}". Você pesquisou e encontrou dados acima.
FAÇA EXATAMENTE ISTO:
1. Apresente um RESUMO dos achados relevantes (2-3 itens concretos da pesquisa)
2. Explique brevemente por que são relevantes para o negócio dele
3. Diga: "Precisaremos fazer um estudo mais detalhado depois, já vou marcar uma tarefa para isso."
4. Pergunte: "Concorda com essa análise inicial? Pode ajustar como quiser."
5. NO JSON updated_profile, coloque o valor sugerido no campo "{field_being_researched}"
6. NÃO passe para outro campo - espere a confirmação do usuário
"""
        else:
            teaching_block = f"""
🔍 DADOS DA PESQUISA (propósito: {search_purpose}):
{search_context}

INSTRUÇÃO - USE OS DADOS:
- Ofereça 2-3 opções específicas baseadas na pesquisa
- Termine perguntando se ele concorda com alguma opção
"""

    # Build pending research block
    pending_block = ""
    if research_pending:
        pending_field = research_pending.get("field", "")
        pending_value = research_pending.get("suggested_value", "")
        pending_label = FIELD_LABELS_PT.get(pending_field, pending_field)
        pending_block = f"""
⏳ PESQUISA PENDENTE DE CONFIRMAÇÃO:
Você pesquisou sobre "{pending_label}" e sugeriu: "{pending_value}"
Aguardando confirmação do usuário.
- Se confirmar: Aceite, agradeça, e passe para o PRÓXIMO campo
- Se rejeitar: Peça o que ele acha correto, ou ofereça pesquisar de novo
- Se der outra resposta: Use a resposta dele como valor do campo
"""

    # Determine what info we still need - ALL fields in order
    missing_required = [f for f in REQUIRED_FIELDS if not extracted_profile.get(f)]
    missing_priority = [f for f in PRIORITY_OPTIONAL if not extracted_profile.get(f)]
    missing_optional = [f for f in OPTIONAL_FIELDS if not extracted_profile.get(f) and f not in PRIORITY_OPTIONAL]
    missing_context = [f for f in CONTEXT_FIELDS if not extracted_profile.get(f)]
    
    all_remaining = [f for f in ALL_COLLECTIBLE_FIELDS_ORDER
                     if not extracted_profile.get(f)
                     and f != "investimento_marketing"
                     and not f.startswith("_")]
    
    next_field = all_remaining[0] if all_remaining else None
    next_field_hint = ""
    if next_field:
        is_researchable = next_field in RESEARCHABLE_FIELDS
        research_note = " (Se o usuário disser 'não sei', PESQUISE usando dados do perfil)" if is_researchable else ""
        next_field_hint = f"PRÓXIMO CAMPO A COLETAR: {FIELD_LABELS_PT.get(next_field, next_field)}{research_note}"
    else:
        next_field_hint = "TODOS OS CAMPOS COLETADOS - sugira gerar análise"

    # Clean profile for display (exclude internal fields)
    display_profile = {k: v for k, v in extracted_profile.items() if not str(k).startswith("_") and v}
    display_profile_json = json.dumps(display_profile, ensure_ascii=False, indent=2)

    system_prompt = f"""Você é uma CONSULTORA DE CRESCIMENTO simpática e objetiva.
Seu ÚNICO objetivo agora é ENTENDER o negócio do usuário. Você está na FASE DE COLETA.

PERFIL COLETADO (NUNCA apague dados existentes):
{display_profile_json}

{teaching_block}{pending_block}
{next_field_hint}

╔═══════════════════════════════════════════════╗
║        REGRAS ABSOLUTAS (QUEBRE = FALHA)      ║
╚═══════════════════════════════════════════════╝

1. NUNCA ECOE: Não repita, reformule ou parafraseie o que o usuário acabou de dizer.
   ❌ "Entendi! Você fabrica e vende brownies. Isso é incrível!"
   ❌ "Você vende brownies na rua, legal!"
   ✅ "Show!" → próxima pergunta

2. NUNCA DÊ CONSELHOS durante a coleta:
   ❌ "Você já pensou em aumentar a visibilidade nas redes sociais?"
   ❌ "Uma dica: tente usar Instagram Reels."
   ✅ Apenas colete informações. Conselhos vêm DEPOIS.

3. NUNCA REPITA PERGUNTAS: Se o usuário já mencionou algo, NÃO pergunte de novo.
   Ex: Se disse "compro ingredientes semanalmente", NÃO pergunte sobre compras.
   Ex: Se disse "fabrico e vendo brownies", NÃO pergunte "produto ou serviço?"

4. MÁXIMO 1 FRASE de reconhecimento + 1 PERGUNTA. Total: 2-3 frases curtas.
   Reconhecimentos válidos: "Show!", "Legal!", "Entendi!", "Ótimo!", "Beleza!", "Perfeito!"

5. UMA PERGUNTA por mensagem. Sempre o PRÓXIMO campo faltante.

🔍 QUANDO O USUÁRIO NÃO SOUBER:
- Apresente 2-3 achados concretos da pesquisa
- Diga: "Marquei uma tarefa pra aprofundar isso depois."
- Pergunte: "Faz sentido?" e espere confirmação

FORMATO DA RESPOSTA:
- Reconhecimento curto (1 palavra/frase)
- Pergunta direta do próximo campo
- SEM listas, SEM checklist, SEM resumos do que já foi coletado

EXTRAÇÃO JSON — salve EXATAMENTE o que o usuário disse:
- "fabrico e vendo brownies" → tipo_produto: "produto", segmento: "brownies caseiros"
- "B2C" → modelo: "B2C" (NUNCA em segmento)
- "Vendo na loja e WhatsApp" → canais_venda: "loja física, WhatsApp"
- NUNCA retorne null para campos já coletados
- investimento_marketing deve ser sempre null — use capital_disponivel

Retorne JSON:
{{
    "reply": "<sua resposta — máximo 2-3 frases>",
    "updated_profile": {{
        "nome_negocio": "{extracted_profile.get('nome_negocio') or 'null'}",
        "segmento": "{extracted_profile.get('segmento') or 'null'}",
        "modelo": "{extracted_profile.get('modelo') or 'null'}",
        "localizacao": "{extracted_profile.get('localizacao') or 'null'}",
        "dificuldades": "{extracted_profile.get('dificuldades') or 'null'}",
        "objetivos": "{extracted_profile.get('objetivos') or 'null'}",
        "capital_disponivel": "{extracted_profile.get('capital_disponivel') or 'null'}",
        "num_funcionarios": "{extracted_profile.get('num_funcionarios') or 'null'}",
        "ticket_medio": "{extracted_profile.get('ticket_medio') or 'null'}",
        "faturamento_mensal": "{extracted_profile.get('faturamento_mensal') or 'null'}",
        "canais_venda": "{extracted_profile.get('canais_venda') or 'null'}",
        "cliente_ideal": "{extracted_profile.get('cliente_ideal') or 'null'}",
        "modelo_operacional": "{extracted_profile.get('modelo_operacional') or 'null'}",
        "tempo_operacao": "{extracted_profile.get('tempo_operacao') or 'null'}",
        "tipo_produto": "{extracted_profile.get('tipo_produto') or 'null'}",
        "diferencial": "{extracted_profile.get('diferencial') or 'null'}",
        "concorrentes": "{extracted_profile.get('concorrentes') or 'null'}",
        "principal_gargalo": "{extracted_profile.get('principal_gargalo') or 'null'}",
        "margem_lucro": "{extracted_profile.get('margem_lucro') or 'null'}",
        "origem_clientes": "{extracted_profile.get('origem_clientes') or 'null'}",
        "maior_objecao": "{extracted_profile.get('maior_objecao') or 'null'}",
        "tempo_entrega": "{extracted_profile.get('tempo_entrega') or 'null'}",
        "instagram_handle": "{extracted_profile.get('instagram_handle') or 'null'}",
        "linkedin_url": "{extracted_profile.get('linkedin_url') or 'null'}",
        "site_url": "{extracted_profile.get('site_url') or 'null'}",
        "email_contato": "{extracted_profile.get('email_contato') or 'null'}",
        "whatsapp_numero": "{extracted_profile.get('whatsapp_numero') or 'null'}",
        "google_maps_url": "{extracted_profile.get('google_maps_url') or 'null'}",
        "investimento_marketing": null
    }}
}}"""

    chat_messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 10 messages max for better context)
    for m in messages[-10:]:
        chat_messages.append({"role": m["role"], "content": m["content"]})

    # Add current user message
    chat_messages.append({"role": "user", "content": user_message})

    raw = call_groq_single(api_key, chat_messages, temperature=0.5)
    
    # DEBUG: Log raw LLM response (first 500 chars)
    print(f"  🤖 LLM raw response: {raw if raw else 'None'}", file=sys.stderr)
    
    try:
        parsed = json.loads(raw)
        print(f"  ✅ JSON parsed successfully", file=sys.stderr)
        return parsed
    except (json.JSONDecodeError, TypeError):
        print(f"  ⚠️ JSON parse failed, trying regex extraction", file=sys.stderr)
        # LLM returned invalid JSON — try to extract reply with regex
        reply_match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', raw or '')
        profile_match = re.search(r'"updated_profile"\s*:\s*(\{[^}]*\})', raw or '')
        extracted_reply = reply_match.group(1) if reply_match else None
        extracted_update = {}
        if profile_match:
            try:
                extracted_update = json.loads(profile_match.group(1))
                print(f"  ✅ Regex extraction succeeded: {list(extracted_update.keys())}", file=sys.stderr)
            except Exception:
                print(f"  ❌ Regex extraction failed", file=sys.stderr)
                pass
        result = {
            "reply": extracted_reply,
            "updated_profile": extracted_update or extracted_profile
        }
        print(f"  ↩️ Returning fallback result", file=sys.stderr)
        return result


def validate_extraction(updated_profile: dict, all_user_text: str, previous_profile: dict) -> dict:
    """
    Backend validation: reject hallucinated fields that don't match user text.
    Only keeps fields where the value has some textual basis in what the user said,
    OR was already in the previous profile (already validated).
    """
    print(f"  🔬 validate_extraction() received: {list(updated_profile.keys())}", file=sys.stderr)
    
    validated = {}
    user_lower = all_user_text.lower()

    for field, value in updated_profile.items():
        if value is None or value == "" or value == []:
            continue

        # Special validation: modelo must be one of the valid options
        if field == "modelo":
            val_upper = str(value).upper().strip()
            print(f"  🔍 Validating modelo: '{value}' → '{val_upper}'", file=sys.stderr)
            if val_upper not in ["B2B", "B2C", "D2C", "MISTO"]:
                # Invalid modelo value, skip it
                print(f"  ❌ REJECTED: '{val_upper}' is not in [B2B, B2C, D2C, MISTO]", file=sys.stderr)
                continue
            else:
                print(f"  ✅ ACCEPTED: modelo = '{val_upper}'", file=sys.stderr)
                validated[field] = val_upper
                continue
        
        # Special validation: segmento should NOT be B2B/B2C (that's modelo)
        if field == "segmento":
            val_upper = str(value).upper().strip()
            if val_upper in ["B2B", "B2C", "D2C", "MISTO"]:
                # Wrong field! Skip it
                continue

        # Special validation: site_url must NOT be a social media URL
        if field == "site_url":
            _social = ["instagram.com", "linkedin.com", "facebook.com", "twitter.com", "x.com", "tiktok.com", "youtube.com"]
            if any(sd in str(value).lower() for sd in _social):
                print(f"  ⚠️ site_url rejeitado em validate_extraction (é rede social): {value}", file=sys.stderr)
                continue
        
        # Special validation: capital_disponivel zero-synonyms
        if field == "capital_disponivel":
            val_lower = str(value).lower().strip()
            # If LLM interpreted "nada/zero" → accept if user said nada, zero, não posso, etc
            if val_lower in ["zero", "nada", "nenhum"]:
                zero_patterns = r"nada|zero|nenhum|não.*posso|nao.*posso|sem.*capital|sem.*dinheiro"
                if re.search(zero_patterns, user_lower):
                    validated[field] = value
                    continue

        # Already existed in previous profile — keep it
        if previous_profile.get(field):
            validated[field] = previous_profile[field]
            # But allow updates if the new value also passes validation
            if value != previous_profile[field]:
                if _value_has_basis(field, value, user_lower):
                    validated[field] = value
            continue

        # New field — check if it has basis in user text
        if _value_has_basis(field, value, user_lower):
            validated[field] = value

    return validated


def _value_has_basis(field: str, value, user_lower: str) -> bool:
    """Check if an extracted value has textual basis in user messages."""
    # Normalize both sides (strip accents) so "loja física" matches "loja fisica"
    user_norm = _normalize(user_lower)

    # ── MONETARY FIELDS: compare numerically ──
    monetary_fields = ["capital_disponivel", "faturamento_mensal", "ticket_medio", "investimento_marketing"]
    if field in monetary_fields:
        # Extract the number from the LLM-extracted value
        val_number = _extract_number(str(value))
        
        if val_number is not None:
            # Extract ALL numbers from user text and check if any match
            # Split user text into chunks and extract a number from each
            user_chunks = re.split(r'[,;.!?\s]+', user_norm)
            # Also try sliding windows of 2-3 words for "5 mil", "2 milhoes"
            user_words = user_norm.split()
            windows = []
            for i in range(len(user_words)):
                for size in range(1, 4):
                    if i + size <= len(user_words):
                        windows.append(' '.join(user_words[i:i+size]))
            
            for chunk in windows:
                chunk_number = _extract_number(chunk)
                if chunk_number is not None:
                    if val_number == chunk_number:
                        return True
                    # Allow 10% tolerance for rounding
                    if max(val_number, chunk_number) > 0:
                        ratio = min(val_number, chunk_number) / max(val_number, chunk_number)
                        if ratio >= 0.9:
                            return True
        
        # Otherwise, fall through to text-based matching
    
    # ── LENIENT FIELDS: accept short direct answers easily ──
    lenient_fields = {
        "modelo": [r"b2c|b2b|misto|d2c"],  # Strict: only B2B/B2C patterns
        "localizacao": None,
        "nome_negocio": None,
        "segmento": None,
        "dificuldades": None,
        "objetivos": None,
        "canais_venda": None,
        "investimento_marketing": None,
        "cliente_ideal": None,
        "capital_disponivel": None,  # Accept any answer about investment capacity
        "num_funcionarios": None,    # Accept any answer about team size
    }
    if field in lenient_fields:
        # Flatten lists to a single string for checking
        if isinstance(value, list):
            flat_val = ' '.join(str(v) for v in value).lower()
        else:
            flat_val = str(value).lower()
        val_norm = _normalize(flat_val)

        patterns = lenient_fields[field]
        if patterns is None:
            # Accept if any significant word from value appears in user text (accent-insensitive)
            val_words = [w for w in val_norm.split() if len(w) > 1]
            user_words = set(user_norm.split())
            
            # First: exact word match
            if any(w in user_norm for w in val_words):
                return True
            if val_norm in user_norm or any(w in val_norm for w in user_words if len(w) > 2):
                return True
            
            # Second: fuzzy match for single-word values (handles typos like "indiaiatuba" vs "indaiatuba")
            if len(val_words) == 1 and len(user_words) > 0:
                for user_word in user_words:
                    if len(user_word) > 3 and _similar(val_words[0], user_word, threshold=0.70):
                        return True
            
            # For very short user inputs, accept plausible values
            if len(user_norm.split()) <= 5:
                return True
            return False
        else:
            for pattern in patterns:
                if re.search(pattern, user_norm):
                    return True
            if val_norm in user_norm:
                return True
            return False

    # ── Lists for non-lenient fields ──
    if isinstance(value, list):
        return any(_normalize(item) in user_norm for item in value if isinstance(item, str))

    val_str = str(value).lower()
    val_norm = _normalize(val_str)
    
    # ── Special handling for context fields that are DETECTED, not quoted ──
    detected_fields = ["modelo_operacional", "capital_disponivel", "principal_gargalo", 
                       "margem_lucro", "maior_objecao", "num_funcionarios"]
    
    if field in detected_fields:
        # For detected fields, check for keywords that indicate this value
        detection_patterns = {
            # modelo_operacional
            "sob encomenda": r"encomenda|primeiro.*paga|depois.*envio|não.*estoque|sem.*estoque",
            "dropshipping": r"dropship|drop\s*ship|fornecedor.*direto|não.*estoque",
            "estoque próprio": r"estoque|produtos.*loja|guardo",
            "consignação": r"consign|parceiro|revend",
            # capital_disponivel
            "zero": r"zero|não.*capital|sem.*dinheiro|não.*investi|pouco|nada",
            "baixo": r"pouco|baixo|limitado|restrito",
            # principal_gargalo
            "credibilidade": r"credibilidade|confiança|desconfia|golpe|medo",
            "tempo": r"sozinho|não.*tempo|sobrecarreg",
            "capital": r"capital|dinheiro|investir|recurso",
            # num_funcionarios
            "1": r"só eu|sozinho|uma pessoa|eu-quipe|1 pessoa",
            "sozinho": r"só eu|sozinho|uma pessoa|eu-quipe",
        }
        
        val_clean = val_norm.strip()
        if val_clean in detection_patterns:
            pattern = detection_patterns[val_clean]
            if re.search(pattern, user_norm):
                return True
        
        # Fallback: check if key concepts appear (accent-insensitive)
        concepts = [_normalize(w) for w in val_str.split() if len(w) > 3]
        return any(c in user_norm for c in concepts) if concepts else True
    
    # ── Numeric Validation (Handle 8k, 8 mil, 8000) ──
    clean_val = val_norm.replace('.', '').replace(',', '').replace('r$', '').replace(' ', '')
    if clean_val.isdigit():
        num_val = int(clean_val)
        
        if val_norm in user_norm or clean_val in user_norm:
            return True
            
        if num_val >= 1000 and num_val % 1000 == 0:
            thousands = str(num_val // 1000)
            variants = [f"{thousands} mil", f"{thousands}k", f"{thousands} k", f"{thousands}.000"]
            if any(v in user_norm for v in variants):
                return True
        
        return False
        
    # ── Text Matches (accent-insensitive) ──
    if len(val_norm) <= 15:
        words = [_normalize(w) for w in val_str.split() if len(w) > 2]
        if not words:
            return val_norm in user_norm
        return any(w in user_norm for w in words)

    words = [_normalize(w) for w in val_str.split() if len(w) > 3]
    if not words:
        return True
    matches = sum(1 for w in words if w in user_norm)
    return matches >= min(2, len(words))


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
            "fields_missing": REQUIRED_FIELDS,
        }

    messages = input_data.get("messages", [])
    user_message = input_data.get("user_message", "")
    extracted_profile = input_data.get("extracted_profile", {})

    # ━━━ Handle pending research confirmation ━━━
    research_pending = extracted_profile.get("_research_pending")
    research_tasks = extracted_profile.get("_research_tasks", [])
    
    # Track which fields were already researched (prevents re-searching same field)
    fields_researched = extracted_profile.get("_fields_researched", [])
    just_resolved_pending = False  # Flag to skip proactive search after resolving pending
    
    if research_pending and user_message:
        user_response = detect_research_response(user_message)
        pending_field = research_pending.get("field", "")
        pending_value = research_pending.get("suggested_value", "")
        
        # "não sei" while pending = user still doesn't know = ACCEPT the research
        msg_lower_check = user_message.lower().strip()
        is_still_dont_know = bool(re.search(
            r"n[aã]o sei|sei l[aá]|n[aã]o fa[cç]o ideia|n[aã]o tenho certeza|pode ser|tanto faz",
            msg_lower_check
        ))
        
        if user_response == "confirm" or is_still_dont_know:
            print(f"  ✅ User {'CONFIRMED' if user_response == 'confirm' else 'still doesnt know, auto-accepting'} research for {pending_field}: {pending_value}", file=sys.stderr)
            extracted_profile[pending_field] = pending_value
            research_tasks.append({
                "titulo": f"Aprofundar: {FIELD_LABELS_PT.get(pending_field, pending_field)}",
                "descricao": research_pending.get("task_description", ""),
                "categoria": "pesquisa",
                "origem": "pesquisa_assistida"
            })
            extracted_profile["_research_tasks"] = research_tasks
            if pending_field not in fields_researched:
                fields_researched.append(pending_field)
            extracted_profile["_fields_researched"] = fields_researched
            extracted_profile.pop("_research_pending", None)
            research_pending = None
            just_resolved_pending = True
            print(f"  📋 Task added for deeper study of {pending_field}", file=sys.stderr)
        elif user_response == "reject":
            print(f"  ❌ User REJECTED research for {pending_field}", file=sys.stderr)
            # Still create a task for deeper research when rejected
            task_config = RESEARCHABLE_FIELDS.get(pending_field, {})
            rp_nome = extracted_profile.get("nome_negocio", "o negócio")
            rp_loc = extracted_profile.get("localizacao", "")
            rp_seg = extracted_profile.get("segmento", "")
            try:
                task_desc = task_config.get("task_template", "Aprofundar pesquisa").format(
                    nome_negocio=rp_nome, localizacao=rp_loc, segmento=rp_seg)
            except (KeyError, IndexError):
                task_desc = f"Aprofundar pesquisa sobre {FIELD_LABELS_PT.get(pending_field, pending_field)}"
            research_tasks.append({
                "titulo": f"Pesquisar melhor: {FIELD_LABELS_PT.get(pending_field, pending_field)}",
                "descricao": task_desc + " (pesquisa inicial rejeitada pelo usuário)",
                "categoria": "pesquisa",
                "origem": "pesquisa_rejeitada"
            })
            extracted_profile["_research_tasks"] = research_tasks
            if pending_field not in fields_researched:
                fields_researched.append(pending_field)
            extracted_profile["_fields_researched"] = fields_researched
            extracted_profile.pop("_research_pending", None)
            research_pending = None
            just_resolved_pending = True
        else:
            # User gave a specific answer — use it as the field value
            print(f"  🔄 User gave specific response for {pending_field}: {user_message}", file=sys.stderr)
            extracted_profile[pending_field] = user_message
            if pending_field not in fields_researched:
                fields_researched.append(pending_field)
            extracted_profile["_fields_researched"] = fields_researched
            extracted_profile.pop("_research_pending", None)
            research_pending = None
            just_resolved_pending = True

    # First message? Send greeting (no LLM call needed)
    if not messages and not user_message:
        return {
            "reply": "Oi! 👋 Sou sua consultora de crescimento.\n\nVou te fazer algumas perguntas rápidas pra entender seu negócio e gerar um plano de ação personalizado. Se tiver algo que você não souber, sem problema — eu pesquiso pra você!\n\nVamos lá: qual o nome do seu negócio e o que vocês fazem?",
            "extracted_profile": extracted_profile,
            "search_performed": False,
            "search_query": None,
            "ready_for_analysis": False,
            "fields_collected": [],
            "fields_missing": REQUIRED_FIELDS,
        }

    # Step 1: PROACTIVE SEARCH - search when user needs help
    # Skip if we just resolved a pending research (don't chain searches)
    
    # Pre-infer fields so tipo_produto is available for search queries
    early_inferred = _infer_fields_from_context(
        messages + [{"role": "user", "content": user_message}], extracted_profile
    )
    for f, v in early_inferred.items():
        if not extracted_profile.get(f):
            extracted_profile[f] = v
            print(f"  🧠 Early inferred {f}={v} for search context", file=sys.stderr)
    
    if just_resolved_pending:
        search_decision = {"should_search": False, "query": None, "purpose": None, "field_being_researched": None}
        print("  ⏭️ Skipping proactive search — just resolved pending research", file=sys.stderr)
    else:
        search_decision = should_search_proactively(user_message, messages, extracted_profile)
    search_context = None
    search_performed = False
    search_query = None
    search_purpose = None
    field_being_researched = search_decision.get("field_being_researched")
    field_being_researched_failed = None  # Track field if search fails/irrelevant

    # Track if user said "não sei" so we can acknowledge it even if search fails
    user_said_dont_know = search_decision.get("should_search", False) and bool(
        re.search(r"não sei|nao sei|sei lá|sei la|não faço ideia|nao faco ideia|não tenho certeza|nao tenho certeza", user_message.lower())
    )

    search_sources = []  # URLs/titles from search results

    if search_decision["should_search"] and search_decision["query"]:
        search_query = search_decision["query"]
        search_purpose = search_decision.get("purpose", "Busca de contexto")
        search_result = search_internet(search_query)
        search_context = search_result["text"]
        search_sources = search_result["sources"]
        search_performed = True
        print(f"  📚 Propósito: {search_purpose} | Fontes: {len(search_sources)}", file=sys.stderr)
        
        # If we're searching, we MUST have search context before generating reply
        if not search_context or search_context.strip() == "Nenhum resultado encontrado.":
            print("  ⚠️ Busca falhou, continuando sem dados", file=sys.stderr)
            field_being_researched_failed = field_being_researched  # save before clearing
            search_performed = False
            search_context = None
            search_sources = []
        else:
            # Check relevance of results
            seg = extracted_profile.get("segmento", "")
            tp = extracted_profile.get("tipo_produto", "")
            if field_being_researched and not _check_search_relevance(search_context, seg, tp):
                print(f"  ⚠️ Search results irrelevant for '{seg}/{tp}', creating task instead", file=sys.stderr)
                # Results are garbage — create a research task and skip showing them
                task_config = RESEARCHABLE_FIELDS.get(field_being_researched, {})
                rp_nome = extracted_profile.get("nome_negocio", "o negócio")
                rp_loc = extracted_profile.get("localizacao", "")
                try:
                    task_desc = task_config.get("task_template", "Aprofundar pesquisa").format(
                        nome_negocio=rp_nome, localizacao=rp_loc, segmento=seg)
                except (KeyError, IndexError):
                    task_desc = f"Pesquisar sobre {FIELD_LABELS_PT.get(field_being_researched, field_being_researched)}"
                research_tasks = extracted_profile.get("_research_tasks", [])
                research_tasks.append({
                    "titulo": f"Pesquisar: {FIELD_LABELS_PT.get(field_being_researched, field_being_researched)}",
                    "descricao": task_desc + " (busca automática não retornou resultados relevantes)",
                    "categoria": "pesquisa",
                    "origem": "busca_irrelevante"
                })
                extracted_profile["_research_tasks"] = research_tasks
                fields_researched = extracted_profile.get("_fields_researched", [])
                if field_being_researched not in fields_researched:
                    fields_researched.append(field_being_researched)
                extracted_profile["_fields_researched"] = fields_researched
                # Clear search so we don't show bad results
                field_being_researched_failed = field_being_researched  # save before clearing
                search_performed = False
                search_context = None
                search_sources = []
                field_being_researched = None

    # Step 2: Generate CONSULTATIVE reply (teaches + extracts profile naturally)
    print("💬 Gerando resposta consultiva...", file=sys.stderr)
    try:
        result = generate_reply(api_key, messages, user_message, extracted_profile, search_context, search_purpose, field_being_researched, research_pending)
    except Exception as e:
        print(f"  ❌ Erro ao gerar resposta: {e}", file=sys.stderr)
        # Fallback: acknowledge user input and ask next question
        result = {"reply": None, "updated_profile": dict(extracted_profile)}

    reply = result.get("reply") or None
    updated_profile = result.get("updated_profile", extracted_profile)

    # ━━━ Capture research suggestion BEFORE validation (would be rejected by validator) ━━━
    research_suggestion = None
    if field_being_researched and search_performed:
        research_suggestion = updated_profile.get(field_being_researched)
        if research_suggestion:
            # Remove so validation doesn't reject it (value isn't in user text)
            updated_profile[field_being_researched] = None
            print(f"  🔬 Captured research suggestion for {field_being_researched}: {research_suggestion}", file=sys.stderr)

    # DEBUG: Log what LLM extracted
    print(f"  🧠 LLM extracted profile: {json.dumps(updated_profile, ensure_ascii=False)}", file=sys.stderr)

    # If reply is empty/null or is leaked system prompt text, generate a simple fallback
    if not reply or reply.startswith("<ESCREVA") or "campo obrigatório" in reply.lower():
        reply = None  # Will be filled by field prompt logic below

    # Post-process: fix echo replies (LLM sometimes repeats user message verbatim)
    if reply and user_message and len(user_message) > 10:
        user_norm = _normalize(user_message).strip()
        reply_norm = _normalize(reply).strip()
        
        # Check if reply STARTS with what user said (echo)
        if len(user_norm) > 10 and reply_norm.startswith(user_norm[:30]):
            parts = reply.split("\n\n", 1)
            if len(parts) > 1:
                reply = parts[1].strip()
            else:
                reply = None  # Will be replaced by field prompt below
        
        # Check if reply CONTAINS the user message as a near-complete echo
        elif len(user_norm) > 15:
            # Split reply into sentences and remove any that echo the user
            import re as _re
            sentences = _re.split(r'(?<=[.!?])\s+', reply)
            filtered = []
            for s in sentences:
                s_norm = _normalize(s).strip()
                # Skip if >60% of user text appears in this sentence
                overlap = sum(1 for w in user_norm.split() if len(w) > 2 and w in s_norm)
                total_words = len([w for w in user_norm.split() if len(w) > 2])
                if total_words > 0 and overlap / total_words > 0.6:
                    continue  # Skip this echoing sentence
                filtered.append(s)
            if filtered:
                reply = ' '.join(filtered)
            else:
                reply = None  # All sentences were echoes

    # Step 3: VALIDATE extracted profile against actual user text
    all_user_text = user_message
    for m in messages:
        if m.get("role") == "user":
            all_user_text += " " + m.get("content", "")
    
    # DEBUG: Log what we received
    print(f"📥 RECEIVED extracted_profile: {json.dumps(extracted_profile, ensure_ascii=False)}", file=sys.stderr)

    # Special handling: detect B2B/B2C/D2C keywords and force to "modelo" field
    user_lower = user_message.lower()
    if updated_profile and isinstance(updated_profile, dict):
        # If LLM mistakenly put B2C/B2B in segmento, move it to modelo
        segmento_val = str(updated_profile.get("segmento", "")).upper()
        if segmento_val in ["B2B", "B2C", "D2C", "MISTO"]:
            print(f"  🔄 Moving '{segmento_val}' from segmento to modelo", file=sys.stderr)
            updated_profile["modelo"] = segmento_val
            updated_profile["segmento"] = None
        
        # If modelo field has B2C-like value but segmento is empty, try to extract segmento from message
        if updated_profile.get("modelo") and not updated_profile.get("segmento"):
            # Check if user message has comma (e.g., "CASA, MOVEIS PLANEJADOS")
            if "," in user_message:
                parts = [p.strip() for p in user_message.split(",")]
                if len(parts) >= 2:
                    # First part likely name, second part likely segmento
                    if not updated_profile.get("nome_negocio"):
                        updated_profile["nome_negocio"] = parts[0]
                    if not updated_profile.get("segmento"):
                        # Remove B2C/B2B from segmento if present
                        seg_candidate = parts[1]
                        for term in ["B2B", "B2C", "D2C", "MISTO"]:
                            seg_candidate = seg_candidate.replace(term, "").strip()
                        if seg_candidate:
                            updated_profile["segmento"] = seg_candidate

    if updated_profile and isinstance(updated_profile, dict):
        cleaned_profile = validate_extraction(updated_profile, all_user_text, extracted_profile)
    else:
        cleaned_profile = dict(extracted_profile)

    # DEBUG: Log validation result  
    print(f"✅ After validation: {json.dumps(cleaned_profile, ensure_ascii=False)}", file=sys.stderr)

    # CRITICAL: Never lose previously validated data
    preserved_count = 0
    for k, v in extracted_profile.items():
        if v and not cleaned_profile.get(k):
            print(f"🔒 PRESERVING {k}: {v} (was missing from cleaned_profile)", file=sys.stderr)
            cleaned_profile[k] = v
            preserved_count += 1
    
    if preserved_count > 0:
        print(f"🔒 PRESERVED {preserved_count} fields from previous validation", file=sys.stderr)
    
    # FORCE PRESERVE critical required fields if they exist in extracted_profile
    required_preserved = 0
    for field in REQUIRED_FIELDS:
        if extracted_profile.get(field) and not cleaned_profile.get(field):
            print(f"⚠️ FORCE PRESERVING REQUIRED FIELD {field}: {extracted_profile[field]}", file=sys.stderr)
            cleaned_profile[field] = extracted_profile[field]
            required_preserved += 1
    
    if required_preserved > 0:
        print(f"⚠️ FORCE PRESERVED {required_preserved} required fields", file=sys.stderr)

    # Sync overlapping fields: investimento_marketing ↔ capital_disponivel
    if cleaned_profile.get("investimento_marketing") and not cleaned_profile.get("capital_disponivel"):
        cleaned_profile["capital_disponivel"] = cleaned_profile["investimento_marketing"]
        print(f"  🔄 Synced investimento_marketing → capital_disponivel: {cleaned_profile['capital_disponivel']}", file=sys.stderr)
    elif cleaned_profile.get("capital_disponivel") and not cleaned_profile.get("investimento_marketing"):
        cleaned_profile["investimento_marketing"] = cleaned_profile["capital_disponivel"]
        print(f"  🔄 Synced capital_disponivel → investimento_marketing: {cleaned_profile['investimento_marketing']}", file=sys.stderr)

    # Infer num_funcionarios from message if still missing
    if not cleaned_profile.get("num_funcionarios"):
        solo_patterns = ["trabalho sozinho", "sou só eu", "sou eu mesmo", "somente eu", 
                         "só eu", "apenas eu", "trabalho só", "empreendedor solo"]
        msg_lower = user_message.lower()
        # Also check full conversation context
        context_lower = " ".join(m.get("content", "") for m in messages).lower()
        combined = msg_lower + " " + context_lower
        if any(p in combined for p in solo_patterns):
            cleaned_profile["num_funcionarios"] = "sozinho"
            print(f"  🔄 Inferred num_funcionarios=sozinho from context", file=sys.stderr)

    # ━━━ AUTO-INFER fields from conversation context ━━━
    inferred = _infer_fields_from_context(messages + [{"role": "user", "content": user_message}], cleaned_profile)
    for field, value in inferred.items():
        if not cleaned_profile.get(field):
            cleaned_profile[field] = value
            print(f"  🧠 Auto-inferred {field}={value} from conversation context", file=sys.stderr)

    # ━━━ Set _research_pending if we just searched for a specific field ━━━
    if research_suggestion and field_being_researched:
        # Don't mark as pending if field was already collected before this interaction
        already_collected = extracted_profile.get(field_being_researched)
        if not already_collected:
            task_config = RESEARCHABLE_FIELDS.get(field_being_researched, {})
            rp_nome = cleaned_profile.get("nome_negocio", "o negócio")
            rp_loc = cleaned_profile.get("localizacao", "")
            rp_seg = cleaned_profile.get("segmento", "")
            try:
                task_desc = task_config.get("task_template", "Aprofundar pesquisa").format(
                    nome_negocio=rp_nome, localizacao=rp_loc, segmento=rp_seg)
            except (KeyError, IndexError):
                task_desc = f"Aprofundar pesquisa sobre {FIELD_LABELS_PT.get(field_being_researched, field_being_researched)}"
            cleaned_profile["_research_pending"] = {
                "field": field_being_researched,
                "suggested_value": research_suggestion,
                "task_description": task_desc,
            }
            # Don't store value as confirmed yet
            cleaned_profile[field_being_researched] = None
            print(f"  ⏳ Set _research_pending for {field_being_researched}: {research_suggestion}", file=sys.stderr)
            
            # ━━━ CRITICAL: Override reply if LLM didn't present findings ━━━
            # The LLM (especially smaller fallback model) often says "Vou pesquisar"
            # instead of presenting the actual search results. Force-build a reply.
            skip_phrases = ["vou pesquisar", "marquei uma tarefa", "vou buscar", 
                           "preciso pesquisar", "vou procurar", "vou verificar",
                           "deixa eu pesquisar", "vou dar uma olhada"]
            llm_reply_lower = (reply or "").lower()
            llm_skipped_results = (
                not reply or 
                any(sp in llm_reply_lower for sp in skip_phrases) or
                len(reply.strip()) < 40  # Too short to contain real findings
            )
            
            if llm_skipped_results and research_suggestion and research_suggestion != "null":
                field_label = FIELD_LABELS_PT.get(field_being_researched, field_being_researched)
                reply = f"Pesquisei sobre **{field_label}** pro seu negócio e encontrei:\n\n"
                reply += f"📋 **{research_suggestion}**\n\n"
                reply += "Marquei uma tarefa pra aprofundar isso depois. Faz sentido pra você?"
                print(f"  🔧 Override: LLM reply was empty/generic, built reply with research data", file=sys.stderr)
        else:
            print(f"  ⚠️ {field_being_researched} already has value '{already_collected}', not marking as pending", file=sys.stderr)
    
    # Preserve _research_tasks from previous interactions
    if extracted_profile.get("_research_tasks") and not cleaned_profile.get("_research_tasks"):
        cleaned_profile["_research_tasks"] = extracted_profile["_research_tasks"]

    # Preserve _fields_researched from previous interactions
    if extracted_profile.get("_fields_researched") and not cleaned_profile.get("_fields_researched"):
        cleaned_profile["_fields_researched"] = extracted_profile["_fields_researched"]

    # Calculate what we have
    fields_collected = [f for f in ALL_FIELDS if cleaned_profile.get(f) and not f.startswith("_")]
    fields_missing = [f for f in REQUIRED_FIELDS if not cleaned_profile.get(f)]
    priority_collected = [f for f in PRIORITY_OPTIONAL if cleaned_profile.get(f)]
    priority_missing = [f for f in PRIORITY_OPTIONAL if not cleaned_profile.get(f)]
    
    # ALL remaining fields (for systematic collection)
    all_remaining = [f for f in ALL_COLLECTIBLE_FIELDS_ORDER
                     if not cleaned_profile.get(f)
                     and f != "investimento_marketing"
                     and not f.startswith("_")]
    
    # DEBUG: Log field status
    print(f"  📊 Fields collected: {fields_collected}", file=sys.stderr)
    print(f"  ❌ Missing required: {fields_missing}", file=sys.stderr)
    print(f"  🟢 Priority collected ({len(priority_collected)}/7): {priority_collected}", file=sys.stderr)
    print(f"  🔴 Priority missing: {priority_missing}", file=sys.stderr)
    print(f"  📋 All remaining: {all_remaining}", file=sys.stderr)
    
    # Check readiness
    required_done = len(fields_missing) == 0
    priority_count = len(priority_collected)
    has_pending = cleaned_profile.get("_research_pending") is not None
    
    # User explicitly wants to generate
    user_wants_finish = any(x in user_message.lower() for x in 
        ["pode gerar", "analisar", "pronto", "terminar", "concluir", "gerar análise", "gerar a análise", "fazer análise", "vamos analisar"])
    
    # Base readiness: required + 5 priority
    base_ready = required_done and priority_count >= 5
    ready = user_wants_finish or base_ready

    # ━━━ Unified field collection and reply appendix ━━━
    if user_wants_finish:
        if reply:
            reply += "\n\n✅ Vou gerar a análise agora!"
        else:
            reply = "✅ Vou gerar a análise agora!"
    elif has_pending:
        # Waiting for research confirmation - don't ask new fields
        pending_data = cleaned_profile.get("_research_pending", {})
        pending_val = pending_data.get("suggested_value", "") if isinstance(pending_data, dict) else ""
        pending_fld = pending_data.get("field", "") if isinstance(pending_data, dict) else ""
        pending_lbl = FIELD_LABELS_PT.get(pending_fld, pending_fld) if pending_fld else ""
        
        # Check if reply mentions the findings or is too generic
        skip_phrases = ["vou pesquisar", "marquei uma tarefa", "vou buscar",
                       "preciso pesquisar", "vou procurar", "vou verificar"]
        reply_lower = (reply or "").lower()
        reply_is_generic = not reply or any(sp in reply_lower for sp in skip_phrases) or len((reply or "").strip()) < 40
        
        if reply_is_generic and pending_val and pending_val != "null":
            reply = f"Pesquisei sobre **{pending_lbl}** pro seu negócio e encontrei:\n\n"
            reply += f"📋 **{pending_val}**\n\n"
            reply += "Marquei uma tarefa pra aprofundar isso depois. Faz sentido pra você?"
        elif not reply:
            reply = "O que você acha da sugestão?"
    elif not required_done:
        # Missing required fields - ask next one
        missing_field = fields_missing[0]
        prompt = FIELD_PROMPTS_ALL.get(missing_field, f"Me conta sobre {FIELD_LABELS_PT.get(missing_field, missing_field)}?")
        if not reply:
            reply = prompt
        elif not reply.strip().endswith("?"):
            reply += f"\n\n{prompt}"
    elif user_said_dont_know and not has_pending:
        # User said "não sei" but search failed or returned irrelevant results
        # Acknowledge it instead of silently skipping to the next field
        failed_field = field_being_researched_failed or get_field_from_context(messages)
        field_label = FIELD_LABELS_PT.get(failed_field or '', 'esse assunto')
        if not reply:
            reply = f"Sem problemas! Não encontrei dados confiáveis agora sobre {field_label}. Marquei uma tarefa pra pesquisar isso depois com mais calma."
        # Create a research task for the failed field
        if failed_field:
            task_config = RESEARCHABLE_FIELDS.get(failed_field, {})
            rp_nome = cleaned_profile.get("nome_negocio", "o negócio")
            rp_loc = cleaned_profile.get("localizacao", "")
            rp_seg = cleaned_profile.get("segmento", "")
            try:
                task_desc = task_config.get("task_template", "Aprofundar pesquisa").format(
                    nome_negocio=rp_nome, localizacao=rp_loc, segmento=rp_seg)
            except (KeyError, IndexError):
                task_desc = f"Pesquisar sobre {field_label}"
            research_tasks_list = cleaned_profile.get("_research_tasks", [])
            research_tasks_list.append({
                "titulo": f"Pesquisar: {field_label}",
                "descricao": task_desc + " (busca automática não retornou resultados relevantes)",
                "categoria": "pesquisa",
                "origem": "busca_falhou"
            })
            cleaned_profile["_research_tasks"] = research_tasks_list
            fr_list = cleaned_profile.get("_fields_researched", [])
            if failed_field not in fr_list:
                fr_list.append(failed_field)
            cleaned_profile["_fields_researched"] = fr_list
        # Move on to next field
        next_remaining = [f for f in ALL_COLLECTIBLE_FIELDS_ORDER
                         if not cleaned_profile.get(f) and f != "investimento_marketing" and not f.startswith("_")]
        if next_remaining:
            prompt = FIELD_PROMPTS_ALL.get(next_remaining[0], "")
            if prompt and not reply.strip().endswith("?"):
                reply += f"\n\n{prompt}"
    elif all_remaining:
        # Have basics, systematically collect remaining fields
        next_field = all_remaining[0]
        is_researchable = next_field in RESEARCHABLE_FIELDS
        
        prompt = FIELD_PROMPTS_ALL.get(next_field, f"Me conta sobre {FIELD_LABELS_PT.get(next_field, next_field)}?")
        if is_researchable:
            prompt += " Se não souber, posso pesquisar pra você!"
        
        # Check if reply already contains a question
        if not reply:
            reply = prompt
        elif not reply.strip().endswith("?"):
            if base_ready:
                reply += f"\n\nPra enriquecer a análise: {prompt}"
            else:
                reply += f"\n\n{prompt}"
    else:
        # ALL fields collected!
        if not reply:
            reply = "✅ Tenho tudo! Clique em 'Gerar Análise' pra ver seu relatório."
        else:
            reply += "\n\n✅ Tenho tudo! Clique em 'Gerar Análise' pra ver seu relatório."

    # NOTE: search indicator is handled by the frontend via search_performed/search_query fields
    # Do NOT prepend raw search text to reply

    # FINAL DEBUG: Log what we're returning
    print(f"📤 RETURNING cleaned_profile: {json.dumps(cleaned_profile, ensure_ascii=False)}", file=sys.stderr)

    print(f"  📊 Total: {len(fields_collected)}/{len(ALL_FIELDS)} | Obrig: {len(REQUIRED_FIELDS)-len(fields_missing)}/{len(REQUIRED_FIELDS)} | Import: {priority_count}/{len(PRIORITY_OPTIONAL)}", file=sys.stderr)
    if ready:
        print("  ✅ PRONTO PARA ANÁLISE", file=sys.stderr)

    return {
        "reply": reply,
        "extracted_profile": cleaned_profile,
        "search_performed": search_performed,
        "search_query": search_query if search_performed else None,
        "search_sources": search_sources if search_performed else [],
        "ready_for_analysis": ready,
        "fields_collected": fields_collected,
        "fields_missing": fields_missing,
    }
