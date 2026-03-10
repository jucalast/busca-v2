import sys

with open(r'c:\Users\João Luccas\Desktop\TG-v3\busca-v2\backend\src\app\core\llm_router.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_ds = """        except Exception as e:
            if "Task cancelled" in str(e): raise
            if attempt == max_retries - 1: raise
            time.sleep(1 * (attempt + 1))"""

new_ds = """        except Exception as e:
            err_str = str(e).lower()
            if "insufficient balance" in err_str or "unpaid" in err_str or "402" in err_str:
                print(f"  ⚠️ DeepSeek saldo insuficiente. Pulando...", file=sys.stderr)
                raise Exception("DeepSeek saldo insuficiente")
            if "Task cancelled" in str(e): raise
            if attempt == max_retries - 1: raise
            time.sleep(1 * (attempt + 1))"""

# Replace only in deepseek engine section to avoid breaking others
if old_ds in content:
    content = content.replace(old_ds, new_ds)
    print("DeepSeek fix applied")
else:
    print("DeepSeek fix NOT applied - old string not found")

with open(r'c:\Users\João Luccas\Desktop\TG-v3\busca-v2\backend\src\app\core\llm_router.py', 'w', encoding='utf-8') as f:
    f.write(content)
