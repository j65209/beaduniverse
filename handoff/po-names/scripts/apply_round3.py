"""Round 3: photo names for code-only items + official names from the exhaustive comparison.
Usage: python3 -I apply_round3.py <scratch_dir> <overrides.json> [--dry]
 1) data/names_F.json -> overrides, only where the item has no name override / suggestion yet
 2) xs/result_*.json  -> sure : overrides[pid] = official short name (replaces Claude's own photo name)
                         maybe: auto_overrides[pid] = {name, src, ref} (🤖, the photo name stays as fallback)
 Never touches names the owner edited in the app, or hidden items.
"""
import json, os, sys, glob, collections
S, OV = sys.argv[1], sys.argv[2]; dry = "--dry" in sys.argv; D = os.path.join(S, "data")
ONLY = next((a.split("=", 1)[1].split(",") for a in sys.argv if a.startswith("--files=")), None)  # e.g. --files=result_neck.json,result_brac.json
ov = json.load(open(OV, encoding="utf-8"))
for k in ("overrides", "auto_overrides", "img_overrides", "deleted_ids"):
    ov.setdefault(k, {})
tr = json.load(open(os.path.join(D, "translations_applied.json")))
dec = {d["po_id"] for d in json.load(open(os.path.join(D, "decisions_final.json")))}
nf_path = os.path.join(D, "names_F.json"); names_f = json.load(open(nf_path)) if os.path.exists(nf_path) else {}
off = json.load(open(os.path.join(D, "official.json")))
file2off = {f: r for r in off for f in r["files"]}
mine = set(tr) | dec | set(names_f)
manual = {pid for pid in ov["overrides"] if pid not in mine}
before = dict(ov["overrides"])
st = collections.Counter()

# 1) photo names for code-only items
for pid, nm in names_f.items():
    nm = (nm or "").strip()
    if not nm or any("一" <= c <= "鿿" for c in nm):
        st["F_skip_bad"] += 1; continue
    if pid in ov["deleted_ids"] or pid in ov["overrides"] or pid in ov["auto_overrides"]:
        st["F_skip_has_name"] += 1; continue
    ov["overrides"][pid] = nm; st["F_named"] += 1

# 2) official names from the exhaustive comparison
res = collections.defaultdict(list)
for grp in ("ring", "neck", "brac"):
    xp = os.path.join(S, "xs", f"{grp}.json")
    if not os.path.exists(xp):
        continue
    X = json.load(open(xp))
    for f in sorted(glob.glob(os.path.join(S, "xs", f"result_{grp}*.json"))):
        if ONLY is not None and os.path.basename(f) not in ONLY:
            continue
        for r in json.load(open(f)):
            p = X["po"][str(int(r["n"]))]; c = X["catalog"][r["cid"]]
            if p["po_id"] != r.get("po_id", p["po_id"]):
                st["bad_po_id"] += 1; print("po_id mismatch", f, r); continue
            o = file2off.get(c["best"]) or next((file2off[x] for x in c["images"] if x in file2off), None)
            brand = "6A" if c["brand"] == "6A" else "YAR"
            res[p["po_id"]].append({"name": c["name"], "level": r["level"], "ref": f"{brand}:{o['id'] if o else ''}",
                                    "cid": r["cid"], "grp": grp, "note": r.get("note", "")})
xp = os.path.join(S, "xs", "extra_results.json")
for r in (json.load(open(xp)) if os.path.exists(xp) else []):   # hand-checked entries win over agent results
    res[r["po_id"]] = [{"name": r["name"], "level": r["level"], "ref": r["ref"], "cid": "-", "grp": "extra", "note": r.get("note", "")}]
report = []
for pid, rs in res.items():
    names = {r["name"] for r in rs}
    if len(names) > 1:
        st["conflict_skip"] += 1; report.append(("CONFLICT", pid, rs)); continue
    r = sorted(rs, key=lambda r: r["level"] != "sure")[0]
    if pid in ov["deleted_ids"]:
        st["skip_hidden"] += 1; continue
    if pid in manual:
        st["skip_manual"] += 1; report.append(("MANUAL", pid, rs)); continue
    if r["level"] == "sure":
        ov["overrides"][pid] = r["name"]; ov["auto_overrides"].pop(pid, None); st["sure"] += 1
    elif r["level"] == "maybe":
        ov["auto_overrides"][pid] = {"name": r["name"], "src": "claude 이미지 매칭", "ref": r["ref"]}; st["maybe"] += 1
    report.append((r["level"], pid, r["name"], r["cid"], r["note"][:60]))
for pid in manual:
    assert ov["overrides"][pid] == before[pid], pid
out = json.dumps(ov, ensure_ascii=False, indent=2) + "\n"; json.loads(out)
if not dry:
    open(OV, "w", encoding="utf-8").write(out)
    # 한 번 반영한 결과 파일은 옮겨 둠 → 다시 돌려도 앱에서 취소한 🤖 제안이 되살아나지 않음
    done = os.path.join(S, "xs", "applied"); os.makedirs(done, exist_ok=True)
    for f in glob.glob(os.path.join(S, "xs", "result_*.json")) + [os.path.join(S, "xs", "extra_results.json")]:
        if os.path.exists(f) and (ONLY is None or os.path.basename(f) in ONLY + ["extra_results.json"]):
            os.replace(f, os.path.join(done, os.path.basename(f)))
json.dump(report, open(os.path.join(S, "xs", "round3_report.json"), "w"), ensure_ascii=False, indent=1)
print(dict(st), "| overrides", len(before), "->", len(ov["overrides"]), "| auto", len(ov["auto_overrides"]))
