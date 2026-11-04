"""Apply Korean translations of Chinese 발주 product names as name overrides.

Usage: python3 -I translate_apply.py <scratch_dir> <overrides.json> [--dry]
"""
import json, os, sys, glob

S, ov_path = sys.argv[1], sys.argv[2]; dry = "--dry" in sys.argv
D = os.path.join(S, "data")
norm = lambda s: s.replace("\n", " / ").replace("\t", " ")
src = {}
for line in open(os.path.join(D, "tr_src.tsv"), encoding="utf-8"):
    k, s = line.rstrip("\n").split("\t", 1); src[int(k)] = s
ko = {}
for f in sorted(glob.glob(os.path.join(D, "tr_ko_*.tsv"))):
    for line in open(f, encoding="utf-8"):
        if not line.strip():
            continue
        k, t = line.rstrip("\n").split("\t", 1); ko[int(k)] = t.strip()
missing = sorted(set(src) - set(ko))
cjk = [k for k, t in ko.items() if any("一" <= c <= "鿿" for c in t)]
assert not missing, f"missing translations: {missing[:20]}"
assert not cjk, f"Chinese left in: {cjk}"
by_src = {src[k]: ko[k] for k in src}

items = json.load(open(os.path.join(D, "tr_items.json")))
ov = json.load(open(ov_path, encoding="utf-8"))
before = dict(ov["overrides"]); applied = {}; skipped = 0
for it in items:
    pid = it["id"]
    if pid in ov["overrides"] or pid in ov.get("auto_overrides", {}) or pid in ov.get("deleted_ids", {}):
        skipped += 1; continue
    t = by_src.get(norm(it["src"]))
    if t:
        ov["overrides"][pid] = t; applied[pid] = {"ko": t, "src": it["src"]}
for pid, v in before.items():
    assert ov["overrides"][pid] == v
out = json.dumps(ov, ensure_ascii=False, indent=2) + "\n"; json.loads(out)
if not dry:
    open(ov_path, "w", encoding="utf-8").write(out)
    json.dump(applied, open(os.path.join(D, "translations_applied.json"), "w"), ensure_ascii=False, indent=1)
print("translated:", len(applied), "| skipped (already named/hidden):", skipped, "| overrides:", len(before), "->", len(ov["overrides"]))
