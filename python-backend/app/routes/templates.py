from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import require_session
from app.db import acquire

router = APIRouter()


class TemplatePayload(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    template: dict[str, Any]


def row_to_template(row) -> dict[str, Any]:
    document = dict(row)
    if isinstance(document.get("template"), str):
        document["template"] = json.loads(document["template"])
    return document


@router.get("/templates")
async def list_templates(request: Request):
    auth = await require_session(request)
    async with acquire() as conn:
        rows = await conn.fetch(
            """
            select id::text, name, description, template, created_at, updated_at
            from crew_templates
            where user_id = $1
            order by updated_at desc
            """,
            auth.user_id,
        )
    return {"documents": [row_to_template(row) for row in rows]}


@router.post("/templates")
async def save_template(payload: TemplatePayload, request: Request):
    auth = await require_session(request)
    async with acquire() as conn:
        if payload.id:
            row = await conn.fetchrow(
                """
                update crew_templates
                set name = $3, description = $4, template = $5::jsonb, updated_at = now()
                where id = $1::uuid and user_id = $2
                returning id::text, name, description, template, created_at, updated_at
                """,
                payload.id,
                auth.user_id,
                payload.name,
                payload.description,
                json.dumps(payload.template),
            )
            if row is None:
                raise HTTPException(status_code=404, detail="Template not found")
        else:
            row = await conn.fetchrow(
                """
                insert into crew_templates (user_id, name, description, template)
                values ($1, $2, $3, $4::jsonb)
                returning id::text, name, description, template, created_at, updated_at
                """,
                auth.user_id,
                payload.name,
                payload.description,
                json.dumps(payload.template),
            )
    return {"document": row_to_template(row)}


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, request: Request):
    auth = await require_session(request)
    async with acquire() as conn:
        result = await conn.execute(
            "delete from crew_templates where id = $1::uuid and user_id = $2",
            template_id,
            auth.user_id,
        )
    return {"ok": result.endswith("1")}
