import os
import time
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import redis
from dotenv import load_dotenv

# Load .env from backend directory
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
dotenv_path = os.path.join(backend_dir, '.env')
load_dotenv(dotenv_path=dotenv_path)

# Configuration
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Updated hard limits for Free Tiers (March 2026)
LIMITS = {
    "gemini": {
        "daily_requests": 250,      # Gemini 2.5 Flash limit
        "requests_per_minute": 10,  # Gemini 2.5 Flash limit
        "tokens_per_minute": 250000 
    },
    "gemini-2.5-flash": {
        "daily_requests": 250,
        "requests_per_minute": 10,
        "tokens_per_minute": 200000
    },
    "gemini-2.5-flash-lite": {
        "daily_requests": 1000,
        "requests_per_minute": 15,
        "tokens_per_minute": 300000
    },
    "gemini-2.0-flash": {
        "daily_requests": 200,
        "requests_per_minute": 15,
        "tokens_per_minute": 150000
    },
    "groq": {
        "daily_requests": 1000,      
        "requests_per_minute": 30,
        "tokens_per_minute": 30000,   # Back to 30k (safer for free tier)
        "daily_tokens": 500000        # 500k is a safer assumption than 2M
    },
    "openrouter": {
        "daily_requests": 50,       # Free tier limit
        "requests_per_minute": 20,
        "tokens_per_minute": 100000,
        "daily_tokens": 500000
    },
    "sambanova": {
        "daily_requests": 25,       # SambaNova free is very restrictive
        "requests_per_minute": 10,
        "tokens_per_minute": 250000,
        "daily_tokens": 500000
    },
    "deepseek": {
        "daily_requests": 500,      
        "requests_per_minute": 60,
        "tokens_per_minute": 100000,
        "daily_tokens": 2000000
    },
    "cerebras": {
        "daily_requests": 100,      
        "requests_per_minute": 20,
        "tokens_per_minute": 100000,
        "daily_tokens": 1000000     # Official 1M tokens/day limit
    }
}

class LLMUsageTracker:
    """Tracks LLM request and token usage using Redis."""
    
    def __init__(self):
        self._redis = None
        self._logger = logging.getLogger("usage_tracker")

    def _get_client(self):
        if self._redis is None:
            try:
                # Clean URL and handle parameters
                clean_url = REDIS_URL
                ssl_params = {}
                
                if REDIS_URL and "ssl_cert_reqs" in REDIS_URL.lower():
                    # Strip the param from URL if present for redis-py
                    if "?" in REDIS_URL:
                        clean_url = REDIS_URL.split("?")[0]
                    ssl_params["ssl_cert_reqs"] = None
                
                if clean_url.startswith("rediss://"):
                    self._redis = redis.from_url(clean_url, **ssl_params)
                else:
                    self._redis = redis.from_url(clean_url)
                
                # Test connection
                self._redis.ping()
            except Exception as e:
                self._logger.error(f"Failed to connect to Redis for usage tracking: {e}")
                self._redis = None
        return self._redis

    def can_make_request(self, provider: str, estimated_tokens: int = 2000) -> tuple[bool, str]:
        """
        Safety check BEFORE calling LLM. 
        Returns (True, "") if allowed, (False, "Reason") if blocked.
        """
        client = self._get_client()
        if not client:
            return True, "" # Allow if tracking is broken to avoid hard stop

        provider = provider.lower()
        if provider not in LIMITS:
            return True, ""

        limit = LIMITS[provider]
        now = datetime.now()
        day_key = f"llm_usage:daily:{now.strftime('%Y-%m-%d')}:{provider}"
        min_key = f"llm_usage:minute:{now.strftime('%Y-%m-%H-%M')}:{provider}"

        try:
            # Check Daily Requests
            daily_reqs = int(client.hget(day_key, "requests") or 0)
            if daily_reqs >= limit["daily_requests"]:
                return False, f"Cota diária esgotada ({daily_reqs}/{limit['daily_requests']} requests)"

            # Check Daily Tokens
            daily_tokens = int(client.hget(day_key, "tokens") or 0)
            if "daily_tokens" in limit and (daily_tokens + estimated_tokens) > limit["daily_tokens"]:
                return False, f"Limite de tokens diários ({limit['daily_tokens']}) ficaria saturado"

            # Check Per-Minute Requests
            min_reqs = int(client.hget(min_key, "requests") or 0)
            if min_reqs >= limit["requests_per_minute"]:
                return False, f"Limite de requisições por minuto atingido ({min_reqs} RPM)"

            # Check Per-Minute Tokens (Critical for Groq)
            min_tokens = int(client.hget(min_key, "tokens") or 0)
            if (min_tokens + estimated_tokens) > limit["tokens_per_minute"]:
                return False, f"Limite de tokens por minuto ({limit['tokens_per_minute']}) ficaria saturado"

            return True, ""
        except Exception as e:
            self._logger.debug(f"Rate check failed: {e}")
            return True, ""

    def mark_exhausted(self, provider: str):
        """Manually forces the daily counter to the limit to reflect exhaustion."""
        client = self._get_client()
        if not client:
            return

        provider = provider.lower()
        if provider not in LIMITS:
            return

        limit = LIMITS[provider]["daily_requests"]
        now = datetime.now()
        day_key = f"llm_usage:daily:{now.strftime('%Y-%m-%d')}:{provider}"
        
        try:
            client.hset(day_key, "requests", limit)
            client.expire(day_key, 86400 * 2)
        except Exception:
            self._redis = None # Force rejuvenation on next call if network died

    def track_request(self, provider: str, prompt: str, response_text: str = "", model: str = "", headers: Dict[str, str] = None, prompt_tokens: int = 0, completion_tokens: int = 0):
        """Records a request and estimates token usage, syncing with headers if provided."""
        client = self._get_client()
        if not client:
            return

        provider = provider.lower()
        now = datetime.now()
        day_key = f"llm_usage:daily:{now.strftime('%Y-%m-%d')}:{provider}"
        min_key = f"llm_usage:minute:{now.strftime('%Y-%m-%H-%M')}:{provider}"
        
        # 1. Token calculation logic
        if prompt_tokens > 0 or completion_tokens > 0:
            total_tokens = prompt_tokens + completion_tokens
        else:
            # Fallback to estimate if not provided
            tokens_in = len(prompt) // 4
            tokens_out = len(response_text) // 4
            total_tokens = tokens_in + tokens_out

        try:
            pipe = client.pipeline()
            pipe.hincrby(day_key, "requests", 1)
            pipe.hincrby(day_key, "tokens", total_tokens)
            pipe.expire(day_key, 86400 * 2)
            
            pipe.hincrby(min_key, "requests", 1)
            pipe.hincrby(min_key, "tokens", total_tokens)
            pipe.expire(min_key, 120)
            
            # 2. Advanced: Sync from Headers (Groq / OpenRouter / Gemini)
            if headers:
                # Groq/OpenAI: x-ratelimit-remaining-requests, x-ratelimit-limit-requests
                # Gemini: x-goog-ratelimit-remaining, etc.
                
                # Try to infer daily usage from remaining
                rem_req = headers.get('x-ratelimit-remaining-requests') or headers.get('x-goog-ratelimit-remaining')
                limit_req = headers.get('x-ratelimit-limit-requests') or headers.get('x-goog-ratelimit-limit')
                
                if rem_req and limit_req:
                    try:
                        used = int(limit_req) - int(rem_req)
                        # Update daily request count if the header represents daily limit
                        # (Careful: Groq headers might be RPM, check indicator)
                        if "month" in str(headers.keys()) or "day" in str(headers.keys()):
                             pipe.hset(day_key, "requests", used)
                    except (ValueError, TypeError):
                        pass

                # Tokens remaining (TPM sync)
                rem_tokens = headers.get('x-ratelimit-remaining-tokens')
                limit_tokens = headers.get('x-ratelimit-limit-tokens')
                if rem_tokens and limit_tokens:
                    try:
                        used_tokens = int(limit_tokens) - int(rem_tokens)
                        pipe.hset(min_key, "tokens", used_tokens)
                    except (ValueError, TypeError):
                        pass

            pipe.execute()
        except Exception as e:
            self._logger.debug(f"Usage tracking sync failed: {e}")
            
        return total_tokens

    def track_error(self, provider: str, headers: Dict[str, str] = None):
        """Updates limits based on error response headers (e.g. 429 Too Many Requests)."""
        if not headers:
            return
            
        client = self._get_client()
        if not client:
            return

        provider = provider.lower()
        now = datetime.now()
        day_key = f"llm_usage:daily:{now.strftime('%Y-%m-%d')}:{provider}"
        min_key = f"llm_usage:minute:{now.strftime('%Y-%m-%H-%M')}:{provider}"

        try:
            pipe = client.pipeline()
            
            # Sync from Headers
            rem_req = headers.get('x-ratelimit-remaining-requests') or headers.get('x-goog-ratelimit-remaining')
            limit_req = headers.get('x-ratelimit-limit-requests') or headers.get('x-goog-ratelimit-limit')
            
            if rem_req and limit_req:
                try:
                    used = int(limit_req) - int(rem_req)
                    if "month" in str(headers.keys()) or "day" in str(headers.keys()):
                        pipe.hset(day_key, "requests", used)
                except (ValueError, TypeError):
                    pass

            pipe.execute()
        except Exception as e:
            self._logger.debug(f"Error synchronization failed: {e}")

    def get_current_usage(self) -> Dict[str, Any]:
        """Returns current usage vs limits for all providers."""
        client = self._get_client()
        now = datetime.now()
        usage_data = {}

        for provider in LIMITS.keys():
            day_key = f"llm_usage:daily:{now.strftime('%Y-%m-%d')}:{provider}"
            min_key = f"llm_usage:minute:{now.strftime('%Y-%m-%H-%M')}:{provider}"
            
            try:
                # Fetch daily data
                daily = client.hgetall(day_key) if client else {}
                daily_requests = int(daily.get(b"requests", 0))
                daily_tokens = int(daily.get(b"tokens", 0))
                
                # Fetch current minute data
                minute = client.hgetall(min_key) if client else {}
                min_requests = int(minute.get(b"requests", 0))
                min_tokens = int(minute.get(b"tokens", 0))
                
                limit = LIMITS[provider]
                
                is_daily_blocked = (daily_requests >= limit["daily_requests"] or (limit.get("daily_tokens", 0) > 0 and daily_tokens >= limit["daily_tokens"]))
                is_minute_blocked = (min_requests >= limit["requests_per_minute"] or (limit.get("tokens_per_minute", 0) > 0 and min_tokens >= limit["tokens_per_minute"]))
                
                status = "ok"
                if is_daily_blocked or is_minute_blocked:
                    status = "blocked"
                elif (daily_requests / limit["daily_requests"]) > 0.8 or (limit.get("tokens_per_minute", 0) > 0 and min_tokens / limit["tokens_per_minute"] > 0.8):
                    status = "warning"

                usage_data[provider] = {
                    "daily": {
                        "requests": daily_requests,
                        "limit_requests": limit["daily_requests"],
                        "tokens": daily_tokens,
                        "limit_tokens": limit.get("daily_tokens", 0),
                        "percent_requests": round((daily_requests / limit["daily_requests"]) * 100, 1) if limit["daily_requests"] > 0 else 0
                    },
                    "minute": {
                        "requests": min_requests,
                        "limit_requests": limit["requests_per_minute"],
                        "tokens": min_tokens,
                        "limit_tokens": limit["tokens_per_minute"]
                    },
                    "status": status
                }
            except Exception:
                usage_data[provider] = {"error": "unavailable"}

        return usage_data

# Global instance
usage_tracker = LLMUsageTracker()
