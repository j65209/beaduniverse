"""Zoom helper for exhaustive official <-> 발주 comparison.
Usage:
  python3 -I xs_tool.py <scratch_dir> <grp> pairs "12:R5,40:R9"   # one row per pair: 발주 photo (big) | all official photos of that item
  python3 -I xs_tool.py <scratch_dir> <grp> po "12,13,14"         # 발주 photos at full size, 3 per row
  python3 -I xs_tool.py <scratch_dir> <grp> cat "R5,R9"           # every official photo of these catalog items
  python3 -I xs_tool.py <scratch_dir> <grp> crop 12 x0 y0 x1 y1   # crop of one 발주 photo (fractions 0-1), enlarged
Prints the path of the image it wrote (under xs/zoom/).
"""
import json, os, sys, hashlib
from PIL import Image, ImageDraw, ImageFont
S, grp, mode = sys.argv[1], sys.argv[2], sys.argv[3]
X = json.load(open(os.path.join(S, "xs", f"{grp}.json")))
OUT = os.path.join(S, "xs", "zoom"); os.makedirs(OUT, exist_ok=True)
F = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 18)

def fit(path, s):
    im = Image.open(path).convert("RGB"); im.thumbnail((s, s), Image.LANCZOS)
    bg = Image.new("RGB", (s, s), "white"); bg.paste(im, ((s - im.width) // 2, (s - im.height) // 2)); return bg

def save(img, key):
    p = os.path.join(OUT, f"{grp}_{mode}_{hashlib.md5(key.encode()).hexdigest()[:8]}.jpg"); img.save(p, quality=90); print(p)

if mode == "pairs":
    pairs = [x.split(":") for x in sys.argv[4].split(",") if x]
    BIG, SM, H = 460, 228, 30
    rows = []
    for n, cid in pairs:
        po = X["po"][str(int(n))]; c = X["catalog"][cid]
        imgs = c["images"][:8]
        cols = (len(imgs) + 1) // 2
        w = BIG + 12 + cols * (SM + 4); row = Image.new("RGB", (max(w, 900), BIG + H), (240, 240, 240)); d = ImageDraw.Draw(row)
        d.text((4, 4), f"발주 #{n}  ({po['name'][:30]})", fill=(0, 0, 160), font=F)
        d.text((BIG + 14, 4), f"공홈 {cid} {c['brand']} {c['full'][:44]}", fill=(170, 0, 0), font=F)
        row.paste(fit(po["file"], BIG), (0, H))
        for k, f in enumerate(imgs):
            row.paste(fit(f, SM), (BIG + 12 + (k // 2) * (SM + 4), H + (k % 2) * (SM + 4)))
        rows.append(row)
    W = max(r.width for r in rows); out = Image.new("RGB", (W, sum(r.height + 8 for r in rows)), (60, 60, 60)); y = 0
    for r in rows:
        out.paste(r, (0, y)); y += r.height + 8
    save(out, sys.argv[4])
elif mode in ("po", "cat"):
    keys = [x for x in sys.argv[4].split(",") if x]
    tiles = []
    for k in keys:
        if mode == "po":
            tiles.append((f"#{k}", X["po"][str(int(k))]["file"]))
        else:
            for f in X["catalog"][k]["images"]:
                tiles.append((k, f))
    s, cols = 420, 3
    rows = (len(tiles) + cols - 1) // cols
    out = Image.new("RGB", (cols * (s + 6), rows * (s + 30)), (60, 60, 60)); d = ImageDraw.Draw(out)
    for i, (lab, f) in enumerate(tiles):
        x = (i % cols) * (s + 6); y = (i // cols) * (s + 30)
        out.paste(fit(f, s), (x, y + 28)); d.text((x + 4, y + 2), lab, fill=(255, 255, 255), font=F)
    save(out, mode + sys.argv[4])
elif mode == "crop":
    n = sys.argv[4]; x0, y0, x1, y1 = map(float, sys.argv[5:9])
    im = Image.open(X["po"][str(int(n))]["file"]).convert("RGB"); W, H = im.size
    c = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))); c = c.resize((c.width * 900 // max(c.size), c.height * 900 // max(c.size)), Image.LANCZOS)
    save(c, f"{n}-{x0}-{y0}-{x1}-{y1}")
