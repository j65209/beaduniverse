"""Catalog sheets of still-unlinked official products, grouped by item type.
Usage: python3 -I make_catalog.py <scratch_dir>
Writes catalog/cat_<type>_<k>.jpg + catalog/catalog.json
"""
import json, os, sys, collections
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from corename import core_name, is_set
S = sys.argv[1]; D = os.path.join(S, "data"); OUT = os.path.join(S, "catalog"); os.makedirs(OUT, exist_ok=True)
off = {r["id"]: r for r in json.load(open(os.path.join(D, "official.json")))}
board = json.load(open(os.path.join(S, "board", "data.json")))
TYPE_EN = {"반지": "ring", "목걸이": "necklace", "팔찌": "bracelet", "뱅글": "bracelet", "키링": "bracelet"}
def otype(full):
    f = full.lower()
    for k, t in [("necklace bracelet", "팔찌"), ("bracelet", "팔찌"), ("bangle", "뱅글"), ("necklace", "목걸이"), ("ring", "반지"),
                 ("opne ring", "반지"), ("keyhchain", "키링"), ("keychain", "키링")]:
        if k in f: return t
    return "기타"
groups = collections.defaultdict(list)
for u in board["unmatched"]:
    brand = "6A" if u["brand"] == "6A" else "YAR"
    oids = [oid for oid, r in off.items() if r["brand"] == brand and not is_set(r["name"]) and core_name(r["name"]) == u["name"] and r["files"]]
    files = [f for oid in oids for f in off[oid]["files"]]
    groups[TYPE_EN[otype(u["full"])]].append({"key": u["key"], "brand": u["brand"], "name": u["name"], "full": u["full"], "images": files})
F = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 14)
T, PAD, LH, COLS, PER = 175, 6, 22, 8, 32
def tile(p):
    im = Image.open(p).convert("RGB"); im.thumbnail((T, T)); bg = Image.new("RGB", (T, T), "white")
    bg.paste(im, ((T - im.width) // 2, (T - im.height) // 2)); return bg
catalog = {}
for typ, items in groups.items():
    for k, s in enumerate(range(0, len(items), PER)):
        chunk = items[s:s + PER]; rows = (len(chunk) + COLS - 1) // COLS
        sh = Image.new("RGB", (COLS * (T + PAD) + PAD, rows * (T + LH + PAD) + PAD), (40, 40, 40)); d = ImageDraw.Draw(sh)
        for i, it in enumerate(chunk):
            cid = f"{typ[0].upper()}{s + i}"; it["cid"] = cid
            x = PAD + (i % COLS) * (T + PAD); y = PAD + (i // COLS) * (T + LH + PAD)
            sh.paste(tile(it["images"][0]), (x, y))
            d.text((x + 2, y + T + 2), f"{cid} {it['name'][:16]}", fill="white", font=F)
            catalog[cid] = it
        sh.save(os.path.join(OUT, f"cat_{typ}_{k}.jpg"), quality=84)
json.dump(catalog, open(os.path.join(OUT, "catalog.json"), "w"), ensure_ascii=False, indent=1)
print({t: len(v) for t, v in groups.items()}, "sheets:", sorted(os.listdir(OUT)))
