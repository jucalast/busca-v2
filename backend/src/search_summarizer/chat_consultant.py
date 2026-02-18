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

ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS + CONTEXT_FIELDS
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
    "maior_objecao": "maior objeção dos clientes"
}


def call_groq_single(api_key: str, messages: list, temperature: float = 0.4,
                     max_retries: int = 2, json_mode: bool = True,
                     prefer_small: bool = False) -> str:
    """
    Groq chat completion with retry + model fallback. Returns raw content string.
    If prefer_small=True, starts with the small model to save rate limit.
    """
    client = Groq(api_key=api_key)

    if prefer_small:
        models = ["llama-3.1-8b-instant"]
    else:
        models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]

    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    for model in models:
        for attempt in range(max_retries):
            try:
                completion = client.chat.completions.create(
                    messages=messages,
                    model=model,
                    temperature=temperature,
                    **kwargs,
                )
                content = completion.choices[0].message.content
                return content
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg and attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    print(f"  ⏳ Rate limit ({model}). Aguardando {wait_time}s...", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                elif "429" in error_msg and model != models[-1]:
                    print(f"  🔄 Tentando modelo menor...", file=sys.stderr)
                    break
                raise
    raise Exception("Todos os modelos falharam")


def should_search_proactively(user_message: str, messages: list, extracted_profile: dict) -> dict:
    """
    RESEARCH-DRIVEN LOGIC - searches when user doesn't know something.
    
    Search when:
    1. User says "não sei", "pesquisa", "me ajuda", etc.
    2. Early conversation - get market context for their business
    3. User gives vague answers that need clarification
    4. We need to gather missing required fields
    
    Returns: { should_search: bool, query: str|null, purpose: str }
    """
    msg_lower = user_message.lower()
    segmento = extracted_profile.get("segmento", "")
    localizacao = extracted_profile.get("localizacao", "")
    nome = extracted_profile.get("nome_negocio", "")
    
    # Count past searches
    past_searches = sum(1 for m in messages if m.get("role") == "assistant" and "🔍" in m.get("content", ""))
    
    # ━━━ 1. USER DOESN'T KNOW OR ASKS FOR HELP - RESEARCH FOR THEM ━━━
    # Only search when user explicitly says they don't know
    explicit_dont_know = [
        r"não sei|nao sei|pesquisa|me ajuda|não conheço|nao conheco",
        r"vish.*não sei|não faço ideia|não tenho certeza|ajuda.*descobrir"
    ]
    
    user_doesnt_know = False
    for pattern in explicit_dont_know:
        if re.search(pattern, msg_lower):
            user_doesnt_know = True
            break
    
    if user_doesnt_know:
        # What are we trying to find out? Look at recent assistant questions
        recent_question = ""
        for m in reversed(messages[-3:]):
            if m.get("role") == "assistant":
                content = m.get("content", "")
                if "?" in content:
                    recent_question = content.split("?")[0].split(". ")[-1].lower()
                    break
        
        # Build specific research query based on context
        if "concorrent" in recent_question:
            query = f"concorrentes {segmento} {localizacao} principais empresas mercado"
            return {"should_search": True, "query": query, "purpose": "Identificar concorrentes"}
        
        elif "limitação" in recent_question or "maior" in recent_question:
            query = f"{segmento} principais limitações desafios pequenas empresas"
            return {"should_search": True, "query": query, "purpose": "Identificar limitações típicas"}
        
        elif "público" in recent_question or "cliente" in recent_question:
            query = f"{segmento} {localizacao} perfil cliente típico quem compra"
            return {"should_search": True, "query": query, "purpose": "Definir público-alvo"}
        
        elif "desafio" in recent_question or "dificuldade" in recent_question:
            query = f"{segmento} principais desafios problemas comuns empresas"
            return {"should_search": True, "query": query, "purpose": "Identificar desafios típicos"}
        
        elif "objetivo" in recent_question or "meta" in recent_question:
            query = f"{segmento} objetivos crescimento metas comuns empresas"
            return {"should_search": True, "query": query, "purpose": "Definir objetivos típicos"}
        
        else:
            # Generic research based on their business
            if segmento:
                query = f"{segmento} {localizacao} informações mercado características"
            else:
                query = f"{nome} negócio informações mercado"
            return {"should_search": True, "query": query, "purpose": "Pesquisa geral"}
    
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
        if re.search(pattern, msg_lower) and past_searches < 3:
            query = query_template.replace("{segmento}", segmento or "pequenos negócios").replace("{localizacao}", localizacao or "Brasil")
            return {"should_search": True, "query": query, "purpose": purpose}
    
    # ━━━ 3. VAGUE ANSWERS NEED CLARIFICATION ━━━
    vague_answers = [
        r"todo.*tipo|qualquer.*um|vários|diversos|geral",
        r"tudo|qualquer.*coisa|depende|varia"
    ]
    
    for pattern in vague_answers:
        if re.search(pattern, msg_lower) and segmento and past_searches < 3:
            query = f"{segmento} segmentação público-alvo perfil cliente específico"
            return {"should_search": True, "query": query, "purpose": "Refinar público vago"}
    
    # ━━━ 4. EARLY MARKET RESEARCH ━━━
    msg_count = len(messages)
    if msg_count <= 4 and segmento and localizacao and past_searches == 0:
        query = f"{segmento} {localizacao} mercado oportunidades público-alvo"
        return {"should_search": True, "query": query, "purpose": "Pesquisa inicial de mercado"}
    
    # ━━━ 5. MISSING REQUIRED FIELDS - only search if user explicitly doesn't know ━━━
    # Removed: auto-searching for missing required fields was triggering unnecessary
    # searches when the user was answering directly, causing LLM confusion.
    # Searches for required fields now only happen via section 1 (user says "não sei").
    
    return {"should_search": False, "query": None, "purpose": None}


def search_internet(query: str, region: str = "br-pt") -> str:
    """Search DuckDuckGo and scrape top results. Returns aggregated text."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, script_dir)
    from cli import search_duckduckgo, scrape_page

    print(f"  🔍 Buscando: {query}", file=sys.stderr)
    results = search_duckduckgo(query, max_results=4, region=region)

    if not results:
        return "Nenhum resultado encontrado."

    aggregated = ""
    for i, r in enumerate(results):
        url = r.get('href', '')
        title = r.get('title', '')
        snippet = r.get('body', '')
        aggregated += f"[{title}]: {snippet}\n"
        if i < 2:  # Scrape top 2 results for more depth
            content = scrape_page(url)
            if content:
                aggregated += f"  Detalhes: {content[:1500]}\n"

    return aggregated[:5000]


def generate_reply(api_key: str, messages: list, user_message: str,
                   extracted_profile: dict, search_context: str = None,
                   search_purpose: str = None) -> dict:
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
        teaching_block = f"""

🔍 DADOS DA PESQUISA (propósito: {search_purpose}):
{search_context}

INSTRUÇÃO CRÍTICA - USE OS DADOS PARA OFERECER OPÇÕES:
- Com base na pesquisa, ofereça 2-3 opções específicas para ele escolher
- Exemplo: "Baseado na pesquisa, seu público pode ser: A) X, B) Y ou C) Z. Qual faz mais sentido?"
- Se for sobre concorrentes: "Encontrei estas empresas similares: [lista]. Conhece alguma?"
- SEMPRE termine perguntando se ele concorda com alguma opção
- Se ele concordar, SALVE a resposta e passe para o próximo campo obrigatório
"""

    # Determine what info we still need
    missing_required = [f for f in REQUIRED_FIELDS if not extracted_profile.get(f)]
    missing_priority = [f for f in PRIORITY_OPTIONAL if not extracted_profile.get(f)]
    
    next_field_hint = ""
    if missing_required:
        field = missing_required[0]
        if field == "segmento":
            next_field_hint = "Após confirmar, pergunte: 'Em que segmento/área exatamente você atua?'"
        elif field == "modelo":
            next_field_hint = "Após confirmar, pergunte: 'Você atende mais empresas (B2B) ou pessoas físicas (B2C)?'"
        elif field == "dificuldades":
            next_field_hint = "Após confirmar, pergunte: 'Qual é seu maior desafio hoje no negócio?'"
        elif field == "objetivos":
            next_field_hint = "Após confirmar, pergunte: 'Qual é sua meta principal para os próximos meses?'"
    elif missing_priority:
        field = missing_priority[0]
        hints = {
            "capital_disponivel": "Pergunte: 'Quanto você pode investir por mês em marketing/crescimento?'",
            "num_funcionarios": "Pergunte: 'Você trabalha sozinho ou tem uma equipe? Quantas pessoas?'",
            "canais_venda": "Pergunte: 'Onde/como você vende hoje? Instagram, loja física, site?'",
            "cliente_ideal": "Pergunte: 'Descreva seu cliente ideal - idade, perfil, características'",
            "ticket_medio": "Pergunte: 'Qual o valor médio de cada venda?'",
            "modelo_operacional": "Pergunte: 'Como funciona sua operação? Tem estoque, trabalha sob encomenda?'",
            "faturamento_mensal": "Pergunte: 'Qual seu faturamento médio mensal aproximadamente?'"
        }
        next_field_hint = hints.get(field, f"Pergunte sobre {FIELD_LABELS_PT.get(field, field)}")

    system_prompt = f"""Você é uma CONSULTORA que FAZ PESQUISAS para o cliente.

🎯 SEU OBJETIVO:
- PESQUISAR e trazer informações quando o usuário não souber
- APRESENTAR opções baseadas na pesquisa para ele escolher
- SALVAR a escolha dele e seguir para o próximo campo obrigatório
- COLETAR todos os 6 campos obrigatórios de forma eficiente

CONTEXTO ATUAL DA CONVERSA:
{known_context if known_context else "Ainda começando a coleta."}

CAMPOS JÁ COLETADOS (PRESERVE ESTES VALORES):
{json.dumps(extracted_profile, ensure_ascii=False, indent=2)}

{teaching_block}

CAMPOS OBRIGATÓRIOS AINDA FALTANDO: {missing_required}
CAMPOS IMPORTANTES AINDA FALTANDO: {missing_priority}
{next_field_hint}

ATENÇÃO: Colete primeiro os 6 obrigatórios, depois os 7 importantes. Só sugira análise quando tiver pelo menos os obrigatórios + 4 importantes.

╔═══════════════════════════════════════════════════════════════╗
║  COMPORTAMENTO: PESQUISADOR + COLETOR (OBRIGATÓRIO SEGUIR)   ║
╚═══════════════════════════════════════════════════════════════╝

1. SE TODOS OS OBRIGATÓRIOS + 4 IMPORTANTES ESTÃO COLETADOS:
   - Sugira: "✅ Tenho informações suficientes para uma boa análise! Clique em 'Gerar Análise'."
   - PARE de coletar

2. SE AINDA FALTA CAMPO OBRIGATÓRIO:
   - Priorize obrigatórios primeiro
   - Pergunte diretamente: "Qual é o [campo]?"
   - NÃO repita perguntas já respondidas

3. SE TEM TODOS OBRIGATÓRIOS MAS FALTA IMPORTANTE:
   - Colete campos importantes para análise mais rica
   - "Para uma análise mais precisa: [pergunta]"
   - Pare ao ter pelo menos 4 importantes

3. QUANDO VOCÊ PESQUISOU (tem dados):
   - Apresente 2-3 opções específicas baseadas na pesquisa
   - "Pela pesquisa, encontrei: A) X, B) Y, C) Z. Qual faz mais sentido?"
   - Se ele escolher, ACEITE e avance

4. QUANDO ELE RESPONDE DIRETAMENTE:
   - NÃO busque desnecessariamente
   - NÃO ecoe/repita TODOS os campos coletados (isso polui o histórico)
   - ACEITE a resposta e avance: "Ok! [Próxima pergunta direta]"

5. FORMATO DA RESPOSTA:
   - Máximo 2 frases curtas
   - Se todos campos completos: sugira análise
   - Se falta campo: pergunte diretamente
   - NUNCA repita pergunta já respondida

6. PRIORIDADE DE COLETA:
   OBRIGATÓRIOS (6):
   1. nome_negocio - "Qual o nome do seu negócio?"
   2. segmento - "Em que segmento/área você atua?"
   3. modelo - "Você atende empresas (B2B) ou pessoas físicas (B2C)?"
   4. localizacao - "Em que cidade você atende?"
   5. dificuldades - "Qual seu maior desafio hoje?"
   6. objetivos - "Qual sua principal meta?"
   
   IMPORTANTES (7):
   7. capital_disponivel - "Quanto pode investir por mês?"
   8. num_funcionarios - "Você trabalha sozinho ou tem equipe?"
   9. canais_venda - "Onde/como vende hoje?"
   10. cliente_ideal - "Descreva seu cliente ideal"
   11. ticket_medio - "Valor médio por venda?"
   12. modelo_operacional - "Como funciona sua operação?"
   13. faturamento_mensal - "Faturamento médio mensal?"

7. O QUE NUNCA FAZER:
   - NÃO repita perguntas já respondidas
   - NÃO busque quando usuário responde diretamente  
   - NÃO continue coletando se já tem todos os obrigatórios
   - NÃO trave no mesmo campo

═══════════════════════════════════════════════════════════════
EXTRAÇÃO: Salve EXATAMENTE o que o usuário escolheu/disse.
═══════════════════════════════════════════════════════════════

EXEMPLOS DE EXTRAÇÃO CORRETA:
- Usuário: "CASA, MOVEIS PLANEJADOS" → nome_negocio: "CASA", segmento: "moveis planejados"
- Usuário: "Tenho uma cafeteria chamada Café Aroma" → nome_negocio: "Café Aroma", segmento: "cafeteria"
- Usuário: "Vendo roupas femininas, meu negócio é Loja X" → nome_negocio: "Loja X", segmento: "roupas femininas"
- Usuário: "trabalho sozinho há 2 anos" → num_funcionarios: "1" (ou "sozinho")
- Usuário: "temos 5 pessoas na equipe" → num_funcionarios: "5"
- Usuário: "posso investir R$ 500 por mês" → capital_disponivel: "R$ 500/mês"
- Usuário: "B2C" (depois de perguntar modelo) → modelo: "B2C"
- Usuário: "indaiatuba" → localizacao: "Indaiatuba"
- Usuário: "vender mais" → dificuldades: "vender mais", objetivos: null (ainda não perguntou)

ATENÇÃO CRÍTICA NO JSON:
- B2B/B2C/D2C é sempre o campo "modelo", NUNCA "segmento"
- Segmento é o que a empresa FAZ/VENDE (ex: "cafeteria", "móveis", "roupas", "consultoria")
- Frases como "Tenho uma [X]" ou "Trabalho com [Y]" → X ou Y é o segmento
- "trabalho sozinho" ou "sou só eu" → num_funcionarios: "1" ou "sozinho"
- Se a primeira mensagem tem vírgula, geralmente é: nome, segmento (ex: "Padaria São João, pães artesanais")
- NUNCA retorne `null` para campos já coletados - PRESERVE todos os valores já extraídos
- Se não tem nova informação para um campo, mantenha o valor anterior ou coloque `null` apenas se nunca foi coletado
- "Quanto pode investir por mês" → campo "capital_disponivel" (NÃO "investimento_marketing")
- "investimento_marketing" deve ser sempre null — use apenas "capital_disponivel"

Retorne JSON baseado no que já foi coletado + nova informação desta mensagem:
{{
    "reply": "<ESCREVA SUA RESPOSTA AQUI — máximo 2 frases curtas, em português, conversacional>",
    "updated_profile": {{
        "nome_negocio": "{extracted_profile.get('nome_negocio', 'null se nunca coletado')}",
        "segmento": "{extracted_profile.get('segmento', 'null se nunca coletado')}",
        "modelo": "{extracted_profile.get('modelo', 'null se nunca coletado')}",
        "localizacao": "{extracted_profile.get('localizacao', 'null se nunca coletado')}",
        "dificuldades": "{extracted_profile.get('dificuldades', 'null se nunca coletado')}",
        "objetivos": "{extracted_profile.get('objetivos', 'null se nunca coletado')}",
        "capital_disponivel": "{extracted_profile.get('capital_disponivel', 'null se nunca coletado')}",
        "num_funcionarios": "{extracted_profile.get('num_funcionarios', 'null se nunca coletado')}",
        "ticket_medio": "{extracted_profile.get('ticket_medio', 'null se nunca coletado')}",
        "faturamento_mensal": "{extracted_profile.get('faturamento_mensal', 'null se nunca coletado')}",
        "canais_venda": "{extracted_profile.get('canais_venda', 'null se nunca coletado')}",
        "cliente_ideal": "{extracted_profile.get('cliente_ideal', 'null se nunca coletado')}",
        "modelo_operacional": "{extracted_profile.get('modelo_operacional', 'null se nunca coletado')}",
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

    # First message? Send greeting (no LLM call needed)
    if not messages and not user_message:
        return {
            "reply": "Oi! 👋 Sou sua consultora de crescimento. Vou coletar informações sobre seu negócio para gerar uma análise completa personalizada.\n\nVou perguntar sobre:\n✅ 6 campos essenciais (nome, segmento, modelo, localização, desafios, objetivos)\n📊 Informações importantes (orçamento, equipe, canais, etc.)\n\nQuando você não souber algo, eu pesquiso pra você! Vamos começar:\n\nQual o nome do seu negócio e o que vocês fazem?",
            "extracted_profile": extracted_profile,
            "search_performed": False,
            "search_query": None,
            "ready_for_analysis": False,
            "fields_collected": [],
            "fields_missing": REQUIRED_FIELDS,
        }

    # Step 1: PROACTIVE SEARCH - search when user needs help
    search_decision = should_search_proactively(user_message, messages, extracted_profile)
    search_context = None
    search_performed = False
    search_query = None
    search_purpose = None

    if search_decision["should_search"] and search_decision["query"]:
        search_query = search_decision["query"]
        search_purpose = search_decision.get("purpose", "Busca de contexto")
        search_context = search_internet(search_query)
        search_performed = True
        print(f"  📚 Propósito: {search_purpose}", file=sys.stderr)
        
        # If we're searching, we MUST have search context before generating reply
        if not search_context or search_context.strip() == "Nenhum resultado encontrado.":
            print("  ⚠️ Busca falhou, continuando sem dados", file=sys.stderr)
            search_performed = False
            search_context = None

    # Step 2: Generate CONSULTATIVE reply (teaches + extracts profile naturally)
    print("💬 Gerando resposta consultiva...", file=sys.stderr)
    try:
        result = generate_reply(api_key, messages, user_message, extracted_profile, search_context, search_purpose)
    except Exception as e:
        print(f"  ❌ Erro ao gerar resposta: {e}", file=sys.stderr)
        # Fallback: acknowledge user input and ask next question
        result = {"reply": None, "updated_profile": dict(extracted_profile)}

    reply = result.get("reply") or None
    updated_profile = result.get("updated_profile", extracted_profile)

    # DEBUG: Log what LLM extracted
    print(f"  🧠 LLM extracted profile: {json.dumps(updated_profile, ensure_ascii=False)}", file=sys.stderr)

    # If reply is empty/null or is leaked system prompt text, generate a simple fallback
    if not reply or reply.startswith("<ESCREVA") or "campo obrigatório" in reply.lower():
        missing_required = [f for f in REQUIRED_FIELDS if not extracted_profile.get(f)]
        if missing_required:
            field = missing_required[0]
            field_prompts = {
                "nome_negocio": "Qual o nome do seu negócio e o que vocês fazem?",
                "segmento": "Em que segmento/área você atua?",
                "modelo": "Você atende empresas (B2B) ou pessoas físicas (B2C)?",
                "localizacao": "Em que cidade você atende?",
                "dificuldades": "Qual seu maior desafio hoje no negócio?",
                "objetivos": "Qual sua principal meta para os próximos meses?"
            }
            reply = f"Ok, anotado! {field_prompts.get(field, 'Me conta mais sobre seu negócio?')}"
        else:
            reply = "Entendi! Me conta mais sobre seu negócio."

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

    # Calculate what we have
    fields_collected = [f for f in ALL_FIELDS if cleaned_profile.get(f)]
    fields_missing = [f for f in REQUIRED_FIELDS if not cleaned_profile.get(f)]
    priority_collected = [f for f in PRIORITY_OPTIONAL if cleaned_profile.get(f)]
    priority_missing = [f for f in PRIORITY_OPTIONAL if not cleaned_profile.get(f)]
    
    # DEBUG: Log field status
    print(f"  📊 Fields collected: {fields_collected}", file=sys.stderr)
    print(f"  ❌ Missing required: {fields_missing}", file=sys.stderr)
    print(f"  🟢 Priority collected ({len(priority_collected)}/7): {priority_collected}", file=sys.stderr)
    print(f"  🔴 Priority missing: {priority_missing}", file=sys.stderr)
    
    # Check readiness
    required_done = len(fields_missing) == 0
    priority_count = len(priority_collected)
    
    # User explicitly wants to generate
    user_wants_finish = any(x in user_message.lower() for x in 
        ["pode gerar", "analisar", "pronto", "terminar", "concluir", "gerar análise", "gerar a análise", "fazer análise", "vamos analisar"])
    
    # Ready when: all required + ALL priority fields (7) OR user explicitly asks
    # Coleta completa garantindo análise rica e detalhada
    ready = user_wants_finish or (required_done and priority_count >= 7)

    # If user explicitly wants to finish, add encouragement
    if user_wants_finish:
        reply += "\n\n✅ Vou gerar a análise completa agora - clique no botão abaixo!"
    elif ready:
        # Has enough info for good analysis - DON'T ask more questions
        reply += "\n\n✅ Tenho informações suficientes para uma boa análise! Clique em 'Gerar Análise'."
    elif not required_done:
        # Still missing required fields - ask for the next one directly
        missing_field = fields_missing[0]
        field_prompts = {
            "nome_negocio": "Qual o nome do seu negócio?",
            "segmento": "Em que segmento/área você atua?", 
            "modelo": "Você atende empresas (B2B) ou pessoas físicas (B2C)?",
            "localizacao": "Em que cidade você atende?",
            "dificuldades": "Qual seu maior desafio hoje?",
            "objetivos": "Qual sua principal meta?"
        }
        
        if not reply.strip().endswith("?"):
            prompt = field_prompts.get(missing_field, f"Me conta sobre {FIELD_LABELS_PT.get(missing_field, missing_field)}?")
            reply += f"\n\n{prompt}"
    elif required_done and priority_count < 7 and not ready:
        # Has required but needs more priority fields for richer analysis (only if not already ready)
        next_priority = priority_missing[0] if priority_missing else None
        if next_priority:
            # DEBUG: Check if we're about to ask for a field that's already filled
            if cleaned_profile.get(next_priority):
                print(f"  ⚠️ WARNING: About to ask for '{next_priority}' but it's already filled: {cleaned_profile.get(next_priority)}", file=sys.stderr)
            
            priority_prompts = {
                "capital_disponivel": "Para sugestões mais precisas: quanto você pode investir por mês em marketing/crescimento?",
                "num_funcionarios": "Você trabalha sozinho ou tem uma equipe? Quantas pessoas?",
                "canais_venda": "Onde/como você vende hoje? Instagram, loja física, site?",
                "cliente_ideal": "Descreva seu cliente ideal - idade, perfil, características",
                "ticket_medio": "Qual o valor médio de cada venda?",
                "modelo_operacional": "Como funciona sua operação? Tem estoque, trabalha sob encomenda?",
                "faturamento_mensal": "Qual seu faturamento médio mensal aproximadamente?"
            }
            
            prompt = priority_prompts.get(next_priority, f"Me conta sobre {FIELD_LABELS_PT.get(next_priority, next_priority)}?")
            # Don't append if reply already asks a similar question
            reply_lower = reply.lower()
            prompt_keywords = [w for w in prompt.lower().split() if len(w) > 4]
            already_asking = sum(1 for kw in prompt_keywords if kw in reply_lower) >= 2
            
            print(f"  🤔 Should append '{next_priority}' question? reply_ends_with_?: {reply.strip().endswith('?')}, already_asking: {already_asking}", file=sys.stderr)
            
            if not reply.strip().endswith("?") and not already_asking:
                print(f"  ➕ Appending question for '{next_priority}'", file=sys.stderr)
                reply += f"\n\n{prompt}"

    # Add search indicator to reply if search was performed
    if search_performed:
        reply = f"🔍\nBuscou: \"{search_query[:50]}...\"\n{reply}"

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
        "ready_for_analysis": ready,
        "fields_collected": fields_collected,
        "fields_missing": fields_missing,
    }
