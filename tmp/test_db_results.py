
import psycopg2
import psycopg2.extras
import json
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

def check_task_status(analysis_id, task_id):
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    print(f"--- Checking Status for {task_id} in {analysis_id} ---")
    
    # Check background_tasks
    cursor.execute("SELECT * FROM background_tasks WHERE analysis_id = %s AND task_id = %s", (analysis_id, task_id))
    row = cursor.fetchone()
    if row:
        print(f"Background Task: status={row['status']}, step={row['current_step']}/{row['total_steps']}")
    else:
        print("No background task found.")
        
    # Check specialist_executions (subtasks)
    cursor.execute("SELECT task_id, status, result_data FROM specialist_executions WHERE analysis_id = %s AND (task_id LIKE %s OR task_id = %s)", 
                   (analysis_id, f"{task_id}_st%", task_id))
    rows = cursor.fetchall()
    print(f"Found {len(rows)} execution records.")
    for r in rows:
        data = json.loads(r['result_data']) if r['result_data'] else {}
        print(f"  ID: {r['task_id']} | Status: {r['status']} | HasOpiniao: {bool(data.get('opiniao'))} | Tools: {len(data.get('intelligence_tools_used', []))}")
        if data.get('opiniao'):
            print(f"    Opiniao: {data['opiniao'][:100]}...")

    conn.close()

if __name__ == "__main__":
    # The user didn't give me IDs, but I can find the last analysis
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM analyses ORDER BY created_at DESC LIMIT 1")
    res = cursor.fetchone()
    if res:
        aid = res[0]
        cursor.execute("SELECT task_id FROM background_tasks WHERE analysis_id = %s ORDER BY created_at DESC LIMIT 1", (aid,))
        res2 = cursor.fetchone()
        if res2:
            tid = res2[0]
            check_task_status(aid, tid)
        else:
            print("No background tasks found for latest analysis.")
    else:
        print("No analyses found.")
    conn.close()
