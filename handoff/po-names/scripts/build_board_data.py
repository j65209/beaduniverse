"""Build the data blob for the matching board page.
Usage: python3 -I build_board_data.py <scratch_dir> <out_json>
"""
import json, os, sys, io, base64, collections, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from corename import core_name, is_set, strip_marks

S, OUT = sys.argv[1], sys.argv[2]; D = os.path.join(S, "data")
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}
off = {r["id"]: r for r in json.load(open(os.path.join(D, "official.json")))}
ov = json.load(open(os.path.join(D, "ov_live.json")))
F = np.load(os.path.join(D, "fused.npy")); fi = json.load(open(os.path.join(D, "fused_index.json")))
row = {pid: i for i, pid in enumerate(fi["po_ids"])}; col = {oid: j for j, oid in enumerate(fi["off_ids"])}
final = json.load(open(os.path.join(D, "decisions_final.json")))

def thumb(path, size, q):
    im = Image.open(path).convert("RGB"); im.thumbnail((size, size))
    b = io.BytesIO(); im.save(b, "JPEG", quality=q, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()

def shown(p):
    return strip_marks(ov["overrides"].get(p["id"]) or (ov["auto_overrides"].get(p["id"]) or {}).get("name")
                       or p.get("kor") or p.get("cn") or "").strip()

core_keys = {core_name(r["name"]).lower() for r in off.values() if not is_set(r["name"])}
named = {pid for pid, p in po.items() if shown(p).lower() in core_keys}
linked = collections.Counter(shown(p).lower() for p in po.values())

# 공홈 제품: (브랜드, 이름) 단위로 묶기
groups = collections.OrderedDict()
for oid, r in off.items():
    if is_set(r["name"]) or not r["files"]:
        continue
    key = (r["brand"], core_name(r["name"]))
    groups.setdefault(key, []).append(oid)

unmatched = []
for (brand, core), oids in groups.items():
    if linked[core.lower()] > 0:
        continue
    cols = [col[o] for o in oids if o in col]
    sc = F[:, cols].max(axis=1).copy()
    for pid in named:
        if pid in row: sc[row[pid]] = -99
    top = [fi["po_ids"][i] for i in np.argsort(-sc)[:12]]
    imgs = []
    for o in oids:
        for f in off[o]["files"][:2]:
            if len(imgs) < 2: imgs.append(thumb(f, 220, 72))
    unmatched.append({"key": f"{brand}:{core}", "brand": "6A" if brand == "6A" else "야르", "name": core,
                      "full": off[oids[0]]["name"], "imgs": imgs, "cands": top})

po_items = []
for pid, p in po.items():
    if not p.get("file") or pid in named:
        continue
    txt = (p.get("kor") or p.get("cn") or "").replace("\n", " ").strip()
    po_items.append({"id": pid, "t": txt[:40], "y": (p.get("latest") or "")[:7], "g": "6A" if "6A(식스에이)" in p["groups"] else "일반",
                     "n": p.get("orders", 0), "img": thumb(p["file"], 120, 64)})
po_items.sort(key=lambda x: x["y"], reverse=True)

applied = []
for d in final:
    p = po[d["po_id"]]; o = off[d["off_id"]]
    applied.append({"name": d["name"], "brand": "6A" if d["brand"] == "6A" else "야르", "level": d["level"],
                    "was": (p.get("kor") or p.get("cn") or "").replace("\n", " ")[:40], "id": d["po_id"],
                    "oimg": thumb(o["files"][0], 160, 70), "pimg": thumb(p["file"], 160, 70) if p.get("file") else ""})

stats = {"6A": [0, 0], "야르": [0, 0]}
for (brand, core), oids in groups.items():
    b = "6A" if brand == "6A" else "야르"; stats[b][0] += 1
    if linked[core.lower()] > 0: stats[b][1] += 1
blob = {"unmatched": unmatched, "po": po_items, "applied": applied, "stats": stats, "total_po": len(po)}
s = json.dumps(blob, ensure_ascii=False, separators=(",", ":"))
open(OUT, "w").write(s)
print("unmatched", len(unmatched), "po grid", len(po_items), "applied", len(applied), "stats", stats, "size MB", round(len(s) / 1e6, 2))
