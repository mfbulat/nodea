import logging

from fastapi import FastAPI

from .routers import auth, files, maps
from .storage import ensure_bucket

app = FastAPI(title="MindMap API")
app.include_router(auth.router)
app.include_router(maps.router)
app.include_router(files.router)


@app.on_event("startup")
def startup() -> None:
    try:
        ensure_bucket()
    except Exception:
        logging.exception("Не удалось создать bucket в S3")


@app.get("/api/health")
def health():
    return {"ok": True}
