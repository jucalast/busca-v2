import os
import sys

# Add src to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env')
print(f"Loading env from {env_path}")
load_dotenv(env_path)

print("DATABASE_URL:", os.environ.get("DATABASE_URL"))

from app.core.database import init_db

print("Attempting to run init_db() against the database...")
try:
    init_db()
    print("SUCCESS: PostgreSQL initialized properly without syntax errors.")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
