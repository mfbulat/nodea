import os
import uuid

import psycopg
import pytest

# Тесты идут в отдельной базе, чтобы не трогать данные разработки
BASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://mindmap:mindmap@db:5432/mindmap")
TEST_DB = "mindmap_test"
TEST_URL = BASE_URL.rsplit("/", 1)[0] + "/" + TEST_DB
os.environ["DATABASE_URL"] = TEST_URL
os.environ["VERSION_INTERVAL_SECONDS"] = "0"


def _recreate_db():
    admin = BASE_URL.replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(admin, autocommit=True) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {TEST_DB}")


_recreate_db()

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

command.upgrade(Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini")), "head")

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(c: TestClient, email: str | None = None, password: str = "password123"):
    email = email or f"u{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return email


@pytest.fixture
def user(client):
    return register(client)
