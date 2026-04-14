"""Azure Queue Storage wrapper for async PDF processing."""
from __future__ import annotations

import json
import os
from typing import Any, Optional

from azure.storage.queue import QueueClient

_queue_client: Optional[QueueClient] = None


def _queue_name() -> str:
    return os.environ.get("AZURE_PDF_PROCESSING_QUEUE_NAME", "pdf-processing")


def _get_client() -> QueueClient:
    global _queue_client
    if _queue_client is None:
        connection_string = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        _queue_client = QueueClient.from_connection_string(
            conn_str=connection_string,
            queue_name=_queue_name(),
        )
        _queue_client.create_queue()
    return _queue_client


def enqueue_pdf_processing_message(message: dict[str, Any]) -> None:
    """Send a JSON message to the processing queue."""
    client = _get_client()
    client.send_message(json.dumps(message, ensure_ascii=True))
