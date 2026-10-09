"""Совместное редактирование: Y-комнаты поверх WebSocket (протокол y-websocket).

Комната на карту. Документ загружается из базы при первом подключении, изменения
сохраняются в maps.document раз в секунду и при уходе последнего участника.
"""
import json
import logging
import uuid

import anyio
from anyio.abc import TaskGroup
from pycrdt import Array, Doc, Map
from pycrdt.websocket import WebsocketServer, YRoom

from .db import SessionLocal
from .models import Map as MapModel
from .ydoc import document_to_ydoc, ydoc_to_document

log = logging.getLogger("collab")


class WebSocketChannel:
    """Адаптер Starlette WebSocket → канал pycrdt. Зрители не могут присылать изменения."""

    def __init__(self, websocket, path: str, readonly: bool):
        self._ws = websocket
        self._path = path
        self._readonly = readonly
        self._lock = anyio.Lock()

    @property
    def path(self) -> str:
        return self._path

    def __aiter__(self):
        return self

    async def __anext__(self) -> bytes:
        while True:
            try:
                msg = bytes(await self._ws.receive_bytes())
            except Exception:
                raise StopAsyncIteration()
            # 0 = SYNC; 1 = step2, 2 = update — правки документа
            if self._readonly and len(msg) > 1 and msg[0] == 0 and msg[1] in (1, 2):
                continue
            return msg

    async def send(self, message: bytes):
        async with self._lock:
            await self._ws.send_bytes(message)

    async def recv(self) -> bytes:
        return await self.__anext__()


def _replace_content(doc: Doc, document: dict) -> None:
    """Заменить содержимое живого документа (откат версии) — участники получат изменения."""
    fresh = document_to_ydoc(document)
    nodes, sheets, order = doc.get("nodes", type=Map), doc.get("sheets", type=Map), doc.get("order", type=Array)
    with doc.transaction(origin="server"):
        for k in list(nodes.keys()):
            del nodes[k]
        for k in list(sheets.keys()):
            del sheets[k]
        del order[0:len(order)]
        fn, fs = fresh.get("nodes", type=Map), fresh.get("sheets", type=Map)
        for k, v in fn.items():
            nodes[k] = Map({kk: (Array(list(vv)) if kk in ("children", "callouts") else vv) for kk, vv in v.items()})
        for k, v in fs.items():
            sheets[k] = Map({kk: (Array(list(vv)) if kk == "floating" else vv) for kk, vv in v.items()})
        order.extend(list(fresh.get("order", type=Array)))


class Rooms:
    def __init__(self):
        self.server = WebsocketServer(auto_clean_rooms=False)
        self.dirty: set[str] = set()
        self.saved: dict[str, str] = {}
        self._lock = anyio.Lock()
        self._tg: TaskGroup | None = None

    async def run(self, task_status=anyio.TASK_STATUS_IGNORED):
        async with self.server, anyio.create_task_group() as tg:
            self._tg = tg
            tg.start_soon(self._saver)
            task_status.started()
            await anyio.sleep_forever()

    async def get(self, map_id: uuid.UUID) -> YRoom:
        name = str(map_id)
        async with self._lock:
            room = self.server.rooms.get(name)
            if room is None:
                document = await anyio.to_thread.run_sync(self._load, map_id)
                doc = document_to_ydoc(document)
                room = YRoom(ready=True, ydoc=doc, log=log)
                self.server.rooms[name] = room
                self.saved[name] = json.dumps(document, sort_keys=True)
                doc.observe(lambda _e, n=name: self.dirty.add(n))
                await self.server.start_room(room)
            return room

    async def serve(self, map_id: uuid.UUID, websocket, readonly: bool):
        room = await self.get(map_id)
        await room.serve(WebSocketChannel(websocket, str(map_id), readonly))
        if not room.clients:
            await self._save(str(map_id))
            async with self._lock:
                if not room.clients and str(map_id) in self.server.rooms:
                    await self.server.delete_room(name=str(map_id))
                    self.saved.pop(str(map_id), None)

    async def reset(self, map_id: uuid.UUID, document: dict):
        room = self.server.rooms.get(str(map_id))
        if room is not None:
            _replace_content(room.ydoc, document)
            self.saved[str(map_id)] = json.dumps(document, sort_keys=True)
            self.dirty.discard(str(map_id))

    def active(self, map_id: uuid.UUID) -> bool:
        return str(map_id) in self.server.rooms

    @staticmethod
    def _load(map_id: uuid.UUID) -> dict:
        with SessionLocal() as db:
            m = db.get(MapModel, map_id)
            return m.document if m else {"version": 1, "sheets": []}

    async def _saver(self):
        while True:
            await anyio.sleep(1)
            for name in list(self.dirty):
                await self._save(name)

    async def _save(self, name: str):
        self.dirty.discard(name)
        room = self.server.rooms.get(name)
        if room is None:
            return
        document = ydoc_to_document(room.ydoc)
        if not document["sheets"]:
            return
        key = json.dumps(document, sort_keys=True)
        if self.saved.get(name) == key:
            return
        self.saved[name] = key

        def write():
            from .routers.maps import save_document
            with SessionLocal() as db:
                m = db.get(MapModel, uuid.UUID(name))
                if m:
                    save_document(m, document, db)
                    db.commit()
        try:
            await anyio.to_thread.run_sync(write)
        except Exception:
            log.exception("Не удалось сохранить карту %s", name)
            self.dirty.add(name)


rooms = Rooms()
