from fastapi import APIRouter

from app.db import acquire

router = APIRouter()


@router.get("/health")
async def health():
    async with acquire() as conn:
        await conn.fetchval("select 1")
    return {"status": "ok"}
