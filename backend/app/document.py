import uuid


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def empty_document() -> dict:
    """Новая карта как в XMind: центральная тема и 4 основные, структура «по часовой»."""
    return {
        "version": 1,
        "sheets": [
            {
                "id": new_id(),
                "title": "Mind Map",
                "structure": "mindmap-cw",
                "rootTopic": {
                    "id": new_id(),
                    "title": "Central Topic",
                    "children": [{"id": new_id(), "title": f"Main Topic {i}", "children": []} for i in range(1, 5)],
                },
            }
        ],
    }
