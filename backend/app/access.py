import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Map, MapShare, User
from .security import ACCESS_COOKIE, decode_token


def optional_user(token: str | None, db: Session) -> User | None:
    try:
        return decode_token(token, "access", db) if token else None
    except HTTPException:
        return None


def resolve_role(map_id: uuid.UUID, user: User | None, share: str | None, db: Session) -> str | None:
    """owner | edit | view | None"""
    m = db.get(Map, map_id)
    if not m:
        return None
    if user and m.owner_id == user.id:
        return "owner"
    if share:
        s = db.scalar(select(MapShare).where(MapShare.token == share, MapShare.map_id == map_id))
        if s:
            return s.role
    return None


__all__ = ["ACCESS_COOKIE", "optional_user", "resolve_role"]
