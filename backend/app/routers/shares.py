import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..access import optional_user, resolve_role
from ..collab import rooms
from ..db import SessionLocal, get_db
from ..models import Map, MapShare, User
from ..schemas import MapOut
from ..security import ACCESS_COOKIE, current_user

router = APIRouter(tags=["shares"])


class ShareIn(BaseModel):
    role: str  # view | edit


class ShareOut(BaseModel):
    id: uuid.UUID
    token: str
    role: str


def _own(map_id: uuid.UUID, user: User, db: Session) -> Map:
    m = db.get(Map, map_id)
    if not m or m.owner_id != user.id:
        raise HTTPException(404, "Карта не найдена")
    return m


@router.get("/api/maps/{map_id}/shares", response_model=list[ShareOut])
def list_shares(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _own(map_id, user, db)
    return db.scalars(select(MapShare).where(MapShare.map_id == map_id).order_by(MapShare.created_at)).all()


@router.post("/api/maps/{map_id}/shares", response_model=ShareOut)
def create_share(map_id: uuid.UUID, data: ShareIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if data.role not in ("view", "edit"):
        raise HTTPException(422, "role: view или edit")
    _own(map_id, user, db)
    s = MapShare(map_id=map_id, token=secrets.token_urlsafe(24), role=data.role)
    db.add(s)
    db.commit()
    return s


@router.delete("/api/maps/{map_id}/shares/{share_id}")
def delete_share(map_id: uuid.UUID, share_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _own(map_id, user, db)
    s = db.get(MapShare, share_id)
    if not s or s.map_id != map_id:
        raise HTTPException(404, "Ссылка не найдена")
    db.delete(s)
    db.commit()
    return {"ok": True}


class SharedOut(BaseModel):
    map: MapOut
    role: str


@router.get("/api/shared/{token}", response_model=SharedOut)
def open_shared(token: str, request: Request, db: Session = Depends(get_db)):
    s = db.scalar(select(MapShare).where(MapShare.token == token))
    if not s:
        raise HTTPException(404, "Ссылка недействительна или отозвана")
    user = optional_user(request.cookies.get(ACCESS_COOKIE), db)
    m = db.get(Map, s.map_id)
    role = "owner" if user and m.owner_id == user.id else s.role
    return {"map": m, "role": role}


@router.websocket("/api/collab/{map_id}")
async def collab(websocket: WebSocket, map_id: uuid.UUID):
    share = websocket.query_params.get("share")
    with SessionLocal() as db:
        user = optional_user(websocket.cookies.get(ACCESS_COOKIE), db)
        role = resolve_role(map_id, user, share, db)
    if role is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await websocket.accept()
    await rooms.serve(map_id, websocket, readonly=role == "view")
