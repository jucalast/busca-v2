"""
Tests for JWT Authentication.
"""
import pytest
import jwt
from app.core.database import create_jwt_token, verify_jwt_token, JWT_SECRET, JWT_ALGORITHM

def test_create_jwt_token():
    token = create_jwt_token(123, "test@example.com", "Test User")
    assert isinstance(token, str)
    assert len(token) > 0

def test_verify_valid_jwt():
    token = create_jwt_token("user_abc", "verify@example.com", "Verify User")
    payload = verify_jwt_token(token)
    
    assert payload is not None
    assert payload["sub"] == "user_abc"
    assert payload["email"] == "verify@example.com"
    assert payload["name"] == "Verify User"

def test_verify_expired_jwt(monkeypatch):
    # Mock JWT_EXPIRATION_HOURS to be negative to force expiration
    monkeypatch.setattr("app.core.database.JWT_EXPIRATION_HOURS", -1)
    
    token = create_jwt_token(1, "expired@example.com", "Old User")
    payload = verify_jwt_token(token)
    
    assert payload is None

def test_verify_invalid_token():
    payload = verify_jwt_token("totally-not-a-jwt")
    assert payload is None

def test_verify_wrong_secret():
    token = create_jwt_token(1, "wrong@example.com", "User")
    # Manually decode with wrong secret to simulate tamper
    try:
        jwt.decode(token, "different-secret", algorithms=[JWT_ALGORITHM])
        pytest.fail("Should have raised InvalidSignatureError")
    except jwt.exceptions.InvalidSignatureError:
        pass
    
    # verify_jwt_token should return None
    assert verify_jwt_token(token + "tamper") is None
