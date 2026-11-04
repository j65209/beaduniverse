"""Merge reviewer outputs (review_*.json) into one decision list per 발주 product.

Usage: python3 -I merge_reviews.py <scratch_dir>
Writes data/decisions_raw.json : [{po_id, idx, name, level, off_id, brand, z, note, conflict}]
"""
import json, os, sys, glob, collections, numpy as np

S = sys.argv[1]; D = os.path.join(S, "data")
rows = json.load(open(os.path.join(D, "cands.json")))
po_index = {int(k): v for k, v in json.load(open(os.path.join(D, "po_index.json"))).items()}
F = np.load(os.path.join(D, "fused.npy"))
fi = json.load(open(os.path.join(D, "fused_index.json")))
off_col = {oid: j for j, oid in enumerate(fi["off_ids"])}

by_po = collections.defaultdict(list)
bad = 0
for f in sorted(glob.glob(os.path.join(D, "review_*.json"))):
    for m in json.load(open(f)):
        try:
            r = rows[int(m["row"])]; idx = int(m["idx"])
        except Exception:
            bad += 1; continue
        if idx not in {c["idx"] for c in r["cands"]}:
            bad += 1; continue   # 그 행의 후보가 아닌 번호 → 무시
        by_po[po_index[idx]].append({"idx": idx, "name": r["core"], "level": m.get("level", "maybe"),
                                     "off_id": r["off_id"], "brand": r["brand"],
                                     "z": float(F[idx, off_col[r["off_id"]]]), "note": m.get("note", "")})
out = []
for pid, ms in by_po.items():
    names = {m["name"] for m in ms}
    sure = [m for m in ms if m["level"] == "sure"]
    if len(names) == 1:
        best = max(sure or ms, key=lambda m: m["z"]); best = dict(best); best["conflict"] = ""
    else:
        sure_names = {m["name"] for m in sure}
        if len(sure_names) == 1:          # 하나만 sure → 그걸로, 나머지 maybe 이름은 메모
            best = dict(max(sure, key=lambda m: m["z"]))
            best["conflict"] = "also maybe: " + ", ".join(sorted(names - sure_names))
        else:                              # 서로 다른 이름 여러 개 → 애매로 내림
            best = dict(max(ms, key=lambda m: m["z"])); best["level"] = "maybe"
            best["conflict"] = "candidates: " + ", ".join(sorted(names))
    best["po_id"] = pid
    out.append(best)
out.sort(key=lambda d: (d["level"] != "sure", d["name"].lower()))
json.dump(out, open(os.path.join(D, "decisions_raw.json"), "w"), ensure_ascii=False, indent=1)
c = collections.Counter(d["level"] for d in out)
print("po matched:", len(out), dict(c), "| conflicts:", sum(1 for d in out if d["conflict"]), "| bad refs:", bad)
