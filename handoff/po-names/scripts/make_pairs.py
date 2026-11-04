"""Render verification sheets of proposed matches: [official | 발주 image] pairs.

Usage: python3 -I make_pairs.py <scratch_dir> <decisions.json> <out_prefix> [pairs_per_sheet]
decisions entries need: po_id, off_id, name, level (+ optional idx)
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

scratch, dec_path, prefix = sys.argv[1:4]
PPS = int(sys.argv[4]) if len(sys.argv) > 4 else 20
D = os.path.join(scratch, "data"); OUT = os.path.join(scratch, "verify"); os.makedirs(OUT, exist_ok=True)
official = {r["id"]: r for r in json.load(open(os.path.join(D, "official.json")))}
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}
dec = json.load(open(dec_path))
FONT = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 14)
T, PAD, LH, COLS = 190, 8, 40, 4
PW = T * 2 + PAD
def tile(path, size):
    bg = Image.new("RGB", (size, size), "white")
    if path and os.path.exists(path):
        im = Image.open(path).convert("RGB"); im.thumbnail((size, size))
        bg.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return bg
for s in range(0, len(dec), PPS):
    chunk = dec[s:s + PPS]; rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (PW + PAD * 2) + PAD, rows * (T + LH + PAD) + PAD), (225, 225, 225))
    d = ImageDraw.Draw(sheet)
    for i, x in enumerate(chunk):
        cx = PAD + (i % COLS) * (PW + PAD * 2); cy = PAD + (i // COLS) * (T + LH + PAD)
        off = official[x["off_id"]]
        sheet.paste(tile(off["files"][0] if off["files"] else None, T), (cx, cy))
        sheet.paste(tile(po[x["po_id"]].get("file"), T), (cx + T + PAD, cy))
        d.line([cx + T + PAD // 2, cy, cx + T + PAD // 2, cy + T], fill="red", width=3)
        tag = "S" if x["level"] == "sure" else "M"
        d.text((cx, cy + T + 2), f"P{s + i} [{tag}] {x['name'][:20]}", fill="black", font=FONT)
        d.text((cx, cy + T + 20), (po[x["po_id"]].get("kor") or po[x["po_id"]].get("cn") or "")[:24], fill=(80, 80, 80), font=FONT)
    sheet.save(os.path.join(OUT, f"{prefix}_{s // PPS:02d}.jpg"), quality=82)
print("pairs", len(dec), "sheets", (len(dec) + PPS - 1) // PPS)
