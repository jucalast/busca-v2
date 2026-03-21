import json
import os
import sys
from typing import Any, Dict, Optional
import redis

class TaskEventBus:
    """
    Barramento de eventos baseado em Redis Pub/Sub para comunicação 
    em tempo real entre Workers Celery e Frontend via SSE.
    """
    def __init__(self):
        self.redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self._redis = None
        try:
            self._redis = redis.from_url(self.redis_url)
        except Exception as e:
            print(f"  ⚠️ TaskEventBus: Erro ao conectar ao Redis: {e}", file=sys.stderr)

    def publish(self, channel_id: str, event_type: str, data: Any, source_task_id: str = None):
        """
        Publica um evento para uma tarefa específica.
        Canais: task_updates:{channel_id}
        """
        if not self._redis or not channel_id:
            return

        channel = f"task_updates:{channel_id}"
        event = {
            "type": event_type,
            "data": data,
            "task_id": source_task_id or channel_id
        }
        
        try:
            self._redis.publish(channel, json.dumps(event, ensure_ascii=False))
        except Exception as e:
            print(f"  ⚠️ TaskEventBus: Erro ao publicar no canal {channel}: {e}", file=sys.stderr)

    def publish_thought(self, channel_id: str, text: str, source_task_id: str = None):
        """Atalho para publicar pensamentos da IA (opiniao)."""
        self.publish(channel_id, "thought", {"text": text}, source_task_id)

    def publish_tool(self, channel_id: str, tool_name: str, status: str, details: str = "", source_task_id: str = None):
        """Atalho para publicar uso de ferramentas."""
        self.publish(channel_id, "tool", {
            "tool": tool_name,
            "status": status,
            "details": details
        }, source_task_id)

    def publish_source(self, channel_id: str, source: Dict[str, Any], source_task_id: str = None):
        """Atalho para publicar fontes encontradas."""
        self.publish(channel_id, "source", {"source": source}, source_task_id)

# Instância global para reuso
event_bus = TaskEventBus()
