from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.auth import require_session
from app.db import acquire

router = APIRouter()


class ReplayRequest(BaseModel):
    runId: str | None = None
    taskId: str | None = None


@router.post("/replay")
async def replay(payload: ReplayRequest, request: Request):
    auth = await require_session(request)
    async with acquire() as conn:
        rows = await conn.fetch(
            """
            select id::text, run_id::text, crew_name, task_id, agent, event_type, payload, created_at
            from crew_task_logs
            where user_id = $1
              and ($2::uuid is null or run_id = $2::uuid)
              and ($3::text is null or task_id = $3)
            order by created_at asc
            limit 500
            """,
            auth.user_id,
            payload.runId,
            payload.taskId,
        )
    return {"events": [dict(row) for row in rows]}
