from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.auth import require_session
from app.crews import BUILDERS
from app.db import acquire

router = APIRouter()


class TestRequest(BaseModel):
    crewName: str
    iterations: int = Field(default=1, ge=1, le=10)
    eval_llm: str | None = None
    inputs: dict[str, Any] = Field(default_factory=dict)


@router.post("/test")
async def test_crew(payload: TestRequest, request: Request):
    auth = await require_session(request)
    builder = BUILDERS[payload.crewName]
    async with acquire() as conn:
        row = await conn.fetchrow(
            """
            insert into crew_training_runs (user_id, crew_name, kind, status, inputs)
            values ($1, $2, 'test', 'running', $3::jsonb)
            returning id::text
            """,
            auth.user_id,
            payload.crewName,
            json.dumps(payload.model_dump()),
        )
    run_id = row["id"]
    try:
        crew = builder(payload.inputs, auth.cookie)
        result = await asyncio.to_thread(crew.test, n_iterations=payload.iterations, eval_llm=payload.eval_llm)
        status = "completed"
        body = {"result": str(result)}
    except Exception as exc:
        status = "failed"
        body = {"error": str(exc)}
    async with acquire() as conn:
        await conn.execute(
            """
            update crew_training_runs
            set status = $2, result = $3::jsonb, completed_at = now()
            where id = $1::uuid
            """,
            run_id,
            status,
            json.dumps(body),
        )
    return {"id": run_id, "status": status, **body}
