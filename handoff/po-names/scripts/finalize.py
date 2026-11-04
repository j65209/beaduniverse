"""Build the final decision list from merged reviews + my verification adjustments.

Usage: python3 -I finalize.py <scratch_dir>
Writes data/decisions_final.json
"""
import json, os, sys, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from corename import core_name, is_set, strip_marks

S = sys.argv[1]; D = os.path.join(S, "data")
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}
off = {r["id"]: r for r in json.load(open(os.path.join(D, "official.json")))}
idx2po = json.load(open(os.path.join(D, "po_index.json")))
ov = json.load(open("/home/claude/beaduniverse/data/product-name-overrides.json"))
raw = json.load(open(os.path.join(D, "decisions_raw.json")))
text = json.load(open(os.path.join(D, "dec_text.json")))
adj = json.load(open(os.path.join(D, "adjust.json")))   # 검수에서 내가 고친 것

core_by_name = {core_name(r["name"]).lower(): (core_name(r["name"]), oid, r["brand"])
                for oid, r in off.items() if not is_set(r["name"])}
dec = {}
for d in text:
    dec[d["po_id"]] = {**d, "src": "text"}
for d in raw:
    dec[d["po_id"]] = {"po_id": d["po_id"], "idx": d["idx"], "name": d["name"], "level": d["level"],
                       "off_id": d["off_id"], "brand": d["brand"], "src": "review", "note": d["note"]}
for a in adj:   # {"idx": "601", "name": "HASSI", "level": "sure"|"maybe"|"drop"}
    pid = idx2po[str(a["idx"])]
    if a["level"] == "drop":
        dec.pop(pid, None); continue
    nm, oid, brand = core_by_name[a["name"].lower()]
    dec[pid] = {"po_id": pid, "idx": int(a["idx"]), "name": nm, "level": a["level"], "off_id": oid,
                "brand": brand, "src": "verify", "note": a.get("note", "")}
final, skipped = [], []
for pid, d in dec.items():
    shown = strip_marks(ov["overrides"].get(pid) or po[pid].get("kor") or "").strip()
    if pid in ov["overrides"] or shown.lower() == d["name"].lower():
        skipped.append(pid); continue          # 이미 직접 고쳤거나 이미 같은 이름 → 그대로 둠
    d["was"] = (po[pid].get("kor") or po[pid].get("cn") or "")[:40]
    final.append(d)
final.sort(key=lambda d: (d["level"] != "sure", d["brand"], d["name"].lower()))
json.dump(final, open(os.path.join(D, "decisions_final.json"), "w"), ensure_ascii=False, indent=1)
print("final:", len(final), "sure:", sum(d["level"] == "sure" for d in final),
      "maybe:", sum(d["level"] == "maybe" for d in final), "| unchanged (already named):", len(skipped))
