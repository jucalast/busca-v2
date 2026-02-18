"""
Teste rápido - Verifica apenas se a API está respondendo
Use este para validações rápidas sem consumir muitos tokens
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:3000"
API_ENDPOINT = f"{BASE_URL}/api/growth"

def test_health():
    """Testa se o servidor está respondendo"""
    print("🏥 Testando saúde do servidor...")
    try:
        response = requests.get(BASE_URL, timeout=5)
        print(f"✅ Servidor respondendo - Status: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Servidor não responde: {str(e)}")
        return False

def test_chat_init():
    """Testa inicialização do chat"""
    print("\n💬 Testando inicialização do chat...")
    
    payload = {
        "action": "chat",
        "messages": [],
        "user_message": "",
        "extracted_profile": {}
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Chat inicializado")
            print(f"   Resposta: {data.get('reply', '')[:100]}...")
            return True, data
        else:
            print(f"❌ Erro: {response.status_code}")
            return False, {}
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return False, {}

def test_chat_message():
    """Testa envio de mensagem única"""
    print("\n📨 Testando envio de mensagem...")
    
    payload = {
        "action": "chat",
        "messages": [
            {"role": "assistant", "content": "Olá! Como posso ajudar?"}
        ],
        "user_message": "Tenho uma cafeteria em São Paulo",
        "extracted_profile": {}
    }
    
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=60)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Mensagem processada")
            print(f"   Resposta: {data.get('reply', '')[:100]}...")
            print(f"   Campos coletados: {len(data.get('fields_collected', []))}")
            print(f"   Busca realizada: {data.get('search_performed', False)}")
            return True, data
        else:
            print(f"❌ Erro: {response.status_code}")
            return False, {}
    except Exception as e:
        print(f"❌ Erro: {str(e)}")
        return False, {}

def main():
    print("="*60)
    print("  🧪 TESTE RÁPIDO - VALIDAÇÃO BÁSICA")
    print("="*60)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Endpoint: {API_ENDPOINT}\n")
    
    results = []
    
    # Teste 1: Servidor
    results.append(test_health())
    
    # Teste 2: Init
    success, _ = test_chat_init()
    results.append(success)
    
    # Teste 3: Mensagem
    success, _ = test_chat_message()
    results.append(success)
    
    # Resultado final
    print("\n" + "="*60)
    total = len(results)
    passed = sum(results)
    print(f"📊 RESULTADO: {passed}/{total} testes passaram")
    
    if passed == total:
        print("✅ Todos os testes passaram!")
    else:
        print("⚠️  Alguns testes falharam - verifique os logs acima")
    
    print("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⚠️  Teste interrompido")
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")
