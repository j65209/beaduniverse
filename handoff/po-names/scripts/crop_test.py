"""Experiment: does object-cropping official images + multi-crop 발주 images improve ranking?
Measured on the 67 already-known pairs (reverse rank: true official product among 291).
Usage: python3 -I crop_test.py <scratch_dir>
"""
import json, os, sys, numpy as np, torch, timm
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from corename import core_name, is_set

S = sys.argv[1]; D = os.path.join(S, "data")
torch.set_num_threads(2)
official = [r for r in json.load(open(os.path.join(D, "official.json"))) if r["files"]]
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}
known = json.load(open(os.path.join(D, "known_pairs.json")))
model = timm.create_model("vit_small_patch14_dinov2.lvd142m", pretrained=True, num_classes=0, img_size=224).eval()
cfg = timm.data.resolve_data_config({"input_size": (3, 224, 224), "crop_pct": 1.0}, model=model)
tf = timm.data.create_transform(**cfg)

def enc(ims):
    out = []
    for i in range(0, len(ims), 32):
        with torch.no_grad():
            f = model(torch.stack([tf(x) for x in ims[i:i + 32]]))
        out.append(torch.nn.functional.normalize(f, dim=-1).numpy())
    return np.concatenate(out)

def obj_crop(im):
    a = np.asarray(im.convert("RGB")).astype(int)
    bg = a[[0, 0, -1, -1], [0, -1, 0, -1]].mean(axis=0)
    mask = np.abs(a - bg).sum(axis=2) > 60
    if mask.sum() < 50:
        return im
    ys, xs = np.where(mask); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    h, w = y1 - y0, x1 - x0; s = int(max(h, w) * 1.15) + 2; cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    box = (cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2)
    canvas = Image.new("RGB", (s, s), tuple(int(v) for v in bg))
    canvas.paste(im.convert("RGB").crop(box), (0, 0))
    return canvas

def multi_crops(im):
    im = im.convert("RGB"); W, H = im.size; out = [im]
    for f in (0.6, 0.4):
        w, h = int(W * f), int(H * f); out.append(im.crop(((W - w) // 2, (H - h) // 2, (W + w) // 2, (H + h) // 2)))
    w, h = int(W * 0.6), int(H * 0.6)
    for x0 in (0, W - w):
        for y0 in (0, H - h):
            out.append(im.crop((x0, y0, x0 + w, y0 + h)))
    return out

off_imgs, off_owner = [], []
for j, r in enumerate(official):
    for f in r["files"]:
        im = Image.open(f).convert("RGB"); off_imgs += [im, obj_crop(im)]; off_owner += [j, j]
E_off = enc(off_imgs); owner = np.array(off_owner); full_mask = np.array([k % 2 == 0 for k in range(len(off_imgs))])
core_of = [core_name(r["name"]).lower() for r in official]
base_r, new_r = [], []
for k in known:
    p = po[k["po_id"]]
    if not p.get("file"):
        continue
    crops = multi_crops(Image.open(p["file"]))
    E = enc(crops)
    sim = E @ E_off.T
    def score(s_img, use_mask):
        sc = np.full(len(official), -9.0)
        for j in range(len(official)):
            m = (owner == j) & use_mask
            sc[j] = s_img[:, m].max()
        return sc
    b = score(sim[:1], full_mask)                    # 기존: 전체 이미지 vs 공홈 원본
    n = score(sim, np.ones_like(full_mask))          # 새 방식: 여러 크롭 vs 공홈 원본+물체 크롭
    true = [j for j in range(len(official)) if core_of[j] == k["name"]]
    base_r.append(min(int((b > b[j]).sum()) + 1 for j in true))
    new_r.append(min(int((n > n[j]).sum()) + 1 for j in true))
b, n = np.array(base_r), np.array(new_r)
for name, r in (("base(full only)", b), ("multi-crop", n)):
    print(f"{name:16} top1 {(r==1).sum():2}  <=3 {(r<=3).sum():2}  <=10 {(r<=10).sum():2}  <=20 {(r<=20).sum():2}  median {int(np.median(r))}  (n={len(r)})")
