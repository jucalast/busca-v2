"""
Teste simples para verificar extração e ready_for_analysis
"""
import requests
import json

BASE_URL = "http://localhost:3000"
API_ENDPOINT = f"{BASE_URL}/api/growth"

messages = []
extracted_profile = {}

def send_message(user_msg):
    global messages, extracted_profile
    
    payload = {
        "action": "chat",
        "messages": messages,
        "user_message": user_msg,
        "extracted_profile": extracted_profile
    }
    
    response = requests.post(API_ENDPOINT, json=payload, timeout=60)
    data = response.json()
    
    # Update state
    if data.get("reply"):
        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": data["reply"]})
    
    extracted_profile = data.get("extracted_profile", extracted_profile)
    
    print(f"\n💬 User: {user_msg}")
    print(f"🤖 Reply: {data.get('reply', '')}")
    print(f"📊 Perfil: {json.dumps(extracted_profile, ensure_ascii=False, indent=2)}")
    print(f"✅ Ready: {data.get('ready_for_analysis', False)}")
    print(f"📋 Coletados: {data.get('fields_collected', [])}")
    print(f"❌ Faltando: {data.get('fields_missing', [])}")
    
    return data

print("="*80)
print("  TESTE SIMPLIFICADO - CHAT ONBOARDING")
print("="*80)

# Init
send_message("")

# Msg 1
send_message("Olá! Tenho uma cafeteria em São Paulo chamada Café Aroma")

# Msg 2
send_message("É um negócio físico, trabalho sozinho há 2 anos. Meu principal desafio é atrair mais clientes")

# Msg 3
send_message("Meu objetivo é aumentar o faturamento em 30% nos próximos 6 meses")

print("\n" + "="*80)
print("  FIM DO TESTE")
print("="*80)
