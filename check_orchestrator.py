#!/usr/bin/env python3
"""
Growth Orchestrator - CLI para testar o growth_orchestrator.py original
"""

import subprocess
import sys

# Tentar ver o arquivo completo do git
try:
    result = subprocess.run([
        "git", "show", "e5ebb17:backend/src/search_summarizer/growth_orchestrator.py"
    ], capture_output=True, text=True, cwd="c:\\Users\\João Luccas\\Desktop\\v2tg\\busca-v2")
    
    if result.returncode == 0:
        lines = result.stdout.split('\n')
        # Mostrar primeiras 100 linhas
        for i, line in enumerate(lines[:100]):
            print(f"{i+1:3d}: {line}")
        
        if len(lines) > 100:
            print(f"... ({len(lines)-100} more lines)")
    else:
        print("Erro ao ler arquivo:", result.stderr)
        
except Exception as e:
    print(f"Erro: {e}")
