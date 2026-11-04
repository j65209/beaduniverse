"""Sheets for exhaustive official <-> 발주 comparison, grouped by item type.
Usage: python3 -I make_xsheets.py <scratch_dir>
Writes xs/<grp>_cat_<k>.jpg (official, label = cid), xs/<grp>_po_<k>.jpg (발주, label = #n),
       xs/<grp>.json {catalog:{cid:{name,brand,images}}, po:{n:{po_id,name,file}}, sheets:{...}, hints:{n:[[cid,score],...]}}
"""
import json, os, sys, collections
import numpy as np
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; D = os.path.join(S, "data"); OUT = os.path.join(S, "xs"); os.makedirs(OUT, exist_ok=True)
cat = json.load(open(os.path.join(S, "catalog", "catalog.json")))
pool = json.load(open(os.path.join(D, "pool.json")))
off = {r["id"]: r for r in json.load(open(os.path.join(D, "official.json")))}
fi = json.load(open(os.path.join(D, "fused_index.json"))); F = np.load(os.path.join(D, "fused.npy"))
prow = {p: i for i, p in enumerate(fi["po_ids"])}
ocol = collections.defaultdict(list)
for j, oid in enumerate(fi["off_ids"]):
    ocol[oid.split("#")[0].split("_")[0]].append(j)
file2oid = {}
for oid, r in off.items():
    for f in r["files"]:
        file2oid[f] = oid

GROUPS = {"ring": ("R", {"반지"}), "neck": ("N", {"목걸이"}), "brac": ("B", {"팔찌", "뱅글", "키링"})}
FB = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 15)

def whiteness(path):
    im = Image.open(path).convert("L").resize((64, 64))
    a = np.asarray(im, dtype=np.float32)
    border = np.concatenate([a[:6].ravel(), a[-6:].ravel(), a[:, :6].ravel(), a[:, -6:].ravel()])
    return float((border > 235).mean())

def tile(path, T):
    im = Image.open(path).convert("RGB"); im.thumbnail((T, T), Image.LANCZOS)
    bg = Image.new("RGB", (T, T), "white"); bg.paste(im, ((T - im.width) // 2, (T - im.height) // 2)); return bg

def sheet(items, T, COLS, path, label_color):
    rows = (len(items) + COLS - 1) // COLS; LH, PAD = 22, 5
    sh = Image.new("RGB", (COLS * (T + PAD) + PAD, rows * (T + LH + PAD) + PAD), (35, 35, 35)); d = ImageDraw.Draw(sh)
    for i, (lab, p) in enumerate(items):
        x = PAD + (i % COLS) * (T + PAD); y = PAD + (i // COLS) * (T + LH + PAD)
        sh.paste(tile(p, T), (x, y)); d.text((x + 3, y + T + 1), lab, fill=label_color, font=FB)
    sh.save(path, quality=86)

for grp, (prefix, types) in GROUPS.items():
    cids = [c for c in cat if c.startswith(prefix)]
    catalog = {}
    for c in cids:
        imgs = cat[c]["images"]
        best = max(imgs, key=whiteness)
        catalog[c] = {"name": cat[c]["name"], "brand": cat[c]["brand"], "full": cat[c]["full"], "best": best, "images": imgs}
    pos = [pid for pid, v in pool.items() if v["type"] in types and not v["linked"] and not v["manual"]]
    po = {}
    for n, pid in enumerate(pos):
        po[n] = {"po_id": pid, "name": pool[pid]["name"], "file": pool[pid]["file"]}
    # catalog sheets: 8 x 4 @ 175
    sheets = {}
    for k, s in enumerate(range(0, len(cids), 32)):
        chunk = cids[s:s + 32]; path = os.path.join(OUT, f"{grp}_cat_{k}.jpg")
        sheet([(f"{c} {catalog[c]['name'][:14]}", catalog[c]["best"]) for c in chunk], 175, 8, path, (255, 230, 120))
        sheets[os.path.basename(path)] = chunk
    for k, s in enumerate(range(0, len(pos), 48)):
        chunk = list(range(s, min(s + 48, len(pos)))); path = os.path.join(OUT, f"{grp}_po_{k}.jpg")
        sheet([(f"#{n}", po[n]["file"]) for n in chunk], 170, 8, path, (255, 255, 255))
        sheets[os.path.basename(path)] = chunk
    # embedding hints: for each po item, top-3 catalog items by fused score (max over the item's official images)
    cat_cols = {}
    for c in cids:
        cols = []
        for f in catalog[c]["images"]:
            oid = file2oid.get(f)
            if oid: cols += ocol.get(oid, [])
        cat_cols[c] = sorted(set(cols))
    hints = {}
    for n, v in po.items():
        i = prow.get(v["po_id"])
        if i is None: continue
        sc = [(c, float(F[i, cat_cols[c]].max())) for c in cids if cat_cols[c]]
        sc.sort(key=lambda t: -t[1]); hints[n] = [[c, round(s, 2)] for c, s in sc[:3]]
    json.dump({"catalog": catalog, "po": po, "sheets": sheets, "hints": hints}, open(os.path.join(OUT, f"{grp}.json"), "w"),
              ensure_ascii=False, indent=0)
    print(grp, "catalog", len(cids), "po", len(pos), "hinted", len(hints), "cat-cols-missing", sum(1 for c in cids if not cat_cols[c]))
print(sorted(os.listdir(OUT)))
