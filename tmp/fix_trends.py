import sys

with open(r'c:\Users\João Luccas\Desktop\TG-v3\busca-v2\backend\src\app\services\intelligence\trends\trend_analyzer.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix analyze_demand
old1 = """        if not client:
            result["error"] = "pytrends não disponível"
            return result"""
new1 = """        if not client or not keyword or not keyword.strip():
            if client and (not keyword or not keyword.strip()):
                print(f"  ⚠️ TrendAnalyzer: keyword vazia. Pulando.", file=sys.stderr)
            result["error"] = "pytrends não disponível ou keyword vazia"
            return result"""

# Fix get_rising_queries
old2 = """        if not client:
            result["error"] = "pytrends não disponível"
            return result"""
# (Wait, there are multiple occurrences, so I'll be careful)

# Using replace with count=1 for each specific location if possible, 
# but better to use a more unique anchor.

content = content.replace(
    '        if not client:\n            result["error"] = "pytrends não disponível"\n            return result',
    new1
)

with open(r'c:\Users\João Luccas\Desktop\TG-v3\busca-v2\backend\src\app\services\intelligence\trends\trend_analyzer.py', 'w', encoding='utf-8') as f:
    f.write(content)
