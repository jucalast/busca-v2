"""
Database functions for Unified Research Service
"""

import json
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.core.database import get_connection


def save_research_cache(cache_key: str, cache_entry: Dict[str, Any]) -> bool:
    """Salva entrada de cache no banco."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Serializar dados
        data_json = json.dumps(cache_entry, default=str)
        cached_at_iso = cache_entry["cached_at"].isoformat()
        research_type = cache_entry.get("research_type", "unknown")
        
        # Insert ou replace
        cursor.execute("""
            INSERT OR REPLACE INTO research_cache 
            (cache_key, data, cached_at, research_type) 
            VALUES (?, ?, ?, ?)
        """, (cache_key, data_json, cached_at_iso, research_type))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"Error saving research cache: {e}")
        return False


def get_research_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    """Obtém entrada de cache do banco."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT data, cached_at, research_type 
            FROM research_cache 
            WHERE cache_key = ?
        """, (cache_key,))
        
        row = cursor.fetchone()
        if not row:
            return None
        
        data_json, cached_at_str, research_type = row
        
        # Deserializar dados
        data = json.loads(data_json)
        
        # Converter string para datetime
        cached_at = datetime.fromisoformat(cached_at_str)
        
        return {
            "data": data,
            "cached_at": cached_at,
            "research_type": research_type
        }
        
    except Exception as e:
        print(f"Error getting research cache: {e}")
        return None


def save_research_result(research_type: str, cache_key: str, data: Dict[str, Any]) -> bool:
    """Salva resultado de pesquisa no banco."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Serializar dados
        data_json = json.dumps(data, default=str)
        created_at = datetime.now().isoformat()
        
        # Insert ou replace
        cursor.execute("""
            INSERT OR REPLACE INTO research_results 
            (research_type, cache_key, data, created_at) 
            VALUES (?, ?, ?, ?)
        """, (research_type, cache_key, data_json, created_at))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"Error saving research result: {e}")
        return False


def get_research_result(research_type: str, cache_key: str) -> Optional[Dict[str, Any]]:
    """Obtém resultado de pesquisa do banco."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT data, created_at 
            FROM research_results 
            WHERE research_type = ? AND cache_key = ?
        """, (research_type, cache_key))
        
        row = cursor.fetchone()
        if not row:
            return None
        
        data_json, created_at_str = row
        
        # Deserializar dados
        data = json.loads(data_json)
        data["created_at"] = created_at_str
        
        return data
        
    except Exception as e:
        print(f"Error getting research result: {e}")
        return None


def get_research_stats() -> Dict[str, Any]:
    """Retorna estatísticas de pesquisas."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Total de pesquisas por tipo
        cursor.execute("""
            SELECT research_type, COUNT(*) as count 
            FROM research_results 
            GROUP BY research_type
        """)
        
        by_type = dict(cursor.fetchall())
        
        # Total de cache entries
        cursor.execute("SELECT COUNT(*) FROM research_cache")
        total_cache = cursor.fetchone()[0]
        
        # Total de pesquisas
        cursor.execute("SELECT COUNT(*) FROM research_results")
        total_researches = cursor.fetchone()[0]
        
        return {
            "by_type": by_type,
            "total_cache": total_cache,
            "total_researches": total_researches
        }
        
    except Exception as e:
        print(f"Error getting research stats: {e}")
        return {
            "by_type": {},
            "total_cache": 0,
            "total_researches": 0
        }


def cleanup_expired_cache() -> int:
    """Limpa entradas de cache expiradas."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Deletar entradas mais antigas que 24 horas
        cursor.execute("""
            DELETE FROM research_cache 
            WHERE datetime(cached_at) < datetime('now', '-24 hours')
        """)
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        return deleted_count
        
    except Exception as e:
        print(f"Error cleaning up expired cache: {e}")
        return 0


def create_research_tables() -> bool:
    """Cria tabelas necessárias para o research module."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Tabela de cache
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS research_cache (
                cache_key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                cached_at TEXT NOT NULL,
                research_type TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Tabela de resultados
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS research_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                research_type TEXT NOT NULL,
                cache_key TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(research_type, cache_key)
            )
        """)
        
        # Índices
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_research_cache_type 
            ON research_cache(research_type)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_research_results_type 
            ON research_results(research_type)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_research_cache_created 
            ON research_cache(cached_at)
        """)
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"Error creating research tables: {e}")
        return False
