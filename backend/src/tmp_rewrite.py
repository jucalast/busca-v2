import re
import sys

filepath = r"c:\Users\João Luccas\Desktop\TG-v3\busca-v2\backend\src\app\core\database.py"

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. We replace ? with %s globally in the file. 
# But wait, there are a few ? in strings like "Traduzir ? para %s" which we will remove manually.
# Let's just replace all '?' with '%s' where they appear as part of SQL queries.
# To be safe globally:
text = text.replace('?', '%s')
text = text.replace('%s", "%s"', '?", "?"') # Revert just in case any logs had it
text = text.replace("if '%s' in query:", "if '?' in query:")

# 2. AUTOINCREMENT -> SERIAL
text = text.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")

# 3. PRAGMA -> information_schema
p1 = "PRAGMA table_info('users')"
r1 = "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'users'"
text = text.replace(p1, r1)

p2 = "PRAGMA table_info('analyses')"
r2 = "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'analyses'"
text = text.replace(p2, r2)

p3 = "PRAGMA table_info('specialist_results')"
r3 = "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'specialist_results'"
text = text.replace(p3, r3)

p4 = "PRAGMA table_info('specialist_submissions')" # if any
r4 = "SELECT column_name as name FROM information_schema.columns WHERE table_name = 'specialist_submissions'"
text = text.replace(p4, r4)

text = re.sub(r"PRAGMA table_info\('(.*?)'\)", r"SELECT column_name as name FROM information_schema.columns WHERE table_name = '\1'", text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print("Replacement complete.")
