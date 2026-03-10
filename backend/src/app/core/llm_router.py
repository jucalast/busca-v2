import json
import os
import sys
import time
from groq import Groq
from openai import OpenAI
import warnings
from typing import Callable, Any, Optional, Dict, List, Union

try:
    from google import genai
    HAS_NEW_GENAI = True
except ImportError:
    genai = None
    HAS_NEW_GENAI = False

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

# Load .env from project root (2 levels up from backend/src/app/core/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env'))

# ── Gemini model cascade ──────────────────────────────────────
# Each model has its own separate daily quota on the free tier,
# so when 2.0-flash is exhausted we can still use 1.5-flash, etc.
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-preview-02-05", # More precise ID
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]

# Elite Providers Support (Free/Fast/Powerful)
SAMBANOVA_MODELS = ["Meta-Llama-3.3-70B-Instruct", "Llama-4-Maverick-17B-128E-Instruct", "Qwen3-32B"]
DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner"]
CEREBRAS_MODELS = ["llama3.1-8b", "qwen-3-235b-a22b-instruct-2507", "gpt-oss-120b"]

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


def _try_without_json_constraint(client, msg_payload, model, temperature) -> str | None:
    """
    Try a model WITHOUT response_format constraint, then extract JSON from the text.
    Returns the extracted JSON string, or a wrapped-text JSON, or None if output is garbage.
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

        # Reject garbage output early
        if not _is_clean_text(raw):
            print(f"  ⚠️ {model} sem constraint gerou conteúdo ilegível. Pulando.", file=sys.stderr)
            return None

        # Try to extract valid JSON from the response
        # Method 1: Find a JSON object
        json_match = _re.search(r'\{[\s\S]*\}', raw)
        if json_match:
            try:
                candidate = json_match.group(0)
                json.loads(candidate)
                print(f"  ✅ JSON extraído de {model} sem constraint", file=sys.stderr)
                return candidate
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
            return cleaned
        except json.JSONDecodeError:
            pass

        # Method 3: Wrap clean text as content (last resort)
        if len(raw.strip()) > 100:
            print(f"  ⚠️ JSON extraction falhou em {model}, envolvendo texto como conteúdo ({len(raw)} chars)", file=sys.stderr)
            # Extract first meaningful paragraphs as opiniao
            _paragraphs = [p.strip() for p in raw.strip().split('\n') if p.strip() and len(p.strip()) > 30]
            _opiniao = ' '.join(_paragraphs[:3])[:500] if _paragraphs else ""
            # Try to extract a title from the first line
            _first_line = raw.strip().split('\n')[0].strip().strip('#').strip()
            _titulo = _first_line[:120] if len(_first_line) > 10 else "Resultado gerado"
            return json.dumps({
                "entregavel_titulo": _titulo,
                "entregavel_tipo": "documento",
                "opiniao": _opiniao,
                "conteudo": raw[:16000].strip(),
                "como_aplicar": "",
                "proximos_passos": "",
                "fontes_consultadas": [],
                "impacto_estimado": ""
            }, ensure_ascii=False)

        return None
    except Exception as e:
        print(f"  ⚠️ {model} sem constraint falhou: {str(e)[:80]}", file=sys.stderr)
        return None


_GROQ_BROKEN_MODELS: set = set()
_GROQ_TPD_EXHAUSTED: set = set()
_GEMINI_EXHAUSTED_MODELS: set = set()


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
                    _GROQ_BROKEN_MODELS.add(model)
                    break

                # JSON generation failure → try SAME model without constraint, then next
                if is_json_fail:
                    print(f"  ⚠️ Modelo {model} falhou ao gerar JSON. Tentando sem constraint...", file=sys.stderr)
                    extracted = _try_without_json_constraint(
                        client, msg_payload, model, temperature
                    )
                    if extracted is not None:
                        return extracted, 0, model # Estimação não disponível aqui
                    # This model can't produce usable output — mark as broken for session
                    _GROQ_BROKEN_MODELS.add(model)
                    if mi < len(models) - 1:
                        print(f"  ➡️ {model} marcado como broken. Pulando para próximo modelo...", file=sys.stderr)
                        break
                    raise

                # TPD (daily limit) — switch model immediately, remember for session
                if is_rate_limit and is_tpd:
                    _GROQ_TPD_EXHAUSTED.add(model)
                    usage_tracker.mark_exhausted("groq")
                    if attempt == 0 and mi < len(models) - 1:
                        print(f"  🔄 TPD esgotado em {model}. Trocando modelo...", file=sys.stderr)
                        break
                    elif attempt < max_retries - 1:
                        retry_secs = _parse_retry_wait(error_msg)
                        if retry_secs <= 30:
                            wait = retry_secs if retry_secs > 0 else 15
                            print(f"  ⏳ TPD em {model}. Aguardando {wait}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                            _sleep_with_cancellation(wait, cancellation_check)
                            continue
                    elif mi < len(models) - 1:
                        print(f"  🔄 TPD esgotado em {model}. Trocando modelo...", file=sys.stderr)
                        break
                    raise
                # TPM (per-minute) — always wait and retry aggressively
                elif is_rate_limit and attempt < max_retries - 1:
                    retry_secs = _parse_retry_wait(error_msg)
                    wait = retry_secs if retry_secs > 0 else (attempt + 1) * 30
                    wait = min(wait, 120)  # Cap at 2 min
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
    """Executes call via Google Gemini API with aggressive retry for 429 rate limits."""
    if not HAS_NEW_GENAI:
        raise RuntimeError("A biblioteca google-genai não está instalada.")
    
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


def _call_gemini_once(api_key: str, prompt: str, temperature: float = 0.3, json_mode: bool = True, messages: list = None, model_name: str = "gemini-2.0-flash"):
    """Single Gemini API call (no retries)."""
    if not HAS_NEW_GENAI:
        raise RuntimeError("A biblioteca google-genai não está instalada corretamente.")
    
    client = genai.Client(api_key=api_key)
    
    # Configure generation
    config = {
        "temperature": temperature,
    }
    
    if json_mode:
        config["response_mime_type"] = "application/json"
    
    if messages:
        # Chat mode
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config
        )
        raw = response.text
        
        # Extract headers from Gemini (if available in new SDK)
        headers = {}
        try:
            # Metadata usually contains headers in many SDK versions
            if hasattr(response, 'headers'):
                headers = dict(response.headers)
        except Exception:
            pass
            
        # Track usage with real token counts from Gemini
        prompt_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
        completion_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
        
        tokens = usage_tracker.track_request(
            "gemini", prompt, raw, model_name, headers=headers,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )
        
        return raw, tokens, model_name
    else:
        # Single prompt mode
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config
        )
        raw = response.text
        
        # Sync with Gemini using real token counts
        prompt_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
        completion_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
        
        tokens = usage_tracker.track_request(
            "gemini", prompt, raw, model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens
        )
        
        return raw, tokens, model_name


def _call_sambanova_engine(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 3, json_mode: bool = True, messages: List = None, model: str = None, cancellation_check: Callable[[], None] = None):
    """Execute call via SambaNova API."""
    from openai import OpenAI
    client = OpenAI(
        base_url="https://api.sambanova.ai/v1",
        api_key=api_key,
    )
    
    target_model = model or SAMBANOVA_MODELS[0]
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
            usage_tracker.track_request("sambanova", prompt, content, target_model, prompt_tokens=response.usage.prompt_tokens, completion_tokens=response.usage.completion_tokens)
            return content, tokens, target_model
        except Exception as e:
            err_str = str(e).lower()
            is_json_fail = "400" in err_str and ("json" in err_str or "format" in err_str)
            
            if is_json_fail:
                print(f"  ⚠️ SambaNova {target_model} falhou ao gerar JSON. Tentando sem constraint...", file=sys.stderr)
                extracted = _try_without_json_constraint(client, msg_payload, target_model, temperature)
                if extracted is not None:
                    return extracted, 0, target_model
            
            if "insufficient balance" in err_str or "unpaid" in err_str or "402" in err_str:
                print(f"  ⚠️ SambaNova saldo insuficiente. Pulando...", file=sys.stderr)
                raise Exception("SambaNova saldo insuficiente")
            if "Task cancelled" in str(e): raise
            if attempt == max_retries - 1: raise
            time.sleep(1 * (attempt + 1))
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
                extracted = _try_without_json_constraint(client, msg_payload, target_model, temperature)
                if extracted is not None:
                    return extracted, 0, target_model

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

    for mi, model in enumerate(models[:4]): # Try at most 4 models to avoid long waits
        for attempt in range(2): # 2 attempts per model instead of max_retries
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
                    break

                # Spend limit exceeded on a specific provider - try next model
                if is_spend_limit and mi < len(models) - 1:
                    print(f"  🔄 OpenRouter spend limit em {model}. Trocando modelo...", file=sys.stderr)
                    break
                elif is_spend_limit:
                    raise

                if is_rate_limit and attempt < 1:
                    wait = 5 # Fixed short wait for OpenRouter free models
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
        # Giant prompt: ONLY use high-context masters (Gemini 1M, Groq 128k)
        fallback_chain = ["gemini", "groq"]
        print(f"  � Prompt GIGANTE (~{estimated_tokens} tokens). Usando apenas Gemini/Groq.", file=sys.stderr)
        if actual_provider not in fallback_chain:
            actual_provider = "gemini"
    elif estimated_tokens > 8000:
        # Large prompt: Cerebras/Samba (8k-32k) are likely to fail or be slow
        fallback_chain = ["gemini", "groq"]
        print(f"  🔍 Prompt grande (~{estimated_tokens} tokens). Pulando modelos pequenos.", file=sys.stderr)
        if actual_provider not in fallback_chain:
            actual_provider = "gemini"
    else:
        # Normal/Short prompt: Elite/Balanced priority chain
        # User requested: OpenRouter, SambaNova, Cerebras first, then Groq, Gemini.
        elite_providers = ["openrouter", "sambanova", "cerebras"]
        
        # Balance elite providers if using 'auto' to avoid hitting same limits
        import random
        random.shuffle(elite_providers)
        
        fallback_chain = elite_providers + ["groq", "gemini"]
    
    chain = fallback_chain.copy()
    
    # Supernova alias support for SambaNova
    if actual_provider == "supernova":
        actual_provider = "sambanova"
        
    if actual_provider != "auto":
        # If a specific provider was requested, try it first
        if actual_provider in chain:
            chain.remove(actual_provider)
            chain.insert(0, actual_provider)
        elif actual_provider:
            # If we reach here, it's a short prompt but actual_provider (ex: custom) isn't in chain
            chain.insert(0, actual_provider)
    
    # Ensure OpenRouter is NEVER the final fallback if others were tried
    # (Matches user requirement: "não é pra terminar com openrouter")
    if len(chain) > 1 and chain[-1] == "openrouter":
        # Swap last two if needed
        chain[-1], chain[-2] = chain[-2], chain[-1]
    
    errors = []
    for provider in chain:
        try:
            res, tokens, used_model = None, 0, None
            
            if provider == "sambanova":
                api_key = os.environ.get("SAMBANOVA_API_KEY")
                if not api_key: continue
                can_call, _ = usage_tracker.can_make_request("sambanova", estimated_tokens=len(cache_prompt)//4)
                if not can_call: continue
                res, tokens, used_model = _call_sambanova_engine(api_key, prompt, temperature, max_retries, json_mode, messages, cancellation_check=cancellation_check)

            elif provider == "cerebras":
                api_key = os.environ.get("CEREBRAS_API_KEY")
                if not api_key: continue
                can_call, _ = usage_tracker.can_make_request("cerebras", estimated_tokens=len(cache_prompt)//4)
                if not can_call: continue
                res, tokens, used_model = _call_cerebras_engine(api_key, prompt, temperature, max_retries, json_mode, messages, cancellation_check=cancellation_check)

            elif provider == "gemini":
                api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
                if not api_key: continue
                can_call, _ = usage_tracker.can_make_request("gemini", estimated_tokens=len(cache_prompt)//4)
                if not can_call: continue
                res, tokens, used_model = call_gemini(api_key, prompt, temperature, json_mode, messages, cancellation_check=cancellation_check)

            elif provider == "groq":
                api_key = os.environ.get("GROQ_API_KEY")
                if not api_key: continue
                can_call, _ = usage_tracker.can_make_request("groq", estimated_tokens=len(cache_prompt)//4)
                if not can_call: continue
                eff_prefer_small = prefer_small if tier != 2 else False
                res, tokens, used_model = _call_groq_engine(api_key, prompt, temperature, max_retries, json_mode, messages, eff_prefer_small, cancellation_check=cancellation_check)

            elif provider == "openrouter":
                api_key = os.environ.get("OPENROUTER_API_KEY")
                if not api_key: continue
                can_call, _ = usage_tracker.can_make_request("openrouter", estimated_tokens=len(cache_prompt)//4)
                if not can_call: continue
                res, tokens, used_model = call_openrouter(api_key, prompt, temperature, json_mode, messages, cancellation_check=cancellation_check)

            if res:
                return _process_llm_response(res, tokens, used_model, provider, provider != original_provider, json_mode)

        except Exception as e:
            if "Task cancelled" in str(e): raise
            errors.append(f"{provider}: {str(e)}")
            print(f"⚠️ {provider} falhou: {str(e)[:100]}. Tentando próximo...", file=sys.stderr)
            continue
    
    raise Exception(f"Todos os provedores de LLM falharam: {' | '.join(errors)}")

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
