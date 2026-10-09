from app.ydoc import document_to_ydoc, ydoc_to_document

DOC = {"version": 1, "sheets": [{
    "id": "s1", "title": "Лист", "structure": "logic-right", "rainbow": True,
    "relationships": [{"id": "r", "end1": "a", "end2": "b"}],
    "rootTopic": {"id": "root", "title": "Корень", "style": {"fill": "#fff"}, "children": [
        {"id": "a", "title": "A", "markers": ["priority-1"], "children": [{"id": "a1", "title": "A1", "children": []}],
         "summaries": [{"id": "sm", "ids": ["a1"], "topic": {"id": "st", "title": "Итог", "children": []}}],
         "callouts": [{"id": "c", "title": "Выноска", "children": []}]},
        {"id": "b", "title": "B", "children": []},
    ]},
    "floatingTopics": [{"id": "f", "title": "Плавающая", "position": {"x": 1, "y": 2}, "children": []}],
}, {"id": "s2", "title": "Второй", "rootTopic": {"id": "r2", "title": "R2", "children": []}}]}


def test_roundtrip():
    assert ydoc_to_document(document_to_ydoc(DOC)) == DOC


def test_sync_between_docs():
    from pycrdt import Doc, Map
    src = document_to_ydoc(DOC)
    dst = Doc()
    dst.apply_update(src.get_update())
    assert ydoc_to_document(dst) == DOC
    # правка в одном документе доходит до другого
    src.get("nodes", type=Map)["b"]["title"] = '"B2"'
    dst.apply_update(src.get_update(dst.get_state()))
    assert ydoc_to_document(dst)["sheets"][0]["rootTopic"]["children"][1]["title"] == "B2"
