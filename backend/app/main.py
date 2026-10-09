import logging
from contextlib import asynccontextmanager

import anyio
from fastapi import FastAPI

from .collab import rooms
from .routers import auth, files, maps, shares, templates
from .storage import ensure_bucket


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        ensure_bucket()
    except Exception:
        logging.exception("Не удалось создать bucket в S3")
    async with anyio.create_task_group() as tg:
        await tg.start(rooms.run)
        yield
        tg.cancel_scope.cancel()


app = FastAPI(title="MindMap API", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(maps.router)
app.include_router(files.router)
app.include_router(templates.router)
app.include_router(shares.router)


@app.get("/api/health")
def health():
    return {"ok": True}
