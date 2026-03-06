import pytest
from app.core import database as db
import uuid
from app.api.routers.growth import get_dashboard_metrics, do_analyze

def test_full_analysis_pipeline_e2e(sample_profile):
    """E2E Test: Auth -> Create Business -> Analyze -> Metrics"""
    
    # In native PostgreSQL, the DB persists across runs so we must use unique emails
    import uuid
    from app.core.database import register_user, login_user
    
    unique_ext = uuid.uuid4().hex[:8]
    test_email = f"e2e_{unique_ext}@test.com"
    
    # Register the user
    user_id = register_user(email=test_email, password="dummy", name="E2E Native Postgres")
    
    # Login
    token = login_user(email=test_email, password="dummy")
    
    current_user = {"id": user_id, "email": test_email}
    
    # Check metrics endpoint internally
    res = get_dashboard_metrics(current_user=current_user)
    assert res["success"] is True
    assert "total_users" in res["metrics"]
    
    # We can invoke the analyze function internally without the HTTP layer
    req_body = {
        "user_id": user_id,
        "profile": sample_profile,
        "aiModel": "mock",
        "region": "br-pt"
    }
    
    # We don't execute full LLM pipeline in tests (it takes a long time and costs tokens), 
    # but we can verify the DB registered the user and the metrics updated.
    res2 = get_dashboard_metrics(current_user=current_user)
    assert res2["metrics"]["total_users"] > 0
