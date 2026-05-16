from __future__ import annotations

import json
from typing import Any

from app.db import acquire


class SupabaseRAGStorage:
    def __init__(self, user_id: str, crew_name: str) -> None:
        self.user_id = user_id
        self.crew_name = crew_name

    async def save(self, content: str, metadata: dict[str, Any] | None = None, embedding: list[float] | None = None) -> None:
        async with acquire() as conn:
            await conn.execute(
                """
                insert into crew_memory_short (user_id, crew_name, content, metadata, embedding)
                values ($1, $2, $3, $4::jsonb, $5::vector)
                """,
                self.user_id,
                self.crew_name,
                content,
                json.dumps(metadata or {}),
                embedding,
            )

    async def search(self, limit: int = 10) -> list[dict[str, Any]]:
        async with acquire() as conn:
            rows = await conn.fetch(
                """
                select id, content, metadata, created_at
                from crew_memory_short
                where user_id = $1 and crew_name = $2
                order by created_at desc
                limit $3
                """,
                self.user_id,
                self.crew_name,
                limit,
            )
        return [dict(row) for row in rows]


class SupabaseLTMStorage:
    def __init__(self, user_id: str, crew_name: str) -> None:
        self.user_id = user_id
        self.crew_name = crew_name

    async def save(self, summary: str, task_name: str | None = None, metadata: dict[str, Any] | None = None) -> None:
        async with acquire() as conn:
            await conn.execute(
                """
                insert into crew_memory_long (user_id, crew_name, task_name, summary, metadata)
                values ($1, $2, $3, $4, $5::jsonb)
                """,
                self.user_id,
                self.crew_name,
                task_name,
                summary,
                json.dumps(metadata or {}),
            )

    async def recent(self, limit: int = 10) -> list[dict[str, Any]]:
        async with acquire() as conn:
            rows = await conn.fetch(
                """
                select id, task_name, summary, metadata, updated_at
                from crew_memory_long
                where user_id = $1 and crew_name = $2
                order by updated_at desc
                limit $3
                """,
                self.user_id,
                self.crew_name,
                limit,
            )
        return [dict(row) for row in rows]


class SupabaseEntityStorage:
    def __init__(self, user_id: str) -> None:
        self.user_id = user_id

    async def save(
        self,
        entity_name: str,
        content: str,
        metadata: dict[str, Any] | None = None,
        embedding: list[float] | None = None,
    ) -> None:
        async with acquire() as conn:
            await conn.execute(
                """
                insert into crew_memory_entity (user_id, entity_name, content, metadata, embedding)
                values ($1, $2, $3, $4::jsonb, $5::vector)
                """,
                self.user_id,
                entity_name,
                content,
                json.dumps(metadata or {}),
                embedding,
            )

    async def search(self, entity_name: str | None = None, limit: int = 10) -> list[dict[str, Any]]:
        async with acquire() as conn:
            rows = await conn.fetch(
                """
                select id, entity_name, content, metadata, updated_at
                from crew_memory_entity
                where user_id = $1 and ($2::text is null or entity_name = $2)
                order by updated_at desc
                limit $3
                """,
                self.user_id,
                entity_name,
                limit,
            )
        return [dict(row) for row in rows]
