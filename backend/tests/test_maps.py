from fastapi.testclient import TestClient

from app.main import app

from .conftest import register


def doc(title="T"):
    return {"version": 1, "sheets": [{"id": "s", "title": "Лист", "rootTopic": {"id": "r", "title": title, "children": []}}]}


def test_crud_duplicate(client, user):
    m = client.post("/api/maps", json={"title": "Карта"}).json()
    assert m["document"]["sheets"][0]["rootTopic"]["title"] == "Карта"
    r = client.patch(f"/api/maps/{m['id']}", json={"title": "Новое"})
    assert r.json()["title"] == "Новое"
    d = client.post(f"/api/maps/{m['id']}/duplicate").json()
    assert d["title"] == "Новое (копия)" and d["id"] != m["id"]
    assert {x["id"] for x in client.get("/api/maps").json()} == {m["id"], d["id"]}
    assert client.delete(f"/api/maps/{m['id']}").status_code == 200
    assert client.get(f"/api/maps/{m['id']}").status_code == 404


def test_autosave_revision_conflict(client, user):
    m = client.post("/api/maps", json={"title": "К", "document": doc()}).json()
    r = client.patch(f"/api/maps/{m['id']}", json={"document": doc("A"), "base_revision": m["revision"]})
    assert r.status_code == 200 and r.json()["revision"] == m["revision"] + 1
    r = client.patch(f"/api/maps/{m['id']}", json={"document": doc("B"), "base_revision": m["revision"]})
    assert r.status_code == 409


def test_versions_restore(client, user):
    m = client.post("/api/maps", json={"title": "К", "document": doc("v1")}).json()
    client.patch(f"/api/maps/{m['id']}", json={"document": doc("v2")})
    versions = client.get(f"/api/maps/{m['id']}/versions").json()
    first = versions[-1]  # самая ранняя
    restored = client.post(f"/api/maps/{m['id']}/versions/{first['id']}/restore").json()
    assert restored["document"]["sheets"][0]["rootTopic"]["title"] == "v1"
    assert len(client.get(f"/api/maps/{m['id']}/versions").json()) > len(versions)


def test_other_user_has_no_access(client, user):
    m = client.post("/api/maps", json={"title": "Чужая"}).json()
    other = TestClient(app)  # второй пользователь со своими cookie
    register(other)
    assert other.get(f"/api/maps/{m['id']}").status_code == 404
    assert other.patch(f"/api/maps/{m['id']}", json={"title": "x"}).status_code == 404
    assert other.delete(f"/api/maps/{m['id']}").status_code == 404


def test_requires_auth(client):
    assert client.get("/api/maps").status_code == 401


def test_templates(client, user):
    t = client.post("/api/templates", json={"title": "Шаблон", "document": doc()}).json()
    assert [x["id"] for x in client.get("/api/templates").json()] == [t["id"]]
    assert client.delete(f"/api/templates/{t['id']}").status_code == 200
    assert client.get("/api/templates").json() == []
