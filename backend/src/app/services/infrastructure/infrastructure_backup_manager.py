"""
Infrastructure Backup Manager.
Protege contra perda de dados em ambientes serverless/efêmeros.
"""

import os
import sys
import json
import shutil
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
import zipfile
import hashlib

from app.core import database as db


class InfrastructureBackupManager:
    """
    Gerenciador de backups automáticos para infraestrutura local.
    Protege SQLite, ChromaDB e LangGraph checkpoints.
    """
    
    def __init__(self, backup_root: str = "backups"):
        self.backup_root = backup_root
        self.max_backups = 30  # Manter 30 dias de backups
        self.compression_level = 6  # Nível de compressão ZIP
        
        # Diretórios críticos para backup
        self.critical_paths = {
            "sqlite": "data/growth_platform.db",
            "chroma": "data/vector_db",
            "checkpoints": "data/checkpoints.db",
            "config": "backend/src/app/config"
        }
        
        # Criar diretório de backups
        os.makedirs(self.backup_root, exist_ok=True)
    
    def create_full_backup(self, backup_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Cria backup completo de toda a infraestrutura crítica.
        
        Args:
            backup_name: Nome customizado para o backup
        
        Returns:
            Resultado do backup com estatísticas
        """
        if backup_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"infrastructure_backup_{timestamp}"
        
        backup_path = os.path.join(self.backup_root, f"{backup_name}.zip")
        
        try:
            # Verificar se todos os caminhos críticos existem
            missing_paths = []
            for name, path in self.critical_paths.items():
                if not os.path.exists(path):
                    missing_paths.append(f"{name}: {path}")
            
            if missing_paths:
                return {
                    "status": "error",
                    "error": f"Missing critical paths: {', '.join(missing_paths)}",
                    "backup_path": backup_path
                }
            
            # Criar backup ZIP
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED, self.compression_level) as zipf:
                backup_stats = {}
                total_size = 0
                
                for name, path in self.critical_paths.items():
                    if os.path.exists(path):
                        # Calcular hash para verificação de integridade
                        file_hash = self._calculate_directory_hash(path) if os.path.isdir(path) else self._calculate_file_hash(path)
                        
                        # Adicionar ao ZIP
                        if os.path.isdir(path):
                            for root, dirs, files in os.walk(path):
                                for file in files:
                                    file_path = os.path.join(root, file)
                                    arcname = os.path.join(name, os.path.relpath(file_path, path))
                                    zipf.write(file_path, arcname)
                                    total_size += os.path.getsize(file_path)
                        else:
                            arcname = os.path.join(name, os.path.basename(path))
                            zipf.write(path, arcname)
                            total_size += os.path.getsize(path)
                        
                        backup_stats[name] = {
                            "path": path,
                            "hash": file_hash,
                            "size_mb": os.path.getsize(path) / (1024 * 1024) if os.path.isfile(path) else 0
                        }
            
            # Verificar integridade do backup
            backup_size = os.path.getsize(backup_path)
            backup_hash = self._calculate_file_hash(backup_path)
            
            # Salvar metadados do backup
            metadata = {
                "backup_name": backup_name,
                "created_at": datetime.now().isoformat(),
                "backup_path": backup_path,
                "backup_size_mb": backup_size / (1024 * 1024),
                "backup_hash": backup_hash,
                "compression_level": self.compression_level,
                "contents": backup_stats,
                "total_original_size_mb": total_size / (1024 * 1024),
                "compression_ratio": total_size / backup_size if backup_size > 0 else 1
            }
            
            metadata_path = backup_path.replace(".zip", "_metadata.json")
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            # Limpar backups antigos
            self._cleanup_old_backups()
            
            return {
                "status": "success",
                "backup_name": backup_name,
                "backup_path": backup_path,
                "backup_size_mb": backup_size / (1024 * 1024),
                "compression_ratio": total_size / backup_size if backup_size > 0 else 1,
                "contents": backup_stats,
                "metadata_path": metadata_path
            }
            
        except Exception as e:
            # Remover backup parcial se falhar
            if os.path.exists(backup_path):
                os.remove(backup_path)
            
            return {
                "status": "error",
                "error": str(e),
                "backup_path": backup_path
            }
    
    def restore_from_backup(self, backup_name: str, verify_integrity: bool = True) -> Dict[str, Any]:
        """
        Restaura infraestrutura a partir de um backup.
        
        Args:
            backup_name: Nome do backup para restaurar
            verify_integrity: Se deve verificar integridade antes de restaurar
        
        Returns:
            Resultado da restauração
        """
        backup_path = os.path.join(self.backup_root, f"{backup_name}.zip")
        metadata_path = backup_path.replace(".zip", "_metadata.json")
        
        if not os.path.exists(backup_path):
            return {
                "status": "error",
                "error": f"Backup file not found: {backup_path}"
            }
        
        try:
            # Carregar metadados
            metadata = {}
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
            
            # Verificar integridade se solicitado
            if verify_integrity and metadata:
                current_hash = self._calculate_file_hash(backup_path)
                expected_hash = metadata.get("backup_hash")
                
                if current_hash != expected_hash:
                    return {
                        "status": "error",
                        "error": "Backup integrity check failed - file may be corrupted"
                    }
            
            # Criar backup atual antes de restaurar (safety net)
            safety_backup = self.create_full_backup(f"pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            
            if safety_backup["status"] != "success":
                return {
                    "status": "error",
                    "error": "Failed to create safety backup before restore"
                }
            
            # Restaurar do ZIP
            restored_paths = []
            
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                for file_info in zipf.infolist():
                    # Reconstruir caminho original
                    original_path = file_info.filename
                    
                    # Pular diretórios, só restaurar arquivos
                    if file_info.is_dir():
                        continue
                    
                    # Determinar caminho de destino
                    if original_path.startswith("sqlite/"):
                        dest_path = self.critical_paths["sqlite"]
                    elif original_path.startswith("chroma/"):
                        dest_path = self.critical_paths["chroma"]
                    elif original_path.startswith("checkpoints/"):
                        dest_path = self.critical_paths["checkpoints"]
                    elif original_path.startswith("config/"):
                        dest_path = self.critical_paths["config"]
                    else:
                        continue  # Pular arquivos desconhecidos
                    
                    # Criar diretório se não existir
                    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                    
                    # Extrair arquivo
                    with zipf.open(file_info) as source:
                        with open(dest_path, 'wb') as target:
                            shutil.copyfileobj(source, target)
                    
                    restored_paths.append(dest_path)
            
            return {
                "status": "success",
                "backup_name": backup_name,
                "restored_paths": restored_paths,
                "safety_backup": safety_backup["backup_name"],
                "restored_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "backup_name": backup_name
            }
    
    def list_available_backups(self) -> List[Dict[str, Any]]:
        """Lista todos os backups disponíveis com metadados."""
        
        backups = []
        
        for file in os.listdir(self.backup_root):
            if file.endswith("_metadata.json"):
                metadata_path = os.path.join(self.backup_root, file)
                backup_path = file.replace("_metadata.json", ".zip")
                
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    
                    # Adicionar informações adicionais
                    metadata["backup_exists"] = os.path.exists(os.path.join(self.backup_root, backup_path))
                    metadata["age_days"] = (datetime.now() - datetime.fromisoformat(metadata["created_at"])).days
                    
                    backups.append(metadata)
                    
                except Exception as e:
                    print(f"⚠️ Failed to load metadata for {file}: {str(e)}", file=sys.stderr)
        
        # Ordenar por data (mais recente primeiro)
        backups.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return backups
    
    def _cleanup_old_backups(self):
        """Remove backups antigos mantendo apenas os mais recentes."""
        
        backups = self.list_available_backups()
        
        if len(backups) <= self.max_backups:
            return
        
        # Remover backups mais antigos
        backups_to_remove = backups[self.max_backups:]
        
        for backup in backups_to_remove:
            backup_path = backup.get("backup_path", "")
            metadata_path = backup_path.replace(".zip", "_metadata.json")
            
            try:
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                if os.path.exists(metadata_path):
                    os.remove(metadata_path)
                    
                print(f"🗑️ Removed old backup: {backup['backup_name']}", file=sys.stderr)
                
            except Exception as e:
                print(f"⚠️ Failed to remove backup {backup['backup_name']}: {str(e)}", file=sys.stderr)
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calcula hash SHA-256 de um arquivo."""
        hash_sha256 = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        
        return hash_sha256.hexdigest()
    
    def _calculate_directory_hash(self, dir_path: str) -> str:
        """Calcula hash combinado de todos os arquivos em um diretório."""
        hash_sha256 = hashlib.sha256()
        
        for root, dirs, files in os.walk(dir_path):
            for file in sorted(files):  # Ordenar para consistência
                file_path = os.path.join(root, file)
                file_hash = self._calculate_file_hash(file_path)
                relative_path = os.path.relpath(file_path, dir_path)
                hash_sha256.update(f"{relative_path}:{file_hash}".encode())
        
        return hash_sha256.hexdigest()
    
    def get_backup_health_status(self) -> Dict[str, Any]:
        """Verifica saúde do sistema de backups."""
        
        backups = self.list_available_backups()
        
        if not backups:
            return {
                "status": "no_backups",
                "recommendation": "Create initial backup immediately",
                "risk_level": "CRITICAL"
            }
        
        latest_backup = backups[0]
        age_days = latest_backup.get("age_days", 0)
        
        # Verificar integridade do backup mais recente
        backup_path = latest_backup.get("backup_path", "")
        backup_exists = latest_backup.get("backup_exists", False)
        
        if not backup_exists:
            return {
                "status": "corrupted",
                "latest_backup": latest_backup["backup_name"],
                "recommendation": "Backup file missing - create new backup",
                "risk_level": "CRITICAL"
            }
        
        # Avaliar risco baseado na idade
        if age_days > 7:
            risk_level = "HIGH"
            recommendation = "Backup is old - create fresh backup"
        elif age_days > 3:
            risk_level = "MEDIUM"
            recommendation = "Consider creating fresh backup"
        else:
            risk_level = "LOW"
            recommendation = "Backups are recent"
        
        return {
            "status": "healthy",
            "total_backups": len(backups),
            "latest_backup": latest_backup["backup_name"],
            "latest_age_days": age_days,
            "latest_size_mb": latest_backup.get("backup_size_mb", 0),
            "risk_level": risk_level,
            "recommendation": recommendation
        }
    
    def setup_automated_backups(self, schedule_hours: int = 24) -> Dict[str, Any]:
        """
        Configura backups automáticos periódicos.
        
        Args:
            schedule_hours: Intervalo em horas para backups automáticos
        
        Returns:
            Status da configuração
        """
        
        # Criar script de backup automático
        backup_script = f'''#!/usr/bin/env python3
"""
Automatic Infrastructure Backup
Runs every {schedule_hours} hours
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.infrastructure.infrastructure_backup_manager import InfrastructureBackupManager

def main():
    backup_manager = InfrastructureBackupManager()
    
    # Verificar saúde atual
    health = backup_manager.get_backup_health_status()
    
    if health["risk_level"] == "CRITICAL":
        print("🚨 Critical backup status - creating immediate backup")
    
    # Criar backup
    result = backup_manager.create_full_backup()
    
    if result["status"] == "success":
        print(f"✅ Backup created: {{result['backup_name']}}")
        print(f"✅ Size: {{result['backup_size_mb']:.2f}} MB")
        print(f"✅ Compression: {{result['compression_ratio']:.2f}}x")
    else:
        print(f"❌ Backup failed: {{result.get('error', 'Unknown error')}}")

if __name__ == "__main__":
    main()
'''
        
        script_path = "scripts/auto_backup_infrastructure.py"
        os.makedirs("scripts", exist_ok=True)
        
        with open(script_path, "w") as f:
            f.write(backup_script)
        
        # Criar configuração de cron
        cron_config = f"# Auto backup infrastructure every {schedule_hours} hours\n"
        cron_config += f"0 */{schedule_hours // 1} * * * cd {os.getcwd()} && python scripts/auto_backup_infrastructure.py\n"
        
        return {
            "status": "success",
            "script_created": script_path,
            "cron_config": cron_config,
            "schedule_hours": schedule_hours,
            "next_run": "Configured for automatic execution"
        }


# Instância global
backup_manager = InfrastructureBackupManager()


def create_emergency_backup() -> Dict[str, Any]:
    """Cria backup de emergência imediato."""
    return backup_manager.create_full_backup(f"emergency_{datetime.now().strftime('%Y%m%d_%H%M%S')}")


def check_infrastructure_health() -> Dict[str, Any]:
    """Verifica saúde completa da infraestrutura."""
    
    # Verificar backups
    backup_health = backup_manager.get_backup_health_status()
    
    # Verificar integridade dos bancos
    health_status = {
        "backup_health": backup_health,
        "database_health": {},
        "overall_risk": "LOW"
    }
    
    # Verificar SQLite
    try:
        sqlite_path = backup_manager.critical_paths["sqlite"]
        if os.path.exists(sqlite_path):
            conn = sqlite3.connect(sqlite_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            conn.close()
            
            health_status["database_health"]["sqlite"] = {
                "status": "healthy",
                "user_count": user_count,
                "size_mb": os.path.getsize(sqlite_path) / (1024 * 1024)
            }
        else:
            health_status["database_health"]["sqlite"] = {
                "status": "missing",
                "risk": "CRITICAL"
            }
            health_status["overall_risk"] = "CRITICAL"
    except Exception as e:
        health_status["database_health"]["sqlite"] = {
            "status": "error",
            "error": str(e),
            "risk": "HIGH"
        }
        if health_status["overall_risk"] != "CRITICAL":
            health_status["overall_risk"] = "HIGH"
    
    # Verificar ChromaDB
    try:
        chroma_path = backup_manager.critical_paths["chroma"]
        if os.path.exists(chroma_path):
            health_status["database_health"]["chroma"] = {
                "status": "healthy",
                "size_mb": sum(os.path.getsize(os.path.join(dirpath, filename)) 
                             for dirpath, dirnames, filenames in os.walk(chroma_path) 
                             for filename in filenames) / (1024 * 1024)
            }
        else:
            health_status["database_health"]["chroma"] = {
                "status": "missing",
                "risk": "MEDIUM"
            }
            if health_status["overall_risk"] == "LOW":
                health_status["overall_risk"] = "MEDIUM"
    except Exception as e:
        health_status["database_health"]["chroma"] = {
            "status": "error",
            "error": str(e),
            "risk": "MEDIUM"
        }
        if health_status["overall_risk"] == "LOW":
            health_status["overall_risk"] = "MEDIUM"
    
    return health_status
