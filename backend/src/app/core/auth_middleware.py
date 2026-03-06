"""
Auth Middleware — Session-based authentication for FastAPI.

Validates session tokens from the Authorization header.
Provides a `get_current_user` dependency for protected endpoints.
"""

import logging
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict
from app.core.database import validate_session

logger = logging.getLogger(__name__)

# Bearer token scheme (optional — allows unauthenticated access to whitelisted routes)
security = HTTPBearer(auto_error=False)

# Endpoints that don't require authentication
PUBLIC_ENDPOINTS = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Prefixes that don't require authentication
PUBLIC_PREFIXES = (
    "/api/v1/search",  # Search endpoints are public
)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict]:
    """
    FastAPI dependency that validates the session token (JWT or Legacy Session).
    
    JWT logic:
      Verifies signature and expiration. If valid, returns data from payload.
      
    Legacy logic:
      Falls back to SQLite 'sessions' table lookup.
    """
    if credentials is None:
        return None
    
    token = credentials.credentials
    
    # 1. Try JWT first (stateless)
    jwt_payload = verify_jwt_token(token)
    if jwt_payload:
        return {
            "token": token,
            "user_id": jwt_payload.get("sub"),
            "email": jwt_payload.get("email"),
            "name": jwt_payload.get("name"),
            "is_jwt": True
        }
    
    # 2. Fallback to Legacy Session (database-backed)
    user = validate_session(token)
    if user:
        user["is_jwt"] = False
        return user
    
    # Neither valid
    raise HTTPException(
        status_code=401,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_auth(
    user: Optional[Dict] = Depends(get_current_user),
) -> Dict:
    """
    Stricter dependency — always requires authentication.
    Use on endpoints that must be protected.
    """
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
