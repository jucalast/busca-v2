import json
import os
import sys
import time
from groq import Groq
from openai import OpenAI
import warnings

try:
    from google import genai
    HAS_NEW_GENAI = True
except ImportError:
    genai = None
    HAS_NEW_GENAI = False

from dotenv import load_dotenv

load_dotenv()

# ── Gemini model cascade ──────────────────────────────────────
# Each model has its own separate daily quota on the free tier,
# so when 2.0-flash is exhausted we can still use 1.5-flash, etc.
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

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

def _call_groq_engine(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 4, json_mode: bool = True, messages: list = None, prefer_small: bool = False):
    """Groq execution engine with aggressive retry logic."""
    client = Groq(api_key=api_key)
    
    if prefer_small:
        models = [
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "qwen/qwen3-32b",
        ]
    else:
        models = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "qwen/qwen3-32b",
        ]

    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    msg_payload = messages if messages else [{"role": "user", "content": prompt}]

    for mi, model in enumerate(models):
        for attempt in range(max_retries):
            try:
                completion = client.chat.completions.create(
                    messages=msg_payload,
                    model=model,
                    temperature=temperature,
                    max_tokens=8192,
                    **kwargs,
                )
                return completion.choices[0].message.content
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg
                is_tpd = "tokens per day" in error_msg.lower() or "TPD" in error_msg
                is_model_error = "400" in error_msg and ("does not exist" in error_msg or "not supported" in error_msg or "decommissioned" in error_msg or "The model" in error_msg)
                is_json_fail = "400" in error_msg and ("Failed to generate JSON" in error_msg or "failed to generate" in error_msg.lower())

                # Model doesn't exist → skip to next model
                if is_model_error and mi < len(models) - 1:
                    print(f"  ⚠️ Modelo {model} indisponível. Trocando...", file=sys.stderr)
                    break

                # JSON generation failure → try next model
                if is_json_fail:
                    if mi < len(models) - 1:
                        print(f"  ⚠️ Modelo {model} falhou ao gerar JSON. Tentando próximo...", file=sys.stderr)
                        break
                    if json_mode and attempt < max_retries - 1:
                        print(f"  ⚠️ Tentando {model} sem JSON mode...", file=sys.stderr)
                        try:
                            completion = client.chat.completions.create(
                                messages=msg_payload,
                                model=model,
                                temperature=temperature,
                                max_tokens=8192,
                            )
                            raw = completion.choices[0].message.content
                            import re as _re
                            json_match = _re.search(r'\{[\s\S]*\}', raw)
                            if json_match:
                                return json_match.group(0)
                            return raw
                        except Exception:
                            pass
                    raise

                # TPD (daily limit) — wait aggressively up to 90s before switching
                if is_rate_limit and is_tpd:
                    retry_secs = _parse_retry_wait(error_msg)
                    if attempt < max_retries - 1 and retry_secs <= 90:
                        wait = retry_secs if retry_secs > 0 else 30
                        print(f"  ⏳ TPD em {model}. Aguardando {wait}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                        time.sleep(wait)
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
                    time.sleep(wait)
                    continue
                elif is_rate_limit and mi < len(models) - 1:
                    print(f"  🔄 Rate limit persistente em {model}. Trocando modelo...", file=sys.stderr)
                    time.sleep(10)
                    break
                raise
    raise Exception("Todos os modelos Groq esgotaram o rate limit ou estão indisponíveis.")


def call_gemini(api_key: str, prompt: str, temperature: float = 0.3, json_mode: bool = True, messages: list = None, max_retries: int = 4):
    """Executes call via Google Gemini API with aggressive retry for 429 rate limits."""
    if not HAS_NEW_GENAI:
        raise RuntimeError("A biblioteca google-genai não está instalada.")
    
    import re as _re
    
    for model_idx, model_name in enumerate(GEMINI_MODELS):
        for attempt in range(max_retries + 1):
            try:
                return _call_gemini_once(api_key, prompt, temperature, json_mode, messages, model_name=model_name)
            except Exception as e:
                err_str = str(e)
                is_429 = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower()
                is_404 = "404" in err_str or "not found" in err_str.lower()
                
                if is_404:
                     print(f"  ⚠️ Modelo {model_name} não encontrado (404). Trocando modelo...", file=sys.stderr)
                     break # Try next model
                     
                if is_429 and _is_daily_quota(err_str):
                    # Daily quota exhausted → switch model immediately
                    print(f"  ⚠️ Cota diária do {model_name} esgotada. Trocando modelo...", file=sys.stderr)
                    break
                
                if is_429 and attempt < max_retries:
                    # Per-minute rate limit → AGGRESSIVE retry with backoff
                    delay_match = _re.search(r'retryDelay.*?(\d+)s', err_str)
                    wait_secs = int(delay_match.group(1)) + 3 if delay_match else 30
                    wait_secs = min(wait_secs, 90)  # Cap at 90s
                    print(f"  ⏳ Gemini rate limit ({model_name}). Aguardando {wait_secs}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait_secs)
                    continue
                
                if is_429 and model_idx < len(GEMINI_MODELS) - 1:
                    print(f"  🔄 Rate limit persistente em {model_name}. Trocando modelo...", file=sys.stderr)
                    break
                
                raise
    
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
        return response.text
    else:
        # Single prompt mode
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config
        )
        return response.text


def call_openrouter(api_key: str, prompt: str, temperature: float = 0.3, json_mode: bool = True, messages: list = None, max_retries: int = 4):
    """Execute call via OpenRouter API with aggressive retry."""
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    # Only models confirmed working on OpenRouter free tier (Feb 2026)
    models = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/mistral-small-3.1-24b-instruct:free",
        "openrouter/auto",  # Auto-routes to best available free model
    ]

    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    msg_payload = messages if messages else [{"role": "user", "content": prompt}]

    for mi, model in enumerate(models):
        for attempt in range(max_retries):
            try:
                completion = client.chat.completions.create(
                    messages=msg_payload,
                    model=model,
                    temperature=temperature,
                    max_tokens=8192,
                    **kwargs,
                )
                result = completion.choices[0].message.content
                if result:
                    return result
                # Empty response, try next model
                if mi < len(models) - 1:
                    break
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "rate" in error_msg.lower()
                is_spend_limit = "402" in error_msg or "spend limit" in error_msg.lower()
                is_model_error = "404" in error_msg or "not found" in error_msg.lower() or "not available" in error_msg.lower()

                if is_model_error and mi < len(models) - 1:
                    print(f"  ⚠️ OpenRouter modelo {model} indisponível. Trocando...", file=sys.stderr)
                    break

                # Spend limit exceeded on a specific provider - try next model
                if is_spend_limit and mi < len(models) - 1:
                    print(f"  🔄 OpenRouter spend limit em {model}. Trocando modelo...", file=sys.stderr)
                    break
                elif is_spend_limit:
                    raise

                if is_rate_limit and attempt < max_retries - 1:
                    wait = (attempt + 1) * 15  # 15s, 30s, 45s, 60s
                    wait = min(wait, 60)
                    print(f"  ⏳ OpenRouter rate limit em {model}. Aguardando {wait}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait)
                    continue
                elif is_rate_limit and mi < len(models) - 1:
                    print(f"  🔄 OpenRouter rate limit em {model}. Trocando modelo...", file=sys.stderr)
                    break
                raise
    raise Exception("Todos os modelos OpenRouter falharam.")

def call_llm(provider: str, prompt: str = None, temperature: float = 0.3, max_retries: int = 4, json_mode: bool = True, messages: list = None, prefer_small: bool = False):
    """Global router to send requests either to Groq, Gemini, or OpenRouter based on user preference."""
    actual_provider = provider.lower() if provider else "groq"
    
    if actual_provider == "gemini":
        api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("⚠️ Chave GOOGLE_AI_API_KEY ausente. Fazendo fallback de emergência para Groq.", file=sys.stderr)
            actual_provider = "groq"
        else:
            try:
                res = call_gemini(api_key, prompt, temperature, json_mode, messages)
                if json_mode and isinstance(res, str):
                    return json.loads(res)
                return res
            except Exception as e:
                print(f"⚠️ Erro ao chamar Gemini: {e}. Fazendo fallback de emergência para Groq.", file=sys.stderr)
                actual_provider = "groq"

    if actual_provider == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            print("⚠️ Chave OPENROUTER_API_KEY ausente. Fazendo fallback para Groq.", file=sys.stderr)
            actual_provider = "groq"
        else:
            try:
                res = call_openrouter(api_key, prompt, temperature, json_mode, messages)
                if json_mode and isinstance(res, str):
                    return json.loads(res)
                return res
            except Exception as e:
                print(f"⚠️ Erro ao chamar OpenRouter: {e}. Fazendo fallback para Groq.", file=sys.stderr)
                actual_provider = "groq"
            
    if actual_provider == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Nenhuma chave (Groq ou Gemini) configurada.")
        try:
            res = _call_groq_engine(api_key, prompt, temperature, max_retries, json_mode, messages, prefer_small)
            if json_mode and isinstance(res, str):
                return json.loads(res)
            return res
        except Exception as groq_err:
            # If all Groq models failed, try Gemini then OpenRouter as emergency fallback
            gemini_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
            if gemini_key:
                print(f"⚠️ Groq falhou ({str(groq_err)[:80]}). Fallback para Gemini.", file=sys.stderr)
                try:
                    res = call_gemini(gemini_key, prompt, temperature, json_mode, messages)
                    if json_mode and isinstance(res, str):
                        return json.loads(res)
                    return res
                except Exception as gemini_err:
                    print(f"⚠️ Gemini fallback também falhou: {str(gemini_err)[:80]}", file=sys.stderr)

            # Last resort: try OpenRouter
            openrouter_key = os.environ.get("OPENROUTER_API_KEY")
            if openrouter_key:
                print(f"⚠️ Tentando OpenRouter como último recurso...", file=sys.stderr)
                try:
                    res = call_openrouter(openrouter_key, prompt, temperature, json_mode, messages)
                    if json_mode and isinstance(res, str):
                        return json.loads(res)
                    return res
                except Exception as or_err:
                    print(f"⚠️ OpenRouter fallback também falhou: {str(or_err)[:80]}", file=sys.stderr)

            raise groq_err  # Re-raise original error if all providers failed
