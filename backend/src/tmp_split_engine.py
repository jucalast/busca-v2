import ast
import os

SOURCE_FILE = r'c:\Users\João Luccas\Desktop\TG-v3\busca-v2\backend\src\app\services\agents\engine_specialist.py'
TARGET_DIR = r'c:\Users\João Luccas\Desktop\TG-v3\busca-v2\backend\src\app\services\agents\engine'

MAPPING = {
    'context_builder.py': [
        'get_dynamic_persona_context',
        'get_adapted_specialist_persona',
        'generate_business_brief',
        '_detect_supply_chain_context',
        'brief_to_text',
        'build_cross_pillar_context',
        'build_execution_context'
    ],
    'plan_generator.py': [
        'generate_pillar_plan'
    ],
    'state_manager.py': [
        'record_action_result',
        'get_pillar_full_state',
        'get_all_pillars_state'
    ],
    'dependency_manager.py': [
        'check_pillar_dependencies'
    ],
    'market_researcher.py': [
        '_should_search_for_task',
        '_build_smart_search_query',
        '_extract_market_for_pillar'
    ],
    'task_generator.py': [
        'generate_specialist_tasks',
        '_fallback_to_original_generation',
        '_classify_task_executability'
    ],
    'task_executor.py': [
        '_format_previous_results',
        'agent_execute_task',
        'expand_task_subtasks',
        'ai_try_user_task'
    ]
}

def get_ast_node_source(node, lines):
    start_line = node.lineno - 1
    if hasattr(node, "decorator_list") and node.decorator_list:
        start_line = node.decorator_list[0].lineno - 1
    end_line = node.end_lineno
    return "\n".join(lines[start_line:end_line])

def split():
    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
        
    tree = ast.parse(content)
    
    # Imports include the header docs and the main base imports
    imports_block = "\n".join(lines[0:48]) 
    imports_block += "\n\nfrom typing import Dict, List, Any, Optional\n"
    imports_block += "from app.core.prompt_loader import get_engine_prompt\n"
    imports_block += "from app.services.intelligence.unified_research import unified_research\n"
    imports_block += "import copy, concurrent.futures\n"
    
    output = {filename: imports_block for filename in MAPPING.keys()}
    
    output['context_builder.py'] += "\n\n_SUPPLY_CHAIN_CACHE: dict = {}\n"
    output['dependency_manager.py'] += "\n\nDEPENDENCY_THRESHOLDS = {\n    'critical': 25,\n    'warning': 45,\n}\n"
    
    found_funcs = 0
    total_expected = sum(len(v) for v in MAPPING.values())
    
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            func_name = node.name
            target_file = None
            for fname, func_list in MAPPING.items():
                if func_name in func_list:
                    target_file = fname
                    break
            
            if target_file:
                source = get_ast_node_source(node, lines)
                output[target_file] += "\n\n" + source + "\n"
                found_funcs += 1
                
    init_content = ""
    for filename, funcs in MAPPING.items():
        module_name = filename.replace('.py', '')
        init_content += f"from .{module_name} import ({', '.join(funcs)})\n"
        
    os.makedirs(TARGET_DIR, exist_ok=True)
    for filename, text in output.items():
        with open(os.path.join(TARGET_DIR, filename), 'w', encoding='utf-8') as f:
            f.write(text)
            
    with open(os.path.join(TARGET_DIR, '__init__.py'), 'w', encoding='utf-8') as f:
        f.write(init_content)
        
    print(f"Files created successfully. Extracted {found_funcs}/{total_expected} functions.")

if __name__ == "__main__":
    split()
