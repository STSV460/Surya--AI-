from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_db, init_db
from app.routes import health, replay, run, templates, test, train


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="Surya Crew Service", version="0.1.0", lifespan=lifespan)
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_base_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(run.router, prefix="/api/crew")
app.include_router(templates.router, prefix="/api/crew")
app.include_router(train.router, prefix="/api/crew")
app.include_router(test.router, prefix="/api/crew")
app.include_router(replay.router, prefix="/api/crew")
