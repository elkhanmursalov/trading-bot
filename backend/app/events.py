"""Push messages to the connected stream listeners."""

import asyncio


class Subscriber:
    """One connected stream. A newer message of the same event replaces an older unread one."""

    def __init__(self) -> None:
        self._pending: dict[str, str] = {}
        self._wake = asyncio.Event()

    def put(self, event: str, data: str) -> None:
        """Store a message and wake the stream."""
        self._pending[event] = data
        self._wake.set()

    async def next_batch(self, timeout: float) -> dict[str, str]:
        """Unread messages by event name. Waits up to `timeout` seconds; raises TimeoutError if none arrive."""
        await asyncio.wait_for(self._wake.wait(), timeout)
        self._wake.clear()
        batch, self._pending = self._pending, {}
        return batch


class EventHub:
    """Sends every published message to all connected listeners."""

    def __init__(self) -> None:
        self._subscribers: set[Subscriber] = set()

    @property
    def has_subscribers(self) -> bool:
        return bool(self._subscribers)

    def subscribe(self) -> Subscriber:
        subscriber = Subscriber()
        self._subscribers.add(subscriber)
        return subscriber

    def unsubscribe(self, subscriber: Subscriber) -> None:
        self._subscribers.discard(subscriber)

    def publish(self, event: str, data: str) -> None:
        """Send `data` (JSON text) as `event` to every listener."""
        for subscriber in self._subscribers:
            subscriber.put(event, data)
