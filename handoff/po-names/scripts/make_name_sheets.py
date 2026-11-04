"""Contact sheets for photo-based Korean naming of translated 발주 items.
Usage: python3 -I make_name_sheets.py <scratch_dir> [per_sheet]
Writes namesheets/ns_XX.jpg + ns_XX.json
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; PER = int(sys.argv[2]) if len(sys.argv) > 2 else 24
D = os.path.join(S, "data"); OUT = os.path.join(S, "namesheets"); os.makedirs(OUT, exist_ok=True)
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}
tr = json.load(open(os.path.join(D, "translations_applied.json")))
items = [(pid, v) for pid, v in tr.items() if po.get(pid, {}).get("file")]
F = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 14)
FB = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 16)
T, PAD, LH, COLS = 230, 8, 46, 6
def tile(path):
    im = Image.open(path).convert("RGB"); im.thumbnail((T, T))
    bg = Image.new("RGB", (T, T), "white"); bg.paste(im, ((T - im.width) // 2, (T - im.height) // 2)); return bg
n = 0
for s in range(0, len(items), PER):
    chunk = items[s:s + PER]; rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (T + PAD) + PAD, rows * (T + LH + PAD) + PAD), (230, 230, 230)); d = ImageDraw.Draw(sheet)
    meta = []
    for i, (pid, v) in enumerate(chunk):
        num = s + i; x = PAD + (i % COLS) * (T + PAD); y = PAD + (i // COLS) * (T + LH + PAD)
        sheet.paste(tile(po[pid]["file"]), (x, y))
        d.rectangle([x, y, x + 46, y + 22], fill=(20, 20, 20)); d.text((x + 4, y + 1), f"#{num}", fill="white", font=FB)
        txt = v["src"].replace("\n", " ")
        d.text((x, y + T + 2), txt[:16], fill="black", font=F)
        d.text((x, y + T + 22), txt[16:32], fill=(90, 90, 90), font=F)
        meta.append({"n": num, "po_id": pid, "image": po[pid]["file"], "option_text": txt, "text_translation": v["ko"]})
    sheet.save(os.path.join(OUT, f"ns_{n:02d}.jpg"), quality=82)
    json.dump(meta, open(os.path.join(OUT, f"ns_{n:02d}.json"), "w"), ensure_ascii=False, indent=1)
    n += 1
print("items", len(items), "sheets", n)
