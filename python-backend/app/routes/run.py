from __future__ import annotations

import asyncio
import json
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.auth import require_session
from app.crews import BUILDERS
from app.db import acquire
from app.memory import SupabaseEntityStorage, SupabaseLTMStorage, SupabaseRAGStorage
from app.streaming import CrewStream, sse

router = APIRouter()


class CrewRunRequest(BaseModel):
    crewName: Literal["research", "email", "content", "code", "planner", "custom"]
    inputs: dict[str, Any] = Field(default_factory=dict)
    templateId: str | None = None


async def load_template(user_id: str, template_id: str | None) -> dict[str, Any] | None:
    async with acquire() as conn:
        if template_id:
            row = await conn.fetchrow(
                "select template from crew_templates where id = $1::uuid and user_id = $2",
                template_id,
                user_id,
            )
        else:
            row = await conn.fetchrow(
                """
                select template from crew_templates
                where user_id = $1
                order by updated_at desc
                limit 1
                """,
                user_id,
            )
    if not row:
        return None
    value = row["template"]
    return json.loads(value) if isinstance(value, str) else dict(value)


async def log_event(user_id: str, crew_name: str, event: dict[str, Any], run_id: str | None = None) -> None:
    async with acquire() as conn:
        await conn.execute(
            """
            insert into crew_task_logs (user_id, run_id, crew_name, task_id, agent, event_type, payload)
            values ($1, $2::uuid, $3, $4, $5, $6, $7::jsonb)
            """,
            user_id,
            run_id,
            crew_name,
            event.get("taskId"),
            event.get("agent"),
            event["type"],
            json.dumps(event),
        )


@router.post("/run")
async def run_crew(payload: CrewRunRequest, request: Request):
    auth = await require_session(request)
    builder = BUILDERS.get(payload.crewName)
    if builder is None:
        raise HTTPException(status_code=404, detail="Unknown crew")

    template = await load_template(auth.user_id, payload.templateId) if payload.crewName == "custom" else None
    if payload.crewName == "custom" and template is None:
        raise HTTPException(status_code=400, detail="Custom crew requires a saved template")

    stream = CrewStream()
    short_memory = SupabaseRAGStorage(auth.user_id, payload.crewName)
    long_memory = SupabaseLTMStorage(auth.user_id, payload.crewName)
    entity_memory = SupabaseEntityStorage(auth.user_id)

    async def producer() -> None:
        agents: list[dict[str, str]] = []
        try:
            crew = builder(
                payload.inputs,
                auth.cookie,
                **({"template": template} if payload.crewName == "custom" else {}),
                step_callback=stream.step_callback,
                task_callback=stream.task_callback,
            )
            agents = [{"role": getattr(agent, "role", "Agent")} for agent in getattr(crew, "agents", [])]
            start_event = {"type": "crew_start", "crewName": payload.crewName, "agents": agents}
            stream.emit(start_event)
            await log_event(auth.user_id, payload.crewName, start_event)
            result = await asyncio.to_thread(crew.kickoff, inputs=payload.inputs)
            final_output = str(result)
            complete_event = {"type": "crew_complete", "finalOutput": final_output}
            stream.emit(complete_event)
            await log_event(auth.user_id, payload.crewName, complete_event)
            await long_memory.save(final_output[:12000], task_name="crew_complete", metadata={"inputs": payload.inputs})
            await short_memory.save(final_output[:4000], metadata={"crewName": payload.crewName})
            await entity_memory.save(payload.crewName, final_output[:4000], metadata={"kind": "crew_output"})
        except Exception as exc:
            stream.emit({"type": "error", "error": str(exc), "crewName": payload.crewName, "agents": agents})
        finally:
            await stream.finish()

    async def events():
        task = asyncio.create_task(producer())
        try:
            async for chunk in stream.iter_events():
                yield chunk
        finally:
            await task

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
