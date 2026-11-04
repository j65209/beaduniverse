"""Fuse similarity matrices and render review sheets (official product row + top-K 발주 candidates).

Usage: python3 -I make_sheets.py <scratch_dir> [K] [rows_per_sheet]
Writes:
  data/cands.json           per official product: top-K candidates (po idx, po id, fused score)
  data/po_index.json        idx -> po id (labels '#idx' on sheets)
  sheets/sheet_XX.jpg       review sheets
"""
import json, os, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from corename import core_name, is_set

scratch = sys.argv[1]; K = int(sys.argv[2]) if len(sys.argv) > 2 else 8
RPS = int(sys.argv[3]) if len(sys.argv) > 3 else 8
D = os.path.join(scratch, "data"); OUT = os.path.join(scratch, "sheets"); os.makedirs(OUT, exist_ok=True)
official = {r["id"]: r for r in json.load(open(os.path.join(D, "official.json")))}
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}

mats = []
for key in ("clip", "dino"):
    f = os.path.join(D, f"sim_{key}.npz")
    if os.path.exists(f):
        z = np.load(f, allow_pickle=True); S = z["S"]
        S = (S - S.mean()) / S.std()           # 모델별 점수 분포 정규화
        mats.append((z["po_ids"], z["off_ids"], S))
po_ids, off_ids = mats[0][0], mats[0][1]
for a, b, _ in mats:
    assert (a == po_ids).all() and (b == off_ids).all()
F = sum(m[2] for m in mats) / len(mats)
np.save(os.path.join(D, "fused.npy"), F)
json.dump({"po_ids": po_ids.tolist(), "off_ids": off_ids.tolist()}, open(os.path.join(D, "fused_index.json"), "w"))

po_index = {i: pid for i, pid in enumerate(po_ids.tolist())}
json.dump(po_index, open(os.path.join(D, "po_index.json"), "w"))

# 이미 이름이 정해진 발주 상품(직접 수정 22개 + 원래 이름이 공홈 이름과 같은 것)은 후보에서 제외
ov = json.load(open("/home/claude/beaduniverse/data/product-name-overrides.json"))
cores_l = {core_name(r["name"]).lower() for r in official.values() if not is_set(r["name"])}
named = set(ov.get("overrides", {}))
for p in po.values():
    if (p.get("kor") or "").strip().lower() in cores_l:
        named.add(p["id"])
keep = np.array([pid not in named for pid in po_ids.tolist()])
Fm = np.where(keep[:, None], F, -99.0)
best_j = Fm.argmax(axis=1)
rows = []
for j, oid in enumerate(off_ids.tolist()):
    r = official[oid]
    if is_set(r["name"]):
        continue
    order = [int(i) for i in np.argsort(-Fm[:, j])[:K] if Fm[i, j] > -50]
    extra = [int(i) for i in np.where((best_j == j) & (Fm[:, j] > 1.5))[0] if int(i) not in order]
    extra = sorted(extra, key=lambda i: -Fm[i, j])[:max(0, 10 - len(order))]
    rows.append({"off_id": oid, "brand": r["brand"], "name": r["name"], "core": core_name(r["name"]),
                 "files": r["files"],
                 "cands": [{"idx": i, "po_id": po_index[i], "z": round(float(F[i, j]), 2)} for i in order + extra]})
K = max(len(r["cands"]) for r in rows)
json.dump(rows, open(os.path.join(D, "cands.json"), "w"), ensure_ascii=False, indent=0)

def font(sz):
    for p in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
F14, F12 = font(15), font(12)
OW, CW, PAD, LH = 170, 150, 6, 50
W = PAD + OW * 2 + PAD + K * (CW + PAD)
RH = max(OW, CW) + LH + PAD

def tile(path, size):
    im = Image.open(path).convert("RGB"); im.thumbnail((size, size))
    bg = Image.new("RGB", (size, size), "white"); bg.paste(im, ((size - im.width) // 2, (size - im.height) // 2)); return bg

for s in range(0, len(rows), RPS):
    chunk = rows[s:s + RPS]
    sheet = Image.new("RGB", (W, RH * len(chunk) + PAD), (235, 235, 235)); d = ImageDraw.Draw(sheet)
    for ri, r in enumerate(chunk):
        y = PAD + ri * RH; x = PAD
        d.rectangle([0, y - 2, W, y + RH - 4], fill=(255, 250, 225) if ri % 2 else (250, 250, 250))
        for k in range(2):
            if k < len(r["files"]):
                sheet.paste(tile(r["files"][k], OW), (x + k * OW, y))
        d.text((x, y + OW + 2), f"R{s + ri}  {r['brand']} | {r['core']}", fill="black", font=F14)
        x = PAD + OW * 2 + PAD
        d.line([x - 4, y, x - 4, y + RH - 8], fill="red", width=3)
        for c in r["cands"]:
            p = po[c["po_id"]]
            if p.get("file"):
                sheet.paste(tile(p["file"], CW), (x, y))
            d.text((x, y + CW + 1), f"#{c['idx']}  z{c['z']}", fill="blue", font=F12)
            label = (p.get("kor") or p.get("cn") or "").replace("\n", " ")[:13]
            d.text((x, y + CW + 17), label, fill=(90, 90, 90), font=F12)
            x += CW + PAD
    sheet.save(os.path.join(OUT, f"sheet_{s // RPS:02d}.jpg"), quality=82)
    meta = []
    for ri, r in enumerate(chunk):
        meta.append({"row": s + ri, "brand": r["brand"], "official_name": r["name"], "core": r["core"],
                     "official_images": r["files"],
                     "cands": [{"idx": c["idx"], "z": c["z"], "image": po[c["po_id"]].get("file"),
                                "kor": po[c["po_id"]].get("kor", ""), "cn": po[c["po_id"]].get("cn", "")}
                               for c in r["cands"]]})
    json.dump(meta, open(os.path.join(OUT, f"sheet_{s // RPS:02d}.json"), "w"), ensure_ascii=False, indent=1)
print("rows", len(rows), "sheets", (len(rows) + RPS - 1) // RPS)
