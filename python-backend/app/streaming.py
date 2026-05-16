import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


class CrewStream:
    def __init__(self) -> None:
        self.queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    def emit(self, event: dict[str, Any]) -> None:
        self.queue.put_nowait(event)

    def step_callback(self, step: Any) -> None:
        self.emit(
            {
                "type": "crew_agent_step",
                "agent": getattr(getattr(step, "agent", None), "role", None) or "agent",
                "thought": str(step)[:4000],
            }
        )

    def task_callback(self, task_output: Any) -> None:
        self.emit(
            {
                "type": "crew_task_complete",
                "taskId": getattr(task_output, "task_id", None) or getattr(task_output, "name", None) or "task",
                "output": str(task_output)[:12000],
            }
        )

    async def finish(self) -> None:
        await self.queue.put(None)

    async def iter_events(self) -> AsyncIterator[str]:
        while True:
            event = await self.queue.get()
            if event is None:
                break
            yield sse(event)
