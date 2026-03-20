"""
Cancellation Watchdog - Monitora status de cancelamento em thread separada
Versão melhorada com Redis para cancelamento quase instantâneo
"""

import threading
import time
import sys
import os
from typing import Callable, Optional

class CancellationWatchdog:
    def __init__(self, check_func: Callable[[], bool], interval: float = 0.1, task_id: str = None):
        self.check_func = check_func
        self.interval = interval
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._cancelled = False
        self.task_id = task_id
        
        # Redis para cancelamento instantâneo
        self.redis_key = f"cancel:{task_id}" if task_id else None
        self._redis = None
        
        if self.redis_key:
            try:
                import redis
                self._redis = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
                # Inicializa como não cancelado
                self._redis.setex(self.redis_key, 3600, "false")  # 1 hora TTL
                print(f"  🔄 Redis cancellation key: {self.redis_key}", file=sys.stderr)
            except Exception as e:
                print(f"  ⚠️ Redis não disponível para cancelamento: {e}", file=sys.stderr)
    
    def start(self):
        """Inicia o watchdog em uma thread separada"""
        self._stop_event.clear()
        self._cancelled = False
        self._thread = threading.Thread(target=self._monitor, daemon=True)
        self._thread.start()
    
    def stop(self):
        """Para o watchdog"""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=1.0)
        
        # Limpa chave Redis
        if self._redis and self.redis_key:
            try:
                self._redis.delete(self.redis_key)
            except:
                pass
    
    def _monitor(self):
        """Função que monitora o status de cancelamento"""
        while not self._stop_event.is_set():
            try:
                cancelled = False
                
                # Verificação Redis (prioridade - instantânea)
                if self._redis and self.redis_key:
                    try:
                        status = self._redis.get(self.redis_key)
                        if status == b"true":
                            cancelled = True
                            print(f"  🛑 REDIS CANCELLATION DETECTED for {self.task_id}!", file=sys.stderr)
                    except:
                        pass
                
                # Verificação original (fallback)
                if not cancelled and self.check_func():
                    cancelled = True
                    print(f"  🛑 DB CANCELLATION DETECTED!", file=sys.stderr)
                
                if cancelled:
                    self._cancelled = True
                    break
                    
            except Exception as e:
                print(f"  🛑 WATCHDOG: Error checking cancellation: {e}", file=sys.stderr)
                break
            
            time.sleep(self.interval)
    
    def is_cancelled(self) -> bool:
        """Verifica se o cancelamento foi detectado"""
        return self._cancelled
    
    def check_or_raise(self):
        """Levanta exceção se cancelamento foi detectado"""
        if self.is_cancelled():
            raise Exception("Task cancelled by user (watchdog)")
    
    @classmethod
    def cancel_task(cls, task_id: str) -> bool:
        """Cancela uma tarefa via Redis (chamado pelo frontend)"""
        try:
            import redis
            redis_client = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
            redis_key = f"cancel:{task_id}"
            redis_client.setex(redis_key, 3600, "true")  # 1 hora TTL
            print(f"  🚫 Task {task_id} marked for cancellation via Redis", file=sys.stderr)
            return True
        except Exception as e:
            print(f"  ⚠️ Failed to cancel task via Redis: {e}", file=sys.stderr)
            return False

    @classmethod
    def clear_task(cls, task_id: str) -> bool:
        """Limpa o status de cancelamento de uma tarefa no Redis"""
        try:
            import redis
            import os
            redis_client = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
            redis_key = f"cancel:{task_id}"
            redis_client.delete(redis_key)
            import sys
            print(f"  🧹 Task {task_id} cancellation status cleared from Redis", file=sys.stderr)
            return True
        except Exception as e:
            import sys
            print(f"  ⚠️ Failed to clear status via Redis: {e}", file=sys.stderr)
            return False

# Exemplo de uso:
# watchdog = CancellationWatchdog(check_cancelled_func, interval=0.1, task_id="task_123")
# watchdog.start()
# try:
#     # operação longa aqui
#     watchdog.check_or_raise()  # verifica periodicamente
# finally:
#     watchdog.stop()
