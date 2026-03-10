from app.services.agents.agent_conversation import chat_consultant
import json

def test_full_chat_flow():
    user_message = "15.318.271/0002-48"
    messages = [
        {"role": "assistant", "content": "Olá! Sou seu estrategista de negócios. Para começarmos sua análise de forma automática, poderia me informar o CNPJ da sua empresa?"},
        {"role": "user", "content": user_message}
    ]
    extracted_profile = {}
    
    print(f"User Message: {user_message}")
    
    gen = chat_consultant(messages, user_message, extracted_profile)
    
    reply = ""
    final_profile = {}
    
    for event in gen:
        if event['type'] == 'content':
            reply += event['text']
        elif event['type'] == 'result':
            final_profile = event['data']['extracted_profile']
            print("\nFINAL PROFILE DATA:")
            print(json.dumps(final_profile, indent=2, ensure_ascii=False))
            print(f"\nREADY FOR ANALYSIS: {event['data']['ready_for_analysis']}")
            print(f"FIELDS MISSING: {event['data']['fields_missing']}")

    print(f"\nASSISTANT REPLY:\n{reply}")

if __name__ == "__main__":
    test_full_chat_flow()
