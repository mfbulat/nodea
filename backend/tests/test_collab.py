"""Доступ по ссылке и синхронизация через WebSocket (протокол y-websocket)."""
import pytest
from fastapi.testclient import TestClient
from pycrdt import Doc, Map
from pycrdt import create_sync_message, create_update_message, handle_sync_message

from app.main import app
from app.ydoc import ydoc_to_document

from .conftest import register

DOC = {"version": 1, "sheets": [{"id": "s", "title": "Л", "rootTopic": {"id": "r", "title": "Корень", "children": [
    {"id": "a", "title": "A", "children": []}]}}]}


def sync(ws, doc: Doc):
    """Начальная синхронизация клиента с сервером."""
    ws.send_bytes(create_sync_message(doc))
    for _ in range(4):
        msg = ws.receive_bytes()
        if msg[0] == 0:
            reply = handle_sync_message(msg[1:], doc)
            if reply:
                ws.send_bytes(reply)
            if msg[1] == 1:  # step2 от сервера — состояние получено
                return


def test_shares_crud_and_shared_access(client, user):
    m = client.post("/api/maps", json={"title": "К", "document": DOC}).json()
    view = client.post(f"/api/maps/{m['id']}/shares", json={"role": "view"}).json()
    edit = client.post(f"/api/maps/{m['id']}/shares", json={"role": "edit"}).json()
    assert client.post(f"/api/maps/{m['id']}/shares", json={"role": "admin"}).status_code == 422
    assert len(client.get(f"/api/maps/{m['id']}/shares").json()) == 2
    anon = TestClient(app)
    r = anon.get(f"/api/shared/{view['token']}").json()
    assert r["role"] == "view" and r["map"]["title"] == "К"
    assert anon.get(f"/api/shared/{edit['token']}").json()["role"] == "edit"
    assert client.get(f"/api/shared/{view['token']}").json()["role"] == "owner"
    client.delete(f"/api/maps/{m['id']}/shares/{view['id']}")
    assert anon.get(f"/api/shared/{view['token']}").status_code == 404
    # чужой пользователь не управляет ссылками
    other = TestClient(app)
    register(other)
    assert other.get(f"/api/maps/{m['id']}/shares").status_code == 404


def test_ws_rejects_without_access(client, user):
    m = client.post("/api/maps", json={"title": "К", "document": DOC}).json()
    anon = TestClient(app)
    with pytest.raises(Exception):
        with anon.websocket_connect(f"/api/collab/{m['id']}") as ws:
            ws.receive_bytes()


def test_ws_edit_is_persisted_and_viewer_is_readonly(client, user):
    m = client.post("/api/maps", json={"title": "К", "document": DOC}).json()
    view = client.post(f"/api/maps/{m['id']}/shares", json={"role": "view"}).json()
    with client.websocket_connect(f"/api/collab/{m['id']}") as ws:
        doc = Doc()
        sync(ws, doc)
        assert ydoc_to_document(doc)["sheets"][0]["rootTopic"]["children"][0]["title"] == "A"
        # зритель: его правка не принимается
        anon = TestClient(app)
        with anon.websocket_connect(f"/api/collab/{m['id']}?share={view['token']}") as vws:
            vdoc = Doc()
            sync(vws, vdoc)
            before = vdoc.get_state()
            vdoc.get("nodes", type=Map)["a"]["title"] = '"взлом"'
            vws.send_bytes(create_update_message(vdoc.get_update(before)))
        # владелец правит
        before = doc.get_state()
        doc.get("nodes", type=Map)["a"]["title"] = '"A2"'
        ws.send_bytes(create_update_message(doc.get_update(before)))
        # проверочный клиент получает итоговое состояние
        with client.websocket_connect(f"/api/collab/{m['id']}") as ws2:
            d2 = Doc()
            sync(ws2, d2)
            assert ydoc_to_document(d2)["sheets"][0]["rootTopic"]["children"][0]["title"] == "A2"
    # после ухода всех участников документ сохранён в базе
    saved = client.get(f"/api/maps/{m['id']}").json()
    assert saved["document"]["sheets"][0]["rootTopic"]["children"][0]["title"] == "A2"
