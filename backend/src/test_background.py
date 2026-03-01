import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1/growth"

# Replace with actual IDs if needed, but for testing we can use placeholders
payload = {
    "analysis_id": "test-analysis-123",
    "pillar_key": "publico_alvo",
    "task_id": "test-task-abc",
    "task_data": {
        "id": "test-task-abc",
        "titulo": "Teste de Execução em Background",
        "entregavel_ia": "Documento de Teste"
    },
    "profile": {
        "dna": {"segmento": "Educação"},
        "perfil": {"nome": "Escola de Teste"}
    }
}

print("Starting background execution...")
res = requests.post(f"{BASE_URL}/execute-all-subtasks", json=payload)
print(f"Status Code: {res.status_code}")
print(f"Response: {res.json()}")

if res.status_code == 200:
    print("\nPolling status...")
    for _ in range(10):
        status_res = requests.post(f"{BASE_URL}/poll-background-status", json={
            "analysis_id": "test-analysis-123",
            "task_id": "test-task-abc"
        })
        print(f"Polling update: {status_res.json()}")
        if status_res.json().get("progress", {}).get("status") == "done":
            print("Finished!")
            break
        time.sleep(3)
