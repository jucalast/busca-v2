"""
Tests for database layer — auth, users, businesses, sessions.
"""
import pytest
from app.core.database import (
    hash_password, verify_password, _is_bcrypt_hash,
    register_user, login_user, get_user, get_user_by_email,
    create_session, validate_session, delete_session,
    create_business, get_business, list_user_businesses,
    update_business, delete_business, hard_delete_business,
)


# ═══════════════════════════════════════════════════════════════════
# Password Hashing
# ═══════════════════════════════════════════════════════════════════

class TestPasswordHashing:
    def test_hash_produces_bcrypt(self):
        hashed = hash_password("test123")
        assert _is_bcrypt_hash(hashed), f"Expected bcrypt hash, got: {hashed[:20]}"
    
    def test_hash_is_different_each_time(self):
        """bcrypt uses random salt, so same password → different hashes."""
        h1 = hash_password("test123")
        h2 = hash_password("test123")
        assert h1 != h2
    
    def test_verify_correct_password(self):
        hashed = hash_password("mypassword")
        assert verify_password("mypassword", hashed) is True
    
    def test_verify_wrong_password(self):
        hashed = hash_password("mypassword")
        assert verify_password("wrongpassword", hashed) is False
    
    def test_verify_legacy_sha256(self):
        """Legacy SHA-256 hashes should still work."""
        import hashlib
        legacy_hash = hashlib.sha256("oldpassword".encode()).hexdigest()
        assert not _is_bcrypt_hash(legacy_hash)
        assert verify_password("oldpassword", legacy_hash) is True
        assert verify_password("wrongpassword", legacy_hash) is False


# ═══════════════════════════════════════════════════════════════════
# User Registration & Login
# ═══════════════════════════════════════════════════════════════════

class TestUserRegistration:
    def test_register_user(self):
        user = register_user("test@example.com", "password123", "Test User")
        assert user["email"] == "test@example.com"
        assert user["name"] == "Test User"
        assert "id" in user
    
    def test_register_duplicate_email(self):
        register_user("dupe@example.com", "pass1", "User 1")
        with pytest.raises(ValueError, match="já cadastrado"):
            register_user("dupe@example.com", "pass2", "User 2")
    
    def test_login_success(self):
        register_user("login@example.com", "secret123", "Login User")
        result = login_user("login@example.com", "secret123")
        assert result is not None
        assert result["user"]["email"] == "login@example.com"
        assert "session" in result
        assert "token" in result["session"]
    
    def test_login_wrong_password(self):
        register_user("fail@example.com", "correct", "Fail User")
        result = login_user("fail@example.com", "wrong")
        assert result is None
    
    def test_login_nonexistent_user(self):
        result = login_user("nobody@example.com", "anything")
        assert result is None
    
    def test_get_user_by_email(self):
        register_user("find@example.com", "pass", "Find Me")
        user = get_user_by_email("find@example.com")
        assert user is not None
        assert user["email"] == "find@example.com"


# ═══════════════════════════════════════════════════════════════════
# Sessions
# ═══════════════════════════════════════════════════════════════════

class TestSessions:
    def test_create_and_validate_session(self):
        user = register_user("session@example.com", "pass", "Session User")
        session = create_session(user["id"])
        assert "token" in session
        
        validated = validate_session(session["token"])
        assert validated is not None
        assert validated["user_id"] == user["id"]
    
    def test_validate_invalid_token(self):
        result = validate_session("invalid-token-12345")
        assert result is None
    
    def test_delete_session(self):
        user = register_user("logout@example.com", "pass", "Logout User")
        session = create_session(user["id"])
        
        assert delete_session(session["token"]) is True
        assert validate_session(session["token"]) is None


# ═══════════════════════════════════════════════════════════════════
# Business CRUD
# ═══════════════════════════════════════════════════════════════════

class TestBusinessCRUD:
    def test_create_business(self, sample_profile):
        user = register_user("biz@example.com", "pass", "Biz User")
        biz = create_business(user["id"], "Troty Brownies", sample_profile)
        
        assert biz["name"] == "Troty Brownies"
        assert biz["user_id"] == user["id"]
        assert biz["status"] == "active"
    
    def test_get_business(self, sample_profile):
        user = register_user("get_biz@example.com", "pass", "Get Biz User")
        created = create_business(user["id"], "Test Biz", sample_profile)
        
        fetched = get_business(created["id"])
        assert fetched is not None
        assert fetched["name"] == "Test Biz"
        assert fetched["segment"] == "confeitaria artesanal"
    
    def test_list_user_businesses(self, sample_profile):
        user = register_user("list_biz@example.com", "pass", "List User")
        create_business(user["id"], "Biz 1", sample_profile)
        create_business(user["id"], "Biz 2", sample_profile)
        
        businesses = list_user_businesses(user["id"])
        assert len(businesses) == 2
    
    def test_delete_business_soft(self, sample_profile):
        user = register_user("del_biz@example.com", "pass", "Del User")
        biz = create_business(user["id"], "To Delete", sample_profile)
        
        assert delete_business(biz["id"]) is True
        
        # Soft deleted — not in active list but still retrievable
        businesses = list_user_businesses(user["id"])
        assert len(businesses) == 0
        
        fetched = get_business(biz["id"])
        assert fetched is not None
        assert fetched["status"] == "deleted"
