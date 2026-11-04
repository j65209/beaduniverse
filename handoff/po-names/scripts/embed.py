"""Embed official + 발주 images with one or more backbones; save similarity matrices.

Usage: python3 -I embed.py <scratch_dir> <model_key>
model_key: clip (open_clip ViT-B-16 laion2b) | dino (timm DINOv2 ViT-S/14)
Writes <scratch>/data/sim_<model_key>.npz with:
  S  [n_po x n_off] max cosine similarity over each official product's images
  po_ids, off_ids
"""
import json, os, sys, numpy as np, torch
from PIL import Image

scratch, key = sys.argv[1], sys.argv[2]
D = os.path.join(scratch, "data")
official = json.load(open(os.path.join(D, "official.json")))
po = json.load(open(os.path.join(D, "po.json")))
torch.set_num_threads(2)

if key == "clip":
    import open_clip
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-16", pretrained="laion2b_s34b_b88k")
    model.eval()
    def enc(batch):
        with torch.no_grad():
            f = model.encode_image(batch)
        return torch.nn.functional.normalize(f, dim=-1).numpy()
elif key == "dino":
    import timm
    model = timm.create_model("vit_small_patch14_dinov2.lvd142m", pretrained=True, num_classes=0, img_size=224)
    model.eval()
    cfg = timm.data.resolve_data_config({"input_size": (3, 224, 224), "crop_pct": 1.0}, model=model)
    preprocess = timm.data.create_transform(**cfg)
    def enc(batch):
        with torch.no_grad():
            f = model(batch)
        return torch.nn.functional.normalize(f, dim=-1).numpy()
else:
    raise SystemExit("unknown model")

def embed_files(files, bs=32):
    out = []
    for i in range(0, len(files), bs):
        ims = [preprocess(Image.open(f).convert("RGB")) for f in files[i:i + bs]]
        out.append(enc(torch.stack(ims)))
        print(f"  {key}: {min(i + bs, len(files))}/{len(files)}", flush=True)
    return np.concatenate(out) if out else np.zeros((0, 1))

off_rows = [r for r in official if r["files"]]
off_files, off_owner = [], []
for j, r in enumerate(off_rows):
    for f in r["files"]:
        off_files.append(f); off_owner.append(j)
po_rows = [p for p in po if p["file"]]
E_off = embed_files(off_files)
E_po = embed_files([p["file"] for p in po_rows])
sim_img = E_po @ E_off.T  # [n_po x n_off_images]
S = np.full((len(po_rows), len(off_rows)), -1.0, dtype=np.float32)
owner = np.array(off_owner)
for j in range(len(off_rows)):
    S[:, j] = sim_img[:, owner == j].max(axis=1)
np.savez(os.path.join(D, f"emb_{key}.npz"), E_off=E_off, off_owner=owner, E_po=E_po)
np.savez(os.path.join(D, f"sim_{key}.npz"), S=S,
         po_ids=np.array([p["id"] for p in po_rows]), off_ids=np.array([r["id"] for r in off_rows]))
print("saved", S.shape)
