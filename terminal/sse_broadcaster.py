# terminal/sse_broadcaster.py
import queue
import threading
import json


class MessageAnnouncer:
    def __init__(self):
        self.listeners: list[queue.Queue] = []
        self._lock = threading.Lock()

    def listen(self) -> queue.Queue:
        q = queue.Queue(maxsize=5)
        with self._lock:
            self.listeners.append(q)
        return q

    def unlisten(self, q: queue.Queue) -> None:
        with self._lock:
            try:
                self.listeners.remove(q)
            except ValueError:
                pass

    def announce(self, data: dict) -> None:
        msg = format_sse(json.dumps(data, default=str), event='activeview')
        with self._lock:
            listeners = list(self.listeners)
        for i in reversed(range(len(listeners))):
            try:
                listeners[i].put_nowait(msg)
            except queue.Full:
                # Listener not consuming — treat as dead connection, remove
                self.unlisten(listeners[i])


def format_sse(data: str, event: str | None = None) -> str:
    msg = f'data: {data}\n\n'
    if event is not None:
        msg = f'event: {event}\n{msg}'
    return msg


# Module-level singleton — one instance per process
broadcaster = MessageAnnouncer()
