import uuid


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def empty_document(title: str = "Центральная тема") -> dict:
    return {
        "version": 1,
        "sheets": [
            {
                "id": new_id(),
                "title": "Лист 1",
                "rootTopic": {"id": new_id(), "title": title, "children": []},
            }
        ],
    }
