import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .routers import auth, files, maps, templates
from .storage import ensure_bucket


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        ensure_bucket()
    except Exception:
        logging.exception("Не удалось создать bucket в S3")
    yield


app = FastAPI(title="MindMap API", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(maps.router)
app.include_router(files.router)
app.include_router(templates.router)


@app.get("/api/health")
def health():
    return {"ok": True}
