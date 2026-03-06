import re
import os

file_path = r"c:\Users\João Luccas\Desktop\TG-v3\busca-v2\src\app\api\growth\route.ts"

# Verify file exists
if not os.path.exists(file_path):
    print(f"Error: {file_path} not found")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# For standard runOrchestrator(action, payload, timeout)
pattern1 = r"(runOrchestrator\(['\"][a-z-]+['\"],\s*\{[^}]*\}(?:,\s*\d+)?)\)"
replacement1 = r"\1, jwtToken)"
content = re.sub(pattern1, replacement1, content)

# For runOrchestratorStreaming(payload, timeout)
pattern2 = r"(runOrchestratorStreaming\(\s*\{[^}]*\}(?:,\s*\d+)?)\)"
replacement2 = r"\1, jwtToken)"
content = re.sub(pattern2, replacement2, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
    
print("Successfully injected jwtToken into route.ts")
