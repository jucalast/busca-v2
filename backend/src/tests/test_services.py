"""
Tests for service utilities — validation, pillar config, LLM cache.
"""
import pytest
import sys
from pathlib import Path

# Ensure app is importable
sys.path.insert(0, str(Path(__file__).parent.parent))


# ═══════════════════════════════════════════════════════════════════
# Pillar Config Tests
# ═══════════════════════════════════════════════════════════════════

class TestPillarConfig:
    def test_all_models_have_7_pillars(self):
        from app.services.agents.pillar_config import _SPECIALISTS_BY_MODEL
        
        for model_key in ("b2b", "b2c", "servico"):
            pillars = _SPECIALISTS_BY_MODEL[model_key]
            assert len(pillars) == 7, f"Model {model_key} has {len(pillars)} pillars, expected 7"
    
    def test_each_pillar_has_required_fields(self):
        from app.services.agents.pillar_config import _SPECIALISTS_BY_MODEL
        
        required_fields = {"cargo", "persona", "kpis", "escopo", "entregaveis_obrigatorios", "nao_fazer"}
        
        for model_key, pillars in _SPECIALISTS_BY_MODEL.items():
            for pillar_key, spec in pillars.items():
                missing = required_fields - set(spec.keys())
                assert not missing, f"{model_key}/{pillar_key} missing: {missing}"
    
    def test_detect_b2b(self):
        from app.services.agents.pillar_config import _detect_business_model
        assert _detect_business_model({"perfil": {"modelo_negocio": "B2B"}}) == "b2b"
    
    def test_detect_b2c(self):
        from app.services.agents.pillar_config import _detect_business_model
        assert _detect_business_model({"perfil": {"modelo_negocio": "B2C"}}) == "b2c"
    
    def test_detect_servico(self):
        from app.services.agents.pillar_config import _detect_business_model
        assert _detect_business_model({"perfil": {"segmento": "consultoria de TI"}}) == "servico"
    
    def test_detect_default_is_b2c(self):
        from app.services.agents.pillar_config import _detect_business_model
        assert _detect_business_model({"perfil": {}}) == "b2c"
    
    def test_get_specialist_returns_correct_model(self):
        from app.services.agents.pillar_config import get_specialist
        b2b_spec = get_specialist("publico_alvo", {"perfil": {"modelo_negocio": "B2B"}})
        assert "B2B" in b2b_spec["cargo"]
        
        b2c_spec = get_specialist("publico_alvo", {"perfil": {"modelo_negocio": "B2C"}})
        assert "Consumidor" in b2c_spec["cargo"]


# ═══════════════════════════════════════════════════════════════════
# Validation Tests
# ═══════════════════════════════════════════════════════════════════

class TestValidation:
    def test_validate_pillar_key_valid(self):
        from app.services.common import validate_pillar_key
        assert validate_pillar_key("publico_alvo") is True
        assert validate_pillar_key("branding") is True
        assert validate_pillar_key("processo_vendas") is True
    
    def test_validate_pillar_key_invalid(self):
        from app.services.common import validate_pillar_key
        assert validate_pillar_key("invalid_pillar") is False
        assert validate_pillar_key("") is False
    
    def test_validate_score_valid(self):
        from app.services.common import validate_score
        assert validate_score(50) is True
        assert validate_score(0) is True
        assert validate_score(100) is True
        assert validate_score("75.5") is True
    
    def test_validate_score_invalid(self):
        from app.services.common import validate_score
        assert validate_score(-1) is False
        assert validate_score(101) is False
        assert validate_score("abc") is False


# ═══════════════════════════════════════════════════════════════════
# LLM Cache Tests
# ═══════════════════════════════════════════════════════════════════

class TestLLMCache:
    def test_cache_miss_returns_none(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.core.llm_cache._CACHE_DIR", tmp_path)
        monkeypatch.setattr("app.core.llm_cache._CACHE_DB", tmp_path / "test_cache.db")
        
        from app.core.llm_cache import get_cached_response
        result = get_cached_response("some prompt", 0.3, True, "groq")
        assert result is None
    
    def test_cache_set_and_get(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.core.llm_cache._CACHE_DIR", tmp_path)
        monkeypatch.setattr("app.core.llm_cache._CACHE_DB", tmp_path / "test_cache.db")
        
        from app.core.llm_cache import get_cached_response, set_cached_response
        
        test_response = {"key": "value", "score": 42}
        set_cached_response("test prompt", test_response, 0.3, True, "groq")
        
        cached = get_cached_response("test prompt", 0.3, True, "groq")
        assert cached is not None
        assert cached["key"] == "value"
        assert cached["score"] == 42
    
    def test_cache_different_params_different_keys(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.core.llm_cache._CACHE_DIR", tmp_path)
        monkeypatch.setattr("app.core.llm_cache._CACHE_DB", tmp_path / "test_cache.db")
        
        from app.core.llm_cache import get_cached_response, set_cached_response
        
        set_cached_response("prompt A", {"a": 1}, 0.3, True, "groq")
        set_cached_response("prompt B", {"b": 2}, 0.3, True, "groq")
        
        assert get_cached_response("prompt A", 0.3, True, "groq")["a"] == 1
        assert get_cached_response("prompt B", 0.3, True, "groq")["b"] == 2
    
    def test_cache_expired(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.core.llm_cache._CACHE_DIR", tmp_path)
        monkeypatch.setattr("app.core.llm_cache._CACHE_DB", tmp_path / "test_cache.db")
        
        from app.core.llm_cache import get_cached_response, set_cached_response
        
        # Set with 0-second TTL (immediately expired)
        set_cached_response("expire me", {"expired": True}, 0.3, True, "groq", ttl_seconds=0)
        
        result = get_cached_response("expire me", 0.3, True, "groq", ttl_seconds=0)
        assert result is None
    
    def test_cache_stats(self, tmp_path, monkeypatch):
        monkeypatch.setattr("app.core.llm_cache._CACHE_DIR", tmp_path)
        monkeypatch.setattr("app.core.llm_cache._CACHE_DB", tmp_path / "test_cache.db")
        
        from app.core.llm_cache import set_cached_response, get_cache_stats
        
        set_cached_response("stat test", {"test": True}, 0.3, True, "groq")
        
        stats = get_cache_stats()
        assert stats["total_entries"] >= 1
