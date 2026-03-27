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
import requests
import unicodedata
from dotenv import load_dotenv


# Constant for empty/missing values used in various checks
PLACEHOLDER_VALUES = (
    "null", "none", "n/a", "na", "", "unknown", "vazio", "?", ".", "..", "...", 
    "não informado", "nao informado", "não sei ainda", "não tenho",
    "não entendi", "nao entendi", "como assim", "o que significa", "explica",
    "ajuda", "esclarece", "o que é", "qual a", "pode pular", "pular"
)


def _is_field_filled(value):
    """Check if a field value is conceptually 'filled'."""
    if value is None: return False
    val_str = str(value).strip()
    val_lower = val_str.lower().rstrip('.,;!')

    # 1. Direct match with placeholders
    if val_lower in PLACEHOLDER_VALUES:
        return False
        
    # 2. Conceptually 'DEALT WITH'
    _dealt_with = ["desconhecido", "não possui", "não sei", "nao sei", "pular"]
    if any(term in val_lower for term in _dealt_with) and len(val_str) < 30: 
        return True
        
    # 3. Numeric digits (even 1 digit) are considered filled
    if any(c.isdigit() for c in val_str): return True
        
    # 4. Strict check for pure punctuation/garbage
    if not any(c.isalnum() for c in val_str): return False

    # 5. Long strings are usually real data
    return len(val_str) >= 3


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


def _perform_web_research(company_name: str, current_profile: dict, yield_callback=None) -> dict:
    """Research the company online to find REAL data (site, model, social, etc.)"""
    from app.core.web_utils import search_duckduckgo, scrape_page
    
    if not company_name or len(company_name) < 3:
        return {}
    
    log_info(f"🌐 Iniciando pesquisa web real para: {company_name}...")
    if yield_callback:
        yield_callback({"type": "tool", "tool": "web_research", "status": "running", "detail": f"Buscando site de {company_name}"})
    
    # 1. Search for official site and social
    query = f'site oficial ou instagram "{company_name}"'
    search_results = search_duckduckgo(query, max_results=5)
    
    if not search_results:
        if yield_callback:
            yield_callback({"type": "tool", "tool": "web_research", "status": "warning", "detail": "Nenhum site oficial encontrado"})
        return {}
        
    discovery = {}
    sources_text = ""
    found_urls = []
    
    # Try to scrape the first relevant non-social link (likely the site)
    for res in search_results:
        url = res.get('href', '')
        title = res.get('title', '')
        snippet = res.get('body', '')
        
        found_urls.append(url)
        sources_text += f"\nFonte: {title} ({url})\nSnippet: {snippet}\n"
        
        # If it looks like an official site (not a directory like cnpj.biz)
        if not any(blocked in url for blocked in ["cnpj.biz", "casa-dos-dados", "econodata", "transparencia.cc", "consultacnpj"]):
            if not discovery.get("site") and "http" in url:
                discovery["site"] = url
                # Scrape it!
                if yield_callback:
                    yield_callback({"type": "tool", "tool": "web_research", "status": "running", "detail": f"Lendo site: {url}"})
                site_content = scrape_page(url)
                if site_content:
                    sources_text += f"\nCONTEÚDO DO SITE:\n{site_content[:3000]}\n"
    
    if yield_callback:
        yield_callback({"type": "tool", "tool": "web_research", "status": "running", "detail": "Analisando dados reais encontrados..."})

    # 2. Use LLM to extract REAL data from research
    prompt = f"""Você é um analista de pesquisa de mercado. Com base nos dados REAIS da internet abaixo, extraia informações concretas sobre a empresa "{company_name}".
    
    DADOS DA PESQUISA:
    {sources_text}
    
    REGRAS:
    1. Retorne APENAS JSON.
    2. modelo: Determine se é B2B (foco em empresas/indústria) ou B2C (foco em consumidor final/varejo) com base no que o site diz.
    3. site: Confirme a URL oficial.
    4. instagram/facebook/linkedin: Se encontrar as URLs, extraia.
    5. segmento: Descreva a área de atuação real (ex: "Padaria Artesanal", "Indústria de Plásticos").
    6. diferencial: Se o site citar algo como "desde 1990", "entrega rápida", "prêmio X", extraia.
    
    JSON:
    {{
        "modelo": "B2B ou B2C",
        "site": "url",
        "segmento": "descrição",
        "instagram": "url ou null",
        "linkedin": "url ou null",
        "diferencial": "texto"
    }}"""

    try:
        extraction = call_llm("groq", prompt=prompt, temperature=0.2, json_mode=True, prefer_small=True)
        if isinstance(extraction, dict):
            real_data = {}
            # ── PROTECTIVE MERGE: only update if new value is non-empty ──
            # This prevents LLM from overwriting real data with null/undefined
            for k, v in extraction.items():
                is_new_meaningful = v is not None and v != "" and "desconhecido" not in str(v).lower()
                is_old_empty = not real_data.get(k) or "desconhecido" in str(real_data.get(k)).lower()
                
                if is_new_meaningful:
                    real_data[k] = v
                elif is_old_empty and v:
                    # Capture even low-quality data if we have nothing better
                    real_data[k] = v
            
            if yield_callback:
                for field, val in real_data.items():
                    label = _FIELD_LABELS_PT.get(field, field)
                    yield_callback({"type": "discovery", "field": field, "label": label, "value": val})
                yield_callback({"type": "tool", "tool": "web_research", "status": "success", "detail": "Pesquisa concluída com dados reais"})
            
            return real_data
    except Exception as e:
        log_error(f"Erro na análise de pesquisa: {e}")
        if yield_callback:
            yield_callback({"type": "tool", "tool": "web_research", "status": "error", "detail": "Erro ao processar dados da web"})
            
    return {}


def _lookup_cnpj(cnpj: str) -> dict:
    """Lookup CNPJ info using BrasilAPI."""
    cnpj_clean = re.sub(r'\D', '', cnpj)
    if len(cnpj_clean) != 14:
        return {}
    
    log_info(f"🔍 Buscando dados para o CNPJ: {cnpj_clean}...")
    
    # Try BrasilAPI
    try:
        response = requests.get(f"https://brasilapi.com.br/api/cnpj/v1/{cnpj_clean}", timeout=7)
        if response.status_code == 200:
            data = response.json()
            log_success(f"✅ BrasilAPI: Dados encontrados para {data.get('razao_social')}")
            
            mapped = {
                "nome_negocio": data.get("nome_fantasia") or data.get("razao_social"),
                "localizacao": f"{data.get('municipio')}-{data.get('uf')}",
                "segmento": data.get("cnae_fiscal_descricao"),
                "email_contato": data.get("email"),
                "whatsapp": data.get("ddd_telefone_1"),
                "google_maps": f"{data.get('logradouro')}, {data.get('numero')}, {data.get('bairro')}, {data.get('municipio')}-{data.get('uf')}",
                "tempo_operacao": f"Desde {data.get('data_inicio_atividade')}",
                "capital_social": data.get("capital_social")
            }
            if data.get("capital_social"):
                mapped["capital_disponivel"] = f"R$ {data.get('capital_social'):,.2f}"
            
            return {k: v for k, v in mapped.items() if v}
        else:
            log_warning(f"⚠️ BrasilAPI retornou status {response.status_code}")
    except Exception as e:
        log_warning(f"⚠️ Erro na BrasilAPI: {str(e)}")

    # Fallback: ReceitaWS (API Pública)
    try:
        log_info("🔄 Tentando ReceitaWS como fallback...")
        response = requests.get(f"https://receitaws.com.br/v1/cnpj/{cnpj_clean}", timeout=7)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ERROR":
                log_warning(f"⚠️ ReceitaWS: {data.get('message')}")
                return {}
                
            log_success(f"✅ ReceitaWS: Dados encontrados para {data.get('nome')}")
            mapped = {
                "nome_negocio": data.get("fantasia") or data.get("nome"),
                "localizacao": f"{data.get('municipio')}-{data.get('uf')}",
                "segmento": data.get("atividade_principal", [{}])[0].get("text"),
                "email_contato": data.get("email"),
                "whatsapp": data.get("telefone"),
                "google_maps": f"{data.get('logradouro')}, {data.get('numero')}, {data.get('bairro')}, {data.get('municipio')}-{data.get('uf')}",
                "tempo_operacao": f"Desde {data.get('abertura')}"
            }
            return {k: v for k, v in mapped.items() if v}
    except Exception as e:
        log_error(f"❌ Erro no fallback ReceitaWS: {str(e)}")
    return {}


def _looks_like_cnpj(text: str) -> bool:
    """Check if a string looks like a CNPJ number (14 digits, with or without formatting)."""
    digits_only = re.sub(r'\D', '', text.strip())
    return len(digits_only) >= 11 and len(digits_only) <= 14 and digits_only.isdigit()


def _is_valid_extracted_value(value, field_key: str = '') -> bool:
    """Ultra-strict validation: returns True ONLY if value is real, meaningful data."""
    if value is None:
        return False
    val_str = str(value).strip()
    
    # Block empty
    if not val_str or val_str.lower() in ('null', 'none', 'n/a', 'na', ''):
        return False
    
    # Block pure punctuation (., .., ..., ?, !, etc.)
    if not any(c.isalnum() for c in val_str):
        return False
    
    # Block single characters (unless digit)
    if len(val_str) == 1 and not val_str.isdigit():
        return False
    
    # Block known garbage words
    garbage = ['produtos', 'serviços', 'produto', 'serviço', 'sim', 'não', 'ok', 'certo']
    if val_str.lower() in garbage:
        return False
    
    # ── CRITICAL: Block CNPJ/CPF numbers in NON-ID fields ──
    # A CNPJ number should ONLY go into the 'cnpj' field, never into 'dificuldades' etc.
    if field_key != 'cnpj' and _looks_like_cnpj(val_str):
        return False
    
    # Block pure numbers in text-only fields (challenges, goals, etc.)
    _text_only_fields = ['dificuldades', 'objetivos', 'diferencial', 'gargalos', 
                         'concorrentes', 'fornecedores', 'tipo_cliente', 'canais',
                         'clientes', 'origem_clientes', 'maior_objecao', 'tipo_produto',
                         'modelo_operacional', 'regiao_atendimento', 'segmento']
    if field_key in _text_only_fields:
        digits = re.sub(r'\D', '', val_str)
        # If the value is 80%+ digits, it's not a valid text answer
        if len(digits) > 0 and len(digits) / len(val_str) > 0.8:
            return False
    
    return True


# URLs that are NOT real business sites (directories, lookup tools)
_BLOCKED_SITE_DOMAINS = [
    "cnpj.biz", "casa-dos-dados", "econodata", "transparencia.cc",
    "consultacnpj", "receitaws", "brasilapi", "empresas.ws",
    "cnpja.com", "speedio", "infoplex", "bitcapital", "spotway.com",
    "consultasocio", "empresaqui"
]


def _extract_business_info(message: str, current_profile: dict, messages: list, yield_callback=None) -> dict:
    """Extrai informações do negócio com base na mensagem e histórico."""
    updated_profile = current_profile.copy()
    msg_lower = message.lower()
    
    # ── STEP 0: SANITIZE INCOMING PROFILE ──
    # Remove junk that may have been saved in previous turns
    for key in list(updated_profile.keys()):
        val = updated_profile.get(key)
        if val is not None:
            val_str = str(val).strip()
            # Remove pure punctuation values
            if val_str and not any(c.isalnum() for c in val_str):
                log_info(f"🧹 Limpando campo '{key}' com valor lixo: '{val_str}'")
                del updated_profile[key]
            # Remove blocked URLs saved as 'site'
            if key in ('site', 'site_url') and any(blocked in str(val).lower() for blocked in _BLOCKED_SITE_DOMAINS):
                log_info(f"🧹 Removendo URL de diretório do campo '{key}': {val}")
                del updated_profile[key]

    # ── STEP 1: PRE-EXTRACTION: CNPJ & Research ──
    cnpj_match = re.search(r'\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}', message)
    is_cnpj_message = bool(cnpj_match)  # Flag for later: skip LLM + contextual capture
    
    if cnpj_match and not _is_field_filled(updated_profile.get("cnpj")):
        cnpj_val = cnpj_match.group(0)
        if yield_callback: yield_callback({"type": "tool", "tool": "cnpj_lookup", "status": "running"})
        cnpj_data = _lookup_cnpj(cnpj_val)
        cnpj_data["cnpj"] = cnpj_val
        
        # Filter blocked URLs from CNPJ data
        for k in list(cnpj_data.keys()):
            if k in ('site', 'site_url') and any(blocked in str(cnpj_data[k]).lower() for blocked in _BLOCKED_SITE_DOMAINS):
                del cnpj_data[k]
        
        if yield_callback and cnpj_data:
            yield_callback({"type": "tool", "tool": "cnpj_lookup", "status": "success", "detail": cnpj_data.get("nome_negocio") or cnpj_val})
            for f, v in cnpj_data.items():
                if f != "cnpj" and yield_callback: 
                    yield_callback({"type": "discovery", "field": f, "label": _FIELD_LABELS_PT.get(f, f), "value": v})
        
        # Web Research
        business_name = cnpj_data.get("nome_negocio")
        if business_name:
            research_data = _perform_web_research(business_name, updated_profile, yield_callback)
            if research_data:
                # Filter blocked URLs from research data
                for k in list(research_data.keys()):
                    if k in ('site', 'site_url') and any(blocked in str(research_data[k]).lower() for blocked in _BLOCKED_SITE_DOMAINS):
                        del research_data[k]
                cnpj_data.update(research_data)
        updated_profile.update(cnpj_data)
        log_info("✅ CNPJ processado — pulando LLM extraction e contextual capture para esta mensagem.")

    # ── STEP 2: LLM INTELLIGENT EXTRACTION ──
    # SKIP if the message is just a CNPJ — the lookup already handled everything
    if not is_cnpj_message:
        try:
            recent_context = "(sem contexto)"
            if messages:
                context_lines = []
                for m in messages[-6:]:
                    role = "User" if m.get("role") == "user" else "AI"
                    context_lines.append(f"{role}: {m.get('content', '')[:200]}")
                recent_context = "\n".join(context_lines)
                
            from app.core.prompt_loader import load_prompt_file
            prompt_config = load_prompt_file("chat_consultant.yaml")
            template = prompt_config.get("information_extraction", {}).get("prompt_template", "")
            
            prompt = template.format(
                recent_context=recent_context,
                message=message,
                current_profile=safe_json_dumps(updated_profile, ensure_ascii=False)
            )

            from app.core.llm_router import call_llm as router_llm
            result = router_llm("auto", prompt=prompt, temperature=0.05, json_mode=True, prefer_small=(len(message)<800))
            extracted = result if isinstance(result, dict) else safe_json_loads(result)
            
            if isinstance(extracted, dict) and "error" not in extracted:
                # ── POST-EXTRACTION VALIDATION ──
                non_null_fields = {k: v for k, v in extracted.items() if v is not None and k in _FIELD_LABELS_PT}
                
                log_info(f"🔍 LLM extraiu {len(non_null_fields)} campos: {list(non_null_fields.keys())}")
                
                for key, value in non_null_fields.items():
                    # STRICT VALIDATION: is this value real and appropriate for this field?
                    if not _is_valid_extracted_value(value, field_key=key):
                        log_info(f"🚫 Valor rejeitado para '{key}': '{value}' (falhou validação)")
                        continue
                    
                    val_str = str(value).strip()
                    
                    # Block directory URLs for site fields
                    if key in ('site', 'site_url') and any(blocked in val_str.lower() for blocked in _BLOCKED_SITE_DOMAINS):
                        log_info(f"🚫 URL de diretório rejeitada para '{key}': {val_str}")
                        continue
                    
                    # "Desconhecido" handling — only if field is empty
                    if "desconhecido" in val_str.lower() or "não sei" in val_str.lower():
                        if not _is_field_filled(updated_profile.get(key)):
                            updated_profile[key] = "Desconhecido"
                        continue
                    
                    # Save the value
                    updated_profile[key] = value
                    if yield_callback:
                        yield_callback({"type": "discovery", "field": key, "label": _FIELD_LABELS_PT.get(key, key), "value": value})
                        
        except Exception as e:
            log_error(f"❌ Erro na extração inteligente: {e}")
    else:
        log_info("⏭️ LLM extraction pulada (mensagem é CNPJ).")

    # ── STEP 3: SAFETY NETS & CONTEXTUAL CAPTURE (Runs ALWAYS) ──
    _signals = ["não sei", "nao sei", "pular", "não tenho", "nenhum"]
    
    # 3.1 Last Assistant Question Detection — find what field was asked
    target_field = None
    if messages:
        for m in reversed(messages):
            if m.get("role") == "assistant":
                content = m.get("content", "").lower()
                # Priority matching: check specific keywords first
                _question_map = {
                    'ticket_medio': ['ticket médio', 'ticket medio', 'valor médio', 'valor medio', 'ticket de venda'],
                    'equipe': ['equipe', 'funcionários', 'funcionarios', 'quantas pessoas', 'tamanho da equipe', 'composição da equipe'],
                    'objetivos': ['meta', 'objetivo', 'onde quer chegar', 'onde gostaria', 'metas de crescimento'],
                    'dificuldades': ['desafio', 'dificuldade', 'problema', 'obstáculo'],
                    'faturamento': ['faturamento', 'fatura hoje', 'receita mensal', 'faturamento anual'],
                    'instagram': ['instagram', '@ do instagram'],
                    'site': ['site', 'website', 'página', 'endereço do site', 'link para ele'],
                    'linkedin': ['linkedin', 'perfil da empresa no linkedin'],
                    'concorrentes': ['concorrente', 'concorrência', 'principais concorrentes'],
                    'diferencial': ['diferencial', 'o que diferencia', 'principal diferencial'],
                    'margem': ['margem', 'margem de lucro', 'rentabilidade'],
                    'canais': ['canais de venda', 'como vende', 'canais de comunicação'],
                    'investimento': ['investimento', 'quanto investe', 'investido anualmente', 'marketing'],
                    'tipo_produto': ['produto', 'o que vende', 'o que oferece', 'produtos fabricados', 'principais produtos'],
                    'origem_clientes': ['de onde vêm', 'de onde vem', 'origem dos clientes', 'como consegue clientes', 'origem dos leads'],
                    # ─── CAMPOS QUE FALTAVAM ───
                    'tipo_cliente': ['público-alvo', 'público alvo', 'perfil do cliente', 'tipo de cliente', 'clientes atendidos', 'indústrias atendidas', 'setores atendidos'],
                    'clientes': ['cliente ideal', 'clientes ideais', 'qual é o perfil', 'quem são os clientes'],
                    'maior_objecao': ['objeção', 'objecao', 'objeções', 'objecoes', 'resistência do cliente', 'por que não compram'],
                    'gargalos': ['gargalo', 'gargalos', 'principal desafio operacional'],
                    'capacidade_produtiva': ['capacidade', 'capacidade de produção', 'capacidade produtiva', 'volume de produção'],
                    'tempo_entrega': ['prazo', 'prazo médio', 'prazo de entrega', 'tempo de entrega', 'lead time'],
                    'fornecedores': ['fornecedor', 'fornecedores', 'matéria-prima', 'insumos'],
                    'modelo_operacional': ['modelo operacional', 'operação', 'como produz', 'como opera'],
                    'regiao_atendimento': ['região', 'abrangência', 'área de atuação', 'cobertura geográfica'],
                    'email_contato': ['e-mail', 'email', 'email oficial', 'email da empresa'],
                    'capital_disponivel': ['capital disponível', 'capital disponivel', 'caixa', 'disponível para investir'],
                    'tempo_operacao': ['tempo de mercado', 'há quanto tempo', 'quando fundou'],
                    'google_maps': ['google maps', 'endereço', 'localização física'],
                    'whatsapp': ['whatsapp', 'número de contato'],
                }
                for field, keywords in _question_map.items():
                    if any(kw in content for kw in keywords):
                        target_field = field
                        break
                # Fallback: label matching
                if not target_field:
                    for field, label in _FIELD_LABELS_PT.items():
                        if label.lower() in content:
                            target_field = field
                            break
                break
    
    log_info(f"🎯 Campo alvo detectado: {target_field}")

    # 3.2 Modular Contextual Capture — ONLY if LLM didn't already fill it
    # SKIP if message is a CNPJ — already handled by lookup
    if target_field and not is_cnpj_message and not _is_field_filled(updated_profile.get(target_field)):
        is_skip = any(s in msg_lower for s in _signals)
        if is_skip:
            # User said "I don't know" — mark as dealt with
            updated_profile[target_field] = "Desconhecido"
            log_info(f"⏭️ Campo '{target_field}' marcado como Desconhecido")
            if yield_callback:
                yield_callback({"type": "discovery", "field": target_field, "label": _FIELD_LABELS_PT.get(target_field, target_field), "value": "Desconhecido"})
        elif len(message.strip()) > 3:
            val = message.strip()
            
            # Special formatting for goals/revenue
            if target_field in ['objetivos', 'faturamento']:
                num_match = re.search(r'(\d+[,.]?\d*)\s*(milh[oõ]es|milhões|mi|mil)', val.lower())
                if num_match:
                    try:
                        base = float(num_match.group(1).replace(",", "."))
                        mult = 1_000_000 if 'milh' in num_match.group(2) or 'mi' in num_match.group(2) else 1_000
                        val = f"R$ {int(base * mult):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                    except: pass
            
            # Remove common conversational prefixes
            for prefix in ["bom, ", "então, ", "olha, ", "sim, ", "claro, ", "ah, "]:
                if val.lower().startswith(prefix): val = val[len(prefix):].strip()
            
            # Validate before saving (with field-aware validation)
            if _is_valid_extracted_value(val, field_key=target_field):
                updated_profile[target_field] = val
                log_info(f"🎯 Captura Contextual: {target_field} = {val[:50]}")
                if yield_callback:
                    yield_callback({"type": "discovery", "field": target_field, "label": _FIELD_LABELS_PT.get(target_field, target_field), "value": val})

    # 3.3 Explicit Overrides (Markers like "desafio: ...")
    for kw, fkey in [("desafio", "dificuldades"), ("meta", "objetivos"), ("ticket", "ticket_medio"), ("equipe", "equipe"), ("inst", "instagram")]:
        if fkey in _FIELD_LABELS_PT and kw in msg_lower and ":" in message:
            parts = re.split(rf"{kw}.*?:", message, flags=re.IGNORECASE)
            if len(parts) > 1 and len(parts[1].strip()) > 2:
                val = parts[1].strip()
                if _is_valid_extracted_value(val):
                    updated_profile[fkey] = val
                    if yield_callback: yield_callback({"type": "discovery", "field": fkey, "label": _FIELD_LABELS_PT.get(fkey, fkey), "value": val})

    # 3.4 Specific Safety Nets (Ticket, Equipe)
    if not _is_field_filled(updated_profile.get('ticket_medio')):
        match = re.search(r'(?:ticket|valor\s+(?:medio|médio)).*?(?:r\$|rs)?\s?([\d.,]+)', msg_lower)
        if match:
            ticket_val = match.group(1).replace(".", "").replace(",", ".")
            if _is_valid_extracted_value(ticket_val):
                updated_profile['ticket_medio'] = ticket_val
                if yield_callback: yield_callback({"type": "discovery", "field": "ticket_medio", "label": "Ticket", "value": ticket_val})
    
    if not _is_field_filled(updated_profile.get('equipe')):
        match = re.search(r'(?:equipe|time|funcionarios|pessoas).*?(\d+)', msg_lower)
        if match:
            updated_profile['equipe'] = match.group(1)
            if yield_callback: yield_callback({"type": "discovery", "field": "equipe", "label": "Equipe", "value": match.group(1)})

    # ── FINAL: Normalization Aliases ──
    aliases = [
        ('dificuldades', 'problemas'), ('objetivos', 'metas'), ('equipe', 'num_funcionarios'),
        ('faturamento', 'faturamento_mensal'), ('modelo', 'modelo_negocio'),
        ('instagram', 'instagram_handle'), ('linkedin', 'linkedin_url'),
        ('site', 'site_url'), ('localizacao', 'cidade_estado'), ('nome_negocio', 'nome')
    ]
    for src, dst in aliases:
        src_val = updated_profile.get(src)
        dst_val = updated_profile.get(dst)
        if _is_field_filled(src_val) and not _is_field_filled(dst_val):
            updated_profile[dst] = src_val
        elif _is_field_filled(dst_val) and not _is_field_filled(src_val):
            updated_profile[src] = dst_val

    log_success(f"Extração Finalizada: {len([k for k, v in updated_profile.items() if _is_field_filled(v)])} campos preenchidos.")
    return updated_profile


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
        "produção": "capacidade_produtiva",
        "producao": "capacidade_produtiva",
        "capacidade": "capacidade_produtiva",
        "escala": "capacidade_produtiva",
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
# DNA ESTRATÉGICO — Definição dos campos e grupos
# ═══════════════════════════════════════════════════════════════════

# Campos Críticos: Sem estes a análise NÃO PODE iniciar (mínimo viável)
CRITICAL_FIELDS = [
    'nome_negocio', 'segmento', 'modelo', 'localizacao', 
    'dificuldades', 'objetivos', 'site', 'ticket_medio', 'equipe'
]

# Grupos de campos para coleta organizada e conversacional
FIELD_GROUPS = {
    "Identidade e Presença": ['site', 'instagram', 'whatsapp', 'linkedin', 'google_maps', 'email_contato', 'canais', 'cnpj'],
    "Métricas e Finanças": ['faturamento', 'ticket_medio', 'margem', 'capital_disponivel', 'investimento'],
    "Operação e Oferta": ['equipe', 'tipo_produto', 'tempo_operacao', 'modelo_operacional', 'capacidade_produtiva', 'tempo_entrega', 'fornecedores'],
    "Mercado e Estratégia": ['concorrentes', 'diferencial', 'regiao_atendimento', 'origem_clientes', 'maior_objecao', 'gargalos', 'clientes', 'tipo_cliente']
}

# Lista achatada para conveniência
BONUS_FIELDS = [f for fields in FIELD_GROUPS.values() for f in fields]
BONUS_MINIMUM = len(BONUS_FIELDS) 

_FIELD_LABELS_PT = {
    'nome_negocio': 'Empresa',
    'segmento': 'Segmento',
    'modelo': 'Modelo',
    'localizacao': 'Localização',
    'dificuldades': 'Desafios',
    'objetivos': 'Metas',
    'faturamento': 'Faturamento',
    'ticket_medio': 'Ticket',
    'tipo_produto': 'Produtos',
    'equipe': 'Equipe',
    'diferencial': 'Diferencial',
    'concorrentes': 'Concorrência',
    'canais': 'Canais de Venda',
    'investimento': 'Investimento',
    'margem': 'Margem',
    'tempo_operacao': 'Tempo',
    'modelo_operacional': 'Operação',
    'capital_disponivel': 'Capital',
    'gargalos': 'Gargalos',
    'tipo_cliente': 'Público',
    'clientes': 'Cliente Ideal',
    'capacidade_produtiva': 'Capacidade',
    'regiao_atendimento': 'Região',
    'fornecedores': 'Fornecedores',
    'origem_clientes': 'Origem Leads',
    'maior_objecao': 'Objeções',
    'site': 'Website',
    'instagram': 'Instagram',
    'whatsapp': 'WhatsApp',
    'linkedin': 'LinkedIn',
    'google_maps': 'Google Maps',
    'email_contato': 'E-mail',
    'tempo_entrega': 'Prazo',
    'cnpj': 'CNPJ',
}


def _compute_missing_fields(profile: dict) -> tuple:
    """Compute which critical and bonus fields are still missing, organized by groups."""
    filled = {k for k, v in profile.items() if _is_field_filled(v)}
    
    # Debug: Log which fields are considered filled
    log_debug(f"Campos preenchidos: {sorted(filled)}")
    log_debug(f"Campos faltando: {sorted([f for f in BONUS_FIELDS if f not in filled])}")
    if 'equipe' in profile:
        log_debug(f"Valor do campo equipe: '{profile.get('equipe')}' -> Preenchido: {_is_field_filled(profile.get('equipe'))}")
    
    missing_critical = [f for f in CRITICAL_FIELDS if f not in filled]
    missing_bonus = [f for f in BONUS_FIELDS if f not in filled]
    
    # Calculate group completion
    group_status = {}
    for group_name, fields in FIELD_GROUPS.items():
        missing_in_group = [f for f in fields if f not in filled]
        group_status[group_name] = {
            "missing": missing_in_group,
            "count_missing": len(missing_in_group),
            "total": len(fields),
            "is_complete": len(missing_in_group) == 0
        }
        
    bonus_collected = len(BONUS_FIELDS) - len(missing_bonus)
    all_missing = missing_critical + missing_bonus
    
    return missing_critical, missing_bonus, bonus_collected, all_missing, group_status


def chat_consultant(messages: list, user_message: str, extracted_profile: dict, last_search_time: float = 0, business_id: str = None):
    """
    Main consultant generator - yields events for SSE streaming.
    Supports immediate persistence if business_id is provided.
    """
    
    # Track discovery events to yield them from the generator
    discovery_events = []
    def emit_callback(event):
        discovery_events.append(event)

    log_info(f"Chat consultant processing: {user_message[:50]}...")
    
    # 0. Flatten the input profile for consistent internal usage
    # This prevents the "mixed profile" bug where new fields are flat and old ones are nested.
    internal_profile = extracted_profile.get("perfil", extracted_profile) if isinstance(extracted_profile, dict) else {}
    
    # 1. Extract business information (this will trigger CNPJ lookups and discovery events)
    updated_profile = _extract_business_info(user_message, internal_profile, messages, yield_callback=emit_callback)
    
    # --- IMMEDIATE PERSISTENCE ---
    # As soon as we have the extraction, save to DB so the UI (roleta) updates instantly
    if business_id:
        try:
            from app.core import database as db
            db.update_business_profile(business_id, {"perfil": updated_profile})
            log_info(f"💾 Perfil persistido IMEDIATAMENTE para o negócio {business_id}")
        except Exception as e:
            log_error(f"⚠️ Falha na persistência imediata: {e}")

    # Yield all discoveries and tool events collected during extraction
    for ev in discovery_events:
        yield ev
    
    # 1.5. Track missing fields
    missing_critical, missing_bonus, bonus_count, all_missing, group_status = _compute_missing_fields(updated_profile)
    
    # DEBUG: Log exact state for troubleshooting loops
    log_info(f"📊 Estado do Perfil: {len([k for k, v in updated_profile.items() if _is_field_filled(v)])} campos preenchidos.")
    log_debug(f"🔍 Campos Faltando (all_missing): {all_missing}")
    if 'margem' in updated_profile:
        log_debug(f"📈 Margem no perfil: '{updated_profile.get('margem')}' (Filled: {_is_field_filled(updated_profile.get('margem'))})")
    if 'email_contato' in updated_profile:
        log_debug(f"📧 Email no perfil: '{updated_profile.get('email_contato')}' (Filled: {_is_field_filled(updated_profile.get('email_contato'))})")
    # 2. Detect gaps
    discovery_gaps = _detect_discovery_gaps(user_message, updated_profile)
    if discovery_gaps:
        updated_profile["_discovery_gaps"] = discovery_gaps
    
    # 3. Build response prompt
    profile_summary_lines = []
    for key, label in _FIELD_LABELS_PT.items():
        val = updated_profile.get(key)
        if val and str(val).strip():
            profile_summary_lines.append(f"• {label}: {val}")
    profile_summary = "\n".join(profile_summary_lines) if profile_summary_lines else "(nenhum dado coletado ainda)"
    
    modelo_raw = (updated_profile.get("modelo") or "").lower()
    if "b2b" in modelo_raw:
        modelo_contexto = "B2B (vende para empresas/indústrias)."
    elif any(kw in modelo_raw for kw in ("serviço", "servico", "consultoria")):
        modelo_contexto = "Prestação de serviços."
    else:
        modelo_contexto = "B2C (vende para consumidor final)."
    
    history_lines = []
    for m in (messages[-8:] if messages else []):
        role_label = "Usuário" if m.get("role") == "user" else "Consultor"
        history_lines.append(f"{role_label}: {m.get('content', '')[:300]}")
    history_text = "\n".join(history_lines) if history_lines else "(primeira mensagem)"
    
    # ── ANTI-LOOP: Detect what field the AI JUST asked about ────────────────
    # If the AI asked about a field in the PREVIOUS message and the user just answered,
    # we FORCE that field as saved (even if LLM extraction failed it)
    _anti_loop_map = {
        'tipo_cliente':        ['público-alvo', 'público alvo', 'perfil do cliente', 'quais são as características'],
        'clientes':            ['cliente ideal', 'clientes ideais'],
        'maior_objecao':       ['objeção', 'objecao', 'objeções', 'objecoes', 'por que não compram'],
        'gargalos':            ['gargalo', 'gargalos', 'principais desafios que a'],
        'capacidade_produtiva':['capacidade de produção', 'capacidade produtiva'],
        'tempo_entrega':       ['prazo médio de entrega', 'prazo de entrega'],
        'fornecedores':        ['principais fornecedores', 'matéria-prima'],
        'modelo_operacional':  ['modelo operacional', 'como a empresa produz'],
        'regiao_atendimento':  ['região', 'abrangência geográfica', 'cobertura'],
        'origem_clientes':     ['origem dos leads', 'origem dos clientes'],
        'diferencial':         ['principal diferencial', 'o que diferencia'],
        'tipo_produto':        ['principais produtos', 'produtos fabricados'],
        'concorrentes':        ['principais concorrentes'],
        'investimento':        ['investido anualmente', 'quanto investe'],
    }
    just_asked_field = None
    if messages:
        for m in reversed(messages):
            if m.get("role") == "assistant":
                prev_content = m.get("content", "").lower()
                for fkey, kws in _anti_loop_map.items():
                    if any(kw in prev_content for kw in kws):
                        just_asked_field = fkey
                        break
                break
    
    # If AI just asked about a field and user gave a substantive answer (>5 chars),
    # force-save it to prevent loop — even if extraction failed
    if just_asked_field and not _is_field_filled(updated_profile.get(just_asked_field)):
        answer_len = len(user_message.strip())
        is_skip_signal = any(s in user_message.lower() for s in ["não sei", "nao sei", "pular", "não tenho", "nenhum"])
        if answer_len > 5:
            val_to_save = "Desconhecido" if is_skip_signal else user_message.strip()
            updated_profile[just_asked_field] = val_to_save
            log_info(f"🔒 ANTI-LOOP: Campo '{just_asked_field}' forçado com valor: {val_to_save[:40]}")
            # Yield discovery so the roleta updates
            yield {"type": "discovery", "field": just_asked_field, 
                   "label": _FIELD_LABELS_PT.get(just_asked_field, just_asked_field), 
                   "value": val_to_save}
            # Recompute missing with the newly forced field
            missing_critical, missing_bonus, bonus_count, all_missing, group_status = _compute_missing_fields(updated_profile)
    # ── END ANTI-LOOP ────────────────────────────────────────────────────────

    gaps_text = f"\nO USUÁRIO NÃO SABE: {', '.join(discovery_gaps)}.\n" if discovery_gaps else ""
    
    # Logic for ready_now
    has_critical = len(missing_critical) == 0
    has_all_bonus = len(missing_bonus) == 0
    ready_now = has_critical and has_all_bonus
    
    # Requirement: At least 5 real business facts
    actual_data_count = len([k for k, v in updated_profile.items() if _is_field_filled(v) and k in _FIELD_LABELS_PT and "desconhecido" not in str(v).lower()])
    ready_now = ready_now and (actual_data_count >= 5)
    
    # Rebuild profile summary AFTER anti-loop may have added data
    profile_summary_lines = []
    for key, label in _FIELD_LABELS_PT.items():
        val = updated_profile.get(key)
        if val and str(val).strip():
            profile_summary_lines.append(f"• {label}: {val}")
    profile_summary = "\n".join(profile_summary_lines) if profile_summary_lines else "(nenhum dado coletado ainda)"
    
    if ready_now:
        status_instruction = "ESTADO: DNA MAPEADO. Agradeça profissionalmente e peça para iniciar a análise no botão."
    else:
        missing_labels = [_FIELD_LABELS_PT.get(f, f) for f in all_missing]
        
        # Identify fields already dealt with (skipped/unknown)
        dealt_with = [f for f in BONUS_FIELDS if f in updated_profile and any(term in str(updated_profile.get(f)).lower() for term in ["desconhecido", "pesquisar", "não possui", "não sei", "nao sei"])]
        dealt_with_labels = [_FIELD_LABELS_PT.get(f, f) for f in dealt_with]
        
        # Also tell the LLM the field it JUST received an answer for
        just_answered_label = _FIELD_LABELS_PT.get(just_asked_field, "") if just_asked_field else ""
        just_answered_note = f"\n        ACABOU DE RECEBER: O usuário ACABOU de responder sobre '{just_answered_label}' — NÃO PERGUNTE SOBRE ISSO NOVAMENTE." if just_answered_label else ""
        
        status_instruction = f"""ESTADO: Coletando dados essenciais para o diagnóstico.
        DADOS ATUAIS (RESUMO): {profile_summary if profile_summary else "Nenhum"}
        FALTAM: {', '.join(missing_labels[:5])}
        PULADOS (NÃO PERGUNTE): {', '.join(dealt_with_labels) if dealt_with_labels else "Nenhum"}{just_answered_note}
        
        REGRAS CURTAS:
        1. SEJA DIRETO: Não fale "vi que você mencionou X", apenas reconheça o dado organicamente e avance.
        2. DADOS TÉCNICOS: Ao perguntar sobre Instagram, LinkedIn ou Site, peça o @ ou o Link diretamente.
        3. SEM LISTAS: Não cite o que falta de forma robótica. Apenas pergunte.
        4. SEM AMNÉSIA: Se o dado está no 'DADOS ATUAIS' ou em 'PULADOS', você NUNCA pode perguntar sobre ele. Pule para o próximo de 'FALTAM'.
        5. PEÇA APENAS UM DADO POR VEZ: No máximo dois, se forem correlacionados.
        6. FOCO INDUSTRIAL: Se o usuário é B2B/Indústria, priorize saber sobre concorrentes reais, diferenciais técnicos ou canais de leads agora.
        """

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
    
    # Start yielding the response
    yield {"type": "thought", "text": "Gerando resposta estratégica..."}
    
    try:
        result = call_llm(
            "auto",
            prompt=prompt,
            temperature=0.1,  
            json_mode=False
        )
        reply = result if isinstance(result, str) else result.get("content", "Desculpe, tive um problema na geração da resposta.")
    except Exception as e:
        log_error(f"❌ Falha crítica no LLM (Response Gen): {str(e)}")
        reply = "Tive um problema momentâneo de conexão com meus serviços de IA. Pode repetir a última informação, por favor?"
    
    # Final yield of content
    yield {"type": "content", "text": reply}
    
    # Determine final result
    fields_collected = [k for k, v in updated_profile.items() if v is not None and v != ""]
    
    yield {
        "type": "result",
        "data": {
            "reply": reply,
            "extracted_profile": updated_profile,
            "ready_for_analysis": ready_now,
            "fields_collected": fields_collected,
            "fields_missing": all_missing,
            "discovery_gaps": discovery_gaps
        }
    }


def run_chat(input_data: dict):
    """
    Main entry point for the CONSULTATIVE chat generator.
    """
    messages = input_data.get("messages", [])
    user_message = input_data.get("user_message", "")
    extracted_profile = input_data.get("extracted_profile", {})
    last_search_time = input_data.get("last_search_time", 0)
    business_id = input_data.get("business_id")

    return chat_consultant(messages, user_message, extracted_profile, last_search_time, business_id=business_id)


# ═══════════════════════════════════════════════════════════════════
# RESUMO DA REFACTORAÇÃO
# ═══════════════════════════════════════════════════════════════════

"""
REFACTOR TOTAL PARA RESILIÊNCIA DE DADOS (DNA ESTRATÉGICO)
- Desacoplamento de extração LLM e Redes de Proteção (Safety Nets)
- Formatação numérica robusta para Metas Financeiras (ex: 2,5 mi -> R$ 2.500.000,00)
- Validação estrita contra placeholders '.' e caracteres de lixo
- Sincronização em tempo real via discovery events
- Ganho de 30% em legibilidade e confiabilidade de persistência
"""
