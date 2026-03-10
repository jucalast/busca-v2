"""
LLM Cache — Hash-based response caching for LLM calls.

Caches prompt→response pairs in SQLite to avoid duplicate LLM calls.
Uses SHA-256 hash of (prompt + temperature + json_mode) as cache key.
"""

import hashlib
import json
import sqlite3
import time
import logging
from typing import Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)

# Cache database (same data directory as main DB)
_CACHE_DIR = Path(__file__).parent.parent.parent.parent / 'data'
_CACHE_DIR.mkdir(exist_ok=True)
_CACHE_DB = _CACHE_DIR / 'llm_cache.db'

# Default TTL: 6 hours
DEFAULT_TTL_SECONDS = 6 * 60 * 60


def _get_cache_conn():
    """Get cache database connection."""
    conn = sqlite3.connect(str(_CACHE_DB), timeout=10)
    # LLM Cache Table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS llm_cache (
            cache_key TEXT PRIMARY KEY,
            response TEXT NOT NULL,
            provider TEXT,
            prompt_preview TEXT,
            created_at REAL NOT NULL,
            ttl_seconds REAL NOT NULL,
            hit_count INTEGER DEFAULT 0
        )
    ''')
    # Web Scraping Cache Table (Otimização de Performance)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS web_cache (
            url_hash TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at REAL NOT NULL,
            ttl_seconds REAL NOT NULL
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_cache_created ON llm_cache(created_at)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_web_cache_created ON web_cache(created_at)')
    return conn

# --- WEB SCRAPING CACHE (24h default) ---
def get_web_cache(url: str, ttl_seconds: float = 24 * 60 * 60) -> Optional[str]:
    """Look up a cached web page content."""
    url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()
    try:
        conn = _get_cache_conn()
        cursor = conn.cursor()
        cursor.execute('SELECT content, created_at, ttl_seconds FROM web_cache WHERE url_hash = ?', (url_hash,))
        row = cursor.fetchone()
        if row:
            content, created_at, stored_ttl = row
            if time.time() - created_at < min(stored_ttl, ttl_seconds):
                conn.close()
                return content
            cursor.execute('DELETE FROM web_cache WHERE url_hash = ?', (url_hash,))
            conn.commit()
        conn.close()
    except Exception: pass
    return None

def set_web_cache(url: str, content: str, ttl_seconds: float = 24 * 60 * 60):
    """Store web page content in cache."""
    if not content or len(content) < 50: return
    url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()
    try:
        conn = _get_cache_conn()
        conn.execute(
            'INSERT OR REPLACE INTO web_cache (url_hash, url, content, created_at, ttl_seconds) VALUES (?, ?, ?, ?, ?)',
            (url_hash, url, content, time.time(), ttl_seconds)
        )
        conn.commit()
        conn.close()
    except Exception: pass


def _make_cache_key(prompt: str, temperature: float, json_mode: bool, provider: str = "") -> str:
    """Generate deterministic cache key from prompt parameters."""
    key_parts = f"{prompt}|t={temperature}|json={json_mode}|p={provider}"
    return hashlib.sha256(key_parts.encode('utf-8')).hexdigest()


def get_cached_response(
    prompt: str,
    temperature: float = 0.3,
    json_mode: bool = True,
    provider: str = "",
    ttl_seconds: float = DEFAULT_TTL_SECONDS,
) -> Optional[Any]:
    """
    Look up a cached LLM response.
    
    Returns the parsed response if found and not expired, None otherwise.
    """
    cache_key = _make_cache_key(prompt, temperature, json_mode, provider)
    
    try:
        conn = _get_cache_conn()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT response, created_at, ttl_seconds FROM llm_cache WHERE cache_key = ?',
            (cache_key,)
        )
        row = cursor.fetchone()
        
        if row is None:
            conn.close()
            return None
        
        response_str, created_at, stored_ttl = row
        age = time.time() - created_at
        
        # Use the shorter of stored or requested TTL
        effective_ttl = min(stored_ttl, ttl_seconds)
        
        if age > effective_ttl:
            # Expired — delete and return None
            cursor.execute('DELETE FROM llm_cache WHERE cache_key = ?', (cache_key,))
            conn.commit()
            conn.close()
            return None
        
        # Cache hit — increment counter
        cursor.execute(
            'UPDATE llm_cache SET hit_count = hit_count + 1 WHERE cache_key = ?',
            (cache_key,)
        )
        conn.commit()
        conn.close()
        
        # Parse response
        try:
            return json.loads(response_str)
        except (json.JSONDecodeError, TypeError):
            return response_str
            
    except Exception as e:
        logger.debug(f"Cache lookup error (non-critical): {e}")
        return None


def set_cached_response(
    prompt: str,
    response: Any,
    temperature: float = 0.3,
    json_mode: bool = True,
    provider: str = "",
    ttl_seconds: float = DEFAULT_TTL_SECONDS,
) -> None:
    """Store an LLM response in the cache."""
    cache_key = _make_cache_key(prompt, temperature, json_mode, provider)
    
    try:
        # Serialize response
        if isinstance(response, (dict, list)):
            response_str = json.dumps(response, ensure_ascii=False)
        else:
            response_str = str(response)
        
        conn = _get_cache_conn()
        conn.execute(
            '''INSERT OR REPLACE INTO llm_cache 
               (cache_key, response, provider, prompt_preview, created_at, ttl_seconds, hit_count)
               VALUES (?, ?, ?, ?, ?, ?, 0)''',
            (cache_key, response_str, provider, prompt[:100], time.time(), ttl_seconds)
        )
        conn.commit()
        conn.close()
        
    except Exception as e:
        logger.debug(f"Cache write error (non-critical): {e}")


def cleanup_expired_cache() -> int:
    """Remove all expired cache entries. Returns count of deleted entries."""
    try:
        conn = _get_cache_conn()
        cursor = conn.cursor()
        
        cursor.execute(
            'DELETE FROM llm_cache WHERE (? - created_at) > ttl_seconds',
            (time.time(),)
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        if deleted > 0:
            logger.info(f"🧹 Cleaned up {deleted} expired LLM cache entries")
        
        return deleted
        
    except Exception as e:
        logger.debug(f"Cache cleanup error: {e}")
        return 0


def get_cache_stats() -> dict:
    """Get cache statistics."""
    try:
        conn = _get_cache_conn()
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*), SUM(hit_count) FROM llm_cache')
        row = cursor.fetchone()
        total_entries = row[0] or 0
        total_hits = row[1] or 0
        
        cursor.execute(
            'SELECT COUNT(*) FROM llm_cache WHERE (? - created_at) <= ttl_seconds',
            (time.time(),)
        )
        active_entries = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            "total_entries": total_entries,
            "active_entries": active_entries,
            "expired_entries": total_entries - active_entries,
            "total_hits": total_hits,
        }
        
    except Exception:
        return {"error": "cache unavailable"}
