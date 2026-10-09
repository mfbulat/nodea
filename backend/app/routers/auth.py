from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import Credentials, LoginIn, PasswordChange, UserOut
from ..security import (REFRESH_COOKIE, clear_auth_cookies, current_user, decode_token,
                        hash_password, set_auth_cookies, verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(data: Credentials, response: Response, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Пользователь с такой почтой уже существует")
    user = User(email=email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    set_auth_cookies(response, user)
    return user


@router.post("/login", response_model=UserOut)
def login(data: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(user.password_hash, data.password):
        raise HTTPException(401, "Неверная почта или пароль")
    set_auth_cookies(response, user)
    return user


@router.post("/refresh", response_model=UserOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    user = decode_token(request.cookies.get(REFRESH_COOKIE), "refresh", db)
    set_auth_cookies(response, user)
    return user


@router.post("/logout")
def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/change-password")
def change_password(data: PasswordChange, response: Response,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(user.password_hash, data.current_password):
        raise HTTPException(400, "Текущий пароль неверен")
    user.password_hash = hash_password(data.new_password)
    user.token_version += 1  # инвалидирует остальные сессии
    db.commit()
    set_auth_cookies(response, user)
    return {"ok": True}
