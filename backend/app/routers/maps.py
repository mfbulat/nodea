import copy
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..document import empty_document
from ..models import Map, MapVersion, MapVisit, User
from ..schemas import (MapCreate, MapOut, MapSummary, MapUpdate, SharedMapOut, VersionOut,
                       VersionSummary)
from ..collab import rooms
from ..security import current_user

router = APIRouter(prefix="/api/maps", tags=["maps"])


def _own_map(map_id: uuid.UUID, user: User, db: Session) -> Map:
    m = db.get(Map, map_id)
    if not m or m.owner_id != user.id:
        raise HTTPException(404, "Карта не найдена")
    return m


def _snapshot(m: Map, db: Session) -> None:
    db.add(MapVersion(map_id=m.id, title=m.title, document=copy.deepcopy(m.document)))


def save_document(m: Map, document: dict, db: Session) -> None:
    """Новая ревизия документа + автоснимок истории не чаще version_interval_seconds."""
    m.document = document
    m.revision += 1
    last = db.scalar(select(MapVersion.created_at).where(MapVersion.map_id == m.id)
                     .order_by(MapVersion.created_at.desc()).limit(1))
    now = datetime.now(timezone.utc)
    if last is None or (now - last).total_seconds() >= settings.version_interval_seconds:
        _snapshot(m, db)


@router.get("", response_model=list[MapSummary])
def list_maps(view: str = "recent", user: User = Depends(current_user), db: Session = Depends(get_db)):
    """view: recent | all | starred | trash"""
    q = select(Map).where(Map.owner_id == user.id)
    if view == "trash":
        q = q.where(Map.deleted_at.is_not(None)).order_by(Map.deleted_at.desc())
    else:
        q = q.where(Map.deleted_at.is_(None))
        if view == "starred":
            q = q.where(Map.starred.is_(True))
        if view == "all":
            q = q.order_by(Map.title)
        else:
            if view == "recent":
                q = q.where(Map.hidden_from_recent.is_(False))
            q = q.order_by(func.coalesce(Map.last_opened_at, Map.updated_at).desc())
    return db.scalars(q).all()


@router.get("/shared/with-me", response_model=list[SharedMapOut])
def shared_with_me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.execute(select(MapVisit, Map, User).join(Map, Map.id == MapVisit.map_id).join(User, User.id == Map.owner_id)
                      .where(MapVisit.user_id == user.id, Map.deleted_at.is_(None)).order_by(MapVisit.visited_at.desc())).all()
    return [SharedMapOut(id=m.id, title=m.title, updated_at=m.updated_at, visited_at=v.visited_at, share_token=v.share_token,
                         owner_email=o.email) for v, m, o in rows]


@router.post("/{map_id}/trash", response_model=MapSummary)
def trash_map(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = _own_map(map_id, user, db)
    m.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return m


@router.post("/{map_id}/restore", response_model=MapSummary)
def restore_map(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = _own_map(map_id, user, db)
    m.deleted_at = None
    db.commit()
    return m


@router.post("", response_model=MapOut)
def create_map(data: MapCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = Map(owner_id=user.id, title=data.title, document=data.document or empty_document(data.title))
    db.add(m)
    db.flush()
    _snapshot(m, db)
    db.commit()
    return m


@router.get("/{map_id}", response_model=MapOut)
def get_map(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _own_map(map_id, user, db)


@router.post("/{map_id}/opened")
def mark_opened(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = _own_map(map_id, user, db)
    m.last_opened_at = datetime.now(timezone.utc)
    m.hidden_from_recent = False
    db.commit()
    return {"ok": True}


@router.post("/{map_id}/remove-recent")
def remove_from_recent(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """«Убрать из недавних»: карта остаётся во «Всех картах», вернётся в недавние при следующем открытии"""
    m = _own_map(map_id, user, db)
    m.hidden_from_recent = True
    db.commit()
    return {"ok": True}


@router.patch("/{map_id}", response_model=MapOut)
def update_map(map_id: uuid.UUID, data: MapUpdate, user: User = Depends(current_user),
               db: Session = Depends(get_db)):
    m = _own_map(map_id, user, db)
    if data.base_revision is not None and data.base_revision != m.revision:
        raise HTTPException(409, "Карта изменена в другом окне")
    if data.title is not None:
        m.title = data.title
    if data.starred is not None:
        m.starred = data.starred
    if data.document is not None:
        save_document(m, data.document, db)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{map_id}")
def delete_map(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own_map(map_id, user, db))
    db.commit()
    return {"ok": True}


@router.post("/{map_id}/duplicate", response_model=MapOut)
def duplicate_map(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    src = _own_map(map_id, user, db)
    m = Map(owner_id=user.id, title=f"{src.title} (копия)", document=copy.deepcopy(src.document))
    db.add(m)
    db.flush()
    _snapshot(m, db)
    db.commit()
    return m


@router.get("/{map_id}/versions", response_model=list[VersionSummary])
def list_versions(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _own_map(map_id, user, db)
    return db.scalars(select(MapVersion).where(MapVersion.map_id == map_id)
                      .order_by(MapVersion.created_at.desc())).all()


@router.post("/{map_id}/versions", response_model=VersionSummary)
def save_version(map_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = _own_map(map_id, user, db)
    v = MapVersion(map_id=m.id, title=m.title, document=copy.deepcopy(m.document))
    db.add(v)
    db.commit()
    return v


@router.get("/{map_id}/versions/{version_id}", response_model=VersionOut)
def get_version(map_id: uuid.UUID, version_id: uuid.UUID, user: User = Depends(current_user),
                db: Session = Depends(get_db)):
    _own_map(map_id, user, db)
    v = db.get(MapVersion, version_id)
    if not v or v.map_id != map_id:
        raise HTTPException(404, "Версия не найдена")
    return v


@router.post("/{map_id}/versions/{version_id}/restore", response_model=MapOut)
async def restore_version(map_id: uuid.UUID, version_id: uuid.UUID, user: User = Depends(current_user),
                    db: Session = Depends(get_db)):
    m = _own_map(map_id, user, db)
    v = db.get(MapVersion, version_id)
    if not v or v.map_id != map_id:
        raise HTTPException(404, "Версия не найдена")
    _snapshot(m, db)  # сохраняем текущее состояние перед откатом
    m.document = copy.deepcopy(v.document)
    m.title = v.title
    m.revision += 1
    db.commit()
    db.refresh(m)
    await rooms.reset(m.id, m.document)
    return m
