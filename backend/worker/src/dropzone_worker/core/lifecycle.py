import signal
import sys
from typing import Callable, List

class WorkerLifecycle:
    def __init__(self):
        self._is_running = True
        self._is_shutting_down = False
        self._shutdown_callbacks: List[Callable[[], None]] = []

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def is_shutting_down(self) -> bool:
        return self._is_shutting_down

    def register_shutdown_callback(self, callback: Callable[[], None]):
        self._shutdown_callbacks.append(callback)

    def trigger_shutdown(self):
        if self._is_shutting_down:
            return
        self._is_shutting_down = True
        self._is_running = False

        for cb in self._shutdown_callbacks:
            try:
                cb()
            except Exception:
                pass

    def setup_signal_handlers(self):
        def _handle_signal(signum, frame):
            self.trigger_shutdown()

        try:
            signal.signal(signal.SIGINT, _handle_signal)
        except Exception:
            pass

        try:
            signal.signal(signal.SIGTERM, _handle_signal)
        except Exception:
            pass

