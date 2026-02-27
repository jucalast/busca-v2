import json
import sqlite3
from pathlib import Path

DB_PATH = Path(r"c:\Users\JoãoLuccasFerreiraMo\Desktop\TG_v2\busca\data\growth_platform.db")

if not DB_PATH.exists():
    raise SystemExit(f"Database not found: {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
tables = [row[0] for row in cursor.fetchall()]

summary = {}
for table in tables:
    cursor.execute(f"PRAGMA table_info('{table}')")
    columns = [
        {
            "name": col[1],
            "type": col[2],
            "not_null": bool(col[3]),
            "default": col[4],
            "primary_key": bool(col[5]),
        }
        for col in cursor.fetchall()
    ]

    cursor.execute(f"SELECT COUNT(*) as total FROM '{table}'")
    row_count = cursor.fetchone()["total"]

    summary[table] = {
        "row_count": row_count,
        "columns": columns,
    }

conn.close()

output = {
    "database": str(DB_PATH),
    "table_count": len(tables),
    "tables": summary,
}

print(json.dumps(output, ensure_ascii=False, indent=2))
