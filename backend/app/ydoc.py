"""Документ карты ↔ Y.Doc (CRDT).

Дерево хранится плоско, чтобы одновременные правки разных тем сливались:
  nodes: Map  id → Map { поле: JSON-строка, children: Array[id], callouts: Array[id] }
  sheets: Map id → Map { поле: JSON-строка, root: id, floating: Array[id] }
  order: Array[id листов]
Та же схема реализована на клиенте (frontend/src/collab/ydoc.ts).
"""
import json

from pycrdt import Array, Doc, Map

STRUCT_TOPIC = {"id", "children", "callouts", "summaries"}
STRUCT_SHEET = {"id", "rootTopic", "floatingTopics"}


def _topic_to_nodes(t: dict, out: dict) -> str:
    fields = {k: json.dumps(v, ensure_ascii=False) for k, v in t.items() if k not in STRUCT_TOPIC}
    summaries = []
    for s in t.get("summaries") or []:
        summaries.append({"id": s["id"], "ids": s["ids"], "topicId": _topic_to_nodes(s["topic"], out)})
    if summaries:
        fields["summaries"] = json.dumps(summaries, ensure_ascii=False)
    out[t["id"]] = {
        "fields": fields,
        "children": [_topic_to_nodes(c, out) for c in t.get("children") or []],
        "callouts": [_topic_to_nodes(c, out) for c in t.get("callouts") or []],
    }
    return t["id"]


def document_to_ydoc(document: dict) -> Doc:
    doc = Doc()
    nodes = doc.get("nodes", type=Map)
    sheets = doc.get("sheets", type=Map)
    order = doc.get("order", type=Array)
    flat: dict = {}
    sheet_items = []
    for sh in document.get("sheets", []):
        root = _topic_to_nodes(sh["rootTopic"], flat)
        floating = [_topic_to_nodes(f, flat) for f in sh.get("floatingTopics") or []]
        fields = {k: json.dumps(v, ensure_ascii=False) for k, v in sh.items() if k not in STRUCT_SHEET}
        sheet_items.append((sh["id"], fields, root, floating))
    with doc.transaction(origin="server"):
        for nid, n in flat.items():
            nodes[nid] = Map({**n["fields"], "children": Array(n["children"]), "callouts": Array(n["callouts"])})
        for sid, fields, root, floating in sheet_items:
            sheets[sid] = Map({**fields, "root": json.dumps(root), "floating": Array(floating)})
        order.extend([s[0] for s in sheet_items])
    return doc


def _node_to_topic(nid: str, nodes, seen: set) -> dict | None:
    if nid in seen or nid not in nodes:
        return None
    seen.add(nid)
    n = nodes[nid]
    t: dict = {"id": nid}
    summaries = None
    for k, v in n.items():
        if k in ("children", "callouts"):
            continue
        if k == "summaries":
            summaries = json.loads(v)
            continue
        t[k] = json.loads(v)
    t["children"] = [x for x in (_node_to_topic(c, nodes, seen) for c in n["children"]) if x]
    callouts = [x for x in (_node_to_topic(c, nodes, seen) for c in n["callouts"]) if x]
    if callouts:
        t["callouts"] = callouts
    if summaries:
        out = []
        for s in summaries:
            st = _node_to_topic(s["topicId"], nodes, seen)
            if st:
                out.append({"id": s["id"], "ids": s["ids"], "topic": st})
        if out:
            t["summaries"] = out
    return t


def ydoc_to_document(doc: Doc) -> dict:
    nodes = doc.get("nodes", type=Map)
    sheets = doc.get("sheets", type=Map)
    order = doc.get("order", type=Array)
    out = []
    seen_sheets = set()
    for sid in list(order):
        if sid in seen_sheets or sid not in sheets:
            continue
        seen_sheets.add(sid)
        s = sheets[sid]
        sheet: dict = {"id": sid}
        for k, v in s.items():
            if k in ("root", "floating"):
                continue
            sheet[k] = json.loads(v)
        seen: set = set()
        root = _node_to_topic(json.loads(s["root"]), nodes, seen)
        if not root:
            continue
        sheet["rootTopic"] = root
        floating = [x for x in (_node_to_topic(f, nodes, seen) for f in s["floating"]) if x]
        if floating:
            sheet["floatingTopics"] = floating
        out.append(sheet)
    return {"version": 1, "sheets": out}
