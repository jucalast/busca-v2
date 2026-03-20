
import sys
import os

# Adiciona o backend/src ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core import database as db

def clear_cache(analysis_id, pillar_key):
    conn = db.get_connection()
    cursor = conn.cursor()
    try:
        # 1. Limpa o cache de pesquisa (unified_research)
        cursor.execute("DELETE FROM specialist_research_cache WHERE cache_key LIKE %s", (f"%{pillar_key}%",))
        print(f"Limpando caches de pesquisa para {pillar_key}...")

        # 2. Limpa o plano já gerado para forçar a regeneração pelo LLM
        cursor.execute("DELETE FROM specialist_plans WHERE analysis_id = %s AND pillar_key = %s", (analysis_id, pillar_key))
        print(f"Limpando plano gerado de {pillar_key} para a análise {analysis_id}...")

        conn.commit()
        print("✅ Cache limpo com sucesso! Pode clicar em 'Refazer' no pilar.")
    except Exception as e:
        print(f"❌ Erro ao limpar cache: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    analysis_id = "805aaf06-9c53-455f-b59f-2f175cc0ff33"
    pillar_key = "publico_alvo"
    clear_cache(analysis_id, pillar_key)
