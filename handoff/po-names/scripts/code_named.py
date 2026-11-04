"""발주 items whose visible name is only a code / number / price / URL / empty (not Chinese, but unreadable).
Usage: python3 -I code_named.py <scratch_dir> <orders.json> <overrides.json> [per_sheet]
Writes data/code_named.json (list) and namesheets2/cs_XX.jpg/json (photo sheets for naming)
"""
import json, os, re, sys, unicodedata
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from corename import core_name
S, ORD, OV = sys.argv[1], sys.argv[2], sys.argv[3]; PER = int(sys.argv[4]) if len(sys.argv) > 4 else 24
D = os.path.join(S, "data"); OUT = os.path.join(S, "namesheets2"); os.makedirs(OUT, exist_ok=True)
P = json.load(open(ORD))["products"]; ov = json.load(open(OV, encoding="utf-8"))
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}
off = json.load(open(os.path.join(D, "official.json")))

def norm(s):
    s = unicodedata.normalize("NFKD", s or ""); s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())

offn = {norm(core_name(r["name"])) for r in off}
HANG = re.compile(r"[가-힣]")
def is_real_name(n):
    return bool(re.search(r"[A-Za-z]{3,}", n)) and not re.search(r"http|^[A-Z]{2,5}-?\d|\d+\s*[*xX]\s*\d+", n)

items = []
for p in P:
    pid = p["id"]
    if pid in ov["deleted_ids"] or pid in ov["overrides"] or pid in ov["auto_overrides"]:
        continue
    name = p.get("kor") or p.get("cn") or ""
    if HANG.search(name) or norm(re.sub(r"\s+(bk|sv|gd|a|b)$", "", name, flags=re.I)) in offn or is_real_name(name):
        continue
    f = (po.get(pid) or {}).get("file")
    items.append({"po_id": pid, "kor": p.get("kor") or "", "cn": (p.get("cn") or "").replace("\n", " "), "file": f})
json.dump(items, open(os.path.join(D, "code_named.json"), "w"), ensure_ascii=False, indent=1)
withimg = [it for it in items if it["file"]]
print("code-named:", len(items), "with photo:", len(withimg))
F = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 14)
FB = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 16)
T, PAD, LH, COLS = 230, 8, 46, 6
def tile(path):
    im = Image.open(path).convert("RGB"); im.thumbnail((T, T))
    bg = Image.new("RGB", (T, T), "white"); bg.paste(im, ((T - im.width) // 2, (T - im.height) // 2)); return bg
for n, s in enumerate(range(0, len(withimg), PER)):
    chunk = withimg[s:s + PER]; rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (T + PAD) + PAD, rows * (T + LH + PAD) + PAD), (230, 230, 230)); d = ImageDraw.Draw(sheet)
    meta = []
    for i, it in enumerate(chunk):
        num = s + i; x = PAD + (i % COLS) * (T + PAD); y = PAD + (i // COLS) * (T + LH + PAD)
        sheet.paste(tile(it["file"]), (x, y))
        d.rectangle([x, y, x + 46, y + 22], fill=(20, 20, 20)); d.text((x + 4, y + 1), f"#{num}", fill="white", font=FB)
        txt = (it["kor"] + " / " + it["cn"]).strip(" /")
        d.text((x, y + T + 2), txt[:18], fill="black", font=F); d.text((x, y + T + 22), txt[18:36], fill=(90, 90, 90), font=F)
        meta.append({"n": num, "po_id": it["po_id"], "image": it["file"], "option_text": txt})
    sheet.save(os.path.join(OUT, f"cs_{n:02d}.jpg"), quality=82)
    json.dump(meta, open(os.path.join(OUT, f"cs_{n:02d}.json"), "w"), ensure_ascii=False, indent=1)
print("sheets:", sorted(f for f in os.listdir(OUT) if f.endswith(".jpg")))
