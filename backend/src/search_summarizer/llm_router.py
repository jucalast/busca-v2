import json
import os
import sys
import time
from groq import Groq
try:
    import google.generativeai as genai
except ImportError:
    genai = None

from dotenv import load_dotenv

load_dotenv()

def _parse_retry_wait(error_msg: str) -> int:
    import re
    match = re.search(r"try again in (\d+)m([\d.]+)s", error_msg)
    if match: return int(match.group(1)) * 60 + int(float(match.group(2)))
    match = re.search(r"try again in ([\d.]+)s", error_msg)
    if match: return int(float(match.group(1)))
    return 0

def call_groq(api_key: str, prompt: str, temperature: float = 0.3, max_retries: int = 2, json_mode: bool = True, messages: list = None, prefer_small: bool = False):
    """Fallback Groq execution engine used originally by the platform."""
    client = Groq(api_key=api_key)
    
    if prefer_small:
        models = [
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
            "llama-3.2-3b-preview",
        ]
    else:
        models = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
            "llama-3.2-3b-preview",
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
                    **kwargs,
                )
                return completion.choices[0].message.content
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg
                is_tpd = "tokens per day" in error_msg.lower() or "TPD" in error_msg
                is_model_error = "400" in error_msg and ("does not exist" in error_msg or "not supported" in error_msg or "decommissioned" in error_msg or "The model" in error_msg)

                if is_model_error and mi < len(models) - 1:
                    print(f"  ⚠️ Modelo {model} indisponível. Trocando...", file=sys.stderr)
                    break

                if is_rate_limit and is_tpd:
                    retry_secs = _parse_retry_wait(error_msg)
                    if attempt < max_retries - 1 and retry_secs <= 30:
                        print(f"  ⏳ Rate limit (TPD) em {model}. Aguardando {retry_secs}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                        time.sleep(retry_secs or 5)
                        continue
                    elif mi < len(models) - 1:
                        print(f"  🔄 TPD esgotado em {model}. Trocando modelo...", file=sys.stderr)
                        break
                    raise
                elif is_rate_limit and attempt < max_retries - 1:
                    retry_secs = _parse_retry_wait(error_msg)
                    wait = retry_secs if retry_secs > 0 else (attempt + 1) * 20
                    print(f"  ⏳ Rate limit (TPM) em {model}. Aguardando {wait}s... ({attempt+1}/{max_retries})", file=sys.stderr)
                    time.sleep(wait)
                    continue
                elif is_rate_limit and mi < len(models) - 1:
                    print(f"  🔄 Rate limit (TPM) esgotado em {model}. Trocando modelo...", file=sys.stderr)
                    time.sleep(5)
                    break
                raise
    raise Exception("Todos os modelos esgotaram o rate limit diário.")


def call_gemini(api_key: str, prompt: str, temperature: float = 0.3, json_mode: bool = True, messages: list = None):
    """Executes call via Google Gemini API."""
    if not genai:
        raise RuntimeError("A biblioteca google-generativeai não está instalada.")
        
    genai.configure(api_key=api_key)
    
    # Defaults to flash as it is the most stable universally
    model_name = "gemini-1.5-flash"
    generation_config = {
        "temperature": temperature,
    }
    
    if json_mode:
        generation_config["response_mime_type"] = "application/json"
        
    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config=generation_config,
    )

    if messages:
        # Chat mode - convert OpenAI style messages to Gemini style
        history = []
        last_user_msg = ""
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            if m == messages[-1] and m["role"] == "user":
                last_user_msg = m["content"]
            else:
                history.append({"role": role, "parts": [m["content"]]})
                
        chat = model.start_chat(history=history)
        response = chat.send_message(last_user_msg)
        return response.text
    else:
        # Single prompt mode
        response = model.generate_content(prompt)
        return response.text

def call_llm(provider: str, prompt: str = None, temperature: float = 0.3, max_retries: int = 2, json_mode: bool = True, messages: list = None, prefer_small: bool = False):
    """Global router to send requests either to Groq or Gemini based on user preference."""
    actual_provider = provider.lower() if provider else "groq"
    
    if actual_provider == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("⚠️ Chave GEMINI_API_KEY ausente. Fazendo fallback de emergência para Groq.", file=sys.stderr)
            actual_provider = "groq"
        else:
            try:
                res = call_gemini(api_key, prompt, temperature, json_mode, messages)
                if json_mode and not messages:
                    return json.loads(res)
                return res
            except Exception as e:
                print(f"⚠️ Erro ao chamar Gemini: {e}. Fazendo fallback de emergência para Groq.", file=sys.stderr)
                actual_provider = "groq"
            
    if actual_provider == "groq":
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Nenhuma chave (Groq ou Gemini) configurada.")
        res = call_groq(api_key, prompt, temperature, max_retries, json_mode, messages, prefer_small)
        if json_mode and not messages:
            return json.loads(res)
        return res
