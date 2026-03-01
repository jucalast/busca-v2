"""
LangGraph Checkpoints Garbage Collector.
Evita que data/checkpoints.db exploda com gigabytes de estados intermediários.
"""

import sqlite3
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path

from app.core import database as db


class CheckpointsGarbageCollector:
    """
    Coletor de lixo para checkpoints do LangGraph.
    Mantém apenas informações essenciais e remove dados intermediários.
    """
    
    def __init__(self, checkpoints_db_path: str = "data/checkpoints.db"):
        self.checkpoints_db_path = checkpoints_db_path
        self.max_age_days = 7  # Manter checkpoints por 7 dias
        self.max_checkpoints_per_project = 10  # Máximo por projeto
        
    def cleanup_old_checkpoints(self, force: bool = False) -> Dict[str, Any]:
        """
        Limpa checkpoints antigos e desnecessários.
        
        Args:
            force: Força limpeza mesmo se recente
        
        Returns:
            Estatísticas da limpeza realizada
        """
        if not os.path.exists(self.checkpoints_db_path):
            return {"status": "no_checkpoints_file", "cleaned": 0, "freed_space_mb": 0}
        
        try:
            conn = sqlite3.connect(self.checkpoints_db_path)
            cursor = conn.cursor()
            
            # Obter tamanho antes da limpeza
            size_before = os.path.getsize(self.checkpoints_db_path)
            
            # Identificar checkpoints para remover
            checkpoints_to_remove = self._identify_checkpoints_to_remove(cursor, force)
            
            # Remover checkpoints identificados
            removed_count = 0
            for checkpoint_id in checkpoints_to_remove:
                self._remove_checkpoint(cursor, checkpoint_id)
                removed_count += 1
            
            # Compactar banco de dados
            cursor.execute("VACUUM")
            conn.commit()
            
            # Calcular espaço liberado
            size_after = os.path.getsize(self.checkpoints_db_path)
            freed_space_mb = (size_before - size_after) / (1024 * 1024)
            
            conn.close()
            
            return {
                "status": "success",
                "cleaned": removed_count,
                "freed_space_mb": freed_space_mb,
                "size_before_mb": size_before / (1024 * 1024),
                "size_after_mb": size_after / (1024 * 1024)
            }
            
        except Exception as e:
            print(f"❌ Checkpoints cleanup failed: {str(e)}", file=sys.stderr)
            return {
                "status": "error",
                "error": str(e),
                "cleaned": 0,
                "freed_space_mb": 0
            }
    
    def _identify_checkpoints_to_remove(self, cursor: sqlite3.Cursor, force: bool) -> List[str]:
        """Identifica checkpoints que podem ser removidos com segurança."""
        
        cutoff_date = datetime.now() - timedelta(days=self.max_age_days)
        
        # Buscar todos checkpoints com metadados
        cursor.execute("""
            SELECT checkpoint_id, checkpoint_ns, checkpoint_ts, config 
            FROM checkpoints 
            ORDER BY checkpoint_ts DESC
        """)
        
        checkpoints = cursor.fetchall()
        checkpoints_to_remove = []
        
        # Agrupar por projeto/business_id
        project_checkpoints = {}
        
        for checkpoint_id, checkpoint_ns, checkpoint_ts, config_json in checkpoints:
            try:
                config = json.loads(config_json) if config_json else {}
                business_id = config.get("business_id", "unknown")
                
                if business_id not in project_checkpoints:
                    project_checkpoints[business_id] = []
                
                project_checkpoints[business_id].append({
                    "id": checkpoint_id,
                    "ts": checkpoint_ts,
                    "ns": checkpoint_ns
                })
                
            except json.JSONDecodeError:
                # Config inválido - pode remover
                checkpoints_to_remove.append(checkpoint_id)
        
        # Identificar checkpoints para remoção
        for business_id, project_cps in project_checkpoints.items():
            # Manter apenas os mais recentes
            if len(project_cps) > self.max_checkpoints_per_project:
                # Remover os mais antigos
                excess_checkpoints = project_cps[self.max_checkpoints_per_project:]
                for cp in excess_checkpoints:
                    checkpoints_to_remove.append(cp["id"])
            
            # Remover checkpoints muito antigos
            if not force:
                for cp in project_cps:
                    cp_date = datetime.fromtimestamp(cp["ts"])
                    if cp_date < cutoff_date:
                        checkpoints_to_remove.append(cp["id"])
        
        return list(set(checkpoints_to_remove))  # Remover duplicatas
    
    def _remove_checkpoint(self, cursor: sqlite3.Cursor, checkpoint_id: str):
        """Remove um checkpoint e seus dados associados."""
        
        # Remover checkpoints principais
        cursor.execute("DELETE FROM checkpoints WHERE checkpoint_id = ?", (checkpoint_id,))
        
        # Remover escritas associadas
        cursor.execute("DELETE FROM checkpoint_writes WHERE checkpoint_id = ?", (checkpoint_id,))
        
        # Remover blobs associados
        cursor.execute("DELETE FROM checkpoint_blobs WHERE checkpoint_id = ?", (checkpoint_id,))
    
    def get_checkpoints_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas atuais dos checkpoints."""
        
        if not os.path.exists(self.checkpoints_db_path):
            return {"status": "no_checkpoints_file"}
        
        try:
            conn = sqlite3.connect(self.checkpoints_db_path)
            cursor = conn.cursor()
            
            # Contar checkpoints
            cursor.execute("SELECT COUNT(*) FROM checkpoints")
            total_checkpoints = cursor.fetchone()[0]
            
            # Tamanho do arquivo
            file_size_mb = os.path.getsize(self.checkpoints_db_path) / (1024 * 1024)
            
            # Checkpoints por projeto
            cursor.execute("""
                SELECT config, COUNT(*) 
                FROM checkpoints 
                WHERE config IS NOT NULL 
                GROUP BY config
                LIMIT 10
            """)
            
            project_stats = []
            for config_json, count in cursor.fetchall():
                try:
                    config = json.loads(config_json)
                    business_id = config.get("business_id", "unknown")
                    project_stats.append({"business_id": business_id, "checkpoints": count})
                except:
                    project_stats.append({"business_id": "unknown", "checkpoints": count})
            
            # Checkpoint mais antigo
            cursor.execute("SELECT MIN(checkpoint_ts) FROM checkpoints")
            oldest_ts = cursor.fetchone()[0]
            oldest_date = datetime.fromtimestamp(oldest_ts) if oldest_ts else None
            
            conn.close()
            
            return {
                "status": "success",
                "total_checkpoints": total_checkpoints,
                "file_size_mb": file_size_mb,
                "oldest_checkpoint": oldest_date.isoformat() if oldest_date else None,
                "projects_count": len(project_stats),
                "top_projects": project_stats[:5],
                "risk_level": self._assess_storage_risk(file_size_mb, total_checkpoints)
            }
            
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def _assess_storage_risk(self, size_mb: float, count: int) -> str:
        """Avalia o risco de armazenamento."""
        
        if size_mb > 1000 or count > 1000:
            return "CRITICAL"
        elif size_mb > 500 or count > 500:
            return "HIGH"
        elif size_mb > 100 or count > 100:
            return "MEDIUM"
        else:
            return "LOW"
    
    def setup_automatic_cleanup(self, schedule_hours: int = 24) -> Dict[str, Any]:
        """
        Configura limpeza automática periódica.
        
        Args:
            schedule_hours: Intervalo em horas para limpeza automática
        
        Returns:
            Status da configuração
        """
        
        # Criar script de limpeza automática
        cleanup_script = f'''#!/usr/bin/env python3
"""
Automatic LangGraph Checkpoints Cleanup
Runs every {schedule_hours} hours
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.infrastructure.checkpoints_garbage_collector import CheckpointsGarbageCollector

def main():
    collector = CheckpointsGarbageCollector()
    result = collector.cleanup_old_checkpoints()
    
    if result["status"] == "success":
        print(f"✅ Cleaned {{result['cleaned']}} checkpoints")
        print(f"✅ Freed {{result['freed_space_mb']:.2f}} MB")
    else:
        print(f"❌ Cleanup failed: {{result.get('error', 'Unknown error')}}")

if __name__ == "__main__":
    main()
'''
        
        script_path = "scripts/auto_cleanup_checkpoints.py"
        os.makedirs("scripts", exist_ok=True)
        
        with open(script_path, "w") as f:
            f.write(cleanup_script)
        
        # Criar configuração de cron (se estiver em Unix)
        cron_config = f"# Auto cleanup LangGraph checkpoints every {schedule_hours} hours\n"
        cron_config += f"0 */{schedule_hours // 1} * * * cd {os.getcwd()} && python scripts/auto_cleanup_checkpoints.py\n"
        
        return {
            "status": "success",
            "script_created": script_path,
            "cron_config": cron_config,
            "schedule_hours": schedule_hours,
            "next_run": "Configured for automatic execution"
        }


# Instância global
checkpoints_gc = CheckpointsGarbageCollector()


def cleanup_checkpoints_safe() -> Dict[str, Any]:
    """Interface segura para limpeza de checkpoints."""
    return checkpoints_gc.cleanup_old_checkpoints()


def get_checkpoints_health() -> Dict[str, Any]:
    """Verifica saúde do sistema de checkpoints."""
    stats = checkpoints_gc.get_checkpoints_stats()
    
    if stats.get("risk_level") == "CRITICAL":
        # Limpeza emergencial
        cleanup_result = checkpoints_gc.cleanup_old_checkpoints(force=True)
        stats["emergency_cleanup"] = cleanup_result
    
    return stats
