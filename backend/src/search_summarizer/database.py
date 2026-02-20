"""
Database Layer — SQLite persistence for multi-business support.
Stores users, businesses, analyses, and dimension chats.
"""

import sqlite3
import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path

# Database location
DB_DIR = Path(__file__).parent.parent.parent.parent / 'data'
DB_DIR.mkdir(exist_ok=True)
DB_PATH = DB_DIR / 'growth_platform.db'


def get_connection():
    """Get database connection with JSON support."""
    conn = sqlite3.connect(str(DB_PATH))
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

    # Execution plans - macro plan (phases + task titles)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS execution_plans (
            id TEXT PRIMARY KEY,
            analysis_id TEXT NOT NULL,
            meta TEXT NOT NULL,
            plan_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (analysis_id) REFERENCES analyses (id)
        )
    ''')

    # Plan task details - micro plan (expanded sub-tasks, generated JIT)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plan_task_details (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            detail_data TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES execution_plans (id)
        )
    ''')

    # Task chats - per-task scoped chat history
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS task_chats (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            messages TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (plan_id) REFERENCES execution_plans (id)
        )
    ''')

    # Specialist cache - cached RAG results by segment + task type
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS specialist_cache (
            cache_key TEXT PRIMARY KEY,
            segment TEXT NOT NULL,
            categoria TEXT NOT NULL,
            task_title TEXT NOT NULL,
            content TEXT NOT NULL,
            hit_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            last_used TEXT NOT NULL
        )
    ''')
    
    # Create indexes for common queries
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses (user_id, status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analyses_business ON analyses (business_id, created_at DESC)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dimension_chats_analysis ON dimension_chats (analysis_id, dimension)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_execution_plans_analysis ON execution_plans (analysis_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_plan_task_details_plan ON plan_task_details (plan_id, task_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_task_chats_plan ON task_chats (plan_id, task_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_specialist_cache_segment ON specialist_cache (segment, categoria)')
    
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
    
    now = datetime.utcnow().isoformat()
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
    now = datetime.utcnow().isoformat()
    
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
    
    now = datetime.utcnow().isoformat()
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
    now = datetime.utcnow().isoformat()
    
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
    
    now = datetime.utcnow().isoformat()
    
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
    
    now = datetime.utcnow().isoformat()
    
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

def create_analysis(business_id: str, score_data: Dict, task_data: Dict, market_data: Dict) -> Dict:
    """Create a new analysis result."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    analysis_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    score_geral = score_data.get("score_geral", 0)
    classificacao = score_data.get("classificacao", "")
    
    cursor.execute('''
        INSERT INTO analyses (id, business_id, score_data, task_data, market_data, score_geral, classificacao, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        analysis_id, 
        business_id, 
        json.dumps(score_data, ensure_ascii=False),
        json.dumps(task_data, ensure_ascii=False),
        json.dumps(market_data, ensure_ascii=False),
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


# ═══════════════════════════════════════════════════════════════════
# Dimension Chat Operations
# ═══════════════════════════════════════════════════════════════════

def save_dimension_chat(analysis_id: str, dimension: str, messages: List[Dict]) -> Dict:
    """Save or update dimension chat history."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.utcnow().isoformat()
    
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
# Execution Plan Operations
# ═══════════════════════════════════════════════════════════════════

def save_execution_plan(analysis_id: str, meta: str, plan_data: Dict) -> Dict:
    """Save a macro execution plan."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.utcnow().isoformat()
    
    # Check if plan exists for this analysis
    cursor.execute('SELECT id FROM execution_plans WHERE analysis_id = ?', (analysis_id,))
    row = cursor.fetchone()
    
    if row:
        plan_id = row["id"]
        cursor.execute('''
            UPDATE execution_plans SET meta = ?, plan_data = ?, updated_at = ?
            WHERE id = ?
        ''', (meta, json.dumps(plan_data, ensure_ascii=False), now, plan_id))
    else:
        plan_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO execution_plans (id, analysis_id, meta, plan_data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (plan_id, analysis_id, meta, json.dumps(plan_data, ensure_ascii=False), now, now))
    
    conn.commit()
    conn.close()
    
    return {
        "id": plan_id,
        "analysis_id": analysis_id,
        "meta": meta,
        "plan_data": plan_data,
        "updated_at": now
    }


def get_execution_plan(analysis_id: str) -> Optional[Dict]:
    """Get execution plan for an analysis."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM execution_plans WHERE analysis_id = ? ORDER BY created_at DESC LIMIT 1', (analysis_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "analysis_id": row["analysis_id"],
        "meta": row["meta"],
        "plan_data": json.loads(row["plan_data"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


# ═══════════════════════════════════════════════════════════════════
# Plan Task Detail Operations (JIT micro-plans)
# ═══════════════════════════════════════════════════════════════════

def save_task_detail(plan_id: str, task_id: str, detail_data: Dict) -> Dict:
    """Save expanded task detail (micro-plan)."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.utcnow().isoformat()
    
    cursor.execute('SELECT id FROM plan_task_details WHERE plan_id = ? AND task_id = ?', (plan_id, task_id))
    row = cursor.fetchone()
    
    if row:
        detail_id = row["id"]
        cursor.execute('''
            UPDATE plan_task_details SET detail_data = ?, updated_at = ?
            WHERE id = ?
        ''', (json.dumps(detail_data, ensure_ascii=False), now, detail_id))
    else:
        detail_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO plan_task_details (id, plan_id, task_id, detail_data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (detail_id, plan_id, task_id, json.dumps(detail_data, ensure_ascii=False), now, now))
    
    conn.commit()
    conn.close()
    
    return {
        "id": detail_id,
        "plan_id": plan_id,
        "task_id": task_id,
        "detail_data": detail_data,
        "updated_at": now
    }


def get_task_detail(plan_id: str, task_id: str) -> Optional[Dict]:
    """Get expanded task detail."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM plan_task_details WHERE plan_id = ? AND task_id = ?', (plan_id, task_id))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "plan_id": row["plan_id"],
        "task_id": row["task_id"],
        "detail_data": json.loads(row["detail_data"]),
        "completed": bool(row["completed"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


def toggle_task_complete(plan_id: str, task_id: str, completed: bool) -> bool:
    """Mark a task as completed or not."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.utcnow().isoformat()
    cursor.execute('''
        UPDATE plan_task_details SET completed = ?, updated_at = ?
        WHERE plan_id = ? AND task_id = ?
    ''', (1 if completed else 0, now, plan_id, task_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    return success


# ═══════════════════════════════════════════════════════════════════
# Task Chat Operations (per-task scoped chat)
# ═══════════════════════════════════════════════════════════════════

def save_task_chat(plan_id: str, task_id: str, messages: List[Dict]) -> Dict:
    """Save or update task-scoped chat history."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.utcnow().isoformat()
    
    cursor.execute('SELECT id FROM task_chats WHERE plan_id = ? AND task_id = ?', (plan_id, task_id))
    row = cursor.fetchone()
    
    if row:
        chat_id = row["id"]
        cursor.execute('''
            UPDATE task_chats SET messages = ?, updated_at = ?
            WHERE id = ?
        ''', (json.dumps(messages, ensure_ascii=False), now, chat_id))
    else:
        chat_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO task_chats (id, plan_id, task_id, messages, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (chat_id, plan_id, task_id, json.dumps(messages, ensure_ascii=False), now, now))
    
    conn.commit()
    conn.close()
    
    return {
        "id": chat_id,
        "plan_id": plan_id,
        "task_id": task_id,
        "messages": messages,
        "updated_at": now
    }


def get_task_chat(plan_id: str, task_id: str) -> Optional[Dict]:
    """Get task-scoped chat history."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM task_chats WHERE plan_id = ? AND task_id = ?', (plan_id, task_id))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "id": row["id"],
        "plan_id": row["plan_id"],
        "task_id": row["task_id"],
        "messages": json.loads(row["messages"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


# ═══════════════════════════════════════════════════════════════════
# Specialist Cache Operations (RAG result caching)
# ═══════════════════════════════════════════════════════════════════

def save_specialist_cache(cache_key: str, segment: str, categoria: str, task_title: str, content: Dict) -> Dict:
    """Save RAG result to cache."""
    conn = get_connection()
    cursor = conn.cursor()
    
    now = datetime.utcnow().isoformat()
    
    cursor.execute('''
        INSERT OR REPLACE INTO specialist_cache (cache_key, segment, categoria, task_title, content, hit_count, created_at, last_used)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    ''', (cache_key, segment, categoria, task_title, json.dumps(content, ensure_ascii=False), now, now))
    
    conn.commit()
    conn.close()
    
    return {"cache_key": cache_key, "created_at": now}


def get_specialist_cache(cache_key: str) -> Optional[Dict]:
    """Get cached RAG result. Updates hit_count and last_used."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM specialist_cache WHERE cache_key = ?', (cache_key,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    # Update hit count
    now = datetime.utcnow().isoformat()
    cursor.execute('''
        UPDATE specialist_cache SET hit_count = hit_count + 1, last_used = ?
        WHERE cache_key = ?
    ''', (now, cache_key))
    conn.commit()
    conn.close()
    
    return {
        "cache_key": row["cache_key"],
        "segment": row["segment"],
        "categoria": row["categoria"],
        "task_title": row["task_title"],
        "content": json.loads(row["content"]),
        "hit_count": row["hit_count"] + 1,
        "created_at": row["created_at"],
        "last_used": now
    }


# Initialize database on module import
init_db()
