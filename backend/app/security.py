import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

ph = PasswordHasher()
ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(hashed: str, password: str) -> bool:
    try:
        return ph.verify(hashed, password)
    except VerifyMismatchError:
        return False


def _encode(user: User, kind: str, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "typ": kind, "ver": user.token_version, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def set_auth_cookies(response: Response, user: User) -> None:
    access_ttl = timedelta(minutes=settings.access_ttl_minutes)
    refresh_ttl = timedelta(days=settings.refresh_ttl_days)
    common = dict(httponly=True, secure=settings.cookie_secure, samesite="lax")
    response.set_cookie(ACCESS_COOKIE, _encode(user, "access", access_ttl),
                        max_age=int(access_ttl.total_seconds()), path="/", **common)
    response.set_cookie(REFRESH_COOKIE, _encode(user, "refresh", refresh_ttl),
                        max_age=int(refresh_ttl.total_seconds()), path="/api/auth", **common)


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


def decode_token(token: str | None, kind: str, db: Session) -> User:
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    if payload.get("typ") != kind:
        raise HTTPException(401, "Invalid token")
    user = db.get(User, uuid.UUID(payload["sub"]))
    if not user or user.token_version != payload.get("ver"):
        raise HTTPException(401, "Session expired")
    return user


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    return decode_token(request.cookies.get(ACCESS_COOKIE), "access", db)
