import requests
import time
import sys

def verify_api():
    url = "http://localhost:3000/api/search"
    # Enable Groq for this test
    payload = {"query": "inteligencia artificial", "noGroq": False}
    
    print(f"Testing API at {url} with Groq...")
    
    max_retries = 5
    for i in range(max_retries):
        try:
            start_time = time.time()
            response = requests.post(url, json=payload, timeout=60) # Increased timeout for AI
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                if "structured" in data and "sources" in data:
                    print(f"✅ API Verification Successful in {elapsed:.2f}s!")
                    
                    # Check if we got a real summary or mock
                    summary = data.get("structured", {})
                    if "aviso" in summary and "Groq" in summary["aviso"]:
                         print("⚠️ Warning: Received mock response (Groq might be disabled or key invalid)")
                    else:
                         print("✨ Success: Received AI generated summary!")
                         
                    return True
                else:
                    print(f"❌ API returned unexpected structure: {data.keys()}")
                    return False
            else:
                print(f"⚠️ API returned status {response.status_code}: {response.text}")
        except requests.exceptions.ReadTimeout:
             print(f"⏳ Timeout waiting for AI response... ({i+1}/{max_retries})")
        except requests.exceptions.ConnectionError:
            print(f"⏳ Waiting for server... ({i+1}/{max_retries})")
            time.sleep(2)
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
            
    print("❌ Failed to connect to server after retries.")
    return False

if __name__ == "__main__":
    if verify_api():
        sys.exit(0)
    else:
        sys.exit(1)
