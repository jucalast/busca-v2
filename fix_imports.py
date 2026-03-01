#!/usr/bin/env python3
"""
Corrige todos os erros de importação encontrados no build
"""

import re
from pathlib import Path

def fix_import_errors():
    """Corrige os erros de importação específicos encontrados"""
    
    base_path = Path("c:/Users/João Luccas/Desktop/v2tg/busca-v2/src")
    
    # Mapeamento correto dos imports quebrados
    import_fixes = {
        # No pillar-workspace/index.tsx - imports relativos incorretos
        "from '../ModelSelector'": "from '@/features/shared/components/model-selector'",
        "from '../TaskCard'": "from '@/features/workspace/components/task-card'",
        "from '../TaskActionButtons'": "from '@/features/workspace/components/task-action-buttons'",
        "from '../TaskSubtasksDisplay'": "from '@/features/workspace/components/task-subtasks-display'",
        "from '../RateLimitWarning'": "from '@/features/shared/components/rate-limit-warning'",
        
        # No sidebar.tsx - imports incorretos
        "from '../contexts/AuthContext'": "from '@/contexts/AuthContext'",
        "from './ConfirmDialog'": "from '@/features/shared/components/confirm-dialog'",
        "from './ModelSelector'": "from '@/features/shared/components/model-selector'",
        
        # No growth-chat.tsx - import incorreto
        "from '../contexts/AuthContext'": "from '@/contexts/AuthContext'",
        
        # Outros imports que podem estar quebrados
        "from '@/components/ModelSelector'": "from '@/features/shared/components/model-selector'",
        "from '@/components/RateLimitWarning'": "from '@/features/shared/components/rate-limit-warning'",
        "from '@/components/ConfirmDialog'": "from '@/features/shared/components/confirm-dialog'",
        "from '@/components/ParticleLoader'": "from '@/features/shared/components/particle-loader'",
        "from '@/components/GrowthChat'": "from '@/features/shared/components/growth-chat'",
        "from '@/components/GrowthHub'": "from '@/features/shared/components/growth-hub'",
        "from '@/components/PillarPlan'": "from '@/features/analysis/components/pillar-plan'",
        "from '@/components/DimensionDetail'": "from '@/features/analysis/components/dimension-detail'",
        "from '@/components/BusinessMindMap'": "from '@/features/analysis/components/business-mind-map'",
        "from '@/components/PillarWorkspace'": "from '@/features/workspace/components/pillar-workspace'",
        "from '@/components/TaskActionButtons'": "from '@/features/workspace/components/task-action-buttons'",
        "from '@/components/TaskAssistant'": "from '@/features/workspace/components/task-assistant'",
        "from '@/components/TaskDetail'": "from '@/features/workspace/components/task-detail'",
        "from '@/components/TaskSubtasksDisplay'": "from '@/features/workspace/components/task-subtasks-display'",
        "from '@/components/TaskCard'": "from '@/features/workspace/components/task-card'",
        "from '@/components/SidebarLayout'": "from '@/components/layout/sidebar'",
        "from '@/components/AuthForm'": "from '@/features/auth/components/auth-form'",
    }
    
    print("🔧 Corrigindo erros de importação...")
    
    fixed_files = 0
    
    # Arquivos específicos que precisam de correção
    files_to_fix = [
        "features/workspace/components/pillar-workspace/index.tsx",
        "components/layout/sidebar.tsx", 
        "features/shared/components/growth-chat.tsx",
        "app/analysis/[businessId]/ClientWrapper.tsx",
        "app/page.tsx",
        "app/page-old.tsx",
        "app/analysis/[businessId]/layout.tsx",
        "app/login/page.tsx",
        "app/layout.tsx",
    ]
    
    for file_path in files_to_fix:
        full_path = base_path / file_path
        if full_path.exists():
            try:
                content = full_path.read_text(encoding='utf-8')
                original_content = content
                
                # Aplicar correções
                for old_import, new_import in import_fixes.items():
                    patterns = [
                        rf"from\s+['\"]{re.escape(old_import)}['\"]",
                        rf"import\s+.*\s+from\s+['\"]{re.escape(old_import)}['\"]",
                    ]
                    
                    for pattern_regex in patterns:
                        content = re.sub(pattern_regex, f"from '{new_import}'", content)
                
                # Se houve mudanças, salvar
                if content != original_content:
                    full_path.write_text(content, encoding='utf-8')
                    print(f"  ✅ Corrigido: {file_path}")
                    fixed_files += 1
                    
            except Exception as e:
                print(f"  ❌ Erro em {file_path}: {e}")
    
    # Buscar e corrigir outros arquivos que possam ter imports quebrados
    for file_path in base_path.glob("**/*.tsx"):
        if file_path.is_file() and str(file_path) not in [str(base_path / f) for f in files_to_fix]:
            try:
                content = file_path.read_text(encoding='utf-8')
                original_content = content
                
                for old_import, new_import in import_fixes.items():
                    patterns = [
                        rf"from\s+['\"]{re.escape(old_import)}['\"]",
                        rf"import\s+.*\s+from\s+['\"]{re.escape(old_import)}['\"]",
                    ]
                    
                    for pattern_regex in patterns:
                        content = re.sub(pattern_regex, f"from '{new_import}'", content)
                
                if content != original_content:
                    file_path.write_text(content, encoding='utf-8')
                    print(f"  ✅ Corrigido: {file_path.relative_to(base_path)}")
                    fixed_files += 1
                    
            except Exception as e:
                continue  # Ignorar erros em arquivos que não são essenciais
    
    print(f"\n📊 Resultado: {fixed_files} arquivos corrigidos")

if __name__ == "__main__":
    print("🔧 Correção de erros de importação")
    print("=" * 40)
    fix_import_errors()
    print("\n✅ Importações corrigidas!")
