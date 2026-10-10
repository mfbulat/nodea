from fastapi.testclient import TestClient

from app.main import app

from .conftest import register


def test_star_trash_restore_and_views(client, user):
    a = client.post("/api/maps", json={"title": "Альфа"}).json()
    b = client.post("/api/maps", json={"title": "Бета"}).json()
    client.patch(f"/api/maps/{a['id']}", json={"starred": True})
    assert [m["id"] for m in client.get("/api/maps?view=starred").json()] == [a["id"]]
    client.post(f"/api/maps/{b['id']}/opened")
    assert client.get("/api/maps?view=recent").json()[0]["id"] == b["id"]
    client.post(f"/api/maps/{b['id']}/trash")
    assert [m["id"] for m in client.get("/api/maps").json()] == [a["id"]]
    assert [m["id"] for m in client.get("/api/maps?view=trash").json()] == [b["id"]]
    client.post(f"/api/maps/{b['id']}/restore")
    assert {m["title"] for m in client.get("/api/maps?view=all").json()} == {"Альфа", "Бета"}


def test_shared_with_me(client, user):
    m = client.post("/api/maps", json={"title": "Общая"}).json()
    s = client.post(f"/api/maps/{m['id']}/shares", json={"role": "view"}).json()
    other = TestClient(app)
    register(other)
    assert other.get("/api/maps/shared/with-me").json() == []
    other.get(f"/api/shared/{s['token']}")
    got = other.get("/api/maps/shared/with-me").json()
    assert [g["title"] for g in got] == ["Общая"] and got[0]["share_token"] == s["token"]


def test_remove_from_recent(client, user):
    a = client.post("/api/maps", json={"title": "Альфа"}).json()
    client.post(f"/api/maps/{a['id']}/remove-recent")
    assert client.get("/api/maps?view=recent").json() == []
    assert [m["id"] for m in client.get("/api/maps?view=all").json()] == [a["id"]]
    client.post(f"/api/maps/{a['id']}/opened")
    assert [m["id"] for m in client.get("/api/maps?view=recent").json()] == [a["id"]]
