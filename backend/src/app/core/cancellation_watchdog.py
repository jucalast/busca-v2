"""
Cancellation Watchdog - Monitora status de cancelamento em thread separada
"""

import threading
import time
import sys
from typing import Callable, Optional

class CancellationWatchdog:
    def __init__(self, check_func: Callable[[], bool], interval: float = 0.5):
        self.check_func = check_func
        self.interval = interval
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._cancelled = False
    
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
    
    def _monitor(self):
        """Função que monitora o status de cancelamento"""
        while not self._stop_event.is_set():
            try:
                if self.check_func():
                    self._cancelled = True
                    print(f"  🛑 WATCHDOG: Cancellation detected!", file=sys.stderr)
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

# Exemplo de uso:
# watchdog = CancellationWatchdog(check_cancelled_func, interval=0.5)
# watchdog.start()
# try:
#     # operação longa aqui
#     watchdog.check_or_raise()  # verifica periodicamente
# finally:
#     watchdog.stop()
