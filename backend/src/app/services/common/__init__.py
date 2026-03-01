"""
Common Services - Módulo centralizado para funcionalidades compartilhadas
Reduz redundâncias e padroniza o código backend
"""

# ═══════════════════════════════════════════════════════════════════
# IMPORTS CENTRALIZADOS
# ═══════════════════════════════════════════════════════════════════

# Python standard
import json
import sys
import time
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Union

# Database
from app.core import database as db
from app.core.database import get_connection

# LLM
from app.core.llm_router import call_llm

# Web utils
from app.core.web_utils import search_duckduckgo, scrape_page

# ═══════════════════════════════════════════════════════════════════
# LOGGING CENTRALIZADO
# ═══════════════════════════════════════════════════════════════════

def log_info(message: str, prefix: str = "ℹ️"):
    """Log informativo padronizado."""
    print(f"{prefix} {message}", file=sys.stderr)

def log_error(message: str, prefix: str = "❌"):
    """Log de erro padronizado."""
    print(f"{prefix} {message}", file=sys.stderr)

def log_warning(message: str, prefix: str = "⚠️"):
    """Log de aviso padronizado."""
    print(f"{prefix} {message}", file=sys.stderr)

def log_success(message: str, prefix: str = "✅"):
    """Log de sucesso padronizado."""
    print(f"{prefix} {message}", file=sys.stderr)

def log_debug(message: str, prefix: str = "🐛"):
    """Log de debug padronizado."""
    print(f"{prefix} {message}", file=sys.stderr)

def log_research(message: str, prefix: str = "🔍"):
    """Log de pesquisa padronizado."""
    print(f"{prefix} {message}", file=sys.stdout)  # Mudado para stdout

def log_cache(message: str, prefix: str = "📦"):
    """Log de cache padronizado."""
    print(f"{prefix} {message}", file=sys.stderr)

def log_llm(message: str, prefix: str = "🤖"):
    """Log de LLM padronizado."""
    print(f"{prefix} {message}", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════
# SERIALIZATION CENTRALIZADA
# ═══════════════════════════════════════════════════════════════════

def safe_json_dumps(data: Any, ensure_ascii: bool = False, default=None) -> str:
    """JSON dumps seguro com opções padrão."""
    return json.dumps(data, ensure_ascii=ensure_ascii, default=default or str)

def safe_json_loads(data: str) -> Any:
    """JSON loads seguro."""
    return json.loads(data)

def safe_serialize_for_db(data: Any) -> str:
    """Serialização específica para banco de dados."""
    return json.dumps(data, ensure_ascii=False, default=str)

def safe_deserialize_from_db(data: str) -> Any:
    """Desserialização segura do banco de dados."""
    return json.loads(data)

# ═══════════════════════════════════════════════════════════════════
# CONFIGURAÇÕES CENTRALIZADAS
# ═══════════════════════════════════════════════════════════════════

class CommonConfig:
    """Configurações compartilhadas do sistema."""
    
    # Timeouts
    DEFAULT_TIMEOUT = 4
    LLM_TIMEOUT = 30
    RESEARCH_TIMEOUT = 10
    
    # Rate limits
    RATE_LIMIT_DELAY = 1.0
    MAX_RETRIES = 3
    
    # Cache
    CACHE_TTL_MARKET = 6 * 60 * 60  # 6 horas
    CACHE_TTL_TASK = 2 * 60 * 60    # 2 horas
    CACHE_TTL_SUBTASK = 30 * 60     # 30 minutos
    CACHE_TTL_DISCOVERY = 4 * 60 * 60  # 4 horas
    
    # JSON
    JSON_ENSURE_ASCII = False
    JSON_DEFAULT = str
    
    # Logging
    LOG_PREFIXES = {
        'info': 'ℹ️',
        'error': '❌',
        'warning': '⚠️',
        'success': '✅',
        'debug': '🐛',
        'research': '🔍',
        'cache': '📦',
        'llm': '🤖'
    }

# ═══════════════════════════════════════════════════════════════════
# UTILITÁRIOS COMUNS
# ═══════════════════════════════════════════════════════════════════

def get_timestamp() -> str:
    """Timestamp atual padronizado."""
    return datetime.now().isoformat()

def format_duration(seconds: float) -> str:
    """Formata duração em texto legível."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        return f"{seconds/60:.1f}m"
    else:
        return f"{seconds/3600:.1f}h"

def safe_get(data: Dict, key: str, default: Any = None) -> Any:
    """Get seguro de dicionário com default."""
    return data.get(key, default)

def safe_list_get(data: List, index: int, default: Any = None) -> Any:
    """Get seguro de lista com default."""
    return data[index] if 0 <= index < len(data) else default

def retry_with_delay(func, max_retries: int = None, delay: float = None):
    """Decorador para retry com delay."""
    max_retries = max_retries or CommonConfig.MAX_RETRIES
    delay = delay or CommonConfig.RATE_LIMIT_DELAY
    
    def wrapper(*args, **kwargs):
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                log_warning(f"Retry {attempt + 1}/{max_retries}: {e}")
                time.sleep(delay)
    
    return wrapper

# ═══════════════════════════════════════════════════════════════════
# VALIDAÇÕES COMUNS
# ═══════════════════════════════════════════════════════════════════

def validate_business_id(business_id: str) -> bool:
    """Valida formato de business_id."""
    return isinstance(business_id, str) and len(business_id) > 0

def validate_analysis_id(analysis_id: str) -> bool:
    """Valida formato de analysis_id."""
    return isinstance(analysis_id, str) and len(analysis_id) > 0

def validate_pillar_key(pillar_key: str) -> bool:
    """Valida pillar_key conhecido."""
    valid_pillars = {
        'publico_alvo', 'branding', 'identidade_visual',
        'canais_venda', 'trafego_organico', 'trafego_pago', 'processo_vendas'
    }
    return pillar_key in valid_pillars

def validate_score(score: Any) -> bool:
    """Valida score (0-100)."""
    try:
        s = float(score)
        return 0 <= s <= 100
    except (ValueError, TypeError):
        return False

# ═══════════════════════════════════════════════════════════════════
# EXPORTS
# ═══════════════════════════════════════════════════════════════════

__all__ = [
    # Imports
    'json', 'sys', 'time', 'os', 'datetime', 'timedelta',
    'Dict', 'List', 'Any', 'Optional', 'Tuple', 'Union',
    'db', 'get_connection', 'call_llm', 'search_duckduckgo', 'scrape_page',
    
    # Logging
    'log_info', 'log_error', 'log_warning', 'log_success', 
    'log_debug', 'log_research', 'log_cache', 'log_llm',
    
    # Serialization
    'safe_json_dumps', 'safe_json_loads', 
    'safe_serialize_for_db', 'safe_deserialize_from_db',
    
    # Config
    'CommonConfig',
    
    # Utils
    'get_timestamp', 'format_duration', 'safe_get', 'safe_list_get', 'retry_with_delay',
    
    # Validation
    'validate_business_id', 'validate_analysis_id', 
    'validate_pillar_key', 'validate_score'
]
