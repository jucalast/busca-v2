"""
Database Layer — SQLite persistence for multi-business support.
Stores users, businesses, analyses, and dimension chats.
"""

import sqlite3
import json
import os
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

# Database location (moved to app/core, so we need one more .parent)
DB_DIR = Path(__file__).parent.parent.parent.parent.parent / 'data'
DB_DIR.mkdir(exist_ok=True)
DB_PATH = DB_DIR / 'growth_platform.db'


def get_connection():
    """Get database connection with JSON support."""
    # Add timeout to avoid locks during concurrent access
    conn = sqlite3.connect(str(DB_PATH), timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database schema."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Users table - now with authentication
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            created_at TEXT NOT NULL,
            last_login TEXT,
            metadata TEXT
        )
    ''')
    
    # Sessions table - for authentication
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            last_used TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Businesses table - each user can have multiple businesses
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS businesses (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            segment TEXT,
            model TEXT,
            location TEXT,
            profile_data TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Analyses table - stores complete analysis results
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL,
            score_data TEXT NOT NULL,
            task_data TEXT NOT NULL,
            market_data TEXT NOT NULL,
            profile_data TEXT,
            score_geral INTEGER,
            classificacao TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (business_id) REFERENCES businesses (id)
        )
    ''')
    
    # Dimension chats - conversational history per dimension
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS dimension_chats (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            dimension TEXT NOT NULL,
            messages TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (analysis_id) REFERENCES analyses (id)
        )
    ''')
    
    # Create indexes for common queries
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses (user_id, status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analyses_business ON analyses (business_id, created_at DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dimension_chats_analysis ON dimension_chats (analysis_id, dimension)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at)')
    
    # Pillar data - structured output from pillar agents
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pillar_data (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            structured_output TEXT NOT NULL,
            sources TEXT,
            user_command TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(business_id, pillar_key)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_pillar_data_business ON pillar_data (business_id, pillar_key)')
    
    # Business briefs - compact business brief per analysis
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS business_briefs (
            id TEXT PRIMARY KEY,
            business_id TEXT NOT NULL,
            analysis_id TEXT NOT NULL,
            brief_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(business_id, analysis_id)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_briefs_business ON business_briefs (business_id, analysis_id)')
    
    # Pillar diagnostics - per-pillar diagnostic data from scorer
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pillar_diagnostics (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            diagnostic_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(analysis_id, pillar_key)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_diagnostics_analysis ON pillar_diagnostics (analysis_id, pillar_key)')
    
    # Specialist plans - pillar execution plans
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS specialist_plans (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            plan_data TEXT NOT NULL,
            status TEXT DEFAULT 'draft',
            user_notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(analysis_id, pillar_key)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_specialist_plans ON specialist_plans (analysis_id, pillar_key)')
    
    # Specialist executions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS specialist_executions (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            task_id TEXT NOT NULL,
            result_data TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL
        )
    ''')
    
    # Specialist results
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS specialist_results (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            task_id TEXT NOT NULL,
            action_title TEXT,
            status TEXT DEFAULT 'pending',
            outcome TEXT,
            business_impact TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Pillar KPIs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pillar_kpis (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            kpi_name TEXT NOT NULL,
            kpi_value TEXT,
            kpi_target TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(analysis_id, pillar_key, kpi_name)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_pillar_kpis ON pillar_kpis (analysis_id, pillar_key)')
    
    # Specialist subtasks — expanded micro-steps per task
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS specialist_subtasks (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            task_id TEXT NOT NULL,
            subtasks_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(analysis_id, pillar_key, task_id)
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_specialist_subtasks ON specialist_subtasks (analysis_id, pillar_key)')

    # Background tasks status — for long running operations monitoring
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS background_tasks (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            pillar_key TEXT NOT NULL,
            task_id TEXT NOT NULL,
            status TEXT DEFAULT 'running',
            current_step INTEGER DEFAULT 0,
            total_steps INTEGER DEFAULT 0,
            result_data TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(analysis_id, task_id)
        )
    ''')
    
    # Migration: add status column to specialist_results if missing
    try:
        cursor.execute("ALTER TABLE specialist_results ADD COLUMN status TEXT DEFAULT 'pending'")
    except Exception:
        pass  # Column already exists
    
    # Migration: add unique index to specialist_executions for upsert support
    try:
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_specialist_executions_unique ON specialist_executions (analysis_id, pillar_key, task_id)')
    except Exception:
        pass
    
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════════
# Authentication & Security
# ═══════════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    """Hash a password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash."""
    return hash_password(password) == password_hash


def generate_session_token() -> str:
    """Generate a secure random session token."""
    return secrets.token_urlsafe(32)


def create_session(user_id: str, duration_days: int = 30) -> Dict:
    """Create a new session for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    
    token = generate_session_token()
    now = datetime.utcnow()
    expires = now + timedelta(days=duration_days)
    
    cursor.execute('''
        INSERT INTO sessions (token, user_id, created_at, expires_at, last_used)
        VALUES (?, ?, ?, ?, ?)
    ''', (token, user_id, now.isoformat(), expires.isoformat(), now.isoformat()))
    
    conn.commit()
    conn.close()
    
    return {
        "token": token,
        "user_id": user_id,
        "expires_at": expires.isoformat()
    }


def validate_session(token: str) -> Optional[Dict]:
    """Validate a session token and return user data if valid."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT s.token, s.user_id, s.expires_at, u.email, u.name
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
    ''', (token,))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    # Check if expired
    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.utcnow() > expires_at:
        # Delete expired session
        cursor.execute('DELETE FROM sessions WHERE token = ?', (token,))
        conn.commit()
        conn.close()
        return None
    
    # Update last_used
    cursor.execute('''
        UPDATE sessions SET last_used = ? WHERE token = ?
    ''', (datetime.utcnow().isoformat(), token))
    
    conn.commit()
    conn.close()
    
    return {
        "token": row["token"],
        "user_id": row["user_id"],
        "email": row["email"],
        "name": row["name"],
        "expires_at": row["expires_at"]
    }


def delete_session(token: str) -> bool:
    """Delete a session (logout)."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM sessions WHERE token = ?', (token,))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def cleanup_expired_sessions():
    """Remove all expired sessions."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute('DELETE FROM sessions WHERE expires_at < ?', (now,))
    
    conn.commit()
    deleted = cursor.rowcount
    conn.close()
    
    return deleted


# ═══════════════════════════════════════════════════════════════════
# User Operations
# ═══════════════════════════════════════════════════════════════════

def register_user(email: str, password: str, name: Optional[str] = None) -> Dict:
    """Register a new user with email and password."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if email already exists
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        conn.close()
        raise ValueError("Email já cadastrado")
    
    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        INSERT INTO users (id, email, password_hash, name, created_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, email, password_hash, name, now, json.dumps({})))
    
    conn.commit()
    conn.close()
    
    return {
        "id": user_id,
        "email": email,
        "name": name,
        "created_at": now
    }


def login_user(email: str, password: str) -> Optional[Dict]:
    """Login user and return session token."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, email, password_hash, name 
        FROM users 
        WHERE email = ?
    ''', (email,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    if not verify_password(password, row["password_hash"]):
        return None
    
    # Update last login
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users SET last_login = ? WHERE id = ?
    ''', (datetime.utcnow().isoformat(), row["id"]))
    conn.commit()
    conn.close()
    
    # Create session
    session = create_session(row["id"])
    
    return {
        "user": {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"]
        },
        "session": session
    }


def create_user(user_id: str, email: Optional[str] = None, name: Optional[str] = None, metadata: Optional[Dict] = None) -> Dict:
    """Create a new user (legacy function for backward compatibility)."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    # For legacy users without password, generate a random one
    password_hash = hash_password(secrets.token_urlsafe(16))
    
    cursor.execute('''
        INSERT INTO users (id, email, password_hash, name, created_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_id, email or f'{user_id}@temp.local', password_hash, name, now, json.dumps(metadata or {})))
    
    conn.commit()
    conn.close()
    
    return {
        "id": user_id,
        "email": email,
        "name": name,
        "created_at": now,
        "metadata": metadata or {}
    }


def get_user(user_id: str) -> Optional[Dict]:
    """Get user by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, email, name, created_at, last_login, metadata FROM users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "created_at": row["created_at"],
        "last_login": row["last_login"],
        "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
    }


def get_user_by_email(email: str) -> Optional[Dict]:
    """Get user by email."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, email, name, created_at, last_login FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "created_at": row["created_at"],
        "last_login": row["last_login"]
    }


def get_or_create_user(user_id: str, email: Optional[str] = None, name: Optional[str] = None) -> Dict:
    """Get existing user or create new one (legacy support)."""
    user = get_user(user_id)
    if user:
        return user
    return create_user(user_id, email, name)


# ═══════════════════════════════════════════════════════════════════
# Business Operations
# ═══════════════════════════════════════════════════════════════════

def create_business(user_id: str, name: str, profile_data: Dict) -> Dict:
    """Create a new business for a user."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    business_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Extract key fields from profile
    perfil = profile_data.get("perfil", {})
    segment = perfil.get("segmento", "")
    model = perfil.get("modelo_negocio", perfil.get("modelo", ""))
    location = perfil.get("localizacao", "")
    
    cursor.execute('''
        INSERT INTO businesses (id, user_id, name, segment, model, location, profile_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (business_id, user_id, name, segment, model, location, json.dumps(profile_data, ensure_ascii=False), now, now))
    
    conn.commit()
    conn.close()
    
    return {
        "id": business_id,
        "user_id": user_id,
        "name": name,
        "segment": segment,
        "model": model,
        "location": location,
        "profile_data": profile_data,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }


def get_business(business_id: str) -> Optional[Dict]:
    """Get business by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM businesses WHERE id = ?', (business_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "segment": row["segment"],
        "model": row["model"],
        "location": row["location"],
        "profile_data": json.loads(row["profile_data"]),
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


def list_user_businesses(user_id: str, status: str = "active") -> List[Dict]:
    """List all businesses for a user."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM businesses 
        WHERE user_id = ? AND status = ?
        ORDER BY updated_at DESC
    ''', (user_id, status))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "segment": row["segment"],
        "model": row["model"],
        "location": row["location"],
        "profile_data": json.loads(row["profile_data"]),
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    } for row in rows]


def update_business(business_id: str, profile_data: Dict) -> bool:
    """Update business profile data."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Extract updated key fields
    perfil = profile_data.get("perfil", {})
    segment = perfil.get("segmento", "")
    model = perfil.get("modelo_negocio", perfil.get("modelo", ""))
    location = perfil.get("localizacao", "")
    name = perfil.get("nome", perfil.get("nome_negocio", ""))
    
    cursor.execute('''
        UPDATE businesses 
        SET name = ?, segment = ?, model = ?, location = ?, profile_data = ?, updated_at = ?
        WHERE id = ?
    ''', (name, segment, model, location, json.dumps(profile_data, ensure_ascii=False), now, business_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def delete_business(business_id: str) -> bool:
    """Soft delete a business (set status to 'deleted')."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        UPDATE businesses 
        SET status = 'deleted', updated_at = ?
        WHERE id = ?
    ''', (now, business_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def hard_delete_business(business_id: str) -> bool:
    """Permanently delete a business and all its analyses."""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Delete dimension chats first (foreign key constraint)
        cursor.execute('''
            DELETE FROM dimension_chats 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = ?
            )
        ''', (business_id,))
        
        # Delete analyses
        cursor.execute('DELETE FROM analyses WHERE business_id = ?', (business_id,))
        
        # Delete business
        cursor.execute('DELETE FROM businesses WHERE id = ?', (business_id,))
        
        conn.commit()
        success = cursor.rowcount > 0
        conn.close()
        
        return success
    except Exception as e:
        conn.rollback()
        conn.close()
        raise


# ═══════════════════════════════════════════════════════════════════
# Analysis Operations
# ═══════════════════════════════════════════════════════════════════

_analysis_profile_column_checked = False


def ensure_analysis_profile_column(cursor):
    global _analysis_profile_column_checked
    if _analysis_profile_column_checked:
        return

    cursor.execute("PRAGMA table_info(analyses)")
    columns = {row[1] for row in cursor.fetchall()}
    if 'profile_data' not in columns:
        cursor.execute("ALTER TABLE analyses ADD COLUMN profile_data TEXT")
    _analysis_profile_column_checked = True


def create_analysis(business_id: str, score_data: Dict, task_data: Dict, market_data: Dict, profile_data: Optional[Dict] = None) -> Dict:
    """Create a new analysis result."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    score_geral = score_data.get("score_geral", 0)
    classificacao = score_data.get("classificacao", "")
    
    ensure_analysis_profile_column(cursor)

    cursor.execute('''
        INSERT INTO analyses (id, business_id, score_data, task_data, market_data, profile_data, score_geral, classificacao, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        analysis_id, 
        business_id, 
        json.dumps(score_data, ensure_ascii=False),
        json.dumps(task_data, ensure_ascii=False),
        json.dumps(market_data, ensure_ascii=False),
        json.dumps(profile_data, ensure_ascii=False) if profile_data else None,
        score_geral,
        classificacao,
        now
    ))
    
    conn.commit()
    conn.close()
    
    return {
        "id": analysis_id,
        "business_id": business_id,
        "score_data": score_data,
        "task_data": task_data,
        "market_data": market_data,
        "score_geral": score_geral,
        "classificacao": classificacao,
        "created_at": now
    }


def get_latest_analysis(business_id: str) -> Optional[Dict]:
    """Get the most recent analysis for a business."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM analyses 
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    ''', (business_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "business_id": row["business_id"],
        "score_data": json.loads(row["score_data"]),
        "task_data": json.loads(row["task_data"]),
        "market_data": json.loads(row["market_data"]),
        "score_geral": row["score_geral"],
        "classificacao": row["classificacao"],
        "created_at": row["created_at"]
    }


def list_business_analyses(business_id: str, limit: int = 10) -> List[Dict]:
    """List recent analyses for a business."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM analyses 
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    ''', (business_id, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{
        "id": row["id"],
        "business_id": row["business_id"],
        "score_data": json.loads(row["score_data"]),
        "task_data": json.loads(row["task_data"]),
        "market_data": json.loads(row["market_data"]),
        "score_geral": row["score_geral"],
        "classificacao": row["classificacao"],
        "created_at": row["created_at"]
    } for row in rows]


def get_analysis(analysis_id: str) -> Optional[Dict]:
    """Get a specific analysis by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM analyses WHERE id = ?', (analysis_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "business_id": row["business_id"],
        "score_data": json.loads(row["score_data"]),
        "task_data": json.loads(row["task_data"]),
        "market_data": json.loads(row["market_data"]),
        "profile_data": json.loads(row["profile_data"]) if row["profile_data"] else None,
        "score_geral": row["score_geral"],
        "classificacao": row["classificacao"],
        "created_at": row["created_at"]
    }


# ═══════════════════════════════════════════════════════════════════
# Dimension Chat Operations
# ═══════════════════════════════════════════════════════════════════

def save_dimension_chat(analysis_id: str, dimension: str, messages: List[Dict]) -> Dict:
    """Save or update dimension chat history."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if chat exists
    cursor.execute('''
        SELECT id FROM dimension_chats 
        WHERE analysis_id = ? AND dimension = ?
    ''', (analysis_id, dimension))
    
    row = cursor.fetchone()
    
    if row:
        # Update existing
        chat_id = row["id"]
        cursor.execute('''
            UPDATE dimension_chats 
            SET messages = ?, updated_at = ?
            WHERE id = ?
        ''', (json.dumps(messages, ensure_ascii=False), now, chat_id))
    else:
        # Create new
        chat_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO dimension_chats (id, analysis_id, dimension, messages, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (chat_id, analysis_id, dimension, json.dumps(messages, ensure_ascii=False), now, now))
    
    conn.commit()
    conn.close()
    
    return {
        "id": chat_id,
        "analysis_id": analysis_id,
        "dimension": dimension,
        "messages": messages,
        "updated_at": now
    }


def get_dimension_chat(analysis_id: str, dimension: str) -> Optional[Dict]:
    """Get dimension chat history."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM dimension_chats 
        WHERE analysis_id = ? AND dimension = ?
    ''', (analysis_id, dimension))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "analysis_id": row["analysis_id"],
        "dimension": row["dimension"],
        "messages": json.loads(row["messages"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


# ═══════════════════════════════════════════════════════════════════
# Pillar Data Operations (structured output from pillar agents)
# ═══════════════════════════════════════════════════════════════════

def save_pillar_data(business_id: str, pillar_key: str, structured_output: dict, sources: list = None, user_command: str = "") -> bool:
    """Save or update structured output for a pillar."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    output_json = json.dumps(structured_output, ensure_ascii=False)
    sources_json = json.dumps(sources or [], ensure_ascii=False)
    
    cursor.execute('''
        INSERT INTO pillar_data (id, business_id, pillar_key, structured_output, sources, user_command, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(business_id, pillar_key) DO UPDATE SET
            structured_output = excluded.structured_output,
            sources = excluded.sources,
            user_command = excluded.user_command,
            updated_at = excluded.updated_at
    ''', (str(uuid.uuid4()), business_id, pillar_key, output_json, sources_json, user_command, now, now))
    
    conn.commit()
    conn.close()
    return True


def get_pillar_data(business_id: str, pillar_key: str) -> Optional[dict]:
    """Get structured output for a specific pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT structured_output, sources, user_command, created_at, updated_at
        FROM pillar_data
        WHERE business_id = ? AND pillar_key = ?
    ''', (business_id, pillar_key))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "structured_output": json.loads(row["structured_output"]),
        "sources": json.loads(row["sources"] or "[]"),
        "user_command": row["user_command"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_all_pillar_data(business_id: str) -> dict:
    """Get all pillar data for a business."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT pillar_key, structured_output, sources, user_command, created_at, updated_at
        FROM pillar_data
        WHERE business_id = ?
        ORDER BY pillar_key
    ''', (business_id,))
    
    result = {}
    for row in cursor.fetchall():
        result[row["pillar_key"]] = {
            "structured_output": json.loads(row["structured_output"]),
            "sources": json.loads(row["sources"] or "[]"),
            "user_command": row["user_command"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
    
    conn.close()
    return result


# ═══════════════════════════════════════════════════════════════════
# Business Brief Operations
# ═══════════════════════════════════════════════════════════════════

def save_business_brief(business_id: str, analysis_id: str, brief_data: Any) -> bool:
    """Save or update business brief for specialist engine."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    brief_json = json.dumps(brief_data, ensure_ascii=False) if not isinstance(brief_data, str) else brief_data
    
    cursor.execute('''
        INSERT INTO business_briefs (id, business_id, analysis_id, brief_data, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(business_id, analysis_id) DO UPDATE SET
            brief_data = excluded.brief_data,
            created_at = excluded.created_at
    ''', (str(uuid.uuid4()), business_id, analysis_id, brief_json, now))
    
    conn.commit()
    conn.close()
    return True


def get_business_brief(business_id_or_analysis_id: str, analysis_id: Optional[str] = None) -> Optional[Dict]:
    """Get business brief. Supports both (business_id, analysis_id) and (analysis_id) signatures."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if analysis_id:
        # Called as get_business_brief(business_id, analysis_id)
        cursor.execute('''
            SELECT brief_data, created_at FROM business_briefs
            WHERE business_id = ? AND analysis_id = ?
        ''', (business_id_or_analysis_id, analysis_id))
    else:
        # Called as get_business_brief(analysis_id) — search by analysis_id only
        cursor.execute('''
            SELECT brief_data, created_at FROM business_briefs
            WHERE analysis_id = ?
        ''', (business_id_or_analysis_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    brief_data = row["brief_data"]
    try:
        brief_data = json.loads(brief_data)
    except (json.JSONDecodeError, TypeError):
        pass
    
    return {
        "brief_data": brief_data,
        "created_at": row["created_at"]
    }


# ═══════════════════════════════════════════════════════════════════
# Pillar Diagnostic Operations
# ═══════════════════════════════════════════════════════════════════

def save_pillar_diagnostic(analysis_id: str, pillar_key: str, diagnostic_data: Dict) -> bool:
    """Save or update diagnostic data for a pillar."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    diag_json = json.dumps(diagnostic_data, ensure_ascii=False)
    
    cursor.execute('''
        INSERT INTO pillar_diagnostics (id, analysis_id, pillar_key, diagnostic_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(analysis_id, pillar_key) DO UPDATE SET
            diagnostic_data = excluded.diagnostic_data,
            updated_at = excluded.updated_at
    ''', (str(uuid.uuid4()), analysis_id, pillar_key, diag_json, now, now))
    
    conn.commit()
    conn.close()
    return True


def get_all_diagnostics(analysis_id: str) -> List[Dict]:
    """Get all pillar diagnostics for an analysis."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT pillar_key, diagnostic_data, created_at, updated_at
        FROM pillar_diagnostics
        WHERE analysis_id = ?
    ''', (analysis_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        diag = json.loads(row["diagnostic_data"])
        diag["pillar_key"] = row["pillar_key"]
        diag["created_at"] = row["created_at"]
        diag["updated_at"] = row["updated_at"]
        result.append(diag)
    
    return result


# ═══════════════════════════════════════════════════════════════════
# Analysis Market Data & Specialist Plan Operations
# ═══════════════════════════════════════════════════════════════════

def get_analysis_market_data(analysis_id: str) -> Optional[Dict]:
    """Get market data from a saved analysis."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT market_data FROM analyses WHERE id = ?', (analysis_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    try:
        return json.loads(row["market_data"])
    except (json.JSONDecodeError, TypeError):
        return None


def approve_pillar_plan(analysis_id: str, pillar_key: str, user_notes: str = "") -> bool:
    """Approve a specialist plan for a pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        UPDATE specialist_plans
        SET status = 'approved', user_notes = ?, updated_at = ?
        WHERE analysis_id = ? AND pillar_key = ?
    ''', (user_notes, now, analysis_id, pillar_key))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


# ═══════════════════════════════════════════════════════════════════
# Business Brief Operations
# ═══════════════════════════════════════════════════════════════════

def save_business_brief(business_id: str, analysis_id: str, brief_data: Any) -> bool:
    """Save or update a business brief for a given analysis."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    brief_json = json.dumps(brief_data, ensure_ascii=False) if not isinstance(brief_data, str) else brief_data
    
    cursor.execute('''
        INSERT INTO business_briefs (id, business_id, analysis_id, brief_data, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(business_id, analysis_id) DO UPDATE SET
            brief_data = excluded.brief_data
    ''', (str(uuid.uuid4()), business_id, analysis_id, brief_json, now))
    
    conn.commit()
    conn.close()
    return True


def get_business_brief(business_id_or_analysis_id: str, analysis_id: Optional[str] = None) -> Optional[Dict]:
    """Get business brief. Supports two call signatures:
    - get_business_brief(business_id, analysis_id) — lookup by both keys
    - get_business_brief(analysis_id) — lookup by analysis_id only
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    if analysis_id is not None:
        # Called as get_business_brief(business_id, analysis_id)
        cursor.execute('''
            SELECT * FROM business_briefs
            WHERE business_id = ? AND analysis_id = ?
        ''', (business_id_or_analysis_id, analysis_id))
    else:
        # Called as get_business_brief(analysis_id)
        cursor.execute('''
            SELECT * FROM business_briefs
            WHERE analysis_id = ?
        ''', (business_id_or_analysis_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    brief_raw = row["brief_data"]
    try:
        brief_data = json.loads(brief_raw)
    except (json.JSONDecodeError, TypeError):
        brief_data = brief_raw
    
    return {
        "id": row["id"],
        "business_id": row["business_id"],
        "analysis_id": row["analysis_id"],
        "brief_data": brief_data,
        "created_at": row["created_at"]
    }


# ═══════════════════════════════════════════════════════════════════
# Pillar Diagnostic Operations
# ═══════════════════════════════════════════════════════════════════

def save_pillar_diagnostic(analysis_id: str, pillar_key: str, diagnostic_data: Dict) -> bool:
    """Save or update diagnostic data for a pillar."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    diag_json = json.dumps(diagnostic_data, ensure_ascii=False)
    
    cursor.execute('''
        INSERT INTO pillar_diagnostics (id, analysis_id, pillar_key, diagnostic_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(analysis_id, pillar_key) DO UPDATE SET
            diagnostic_data = excluded.diagnostic_data,
            updated_at = excluded.updated_at
    ''', (str(uuid.uuid4()), analysis_id, pillar_key, diag_json, now, now))
    
    conn.commit()
    conn.close()
    return True


def get_all_diagnostics(analysis_id: str) -> List[Dict]:
    """Get all pillar diagnostics for an analysis."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM pillar_diagnostics
        WHERE analysis_id = ?
    ''', (analysis_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        try:
            diag = json.loads(row["diagnostic_data"])
        except (json.JSONDecodeError, TypeError):
            diag = {}
        results.append({
            "id": row["id"],
            "analysis_id": row["analysis_id"],
            "pillar_key": row["pillar_key"],
            "diagnostic_data": diag,
            **diag,  # Spread diagnostic data at top level for easy access
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        })
    
    return results


# ═══════════════════════════════════════════════════════════════════
# Analysis Market Data Operations
# ═══════════════════════════════════════════════════════════════════

def get_analysis_market_data(analysis_id: str) -> Optional[Dict]:
    """Get market data from a saved analysis."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT market_data FROM analyses
        WHERE id = ?
    ''', (analysis_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    try:
        return json.loads(row["market_data"])
    except (json.JSONDecodeError, TypeError):
        return None


# ═══════════════════════════════════════════════════════════════════
# Specialist Plan Operations
# ═══════════════════════════════════════════════════════════════════

def approve_pillar_plan(analysis_id: str, pillar_key: str, user_notes: str = "") -> bool:
    """Approve a specialist plan for a pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        UPDATE specialist_plans
        SET status = 'approved', user_notes = ?, updated_at = ?
        WHERE analysis_id = ? AND pillar_key = ?
    ''', (user_notes, now, analysis_id, pillar_key))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def get_pillar_diagnostic(analysis_id: str, pillar_key: str) -> Optional[Dict]:
    """Get diagnostic data for a single pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT diagnostic_data, created_at, updated_at
        FROM pillar_diagnostics
        WHERE analysis_id = ? AND pillar_key = ?
    ''', (analysis_id, pillar_key))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    try:
        diag = json.loads(row["diagnostic_data"])
    except (json.JSONDecodeError, TypeError):
        diag = {}
    
    return diag


def save_pillar_plan(analysis_id: str, pillar_key: str, plan_data: Any, status: str = "draft") -> bool:
    """Save or update a specialist plan for a pillar."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    plan_json = json.dumps(plan_data, ensure_ascii=False) if not isinstance(plan_data, str) else plan_data
    
    cursor.execute('''
        INSERT INTO specialist_plans (id, analysis_id, pillar_key, plan_data, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(analysis_id, pillar_key) DO UPDATE SET
            plan_data = excluded.plan_data,
            status = excluded.status,
            updated_at = excluded.updated_at
    ''', (str(uuid.uuid4()), analysis_id, pillar_key, plan_json, status, now, now))
    
    conn.commit()
    conn.close()
    return True


def get_pillar_plan(analysis_id: str, pillar_key: str) -> Optional[Dict]:
    """Get the specialist plan for a pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT plan_data, status, user_notes, created_at, updated_at
        FROM specialist_plans
        WHERE analysis_id = ? AND pillar_key = ?
    ''', (analysis_id, pillar_key))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    try:
        plan_data = json.loads(row["plan_data"])
    except (json.JSONDecodeError, TypeError):
        plan_data = {}
    
    return {
        "plan_data": plan_data,
        "status": row["status"],
        "user_notes": row["user_notes"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


def save_execution_result(
    analysis_id: str, pillar_key: str, task_id: str, action_title: str,
    status: str = "completed", outcome: str = "", business_impact: str = "",
    result_data: Any = None
) -> Dict:
    """Save an execution result for a pillar task, including full content."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    result_id = str(uuid.uuid4())
    
    cursor.execute('''
        INSERT INTO specialist_results (id, analysis_id, pillar_key, task_id, action_title, status, outcome, business_impact, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (result_id, analysis_id, pillar_key, task_id, action_title, status, outcome, business_impact, now))
    
    # Also save full execution content if provided
    if result_data is not None:
        result_json = json.dumps(result_data, ensure_ascii=False) if not isinstance(result_data, str) else result_data
        cursor.execute('''
            INSERT INTO specialist_executions (id, analysis_id, pillar_key, task_id, result_data, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(analysis_id, pillar_key, task_id) DO UPDATE SET
                result_data = excluded.result_data,
                status = excluded.status
        ''', (str(uuid.uuid4()), analysis_id, pillar_key, task_id, result_json, status, now))
    
    conn.commit()
    conn.close()
    
    return {
        "id": result_id,
        "analysis_id": analysis_id,
        "pillar_key": pillar_key,
        "task_id": task_id,
        "action_title": action_title,
        "status": status,
        "outcome": outcome,
        "business_impact": business_impact,
        "created_at": now
    }


def get_pillar_results(analysis_id: str, pillar_key: str) -> Optional[List[Dict]]:
    """Get all execution results for a pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, task_id, action_title, status, outcome, business_impact, created_at
        FROM specialist_results
        WHERE analysis_id = ? AND pillar_key = ?
        ORDER BY created_at
    ''', (analysis_id, pillar_key))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return None
    
    return [{
        "id": row["id"],
        "task_id": row["task_id"],
        "action_title": row["action_title"],
        "status": row["status"],
        "outcome": row["outcome"],
        "business_impact": row["business_impact"],
        "created_at": row["created_at"]
    } for row in rows]


def save_pillar_kpi(
    analysis_id: str, pillar_key: str,
    kpi_name: str, kpi_value: str, kpi_target: str = ""
) -> bool:
    """Save or update a KPI for a pillar."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        INSERT INTO pillar_kpis (id, analysis_id, pillar_key, kpi_name, kpi_value, kpi_target, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(analysis_id, pillar_key, kpi_name) DO UPDATE SET
            kpi_value = excluded.kpi_value,
            kpi_target = excluded.kpi_target
    ''', (str(uuid.uuid4()), analysis_id, pillar_key, kpi_name, kpi_value, kpi_target, now))
    
    conn.commit()
    conn.close()
    return True


def get_pillar_kpis(analysis_id: str, pillar_key: str) -> Optional[List[Dict]]:
    """Get all KPIs for a pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT kpi_name, kpi_value, kpi_target, created_at
        FROM pillar_kpis
        WHERE analysis_id = ? AND pillar_key = ?
    ''', (analysis_id, pillar_key))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return None
    
    return [{
        "kpi_name": row["kpi_name"],
        "kpi_value": row["kpi_value"],
        "kpi_target": row["kpi_target"],
        "created_at": row["created_at"]
    } for row in rows]


# ═══════════════════════════════════════════════════════════════════
# Subtask Persistence
# ═══════════════════════════════════════════════════════════════════

def save_subtasks(analysis_id: str, pillar_key: str, task_id: str, subtasks_data: Any) -> bool:
    """Save or update expanded subtasks for a task."""
    import uuid
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    data_json = json.dumps(subtasks_data, ensure_ascii=False) if not isinstance(subtasks_data, str) else subtasks_data
    
    cursor.execute('''
        INSERT INTO specialist_subtasks (id, analysis_id, pillar_key, task_id, subtasks_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(analysis_id, pillar_key, task_id) DO UPDATE SET
            subtasks_data = excluded.subtasks_data,
            updated_at = excluded.updated_at
    ''', (str(uuid.uuid4()), analysis_id, pillar_key, task_id, data_json, now, now))
    
    conn.commit()
    conn.close()
    return True


def get_subtasks(analysis_id: str, pillar_key: str, task_id: str = None) -> Any:
    """Get subtasks for a specific task or all tasks in a pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if task_id:
        cursor.execute('''
            SELECT task_id, subtasks_data FROM specialist_subtasks
            WHERE analysis_id = ? AND pillar_key = ? AND task_id = ?
        ''', (analysis_id, pillar_key, task_id))
    else:
        cursor.execute('''
            SELECT task_id, subtasks_data FROM specialist_subtasks
            WHERE analysis_id = ? AND pillar_key = ?
        ''', (analysis_id, pillar_key))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return None
    
    result = {}
    for row in rows:
        try:
            result[row["task_id"]] = json.loads(row["subtasks_data"])
        except (json.JSONDecodeError, TypeError):
            result[row["task_id"]] = {}
    
    return result


def get_full_executions(analysis_id: str, pillar_key: str) -> Optional[Dict]:
    """Get all full execution results (with content) for a pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT task_id, result_data, status, created_at
        FROM specialist_executions
        WHERE analysis_id = ? AND pillar_key = ? AND result_data IS NOT NULL
        ORDER BY created_at
    ''', (analysis_id, pillar_key))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return None
    
    result = {}
    for row in rows:
        try:
            result[row["task_id"]] = {
                "result_data": json.loads(row["result_data"]),
                "status": row["status"],
                "created_at": row["created_at"]
            }
        except (json.JSONDecodeError, TypeError):
            pass
    
    return result if result else None


def get_subtask_executions(analysis_id: str, pillar_key: str, parent_task_id: str) -> List[Dict]:
    """Get all subtask execution results for a specific parent task."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Subtasks have IDs like {parent_task_id}_st1, {parent_task_id}_st2, etc.
    # Also include the summary: {parent_task_id}_summary
    cursor.execute('''
        SELECT task_id, result_data, status, created_at
        FROM specialist_executions
        WHERE analysis_id = ? AND pillar_key = ? 
        AND (task_id LIKE ? OR task_id = ?)
        ORDER BY created_at
    ''', (analysis_id, pillar_key, f"{parent_task_id}_st%", f"{parent_task_id}_summary"))
    
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        try:
            results.append({
                "task_id": row["task_id"],
                "result_data": json.loads(row["result_data"]) if row["result_data"] else None,
                "status": row["status"],
                "created_at": row["created_at"]
            })
        except (json.JSONDecodeError, TypeError):
            pass
            
    return results


def delete_subtasks(analysis_id: str, pillar_key: str, task_id: str = None):
    """Delete subtasks for a task or entire pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        if task_id:
            cursor.execute('''
                DELETE FROM specialist_subtasks
                WHERE analysis_id = ? AND pillar_key = ? AND task_id = ?
            ''', (analysis_id, pillar_key, task_id))
        else:
            cursor.execute('''
                DELETE FROM specialist_subtasks
                WHERE analysis_id = ? AND pillar_key = ?
            ''', (analysis_id, pillar_key))
        conn.commit()
    finally:
        conn.close()


def delete_specialist_execution(analysis_id: str, pillar_key: str, task_id: str):
    """Delete specialist execution data for a specific task."""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Delete from specialist_executions table
        cursor.execute('''
            DELETE FROM specialist_executions
            WHERE analysis_id = ? AND pillar_key = ? AND id = ?
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()


def delete_specialist_result(analysis_id: str, pillar_key: str, task_id: str):
    """Delete specialist result data for a specific task."""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Delete from specialist_results table
        cursor.execute('''
            DELETE FROM specialist_results
            WHERE analysis_id = ? AND pillar_key = ? AND task_id = ?
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()


def delete_specialist_subtasks(analysis_id: str, pillar_key: str, task_id: str) -> bool:
    """Delete subtasks data and subtask executions for a specific task."""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Delete subtask executions (they have IDs like taskId_st1, taskId_st2, etc.)
        cursor.execute('''
            DELETE FROM specialist_executions
            WHERE analysis_id = ? AND pillar_key = ? AND id LIKE ?
        ''', (analysis_id, pillar_key, f"{task_id}_st%"))
        
        # Delete the main subtasks array entry
        cursor.execute('''
            DELETE FROM specialist_subtasks
            WHERE analysis_id = ? AND pillar_key = ? AND task_id = ?
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()
        
    return True

def delete_specialist_executions(analysis_id: str, pillar_key: str, task_id: str) -> bool:
    """Delete specialist executions (generated text content for subtasks) for a task."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Executions are stored with task_id + "_st1", "_st2" etc, so we delete by LIKE
    cursor.execute('''
        DELETE FROM specialist_executions
        WHERE analysis_id = ? AND pillar_key = ? AND task_id LIKE ?
    ''', (analysis_id, pillar_key, f"{task_id}%"))
    
    conn.commit()
    conn.close()
    return True

def delete_specialist_results(analysis_id: str, pillar_key: str, task_id: str) -> bool:
    """Delete the final specialist result for a task."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        DELETE FROM specialist_results
        WHERE analysis_id = ? AND pillar_key = ? AND task_id = ?
    ''', (analysis_id, pillar_key, task_id))
    
    conn.commit()
    conn.close()
    return True


def delete_background_task(analysis_id: str, pillar_key: str, task_id: str):
    """Delete background task progress."""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            DELETE FROM background_tasks
            WHERE analysis_id = ? AND pillar_key = ? AND task_id = ?
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()


def delete_pillar_data(analysis_id: str, pillar_key: str):
    """Delete all plan and execution data for an entire pillar."""
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            DELETE FROM specialist_plans 
            WHERE analysis_id = ? AND pillar_key = ?
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM specialist_executions 
            WHERE analysis_id = ? AND pillar_key = ?
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM specialist_results 
            WHERE analysis_id = ? AND pillar_key = ?
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM pillar_diagnostics 
            WHERE analysis_id = ? AND pillar_key = ?
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM pillar_kpis 
            WHERE analysis_id = ? AND pillar_key = ?
        ''', (analysis_id, pillar_key))
        
        cursor.execute('''
            DELETE FROM background_tasks
            WHERE analysis_id = ? AND pillar_key = ?
        ''', (analysis_id, pillar_key))

        conn.commit()
    finally:
        conn.close()


def save_background_task_progress(
    analysis_id: str, 
    task_id: str, 
    pillar_key: str,
    status: str, 
    current_step: int = 0, 
    total_steps: int = 0,
    result_data: Any = None,
    error_message: str = None
) -> None:
    """Save or update the status of a background task."""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    
    res_json = json.dumps(result_data, ensure_ascii=False) if result_data else None
    
    cursor.execute('''
        INSERT INTO background_tasks (
            id, analysis_id, pillar_key, task_id, status, 
            current_step, total_steps, result_data, error_message, 
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(analysis_id, task_id) DO UPDATE SET
            status = excluded.status,
            current_step = excluded.current_step,
            total_steps = excluded.total_steps,
            result_data = COALESCE(excluded.result_data, result_data),
            error_message = excluded.error_message,
            updated_at = excluded.updated_at
    ''', (
        f"{analysis_id}_{task_id}", analysis_id, pillar_key, task_id, status,
        current_step, total_steps, res_json, error_message, now, now
    ))
    
    conn.commit()
    conn.close()


def get_background_task_progress(analysis_id: str, task_id: str) -> Optional[Dict]:
    """Get the current progress of a background task."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM background_tasks 
        WHERE analysis_id = ? AND task_id = ?
    ''', (analysis_id, task_id))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "analysis_id": row["analysis_id"],
        "pillar_key": row["pillar_key"],
        "task_id": row["task_id"],
        "status": row["status"],
        "current_step": row["current_step"],
        "total_steps": row["total_steps"],
        "result_data": json.loads(row["result_data"]) if row["result_data"] else None,
        "error_message": row["error_message"],
        "updated_at": row["updated_at"]
    }



# Initialize database on module import
init_db()
