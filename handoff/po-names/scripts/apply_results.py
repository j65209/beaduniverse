"""Merge matching decisions into data/product-name-overrides.json.

Usage: python3 -I apply_results.py <decisions.json> <overrides.json> [--dry]
decisions: [{"po_id","name","level":"sure"|"maybe","off_id","brand"}]
 - sure  -> overrides[po_id] = name
 - maybe -> auto_overrides[po_id] = {"name", "src", "ref"}  (앱에서 🤖 승인/취소)
Existing manual overrides and hidden (deleted) products are never touched.
"""
import json, sys, collections

dec_path, ov_path = sys.argv[1], sys.argv[2]
dry = "--dry" in sys.argv
dec = json.load(open(dec_path))
raw = open(ov_path, encoding="utf-8").read()
ov = json.loads(raw)
for k in ("overrides", "auto_overrides", "img_overrides", "deleted_ids"):
    ov.setdefault(k, {})
manual_before = dict(ov["overrides"])
stats = collections.Counter()
for d in dec:
    pid, name, level = d["po_id"], d["name"].strip(), d["level"]
    if not name:
        stats["skip_empty"] += 1; continue
    if pid in ov["deleted_ids"]:
        stats["skip_hidden"] += 1; continue
    if pid in manual_before:
        stats["skip_manual"] += 1; continue
    if level == "sure":
        ov["overrides"][pid] = name
        ov["auto_overrides"].pop(pid, None)
        stats["sure"] += 1
    elif level == "maybe":
        ov["auto_overrides"][pid] = {"name": name, "src": "claude 이미지 매칭", "ref": f"{d.get('brand','')}:{d.get('off_id','')}"}
        stats["maybe"] += 1
for pid, v in manual_before.items():
    assert ov["overrides"][pid] == v, pid
out = json.dumps(ov, ensure_ascii=False, indent=2) + "\n"
json.loads(out)
if not dry:
    open(ov_path, "w", encoding="utf-8").write(out)
print(dict(stats), "| overrides:", len(manual_before), "->", len(ov["overrides"]), "| auto:", len(ov["auto_overrides"]))
