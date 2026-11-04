"""Replace text-only translations with photo-based Korean names.

Usage: python3 -I names_apply.py <work_dir> <overrides.json> [--dry]
Reads <work_dir>/data/names_*.json ({po_id: name}) and data/translations_applied.json.
Only replaces an override that still equals the old text translation (so manual edits in the app are kept).
"""
import json, os, sys, glob

W, ov_path = sys.argv[1], sys.argv[2]; dry = "--dry" in sys.argv
D = os.path.join(W, "data")
tr = json.load(open(os.path.join(D, "translations_applied.json")))
names = {}
for f in sorted(glob.glob(os.path.join(D, "names_*.json"))):
    names.update(json.load(open(f)))
ov = json.load(open(ov_path, encoding="utf-8"))
done = kept = 0
for pid, nm in names.items():
    nm = (nm or "").strip()
    if not nm or any("一" <= c <= "鿿" for c in nm):
        continue
    if pid in tr and ov["overrides"].get(pid) == tr[pid]["ko"]:
        ov["overrides"][pid] = nm; done += 1
    else:
        kept += 1
out = json.dumps(ov, ensure_ascii=False, indent=2) + "\n"; json.loads(out)
if not dry:
    open(ov_path, "w", encoding="utf-8").write(out)
print(f"photo names applied: {done} | left as is (edited in app or not a translation): {kept} | names available: {len(names)}")
