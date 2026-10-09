import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str


class MapCreate(BaseModel):
    title: str = Field(default="Новая карта", max_length=500)
    document: dict | None = None


class MapUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    document: dict | None = None
    base_revision: int | None = None


class MapSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class MapOut(MapSummary):
    document: dict
    revision: int


class VersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    created_at: datetime


class VersionOut(VersionSummary):
    document: dict


class TemplateCreate(BaseModel):
    title: str = Field(max_length=500)
    document: dict


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    document: dict
    created_at: datetime
