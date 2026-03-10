from app.services.agents.agent_conversation import _extract_business_info, _compute_missing_fields
import json

def test_cnpj_extraction():
    cnpj = "15.318.271/0002-48"
    current_profile = {}
    
    def mock_yield(event):
        print(f"EVENT: {event}")
        
    updated_profile = _extract_business_info(cnpj, current_profile, yield_callback=mock_yield)
    print("\nUPDATED PROFILE:")
    print(json.dumps(updated_profile, indent=2, ensure_ascii=False))
    
    missing_critical, missing_bonus, bonus_count, all_missing, group_status = _compute_missing_fields(updated_profile)
    print("\nMISSING CRITICAL:")
    print(missing_critical)

if __name__ == "__main__":
    test_cnpj_extraction()
