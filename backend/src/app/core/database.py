"""
Database Layer — SQLite persistence for multi-business support.
Stores users, businesses, analyses, and dimension chats.
"""

import json
import os
import hashlib
import secrets
import logging
import bcrypt
import jwt
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union
from pathlib import Path

logger = logging.getLogger(__name__)

# Database location (deprecated for Postgres, but kept for context if needed)
DB_DIR = Path(__file__).parent.parent.parent.parent.parent / 'data'
DB_DIR.mkdir(exist_ok=True) # Keep mkdir for consistency, though DB_PATH is not used
DB_PATH = DB_DIR / 'growth_platform.db' # Keep for context, not used

# PostgreSQL
DATABASE_URL = os.environ.get("DATABASE_URL")

# JWT Configuration
JWT_SECRET = os.environ.get("NEXTAUTH_SECRET") or os.environ.get("JWT_SECRET") or "dev_secret_keys_change_in_production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def get_connection():
    """Get native PostgreSQL database connection."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set. A valid PostgreSQL connection string is required.")
    conn = psycopg2.connect(db_url)
    return conn


def init_db():
    """Initialize database schema native to PostgreSQL."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
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
    conn.commit()

    # Migration: Stripe Billing columns
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free'")
        conn.commit()
    except Exception:
        conn.rollback()

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT")
        conn.commit()
    except Exception:
        conn.rollback()

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
            discovery_data TEXT,
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
    conn.commit()

    # Migration: add status column to specialist_results if missing
    try:
        cursor.execute("ALTER TABLE specialist_results ADD COLUMN status TEXT DEFAULT 'pending'")
        conn.commit()
    except Exception:
        conn.rollback()  # Column already exists
    
    # Migration: add unique index to specialist_executions for upsert support
    try:
        cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_specialist_executions_unique ON specialist_executions (analysis_id, pillar_key, task_id)')
        conn.commit()
    except Exception:
        conn.rollback()
    
    # Research cache table for unified research system
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS research_cache (
            cache_key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL,
            research_type TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Research results table for analytics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS research_results (
            id SERIAL PRIMARY KEY,
            research_type TEXT NOT NULL,
            cache_key TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(research_type, cache_key)
        )
    ''')
    
    # Indexes for research tables
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_research_cache_type ON research_cache(research_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_research_results_type ON research_results(research_type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_research_cache_created ON research_cache(cached_at)')
    
    conn.commit()
    conn.close()


# ═══════════════════════════════════════════════════════════════════
# Authentication & Security
# ═══════════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    """Hash a password using bcrypt (secure, salted)."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def _is_bcrypt_hash(password_hash: str) -> bool:
    """Check if a hash is bcrypt format (starts with $2b$)."""
    return password_hash.startswith('$2b$') or password_hash.startswith('$2a$')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash.
    
    Supports both bcrypt (new) and SHA-256 (legacy) hashes.
    Legacy SHA-256 hashes are auto-migrated to bcrypt on successful verification.
    """
    if _is_bcrypt_hash(password_hash):
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    else:
        # Legacy SHA-256 fallback
        return hashlib.sha256(password.encode()).hexdigest() == password_hash


def generate_session_token() -> str:
    """Generate a secure random session token."""
    return secrets.token_urlsafe(32)


def create_session(user_id: str, duration_days: int = 30) -> Dict:
    """Create a new session for a user."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    token = generate_session_token()
    now = datetime.utcnow()
    expires = now + timedelta(days=duration_days)
    
    cursor.execute('''
        INSERT INTO sessions (token, user_id, created_at, expires_at, last_used)
        VALUES (%s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT s.token, s.user_id, s.expires_at, u.email, u.name
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = %s
    ''', (token,))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
    
    # Check if expired
    expires_at = datetime.fromisoformat(row["expires_at"])
    if datetime.utcnow() > expires_at:
        # Delete expired session
        cursor.execute('DELETE FROM sessions WHERE token = %s', (token,))
        conn.commit()
        conn.close()
        return None
    
    # Update last_used
    cursor.execute('''
        UPDATE sessions SET last_used = %s WHERE token = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('DELETE FROM sessions WHERE token = %s', (token,))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def cleanup_expired_sessions():
    """Remove all expired sessions."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute('DELETE FROM sessions WHERE expires_at < %s', (now,))
    
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # Check if email already exists
    cursor.execute('SELECT id FROM users WHERE email = %s', (email,))
    if cursor.fetchone():
        conn.close()
        raise ValueError("Email já cadastrado")
    
    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        INSERT INTO users (id, email, password_hash, name, created_at, metadata)
        VALUES (%s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT id, email, password_hash, name 
        FROM users 
        WHERE email = %s
    ''', (email,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    if not verify_password(password, row["password_hash"]):
        return None
    
    # Auto-migrate legacy SHA-256 hash to bcrypt
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    if not _is_bcrypt_hash(row["password_hash"]):
        new_hash = hash_password(password)
        cursor.execute('UPDATE users SET password_hash = %s WHERE id = %s', (new_hash, row["id"]))
        logger.info(f"Auto-migrated password hash to bcrypt for user {row['id']}")
    
    # Update last login
    cursor.execute('''
        UPDATE users SET last_login = %s WHERE id = %s
    ''', (datetime.utcnow().isoformat(), row["id"]))
    conn.commit()
    conn.close()
    
    # Create session (Legacy)
    session = create_session(row["id"])
    
    # Create JWT Access Token (New)
    access_token = create_jwt_token(row["id"], row["email"], row["name"])
    
    return {
        "user": {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"]
        },
        "session": session,
        "access_token": access_token
    }


def create_user(user_id: str, email: Optional[str] = None, name: Optional[str] = None, metadata: Optional[Dict] = None) -> Dict:
    """Create a new user (legacy function for backward compatibility)."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    # For legacy users without password, generate a random one
    password_hash = hash_password(secrets.token_urlsafe(16))
    
    cursor.execute('''
        INSERT INTO users (id, email, password_hash, name, created_at, metadata)
        VALUES (%s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('SELECT id, email, name, created_at, last_login, metadata FROM users WHERE id = %s', (user_id,))
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('SELECT id, email, name, created_at, last_login FROM users WHERE email = %s', (email,))
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
# JWT AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════

def create_jwt_token(user_id: Union[str, int], email: str, name: str) -> str:
    """Generate a stateless JWT token for the user."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> Optional[Dict]:
    """Verify a JWT token and return the payload if valid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None
    except Exception as e:
        logger.error(f"Error decoding JWT: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════
# SESSIONS (Legacy - to be replaced by JWT completely)
# ═══════════════════════════════════════════════════════════════════

def create_business(user_id: str, name: str, profile_data: Dict) -> Dict:
    """Create a new business for a user."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    business_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # --- ROBUSTNESS: Ensure user exists before inserting business ---
    # This prevents FK constraint violations if the user_id is an email or just not in DB yet
    try:
        user_exists = get_user(user_id)
        if not user_exists:
            # If it looks like an email, try lookup by email
            if "@" in str(user_id):
                user_by_email = get_user_by_email(user_id)
                if user_by_email:
                    user_id = user_by_email["id"]
                else:
                    # Auto-register if not found
                    logger.info(f"Auto-registrando usuário {user_id} durante criação de negócio")
                    new_user = create_user(user_id, email=user_id, name="Usuário Auto-registrado")
                    user_id = new_user["id"]
            else:
                # Basic UUID-like ID but missing in DB? Create it.
                logger.info(f"Criando registro de usuário faltante: {user_id}")
                create_user(user_id, name="Usuário")
    except Exception as e:
        logger.error(f"Erro ao resolver user_id {user_id} em create_business: {e}")
        # Continue and let it fail at DB level if necessary, but we tried
    
    # Extract key fields from profile
    perfil = profile_data.get("perfil", {})
    segment = perfil.get("segmento", "")
    model = perfil.get("modelo_negocio", perfil.get("modelo", ""))
    location = perfil.get("localizacao", "")
    
    cursor.execute('''
        INSERT INTO businesses (id, user_id, name, segment, model, location, profile_data, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('SELECT * FROM businesses WHERE id = %s', (business_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    profile_data = json.loads(row["profile_data"])
    perfil = profile_data.get("perfil", {})
    
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "segment": row["segment"] or perfil.get("segmento", ""),
        "model": row["model"] or perfil.get("modelo_negocio", perfil.get("modelo", "")),
        "location": row["location"] or perfil.get("localizacao", ""),
        "profile_data": profile_data,
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }


def list_user_businesses(user_id: str, status: str = "active") -> List[Dict]:
    """List all businesses for a user."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT * FROM businesses 
        WHERE user_id = %s AND status = %s
        ORDER BY updated_at DESC
    ''', (user_id, status))
    
    rows = cursor.fetchall()
    conn.close()
    
    businesses = []
    for row in rows:
        profile_data = json.loads(row["profile_data"])
        perfil = profile_data.get("perfil", {})
        
        businesses.append({
            "id": row["id"],
            "user_id": row["user_id"],
            "name": row["name"],
            "segment": row["segment"] or perfil.get("segmento", ""),
            "model": row["model"] or perfil.get("modelo_negocio", perfil.get("modelo", "")),
            "location": row["location"] or perfil.get("localizacao", ""),
            "profile_data": profile_data,
            "status": row["status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        })
    
    return businesses


def update_business(business_id: str, profile_data: Dict) -> bool:
    """Update business profile data."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Extract updated key fields
    perfil = profile_data.get("perfil", {})
    segment = perfil.get("segmento", "")
    model = perfil.get("modelo_negocio", perfil.get("modelo", ""))
    location = perfil.get("localizacao", "")
    name = perfil.get("nome", perfil.get("nome_negocio", ""))
    
    cursor.execute('''
        UPDATE businesses 
        SET name = %s, segment = %s, model = %s, location = %s, profile_data = %s, updated_at = %s
        WHERE id = %s
    ''', (name, segment, model, location, json.dumps(profile_data, ensure_ascii=False), now, business_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def delete_business(business_id: str) -> bool:
    """Soft delete a business (set status to 'deleted')."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        UPDATE businesses 
        SET status = 'deleted', updated_at = %s
        WHERE id = %s
    ''', (now, business_id))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def hard_delete_business(business_id: str) -> bool:
    """Permanently delete a business and all its analyses."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        logger.info(f"🗑️ Iniciando hard delete do negócio: {business_id}")
        
        # Delete all related data in correct order (respecting foreign keys)
        
        # 1. Delete dimension chats
        cursor.execute('''
            DELETE FROM dimension_chats 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_chats = cursor.rowcount
        logger.info(f"🗑️ Deletados {deleted_chats} chats de dimensão")
        
        # 2. Delete pillar data
        cursor.execute('DELETE FROM pillar_data WHERE business_id = %s', (business_id,))
        deleted_pillar_data = cursor.rowcount
        print(f"🗑️ Deleted {deleted_pillar_data} pillar data records", file=sys.stderr)
        
        # 3. Delete business briefs
        cursor.execute('DELETE FROM business_briefs WHERE business_id = %s', (business_id,))
        deleted_briefs = cursor.rowcount
        print(f"🗑️ Deleted {deleted_briefs} business briefs", file=sys.stderr)
        
        # 4. Delete pillar diagnostics
        cursor.execute('''
            DELETE FROM pillar_diagnostics 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_diagnostics = cursor.rowcount
        print(f"🗑️ Deleted {deleted_diagnostics} pillar diagnostics", file=sys.stderr)
        
        # 5. Delete specialist plans
        cursor.execute('''
            DELETE FROM specialist_plans 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_plans = cursor.rowcount
        print(f"🗑️ Deleted {deleted_plans} specialist plans", file=sys.stderr)
        
        # 6. Delete specialist executions
        cursor.execute('''
            DELETE FROM specialist_executions 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_executions = cursor.rowcount
        print(f"🗑️ Deleted {deleted_executions} specialist executions", file=sys.stderr)
        
        # 7. Delete specialist results
        cursor.execute('''
            DELETE FROM specialist_results 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_results = cursor.rowcount
        print(f"🗑️ Deleted {deleted_results} specialist results", file=sys.stderr)
        
        # 8. Delete pillar KPIs
        cursor.execute('''
            DELETE FROM pillar_kpis 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_kpis = cursor.rowcount
        print(f"🗑️ Deleted {deleted_kpis} pillar KPIs", file=sys.stderr)
        
        # 9. Delete specialist subtasks
        cursor.execute('''
            DELETE FROM specialist_subtasks 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_subtasks = cursor.rowcount
        print(f"🗑️ Deleted {deleted_subtasks} specialist subtasks", file=sys.stderr)
        
        # 10. Delete background tasks
        cursor.execute('''
            DELETE FROM background_tasks 
            WHERE analysis_id IN (
                SELECT id FROM analyses WHERE business_id = %s
            )
        ''', (business_id,))
        deleted_background = cursor.rowcount
        print(f"🗑️ Deleted {deleted_background} background tasks", file=sys.stderr)
        
        # 11. Delete analyses
        cursor.execute('DELETE FROM analyses WHERE business_id = %s', (business_id,))
        deleted_analyses = cursor.rowcount
        print(f"🗑️ Deleted {deleted_analyses} analyses", file=sys.stderr)
        
        # 12. Delete business
        cursor.execute('DELETE FROM businesses WHERE id = %s', (business_id,))
        deleted_business = cursor.rowcount
        print(f"🗑️ Deleted {deleted_business} business record", file=sys.stderr)
        
        conn.commit()
        success = deleted_business > 0
        conn.close()
        
        logger.info(f"🗑️ Hard delete concluído. Sucesso: {success}")
        return success
    except Exception as e:
        conn.rollback()
        conn.close()
        logger.error(f"🗑️ Hard delete falhou: {str(e)}")
        raise


# ═══════════════════════════════════════════════════════════════════
# Analysis Operations
# ═══════════════════════════════════════════════════════════════════

_analysis_profile_column_checked = False
_analysis_discovery_column_checked = False


def ensure_analysis_profile_column(cursor):
    """PostgreSQL handle: dynamic column checks (redundant with init_db but safe)."""
    global _analysis_profile_column_checked
    if _analysis_profile_column_checked:
        return

    try:
        # PostgreSQL native check for column existense
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='analyses' AND column_name='profile_data';
        """)
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE analyses ADD COLUMN profile_data TEXT")
    except Exception as e:
        logger.warning(f"Erro em ensure_analysis_profile_column: {e}")
        
    _analysis_profile_column_checked = True


def ensure_analysis_discovery_column(cursor):
    """PostgreSQL handle: discovery column check."""
    global _analysis_discovery_column_checked
    if _analysis_discovery_column_checked:
        return

    try:
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='analyses' AND column_name='discovery_data';
        """)
        if not cursor.fetchone():
            cursor.execute("ALTER TABLE analyses ADD COLUMN discovery_data TEXT")
    except Exception as e:
        logger.warning(f"Erro em ensure_analysis_discovery_column: {e}")
        
    _analysis_discovery_column_checked = True


def create_analysis(business_id: str, score_data: Dict, task_data: Dict, market_data: Dict, profile_data: Optional[Dict] = None, discovery_data: Optional[Dict] = None) -> Dict:
    """Create a new analysis result."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    score_geral = score_data.get("score_geral", 0)
    classificacao = score_data.get("classificacao", "")
    
    ensure_analysis_profile_column(cursor)
    ensure_analysis_discovery_column(cursor)

    cursor.execute('''
        INSERT INTO analyses (id, business_id, score_data, task_data, market_data, profile_data, discovery_data, score_geral, classificacao, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (
        analysis_id, 
        business_id, 
        json.dumps(score_data, ensure_ascii=False),
        json.dumps(task_data, ensure_ascii=False),
        json.dumps(market_data, ensure_ascii=False),
        json.dumps(profile_data, ensure_ascii=False) if profile_data else None,
        json.dumps(discovery_data, ensure_ascii=False) if discovery_data else None,
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT * FROM analyses 
        WHERE business_id = %s
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
        "profile_data": json.loads(row["profile_data"]) if row["profile_data"] else None,
        "discovery_data": json.loads(row["discovery_data"]) if row["discovery_data"] else None,
        "score_geral": row["score_geral"],
        "classificacao": row["classificacao"],
        "created_at": row["created_at"]
    }


def list_business_analyses(business_id: str, limit: int = 10) -> List[Dict]:
    """List recent analyses for a business."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT * FROM analyses 
        WHERE business_id = %s
        ORDER BY created_at DESC
        LIMIT %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('SELECT * FROM analyses WHERE id = %s', (analysis_id,))
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
        "discovery_data": json.loads(row["discovery_data"]) if row["discovery_data"] else None,
        "score_geral": row["score_geral"],
        "classificacao": row["classificacao"],
        "created_at": row["created_at"]
    }



def update_analysis_profile(analysis_id: str, profile_data: Dict) -> bool:
    """Update profile data stored within an analysis."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cursor.execute('''
            UPDATE analyses 
            SET profile_data = %s
            WHERE id = %s
        ''', (json.dumps(profile_data, ensure_ascii=False), analysis_id))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def update_pillar_diagnostic(analysis_id: str, pillar_key: str, diagnostic_data: Dict) -> bool:
    """Update diagnostic results (score, status, etc.) for a specific pillar."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute('''
            UPDATE pillar_diagnostics 
            SET diagnostic_data = %s, updated_at = %s
            WHERE analysis_id = %s AND pillar_key = %s
        ''', (json.dumps(diagnostic_data, ensure_ascii=False), now, analysis_id, pillar_key))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def get_pillar_diagnostic(analysis_id: str, pillar_key: str) -> Optional[Dict]:
    """Retrieve diagnostic data for a specific pillar."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cursor.execute('''
            SELECT * FROM pillar_diagnostics 
            WHERE analysis_id = %s AND pillar_key = %s
        ''', (analysis_id, pillar_key))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "analysis_id": row["analysis_id"],
            "pillar_key": row["pillar_key"],
            "diagnostic_data": json.loads(row["diagnostic_data"]),
            "updated_at": row["updated_at"]
        }
    finally:
        conn.close()

# ═══════════════════════════════════════════════════════════════════
# Dimension Chat Operations
# ═══════════════════════════════════════════════════════════════════

def save_dimension_chat(analysis_id: str, dimension: str, messages: List[Dict]) -> Dict:
    """Save or update dimension chat history."""
    import uuid
    
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if chat exists
    cursor.execute('''
        SELECT id FROM dimension_chats 
        WHERE analysis_id = %s AND dimension = %s
    ''', (analysis_id, dimension))
    
    row = cursor.fetchone()
    
    if row:
        # Update existing
        chat_id = row["id"]
        cursor.execute('''
            UPDATE dimension_chats 
            SET messages = %s, updated_at = %s
            WHERE id = %s
        ''', (json.dumps(messages, ensure_ascii=False), now, chat_id))
    else:
        # Create new
        chat_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO dimension_chats (id, analysis_id, dimension, messages, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT * FROM dimension_chats 
        WHERE analysis_id = %s AND dimension = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    output_json = json.dumps(structured_output, ensure_ascii=False)
    sources_json = json.dumps(sources or [], ensure_ascii=False)
    
    cursor.execute('''
        INSERT INTO pillar_data (id, business_id, pillar_key, structured_output, sources, user_command, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT structured_output, sources, user_command, created_at, updated_at
        FROM pillar_data
        WHERE business_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT pillar_key, structured_output, sources, user_command, created_at, updated_at
        FROM pillar_data
        WHERE business_id = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    brief_json = json.dumps(brief_data, ensure_ascii=False) if not isinstance(brief_data, str) else brief_data
    
    cursor.execute('''
        INSERT INTO business_briefs (id, business_id, analysis_id, brief_data, created_at)
        VALUES (%s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    if analysis_id:
        # Called as get_business_brief(business_id, analysis_id)
        cursor.execute('''
            SELECT brief_data, created_at FROM business_briefs
            WHERE business_id = %s AND analysis_id = %s
        ''', (business_id_or_analysis_id, analysis_id))
    else:
        # Called as get_business_brief(analysis_id) — search by analysis_id only
        cursor.execute('''
            SELECT brief_data, created_at FROM business_briefs
            WHERE analysis_id = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    diag_json = json.dumps(diagnostic_data, ensure_ascii=False)
    
    cursor.execute('''
        INSERT INTO pillar_diagnostics (id, analysis_id, pillar_key, diagnostic_data, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT pillar_key, diagnostic_data, created_at, updated_at
        FROM pillar_diagnostics
        WHERE analysis_id = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('SELECT market_data FROM analyses WHERE id = %s', (analysis_id,))
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        UPDATE specialist_plans
        SET status = 'approved', user_notes = %s, updated_at = %s
        WHERE analysis_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    brief_json = json.dumps(brief_data, ensure_ascii=False) if not isinstance(brief_data, str) else brief_data
    
    cursor.execute('''
        INSERT INTO business_briefs (id, business_id, analysis_id, brief_data, created_at)
        VALUES (%s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    if analysis_id is not None:
        # Called as get_business_brief(business_id, analysis_id)
        cursor.execute('''
            SELECT * FROM business_briefs
            WHERE business_id = %s AND analysis_id = %s
        ''', (business_id_or_analysis_id, analysis_id))
    else:
        # Called as get_business_brief(analysis_id)
        cursor.execute('''
            SELECT * FROM business_briefs
            WHERE analysis_id = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    diag_json = json.dumps(diagnostic_data, ensure_ascii=False)
    
    cursor.execute('''
        INSERT INTO pillar_diagnostics (id, analysis_id, pillar_key, diagnostic_data, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT * FROM pillar_diagnostics
        WHERE analysis_id = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT market_data FROM analyses
        WHERE id = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        UPDATE specialist_plans
        SET status = 'approved', user_notes = %s, updated_at = %s
        WHERE analysis_id = %s AND pillar_key = %s
    ''', (user_notes, now, analysis_id, pillar_key))
    
    conn.commit()
    success = cursor.rowcount > 0
    conn.close()
    
    return success


def get_pillar_diagnostic(analysis_id: str, pillar_key: str) -> Optional[Dict]:
    """Get diagnostic data for a single pillar."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT diagnostic_data, created_at, updated_at
        FROM pillar_diagnostics
        WHERE analysis_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    plan_json = json.dumps(plan_data, ensure_ascii=False) if not isinstance(plan_data, str) else plan_data
    
    cursor.execute('''
        INSERT INTO specialist_plans (id, analysis_id, pillar_key, plan_data, status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT plan_data, status, user_notes, created_at, updated_at
        FROM specialist_plans
        WHERE analysis_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    result_id = str(uuid.uuid4())
    
    cursor.execute('''
        INSERT INTO specialist_results (id, analysis_id, pillar_key, task_id, action_title, status, outcome, business_impact, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', (result_id, analysis_id, pillar_key, task_id, action_title, status, outcome, business_impact, now))
    
    # Also save full execution content if provided
    if result_data is not None:
        result_json = json.dumps(result_data, ensure_ascii=False) if not isinstance(result_data, str) else result_data
        cursor.execute('''
            INSERT INTO specialist_executions (id, analysis_id, pillar_key, task_id, result_data, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT id, task_id, action_title, status, outcome, business_impact, created_at
        FROM specialist_results
        WHERE analysis_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute('''
        INSERT INTO pillar_kpis (id, analysis_id, pillar_key, kpi_name, kpi_value, kpi_target, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT kpi_name, kpi_value, kpi_target, created_at
        FROM pillar_kpis
        WHERE analysis_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    now = datetime.now(timezone.utc).isoformat()
    data_json = json.dumps(subtasks_data, ensure_ascii=False) if not isinstance(subtasks_data, str) else subtasks_data
    
    cursor.execute('''
        INSERT INTO specialist_subtasks (id, analysis_id, pillar_key, task_id, subtasks_data, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    if task_id:
        cursor.execute('''
            SELECT task_id, subtasks_data FROM specialist_subtasks
            WHERE analysis_id = %s AND pillar_key = %s AND task_id = %s
        ''', (analysis_id, pillar_key, task_id))
    else:
        cursor.execute('''
            SELECT task_id, subtasks_data FROM specialist_subtasks
            WHERE analysis_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT task_id, result_data, status, created_at
        FROM specialist_executions
        WHERE analysis_id = %s AND pillar_key = %s AND result_data IS NOT NULL
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # Subtasks have IDs like {parent_task_id}_st1, {parent_task_id}_st2, etc.
    # Also include the summary: {parent_task_id}_summary
    cursor.execute('''
        SELECT task_id, result_data, status, created_at
        FROM specialist_executions
        WHERE analysis_id = %s AND pillar_key = %s 
        AND (task_id LIKE %s OR task_id = %s)
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        if task_id:
            cursor.execute('''
                DELETE FROM specialist_subtasks
                WHERE analysis_id = %s AND pillar_key = %s AND task_id = %s
            ''', (analysis_id, pillar_key, task_id))
        else:
            cursor.execute('''
                DELETE FROM specialist_subtasks
                WHERE analysis_id = %s AND pillar_key = %s
            ''', (analysis_id, pillar_key))
        conn.commit()
    finally:
        conn.close()


def delete_specialist_execution(analysis_id: str, pillar_key: str, task_id: str):
    """Delete specialist execution data for a specific task."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Delete from specialist_executions table
        cursor.execute('''
            DELETE FROM specialist_executions
            WHERE analysis_id = %s AND pillar_key = %s AND id = %s
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()


def delete_specialist_result(analysis_id: str, pillar_key: str, task_id: str):
    """Delete specialist result data for a specific task."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Delete from specialist_results table
        cursor.execute('''
            DELETE FROM specialist_results
            WHERE analysis_id = %s AND pillar_key = %s AND task_id = %s
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()


def delete_specialist_subtasks(analysis_id: str, pillar_key: str, task_id: str) -> bool:
    """Delete subtasks data and subtask executions for a specific task."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        # Delete subtask executions (they have IDs like taskId_st1, taskId_st2, etc.)
        cursor.execute('''
            DELETE FROM specialist_executions
            WHERE analysis_id = %s AND pillar_key = %s AND id LIKE %s
        ''', (analysis_id, pillar_key, f"{task_id}_st%"))
        
        # Delete the main subtasks array entry
        cursor.execute('''
            DELETE FROM specialist_subtasks
            WHERE analysis_id = %s AND pillar_key = %s AND task_id = %s
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()
        
    return True

def delete_specialist_executions(analysis_id: str, pillar_key: str, task_id: str) -> bool:
    """Delete specialist executions (generated text content for subtasks) for a task."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # Executions are stored with task_id + "_st1", "_st2" etc, so we delete by LIKE
    cursor.execute('''
        DELETE FROM specialist_executions
        WHERE analysis_id = %s AND pillar_key = %s AND task_id LIKE %s
    ''', (analysis_id, pillar_key, f"{task_id}%"))
    
    conn.commit()
    conn.close()
    return True

def delete_specialist_results(analysis_id: str, pillar_key: str, task_id: str) -> bool:
    """Delete the final specialist result for a task."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        DELETE FROM specialist_results
        WHERE analysis_id = %s AND pillar_key = %s AND task_id = %s
    ''', (analysis_id, pillar_key, task_id))
    
    conn.commit()
    conn.close()
    return True


def delete_background_task(analysis_id: str, pillar_key: str, task_id: str):
    """Delete background task progress."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        cursor.execute('''
            DELETE FROM background_tasks
            WHERE analysis_id = %s AND pillar_key = %s AND task_id = %s
        ''', (analysis_id, pillar_key, task_id))
        
        conn.commit()
    finally:
        conn.close()


def delete_pillar_data(analysis_id: str, pillar_key: str):
    """Delete all plan and execution data for an entire pillar."""
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    try:
        cursor.execute('''
            DELETE FROM specialist_plans 
            WHERE analysis_id = %s AND pillar_key = %s
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM specialist_executions 
            WHERE analysis_id = %s AND pillar_key = %s
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM specialist_results 
            WHERE analysis_id = %s AND pillar_key = %s
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM pillar_diagnostics 
            WHERE analysis_id = %s AND pillar_key = %s
        ''', (analysis_id, pillar_key))

        cursor.execute('''
            DELETE FROM pillar_kpis 
            WHERE analysis_id = %s AND pillar_key = %s
        ''', (analysis_id, pillar_key))
        
        cursor.execute('''
            DELETE FROM background_tasks
            WHERE analysis_id = %s AND pillar_key = %s
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    now = datetime.now(timezone.utc).isoformat()
    
    res_json = json.dumps(result_data, ensure_ascii=False) if result_data else None
    
    cursor.execute('''
        INSERT INTO background_tasks (
            id, analysis_id, pillar_key, task_id, status, 
            current_step, total_steps, result_data, error_message, 
            created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT(analysis_id, task_id) DO UPDATE SET
            status = CASE 
                WHEN background_tasks.status = 'cancelled' THEN 'cancelled' 
                ELSE excluded.status 
            END,
            current_step = CASE
                WHEN background_tasks.status = 'cancelled' THEN background_tasks.current_step
                ELSE excluded.current_step
            END,
            total_steps = excluded.total_steps,
            result_data = COALESCE(excluded.result_data, background_tasks.result_data),
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
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    cursor.execute('''
        SELECT * FROM background_tasks 
        WHERE analysis_id = %s AND task_id = %s
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


# ═══════════════════════════════════════════════════════════════════
# RESEARCH CACHE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def save_research_cache(cache_key: str, cache_entry: dict) -> bool:
    """Salva entrada de cache no banco."""
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Serializar dados
        data_json = json.dumps(cache_entry, default=str)
        cached_at_iso = cache_entry["cached_at"].isoformat()
        research_type = cache_entry.get("research_type", "unknown")
        
        # Insert ou replace (PostgreSQL syntax)
        cursor.execute("""
            INSERT INTO research_cache 
            (cache_key, data, cached_at, research_type) 
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (cache_key) DO UPDATE SET
                data = EXCLUDED.data,
                cached_at = EXCLUDED.cached_at,
                research_type = EXCLUDED.research_type
        """, (cache_key, data_json, cached_at_iso, research_type))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"Error saving research cache: {e}")
        return False


def get_research_cache(cache_key: str) -> Optional[dict]:
    """Obtém entrada de cache do banco."""
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        cursor.execute("""
            SELECT data, cached_at, research_type 
            FROM research_cache 
            WHERE cache_key = %s
        """, (cache_key,))
        
        row = cursor.fetchone()
        if not row:
            return None
        
        data_json, cached_at_str, research_type = row
        
        # Deserializar dados
        data = json.loads(data_json)
        
        # Converter string para datetime
        from datetime import datetime
        cached_at = datetime.fromisoformat(cached_at_str)
        
        return {
            "data": data,
            "cached_at": cached_at,
            "research_type": research_type
        }
        
    except Exception as e:
        print(f"Error getting research cache: {e}")
        return None


def save_research_result(research_type: str, cache_key: str, data: dict) -> bool:
    """Salva resultado de pesquisa no banco."""
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        # Serializar dados
        data_json = json.dumps(data, default=str)
        created_at = datetime.now().isoformat()
        
        # Insert ou replace (PostgreSQL syntax)
        cursor.execute("""
            INSERT INTO research_results 
            (research_type, cache_key, data, created_at) 
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (research_type, cache_key) DO UPDATE SET
                data = EXCLUDED.data,
                created_at = EXCLUDED.created_at
        """, (research_type, cache_key, data_json, created_at))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"Error saving research result: {e}")
        return False


def get_research_stats() -> dict:
    """Retorna estatísticas de pesquisas."""
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
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
