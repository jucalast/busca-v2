import os
import sys

# Add backend/src to path
sys.path.append(os.path.join(os.getcwd(), "backend", "src"))

from app.core.llm_router import call_llm
import unittest
from unittest.mock import patch, MagicMock

class TestLLMTiering(unittest.TestCase):
    @patch('app.services.intelligence.usage_tracker.usage_tracker.can_make_request')
    @patch('app.core.llm_router._call_groq_engine')
    @patch('app.core.llm_router.call_gemini')
    @patch('app.core.llm_cache.get_cached_response')
    def test_tier1_routing(self, mock_cache, mock_gemini, mock_groq, mock_usage):
        """Tier 1: Small prompt (< 12k) should use prefer_small=True on Groq"""
        mock_cache.return_value = None
        mock_usage.return_value = (True, "")
        mock_groq.return_value = ("ok", 100, "llama-3.1-8b-instant")
        
        prompt = "Hello" * 100 # ~500 chars
        call_llm("groq", prompt, prefer_small=True)
        
        # Check if _call_groq_engine was called with prefer_small=True
        # Signature: (api_key, prompt, temperature, max_retries, json_mode, messages, prefer_small, ...)
        # prefer_small is the 7th positional argument (index 6)
        args, kwargs = mock_groq.call_args
        self.assertTrue(args[6])

    @patch('app.services.intelligence.usage_tracker.usage_tracker.can_make_request')
    @patch('app.core.llm_router._call_groq_engine')
    @patch('app.core.llm_router.call_gemini')
    @patch('app.core.llm_cache.get_cached_response')
    def test_tier2_routing(self, mock_cache, mock_gemini, mock_groq, mock_usage):
        """Tier 2: Medium prompt (> 12k) should force prefer_small=False on Groq"""
        mock_cache.return_value = None
        mock_usage.return_value = (True, "")
        mock_groq.return_value = ("ok", 100, "llama-3.3-70b-versatile")
        
        prompt = "Hello" * 3000 # ~15000 chars
        call_llm("groq", prompt, prefer_small=True) # Even if user asks for small
        
        # Check if _call_groq_engine was called with prefer_small=False
        args, kwargs = mock_groq.call_args
        self.assertFalse(args[6])

    @patch('app.services.intelligence.usage_tracker.usage_tracker.can_make_request')
    @patch('app.core.llm_router._call_groq_engine')
    @patch('app.core.llm_router.call_gemini')
    @patch('app.core.llm_cache.get_cached_response')
    def test_tier3_routing(self, mock_cache, mock_gemini, mock_groq, mock_usage):
        """Tier 3: Large prompt (> 40k) should force Gemini"""
        mock_cache.return_value = None
        mock_usage.return_value = (True, "")
        mock_gemini.return_value = ("ok", 100, "gemini-1.5-flash")
        
        prompt = "Hello" * 10000 # ~50000 chars
        call_llm("groq", prompt)
        
        # Should call gemini instead of groq
        mock_gemini.assert_called_once()
        mock_groq.assert_not_called()

if __name__ == "__main__":
    os.environ["GROQ_API_KEY"] = "fake"
    os.environ["GOOGLE_AI_API_KEY"] = "fake"
    unittest.main()
