import json
import os
import sys
import time
from groq import Groq
from openai import OpenAI
import warnings
from typing import Callable, Any, Optional, Dict, List, Union

try:
    import google.generativeai as google_generative_ai
    HAS_GENATIVE_AI = True
except (ImportError, Exception) as e_old:
    google_generative_ai = None
    HAS_GENATIVE_AI = False
    print(f"  ⚠️ Old Gemini SDK (google-generativeai) not available: {e_old}", file=sys.stderr)

try:
    from google import genai as google_genai_new
    HAS_NEW_GENAI = bool(google_genai_new)
except (ImportError, Exception) as e_new:
    google_genai_new = None
    HAS_NEW_GENAI = False
    print(f"  ⚠️ New Gemini SDK (google-genai) not available: {e_new}", file=sys.stderr)

class LLMResponse(str):
    """
    Subclass of str that can carry metadata like token counts and model used.
    Used to avoid breaking existing code that expects a string.
    """
    def __new__(cls, content, tokens=0, model=None, provider=None):
        return super().__new__(cls, content)
    
    def __init__(self, content, tokens=0, model=None, provider=None):
        self.tokens = tokens
        self.model = model
        self.provider = provider
    
    def __getnewargs__(self):
        return (str(self), self.tokens, self.model, self.provider)

from dotenv import load_dotenv
from app.services.intelligence.usage_tracker import usage_tracker
from app.services.common import log_info, log_error, log_debug

# Load .env - try multiple paths to be robust
current_dir = os.path.dirname(__file__)
env_paths = [
    os.path.join(current_dir, '..', '..', '..', '.env'), # backend/.env
    os.path.join(current_dir, '..', '..', '..', '..', '.env'), # root/.env
    '.env'
]
for p in env_paths:
    if os.path.exists(p):
        load_dotenv(dotenv_path=p)
        break
else:
    load_dotenv() # Fallback to default search

# ── Gemini model cascade ──────────────────────────────────────
# Each model has its own separate daily quota on the free tier,
# so when 2.0-flash is exhausted we can still use 2.5-flash, etc.
GEMINI_MODELS = [
    "models/gemini-2.0-flash",
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash-lite",
    "models/gemini-2.5-flash-lite",
    "models/gemini-flash-latest"
]

# Elite Providers Support (Free/Fast/Powerful)
SAMBANOVA_MODELS = ["Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-70B-Instruct"]
DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner"]
CEREBRAS_MODELS = ["llama3.1-8b", "llama3.1-70b"]

def _parse_retry_wait(error_msg: str) -> int:
    import re
    match = re.search(r"try again in (\d+)m([\d.]+)s", error_msg)
    if match: return int(match.group(1)) * 60 + int(float(match.group(2)))
    match = re.search(r"try again in ([\d.]+)s", error_msg)
    if match: return int(float(match.group(1)))
    return 0

def _is_daily_quota(error_msg: str) -> bool:
    """Check if the error is a daily quota exhaustion (not per-minute rate limit)."""
    daily_indicators = [
        "free_tier_requests",
        "PerDay",
        "per day",
        "daily",
        "quota exceeded",
    ]
    return any(ind.lower() in error_msg.lower() for ind in daily_indicators)

def _strip_thinking_tags(text: str) -> str:
    """Remove <think>...</think> blocks and Qwen3 reasoning tokens from LLM output."""
    import re as _re
    # Remove <think>...</think> blocks (Qwen3, DeepSeek, etc.)
    text = _re.sub(r'<think>[\s\S]*?</think>', '', text, flags=_re.IGNORECASE)
    # Remove triple-brace thinking token runs (Qwen3 without system prompt)
    text = _re.sub(r'\{{3,}[\x00-\x1F\x7F-\xFF]*\}{0,3}', '', text)
    return text.strip()


def _is_clean_text(text: str, min_printable: float = 0.85) -> bool:
    """Return True if text has mostly real, readable content.
    Rejects binary garbage, Unicode replacement chars, and thinking tokens."""
    if not text or len(text.strip()) < 20:
        return False
    sample = text[:2000]
    # Count genuinely readable characters (exclude U+FFFD replacement chars)
    replacement_chars = sample.count('\ufffd')
    if replacement_chars > len(sample) * 0.05:  # More than 5% replacement chars = garbage
        return False
    printable = sum(1 for c in sample if (c.isprintable() or c in ('\n', '\r', '\t')) and c != '\ufffd')
    return (printable / len(sample)) >= min_printable


def _try_without_json_constraint(client, msg_payload, model, temperature, provider, fallback_title="Resultado gerado") -> tuple[str | None, int]:
    """
    Try a model WITHOUT response_format constraint, then extract JSON from the text.
    Returns (extracted_json_string, tokens), or (None, 0) if output is garbage.
    """
    import re as _re
    try:
        completion = client.chat.completions.create(
            messages=msg_payload,
            model=model,
            temperature=temperature,
            max_tokens=8192,
        )
        raw = _strip_thinking_tags(completion.choices[0].message.content or "")

        # Track tokens even if it's not JSON
        prompt_tokens = getattr(completion.usage, 'prompt_tokens', 0)
        completion_tokens = getattr(completion.usage, 'completion_tokens', 0)
        tokens = usage_tracker.track_request(
            provider, "", raw, model, 
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )

        # Reject garbage output early
        if not _is_clean_text(raw):
            print(f"  ⚠️ {model} sem constraint gerou conteúdo ilegível. Pulando.", file=sys.stderr)
            return None, tokens

        # Try to extract valid JSON from the response
        # Method 1: Find a JSON object
        json_match = _re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            try:
                candidate = json_match.group(0)
                json.loads(candidate)
                print(f"  ✅ JSON extraído de {model} sem constraint", file=sys.stderr)
                return candidate, tokens
            except json.JSONDecodeError:
                pass

        # Method 2: Strip ```json fences
        cleaned = raw.strip()
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        if cleaned.startswith('```'):
            cleaned = cleaned[3:]
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        try:
            json.loads(cleaned)
            print(f"  ✅ JSON extraído de {model} após limpar fences", file=sys.stderr)
            return cleaned, tokens
        except json.JSONDecodeError:
            pass

        # Method 3: Wrap clean text as content (last resort)
        if len(raw.strip()) > 100:
            print(f"  ⚠️ JSON extraction falhou em {model}, envolvendo texto como conteúdo ({len(raw)} chars)", file=sys.stderr)
            # Extract first meaningful paragraphs as opiniao
            lines = [l.strip() for l in raw.strip().split('\n') if l.strip()]
            _first_line = lines[0].strip('#').strip() if lines else ""
            _titulo = _first_line[:120] if len(_first_line) > 10 else fallback_title
            
            _paragraphs = [p.strip() for p in raw.strip().split('\n') if p.strip() and len(p.strip()) > 30]
            _opiniao = ' '.join(_paragraphs[:3])[:500] if _paragraphs else ""
            
            return json.dumps({
                "entregavel_titulo": _titulo,
                "entregavel_tipo": "documento",
                "opiniao": _opiniao,
                "conteudo": raw[:16000].strip(),
                "como_aplicar": "",
                "proximos_passos": "",
                "fontes_consultadas": [],
                "impacto_estimado": ""
            }, ensure_ascii=False), tokens

        return None, tokens
    except Exception as e:
        print(f"  ⚠️ {model} sem constraint falhou: {str(e)[:80]}", file=sys.stderr)
        return None, 0


_GROQ_BROKEN_MODELS: set = set()
_GROQ_TPD_EXHAUSTED: set = set()
_GEMINI_EXHAUSTED_MODELS: set = set()

# Circuit Breaker: Providers that failed completely are disabled for X minutes
_PROVIDER_COOLDOWN: Dict[str, float] = {}


def _sleep_with_cancellation(seconds: float, cancellation_check: Callable[[], None] = None):
    """Sleep in small increments to allow instant cancellation."""
    if not seconds:
        return
    if not cancellation_check:
        time.sleep(seconds)
        return
    
    start_time = time.time()
    while time.time() - start_time < seconds:
        cancellation_check()
        # Sleep in 0.5s increments
        remaining = seconds - (time.time() - start_time)
        time.sleep(min(0.5, remaining) if remaining > 0 else 0)


def _call_groq_engine(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 4, json_mode: bool = True, messages: list = None, prefer_small: bool = False, cancellation_check: Callable[[], None] = None):
    """Groq execution engine with aggressive retry logic."""
    client = Groq(api_key=api_key)
    
    estimated_tokens = (len(prompt) if prompt else 0) // 4
    if messages:
        estimated_tokens = len(json.dumps(messages)) // 4

    if prefer_small and estimated_tokens < 6000:
        # Tier 1: Small/Fast models for routine tasks
        models = [
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
        ]
    else:
        # Tier 2: High Performance models OR large prompts
        models = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant", # Fallback to 8b if 3.3-70b is out
        ]
        # If the prompt is clearly too large for 8b (8k limit), remove it
        if estimated_tokens > 6000:
            models = ["llama-3.3-70b-versatile"]

    # Filter out models known to be broken or TPD-exhausted this session
    models = [m for m in models if m not in _GROQ_BROKEN_MODELS and m not in _GROQ_TPD_EXHAUSTED]
    if _GROQ_BROKEN_MODELS or _GROQ_TPD_EXHAUSTED:
        skipped = (_GROQ_BROKEN_MODELS | _GROQ_TPD_EXHAUSTED)
        print(f"  ⏭️ Modelos filtrados ({len(skipped)} skip): {', '.join(s.split('/')[-1] for s in skipped)}. Restam: {[m.split('/')[-1] for m in models]}", file=sys.stderr)
    if not models:
        raise Exception("Todos os modelos Groq estão marcados como indisponíveis nesta sessão.")

    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    msg_payload = messages if messages else [{"role": "user", "content": prompt}]

    for mi, model in enumerate(models):
        for attempt in range(max_retries):
            try:
                raw_response = client.chat.completions.with_raw_response.create(
                    messages=msg_payload,
                    model=model,
                    temperature=temperature,
                    max_tokens=8192,
                    **kwargs,
                )
                completion = raw_response.parse()
                headers = dict(raw_response.headers)
                raw = _strip_thinking_tags(completion.choices[0].message.content or "")
                
                # Track usage with real token counts from Groq
                prompt_tokens = getattr(completion.usage, 'prompt_tokens', 0)
                completion_tokens = getattr(completion.usage, 'completion_tokens', 0)
                
                tokens = usage_tracker.track_request(
                    "groq", prompt, raw, model, headers=headers,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens
                )
                
                return raw, tokens, model
            except Exception as e:
                # Sync headers on error (Rate Limit 429 usually has headers)
                if hasattr(e, 'response') and hasattr(e.response, 'headers'):
                    usage_tracker.track_error("groq", dict(e.response.headers))
                
                error_msg = str(e)
                is_rate_limit = "429" in error_msg
                is_tpd = "tokens per day" in error_msg.lower() or "TPD" in error_msg or "rate_limit_reached" in error_msg.lower()
                is_model_error = ("400" in error_msg or "404" in error_msg) and ("does not exist" in error_msg or "not supported" in error_msg or "decommissioned" in error_msg or "The model" in error_msg or "not found" in error_msg.lower())
                is_json_fail = "400" in error_msg and ("Failed to generate JSON" in error_msg or "failed to generate" in error_msg.lower())
                is_payload_too_large = "413" in error_msg or "too large" in error_msg.lower() or "context_length_exceeded" in error_msg.lower()

                # Model doesn't exist, TPD hit or prompt too large for THIS model -> skip to next model
                if (is_model_error or is_tpd or is_payload_too_large) and mi < len(models) - 1:
                    reason = "indisponível" if is_model_error else "cota esgotada (TPD)" if is_tpd else "prompt muito grande"
                    print(f"  ⚠️ Modelo {model} {reason}. Trocando...", file=sys.stderr)
                    if is_model_error or is_tpd:
                         _GROQ_TPD_EXHAUSTED.add(model) # Only mark as exhausted for fatal/daily errors
                    break

                # JSON generation failure → try SAME model without constraint, then next
                if is_json_fail:
                    print(f"  ⚠️ Modelo {model} falhou ao gerar JSON. Tentando sem constraint...", file=sys.stderr)
                    extracted, f_tokens = _try_without_json_constraint(
                        client, msg_payload, model, temperature, "groq"
                    )
                    if extracted is not None:
                        return extracted, f_tokens, model 
                    
                    # Don't mark as broken permanently, just skip for this specific call chain if needed
                    if mi < len(models) - 1:
                        print(f"  ➡️ {model} não respondeu em formato JSON. Tentando próximo modelo...", file=sys.stderr)
                        break
                    raise

                # TPD (daily limit) — switch model immediately, remember for session
                if is_rate_limit and is_tpd:
                    _GROQ_TPD_EXHAUSTED.add(model)
                    usage_tracker.mark_exhausted("groq")
                    if attempt == 0 and mi < len(models) - 1:
                        print(f"  🔄 Limite diário atingido em {model}. Trocando para próximo modelo...", file=sys.stderr)
                        break
                    elif attempt < max_retries - 1:
                        retry_secs = _parse_retry_wait(error_msg)
                        if retry_secs <= 30:
                            wait = retry_secs if retry_secs > 0 else 15
                            print(f"  ⏳ TPD em {model}. Aguardando {wait}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                            _sleep_with_cancellation(wait, cancellation_check)
                            continue
                    elif mi < len(models) - 1:
                        print(f"  🔄 Limite diário atingido em {model}. Trocando para próximo modelo...", file=sys.stderr)
                        break
                    raise
                # TPM (per-minute) — wait less, fallback faster
                elif is_rate_limit and attempt < max_retries - 1:
                    retry_secs = _parse_retry_wait(error_msg)
                    wait = retry_secs if retry_secs > 0 else (attempt + 1) * 2 # Reduced from 30s to 2s
                    wait = min(wait, 15)  # Cap at 15s instead of 120s
                    # If wait is too long, just skip to next model
                    if wait > 10 and mi < len(models) - 1:
                        print(f"  🔄 Rate limit alto em {model} ({wait}s). Pulando para próximo modelo...", file=sys.stderr)
                        break
                    print(f"  ⏳ Rate limit em {model}. Aguardando {wait}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    _sleep_with_cancellation(wait, cancellation_check)
                    continue
                elif is_rate_limit and mi < len(models) - 1:
                    print(f"  🔄 Rate limit persistente em {model}. Trocando modelo...", file=sys.stderr)
                    _sleep_with_cancellation(10, cancellation_check)
                    break
                raise
    raise Exception("Todos os modelos Groq esgotaram o rate limit ou estão indisponíveis.")


def call_gemini(api_key: str, prompt: str, temperature: float = 0.3, json_mode: bool = True, messages: list = None, max_retries: int = 4, cancellation_check: Callable[[], None] = None):
    """Executes call via Google Gemini API with support for both old and new SDKs."""
    if not HAS_GENATIVE_AI and not HAS_NEW_GENAI:
        # Diagnostic attempt to check environment
        log_error("CRITICAL: Gemini libraries missing in current Python path!")
        raise RuntimeError("As bibliotecas Google GenAI (google-generativeai ou google-genai) não estão acessíveis no ambiente atual. Verifique se o ambiente virtual (.venv) está configurado e se pacotes foram instalados.")
    
    import re as _re
    
    for model_idx, model_name in enumerate(GEMINI_MODELS):
        if model_name in _GEMINI_EXHAUSTED_MODELS:
            continue
            
        for attempt in range(max_retries + 1):
            if cancellation_check: cancellation_check()
            try:
                res, tokens, used_model = _call_gemini_once(api_key, prompt, temperature, json_mode, messages, model_name=model_name)
                return res, tokens, used_model
            except Exception as e:
                err_str = str(e)
                is_429 = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower()
                is_404 = "404" in err_str or "not found" in err_str.lower()
                
                # Sync headers on error if present
                if hasattr(e, 'response') and hasattr(e.response, 'headers'):
                    usage_tracker.track_error("gemini", dict(e.response.headers))
                
                if is_404:
                     print(f"  ⚠️ Modelo {model_name} não encontrado (404). Trocando modelo...", file=sys.stderr)
                     break # Try next model
                     
                if is_429 and _is_daily_quota(err_str):
                    # Daily quota exhausted → switch model immediately, remember for session
                    print(f"  ⚠️ Cota diária do {model_name} esgotada. Trocando modelo...", file=sys.stderr)
                    _GEMINI_EXHAUSTED_MODELS.add(model_name)
                    # If all models are exhausted, mark provider as exhausted
                    if all(m in _GEMINI_EXHAUSTED_MODELS for m in GEMINI_MODELS):
                        usage_tracker.mark_exhausted("gemini")
                    break
                
                if is_429 and attempt < max_retries:
                    # Per-minute rate limit → AGGRESSIVE retry with backoff
                    delay_match = _re.search(r'retryDelay.*?(\d+)s', err_str)
                    wait_secs = int(delay_match.group(1)) + 3 if delay_match else 30
                    wait_secs = min(wait_secs, 90)  # Cap at 90s
                    print(f"  ⏳ Gemini rate limit ({model_name}). Aguardando {wait_secs}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    _sleep_with_cancellation(wait_secs, cancellation_check)
                    continue
                
                if is_429 and model_idx < len(GEMINI_MODELS) - 1:
                    print(f"  🔄 Rate limit persistente em {model_name}. Trocando modelo...", file=sys.stderr)
                    _sleep_with_cancellation(5, cancellation_check)
                    break
                
                raise
    
    # Final check: If we are here, everything failed
    raise Exception("Todos os modelos Gemini esgotaram a cota ou estão indisponíveis.")


def _call_gemini_once(api_key: str, prompt: str, temperature: float, json_mode: bool, messages: list, model_name: str, cancellation_check: Callable[[], None] = None):
    """Single Gemini call using whichever SDK is available (prefers new SDK)."""
    
    # ── CASE 1: New SDK (google-genai) ──
    if HAS_NEW_GENAI and google_genai_new:
        try:
            client = google_genai_new.Client(api_key=api_key)
            from google.genai import types as new_types
            
            # Prepare content
            contents = []
            if messages:
                for m in messages:
                    # Map role 'system' or 'user' -> 'user' (simplified for Gemini SDK)
                    role = "user" if m["role"] == "user" else "model"
                    contents.append(new_types.Content(role=role, parts=[new_types.Part(text=m["content"])]))
            else:
                contents = [prompt]
            
            # Prepare config
            config = new_types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=12000,
            )
            if json_mode:
                config.response_mime_type = "application/json"
            
            if cancellation_check: cancellation_check()
            response = client.models.generate_content(model=model_name, contents=contents, config=config)
            
            result_text = response.text
            if not result_text:
                raise Exception("Gemini NEW SDK returned empty response")
                
            if json_mode:
                try: 
                    import json
                    return json.loads(result_text), estimated_tokens(result_text) if 'estimated_tokens' in globals() else len(result_text)//4, model_name
                except: 
                    return {"raw_response": result_text}, len(result_text)//4, model_name
            return result_text, len(result_text)//4, model_name
        except Exception as e_new:
            # If new SDK fails but old one is available, try fallback
            if HAS_GENATIVE_AI:
                print(f"  ⚠️ Gemini NEW SDK failed: {e_new}. Falling back to old SDK...", file=sys.stderr)
            else:
                raise e_new

    # ── CASE 2: Old SDK (google-generativeai) ──
    if HAS_GENATIVE_AI and google_generative_ai:
        genai = google_generative_ai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        
        # Build prompt
        if messages:
            gemini_messages = []
            for msg in messages:
                if msg.get("role") == "system":
                    gemini_messages.append({"text": f"System: {msg.get('content')}"})
                else:
                    gemini_messages.append({"text": msg.get("content")})
            prompt_text = "\n".join([m["text"] for m in gemini_messages])
        else:
            prompt_text = prompt
        
        # Configure generation
        generation_config = genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=12000,
        )
        if json_mode:
            generation_config.response_mime_type = "application/json"
        
        try:
            if cancellation_check: cancellation_check()
            
            # For long prompts, allow cancellation
            if (len(prompt_text) if prompt_text else 0) > 10000 and cancellation_check:
                # OLD SDK Streaming
                response = model.generate_content(prompt_text, generation_config=generation_config, stream=True)
                result_text = ""
                for chunk in response:
                    if cancellation_check: cancellation_check()
                    result_text += chunk.text
            else:
                response = model.generate_content(prompt_text, generation_config=generation_config)
                result_text = response.text
                
            if json_mode:
                try: 
                    import json
                    return json.loads(result_text), len(result_text)//4, model_name
                except: 
                    return {"raw_response": result_text}, len(result_text)//4, model_name
            return result_text, len(result_text)//4, model_name
        except Exception as e:
            error_msg = str(e)
            if "quota" in error_msg.lower() or "rate limit" in error_msg.lower() or "429" in error_msg:
                raise Exception(f"Rate limit: {error_msg}")
            raise e

    raise RuntimeError("No working Gemini SDK found in current context (tried old and new)")


def _call_sambanova_engine(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 3, json_mode: bool = True, messages: List = None, model: str = None, cancellation_check: Callable[[], None] = None):
    """Execute call via SambaNova API."""
    from openai import OpenAI
    client = OpenAI(
        base_url="https://api.sambanova.ai/v1",
        api_key=api_key,
    )
    
    target_model = model or SAMBANOVA_MODELS[0]
    msg_payload = messages if messages else [{"role": "user", "content": prompt}]
    
    # Reduzido para 2 retries e failover rápido em 429
    for attempt in range(max_retries):
        if cancellation_check: cancellation_check()
        try:
            response = client.chat.completions.create(
                model=target_model,
                messages=msg_payload,
                temperature=temperature,
                response_format={"type": "json_object"} if json_mode else None,
                timeout=60 # Prevent hanging
            )
            content = response.choices[0].message.content
            tokens = response.usage.total_tokens
            # Track usage
            usage_tracker.track_request("sambanova", prompt, content, target_model, prompt_tokens=response.usage.prompt_tokens, completion_tokens=response.usage.completion_tokens)
            return content, tokens, target_model
        except Exception as e:
            err_str = str(e).lower()
            
            # Se for 429, espera pouco e pula logo (a cota do SambaNova é muito restrita)
            is_429 = "429" in err_str or "too many" in err_str
            if is_429:
                if attempt == 0:
                    wait_time = 2
                    print(f"  ⏳ SambaNova 429. Tentando mais uma vez em {wait_time}s...", file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                else:
                    # Falha rápida após a segunda tentativa de 429
                    print(f"  🛑 SambaNova cota esgotada (429 persistente). Pulando provider.", file=sys.stderr)
                    raise Exception("SambaNova rate limit reached (429)")

            if "insufficient balance" in err_str or "unpaid" in err_str or "402" in err_str:
                raise Exception("SambaNova saldo insuficiente")
            
            if "Task cancelled" in str(e): raise
            if attempt == max_retries - 1: raise
            time.sleep(1)
    return None, 0, target_model

def _call_deepseek_engine(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 3, json_mode: bool = True, messages: List = None, model: str = None, cancellation_check: Callable[[], None] = None):
    """Execute call via DeepSeek API."""
    from openai import OpenAI
    client = OpenAI(
        base_url="https://api.deepseek.com",
        api_key=api_key,
    )
    
    target_model = model or "deepseek-chat"
    msg_payload = messages if messages else [{"role": "user", "content": prompt}]
    
    for attempt in range(max_retries):
        if cancellation_check: cancellation_check()
        try:
            response = client.chat.completions.create(
                model=target_model,
                messages=msg_payload,
                temperature=temperature,
                response_format={"type": "json_object"} if json_mode else None
            )
            content = response.choices[0].message.content
            tokens = response.usage.total_tokens
            # Track usage
            usage_tracker.track_request("deepseek", prompt, content, target_model, prompt_tokens=response.usage.prompt_tokens, completion_tokens=response.usage.completion_tokens)
            return content, tokens, target_model
        except Exception as e:
            err_str = str(e).lower()
            if "insufficient balance" in err_str or "unpaid" in err_str or "402" in err_str:
                print(f"  ⚠️ DeepSeek saldo insuficiente. Pulando...", file=sys.stderr)
                raise Exception("DeepSeek saldo insuficiente")
            if "Task cancelled" in str(e): raise
            if attempt == max_retries - 1: raise
            time.sleep(1 * (attempt + 1))
    return None, 0, target_model

def _call_cerebras_engine(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 3, json_mode: bool = True, messages: List = None, model: str = None, cancellation_check: Callable[[], None] = None):
    """Execute call via Cerebras API (Inference on CS-3)."""
    from openai import OpenAI
    client = OpenAI(
        base_url="https://api.cerebras.ai/v1",
        api_key=api_key,
    )
    
    target_model = model or CEREBRAS_MODELS[0]
    msg_payload = messages if messages else [{"role": "user", "content": prompt}]
    
    for attempt in range(max_retries):
        if cancellation_check: cancellation_check()
        try:
            response = client.chat.completions.create(
                model=target_model,
                messages=msg_payload,
                temperature=temperature,
                response_format={"type": "json_object"} if json_mode else None
            )
            content = response.choices[0].message.content
            tokens = response.usage.total_tokens
            
            # Track usage
            usage_tracker.track_request("cerebras", prompt, content, target_model, 
                                      prompt_tokens=response.usage.prompt_tokens, 
                                      completion_tokens=response.usage.completion_tokens)
            
            return content, tokens, target_model
        except Exception as e:
            err_str = str(e).lower()
            is_json_fail = "400" in err_str and ("json" in err_str or "format" in err_str or "output" in err_str)
            
            if is_json_fail:
                print(f"  ⚠️ Cerebras {target_model} falhou ao gerar JSON. Tentando sem constraint...", file=sys.stderr)
                extracted, f_tokens = _try_without_json_constraint(client, msg_payload, target_model, temperature, "cerebras")
                if extracted is not None:
                    return extracted, f_tokens, target_model

            if "Task cancelled" in str(e): raise
            if attempt == max_retries - 1: raise
            time.sleep(1 * (attempt+1))
    return None, 0, target_model

def call_openrouter(api_key: str, prompt: str, temperature: float = 0.3, json_mode: bool = True, messages: list = None, max_retries: int = 4, cancellation_check: Callable[[], None] = None):
    """Execute call via OpenRouter API with aggressive retry."""
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    # Diversified list of free models to rotate and avoid 429s
    models = [
        "google/gemini-2.0-flash-001:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "nvidia/llama-3.1-nemotron-70b-instruct:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "deepseek/deepseek-r1:free",
    ]
    
    # Shuffle models to distribute traffic among free providers
    import random
    random.shuffle(models)
    
    # Strictly using free models list to avoid paid routing

    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    msg_payload = messages if messages else [{"role": "user", "content": prompt}]
    
    # Calculate prompt size to filter models
    prompt_size = len(json.dumps(msg_payload)) if messages else len(prompt)
    estimated_tokens = prompt_size // 4
    
    # Filter models by context window
    # Free models context windows on OpenRouter vary wildly
    if estimated_tokens > 20000:
        # High context requirements
        models = [m for m in models if "gemini" in m or "70b" in m or "405b" in m]
        if not models: # Fallback to original list if filter is too aggressive
            models = ["google/gemini-2.0-flash-001:free", "meta-llama/llama-3.3-70b-instruct:free"]
    elif estimated_tokens > 8000:
        # Mid-size context
        models = [m for m in models if "gemini" in m or "70b" in m or "instruct" in m]

    for mi, model in enumerate(models[:6]): # Try up to 6 models for better success rate
        for attempt in range(1): # Single attempt per model for faster failover
            try:
                # Synchronous cancellation check
                if cancellation_check: cancellation_check()
                
                raw_resp = client.chat.completions.with_raw_response.create(
                    messages=msg_payload,
                    model=model,
                    temperature=temperature,
                    max_tokens=8192,
                    **kwargs,
                )
                completion = raw_resp.parse()
                result = completion.choices[0].message.content
                headers = dict(raw_resp.headers)

                if result:
                    # Track usage with real token counts from OpenRouter
                    prompt_tokens = getattr(completion.usage, 'prompt_tokens', 0)
                    completion_tokens = getattr(completion.usage, 'completion_tokens', 0)
                    
                    tokens = usage_tracker.track_request(
                        "openrouter", prompt, result, model, headers=headers,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens
                    )
                    return result, tokens, model
                
                # Empty response, try next model
                if mi < len(models) - 1:
                    break
            except Exception as e:
                # Sync OpenRouter headers on error
                if hasattr(e, 'response') and hasattr(e.response, 'headers'):
                    usage_tracker.track_error("openrouter", dict(e.response.headers))
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "rate" in error_msg.lower()
                is_spend_limit = "402" in error_msg or "spend limit" in error_msg.lower()
                is_model_error = "404" in error_msg or "not found" in error_msg.lower() or "not available" in error_msg.lower()
                
                if "Task cancelled" in str(e): raise

                if is_model_error and mi < len(models) - 1:
                    print(f"  ⚠️ OpenRouter modelo {model} indisponível. Trocando...", file=sys.stderr)
                    break  # Immediate switch without delay

                # Spend limit exceeded on a specific provider - try next model immediately
                if is_spend_limit and mi < len(models) - 1:
                    print(f"  🔄 OpenRouter spend limit em {model}. Trocando modelo...", file=sys.stderr)
                    break  # Immediate switch without delay
                elif is_spend_limit:
                    raise

                if is_rate_limit and attempt < 1:
                    wait = 2 # Reduced wait time for faster OpenRouter model switching
                    print(f"  ⏳ OpenRouter rate limit em {model}. Aguardando {wait}s...", file=sys.stderr)
                    _sleep_with_cancellation(wait, cancellation_check)
                    continue
                
                # If everything failed for this model, try next
                if mi < len(models) - 1:
                    break
                raise
    raise Exception("Todos os modelos OpenRouter falharam.")

def call_llm(provider: str, prompt: str = None, temperature: float = 0.3, max_retries: int = 4, json_mode: bool = True, messages: list = None, prefer_small: bool = False, cancellation_check: Callable[[], None] = None):
    """Global router to send requests either to Groq, Gemini, or OpenRouter based on user preference."""
    from app.core.llm_cache import get_cached_response, set_cached_response
    
    # Detect if provider was explicitly requested or use global default
    requested_provider = provider.lower() if provider else None
    actual_provider = requested_provider or "auto"
    original_provider = actual_provider
    
    # --- SMART TIERING STRATEGY ---
    prompt_len = len(prompt or "") + sum(len(m.get("content", "")) for m in (messages or []))
    tier = 1 # Small/Instant
    if prompt_len > 40000:
        tier = 3
        actual_provider = "gemini" if original_provider == "groq" else original_provider
    elif prompt_len > 12000:
        tier = 2
    
    # Build cache key from prompt content
    cache_prompt = prompt or ""
    if messages: cache_prompt = json.dumps(messages, ensure_ascii=False)
    
    # Check cache first
    if temperature <= 0.3 and cache_prompt:
        cached = get_cached_response(cache_prompt, temperature, json_mode, actual_provider)
        if cached is not None: return cached
    
    # Execute call with fallback
    result = _execute_llm_call(
        actual_provider=actual_provider,
        prompt=prompt,
        temperature=temperature,
        max_retries=max_retries,
        json_mode=json_mode,
        messages=messages,
        prefer_small=prefer_small,
        tier=tier,
        original_provider=original_provider,
        cache_prompt=cache_prompt,
        cancellation_check=cancellation_check
    )
    
    # Cache and return
    if result is not None and temperature <= 0.3 and cache_prompt:
        set_cached_response(cache_prompt, temperature, json_mode, original_provider, result)
    
    return result

def _execute_llm_call(actual_provider, prompt, temperature, max_retries, json_mode, messages, prefer_small, tier, original_provider, cache_prompt, cancellation_check):
    """Helper to handle the fallback chain logic outside of call_llm to avoid scoping issues."""
    estimated_tokens = len(cache_prompt) // 4
    
    # ── Context-Aware Fallback optimization ────────────────────
    # For large prompts, we MUST skip small-context models (Cerebras/Samba/OpenRouter-Free)
    if estimated_tokens > 15000:
        # Giant prompt: ONLY use high-context masters (Gemini 1M, Groq 128k, SambaNova 64k)
        fallback_chain = ["gemini", "groq", "sambanova"]
        print(f"  � Prompt GIGANTE (~{estimated_tokens} tokens). Usando apenas Gemini/Groq.", file=sys.stderr)
        if actual_provider not in fallback_chain:
            actual_provider = "gemini"
    elif estimated_tokens > 4000:
        # Mid-size prompt: SambaNova Llama 3.3 70B is elite and free
        fallback_chain = ["sambanova", "gemini", "cerebras", "groq"]
        print(f"  🔍 Prompt grande (~{estimated_tokens} tokens). Pulando modelos pequenos.", file=sys.stderr)
        if actual_provider not in fallback_chain:
            actual_provider = "gemini"
    else:
        # Normal/Short prompt: Elite/Balanced priority chain
        # Prioritize SambaNova for intelligence, Cerebras for speed, Groq as absolute fallback
        fallback_chain = ["sambanova", "cerebras", "gemini", "openrouter", "groq"]
    
    chain = fallback_chain.copy()
    
    # Supernova alias support for SambaNova
    if actual_provider == "supernova":
        actual_provider = "sambanova"
        
    if actual_provider != "auto":
        # If a specific provider was requested, use ONLY it (no fallbacks)
        chain = [actual_provider]
    else:
        # For auto mode, ensure Groq is the absolute final fallback
        if "groq" in chain and chain[-1] != "groq":
            chain.remove("groq")
            chain.append("groq")
    
    errors = []
    now = time.time()
    
    # DEBUG: Verificar carregamento de chaves (log silencioso em produção)
    keys_found = []
    if os.environ.get("GROQ_API_KEY"): keys_found.append("Groq")
    if os.environ.get("SAMBANOVA_API_KEY"): keys_found.append("SambaNova")
    if os.environ.get("CEREBRAS_API_KEY"): keys_found.append("Cerebras")
    if os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY"): keys_found.append("Gemini")
    if os.environ.get("OPENROUTER_API_KEY"): keys_found.append("OpenRouter")
    
    if not keys_found:
        log_error("CRÍTICO: Nenhuma chave de API de LLM foi encontrada no ambiente!")
    else:
        log_debug(f"Chaves de API carregadas: {', '.join(keys_found)}")

    for provider in chain:
        # Check if provider is in cooldown
        if provider in _PROVIDER_COOLDOWN:
            if now < _PROVIDER_COOLDOWN[provider]:
                continue
            else:
                del _PROVIDER_COOLDOWN[provider]

        try:
            res, tokens, used_model = None, 0, None
            
            if provider == "sambanova":
                api_key = os.environ.get("SAMBANOVA_API_KEY")
                if not api_key or api_key.lower() == "none": 
                    errors.append("SambaNova: Chave ausente")
                    continue
                can_call, reason = usage_tracker.can_make_request("sambanova", estimated_tokens=len(cache_prompt)//4)
                if not can_call and len(keys_found) > 1:
                    print(f"  ⏭️ SambaNova pulado: {reason}", file=sys.stderr)
                    continue 
                res, tokens, used_model = _call_sambanova_engine(api_key, prompt, temperature, max_retries, json_mode, messages, cancellation_check=cancellation_check)

            elif provider == "cerebras":
                api_key = os.environ.get("CEREBRAS_API_KEY")
                if not api_key or api_key.lower() == "none":
                    errors.append("Cerebras: Chave ausente")
                    continue
                can_call, reason = usage_tracker.can_make_request("cerebras", estimated_tokens=len(cache_prompt)//4)
                if not can_call and len(keys_found) > 1:
                    print(f"  ⏭️ Cerebras pulado: {reason}", file=sys.stderr)
                    continue
                res, tokens, used_model = _call_cerebras_engine(api_key, prompt, temperature, max_retries, json_mode, messages, cancellation_check=cancellation_check)

            elif provider == "gemini":
                api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
                if not api_key or api_key.lower() == "none":
                    errors.append("Gemini: Chave ausente")
                    continue
                can_call, reason = usage_tracker.can_make_request("gemini", estimated_tokens=len(cache_prompt)//4)
                if not can_call and len(keys_found) > 1:
                    print(f"  ⏭️ Gemini pulado: {reason}", file=sys.stderr)
                    continue
                res, tokens, used_model = call_gemini(api_key, prompt, temperature, json_mode, messages, cancellation_check=cancellation_check)

            elif provider == "groq":
                api_key = os.environ.get("GROQ_API_KEY")
                if not api_key or api_key.lower() == "none":
                    errors.append("Groq: Chave ausente")
                    continue
                can_call, reason = usage_tracker.can_make_request("groq", estimated_tokens=len(cache_prompt)//4)
                if not can_call and len(keys_found) > 1:
                    print(f"  ⏭️ Groq pulado: {reason}", file=sys.stderr)
                    continue
                eff_prefer_small = prefer_small if tier != 2 else False
                res, tokens, used_model = _call_groq_engine(api_key, prompt, temperature, max_retries, json_mode, messages, eff_prefer_small, cancellation_check=cancellation_check)

            elif provider == "openrouter":
                api_key = os.environ.get("OPENROUTER_API_KEY")
                if not api_key or api_key.lower() == "none":
                    errors.append("OpenRouter: Chave ausente")
                    continue
                can_call, reason = usage_tracker.can_make_request("openrouter", estimated_tokens=len(cache_prompt)//4)
                if not can_call and len(keys_found) > 1:
                    print(f"  ⏭️ OpenRouter pulado: {reason}", file=sys.stderr)
                    continue
                res, tokens, used_model = call_openrouter(api_key, prompt, temperature, json_mode, messages, cancellation_check=cancellation_check)

            # SUCCESS: Clear cooldown if it was set
            if res:
                if provider in _PROVIDER_COOLDOWN:
                    del _PROVIDER_COOLDOWN[provider]
                return _process_llm_response(res, tokens, used_model, provider, provider != original_provider, json_mode)

        except Exception as e:
             err_msg = str(e)
             errors.append(f"{provider}: {err_msg}")
             
             is_rate_limit = "429" in err_msg or "rate" in err_msg.lower() or "limit" in err_msg.lower() or "quota" in err_msg.lower()
             if is_rate_limit or "Todos os modelos" in err_msg:
                 cooldown_duration = 120 if provider == "openrouter" else 300
                 print(f"  🛑 Provedor {provider} falhou criticamente. Entrando em cooldown.", file=sys.stderr)
                 _PROVIDER_COOLDOWN[provider] = time.time() + cooldown_duration
             continue
    
    final_error_msg = " | ".join(errors) if errors else "Nenhum provedor disponível (verifique as chaves de API no .env)"
    raise Exception(f"Todos os provedores de LLM falharam: {final_error_msg}")

def _process_llm_response(res, tokens, used_model, provider_name, is_fallback, json_mode):
    """Processes raw LLM response into final format."""
    if json_mode and isinstance(res, str):
        try:
            obj = json.loads(res)
            obj.update({
                "_tokens": tokens,
                "_actual_model": used_model,
                "_actual_provider": provider_name,
                "_is_fallback": is_fallback
            })
            return obj
        except json.JSONDecodeError:
            return {
                "raw_response": res, 
                "error": "Invalid JSON", 
                "_tokens": tokens, 
                "_actual_model": used_model, 
                "_actual_provider": provider_name, 
                "_is_fallback": is_fallback
            }
    return LLMResponse(res, tokens, used_model, provider=provider_name)
