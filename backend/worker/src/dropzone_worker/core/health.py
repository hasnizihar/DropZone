import os
import sys
import time
from typing import Dict, Any

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

from .. import __version__, PROTOCOL_VERSION

class WorkerHealthMonitor:
    def __init__(self):
        self.start_time = time.time()
        self.requests_count = 0
        self.errors_count = 0
        self.last_heartbeat_time: float = self.start_time

    def record_request(self):
        self.requests_count += 1

    def record_error(self):
        self.errors_count += 1

    def record_heartbeat(self):
        self.last_heartbeat_time = time.time()

    def get_uptime_seconds(self) -> float:
        return round(time.time() - self.start_time, 2)

    def get_memory_bytes(self) -> int:
        if HAS_PSUTIL:
            try:
                proc = psutil.Process(os.getpid())
                return proc.memory_info().rss
            except Exception:
                pass
        return 0

    def get_status_payload(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "pid": os.getpid(),
            "workerVersion": __version__,
            "protocolVersion": PROTOCOL_VERSION,
            "pythonVersion": sys.version.split()[0],
            "uptimeSeconds": self.get_uptime_seconds(),
            "memoryBytes": self.get_memory_bytes(),
            "requestsProcessed": self.requests_count,
            "errorsCount": self.errors_count,
            "capabilities": ["ping", "hello", "get_status", "shutdown"],
        }
