"""Zero-shot item type for 발주 photos not covered by the photo-naming pass.
Usage: python3 -I clip_types.py <scratch_dir>
Writes data/types_clip.json {po_id: type}
"""
import json, os, sys, torch, open_clip
from PIL import Image
S = sys.argv[1]; D = os.path.join(S, "data"); torch.set_num_threads(2)
po = {p["id"]: p for p in json.load(open(os.path.join(D, "po.json")))}
ids = json.load(open(os.path.join(D, "rest_for_clip.json")))
model, _, pre = open_clip.create_model_and_transforms("ViT-B-16", pretrained="laion2b_s34b_b88k"); model.eval()
tok = open_clip.get_tokenizer("ViT-B-16")
labels = [("반지", "a photo of a ring"), ("반지", "a ring worn on a finger"), ("목걸이", "a photo of a necklace"),
          ("목걸이", "a pendant necklace worn on the neck"), ("팔찌", "a photo of a bracelet"), ("팔찌", "a bracelet worn on a wrist"),
          ("뱅글", "a metal bangle cuff"), ("귀걸이", "a pair of earrings"), ("키링", "a keychain"), ("헤어핀", "a hair clip"),
          ("신발 장식", "shoe charms"), ("케이블", "a charging cable"), ("포장재", "a plastic packaging bag"), ("포장재", "a gift box"),
          ("가방", "a handbag"), ("생활용품", "a pillow or cushion"), ("생활용품", "a rug or mat"), ("생활용품", "a lamp"),
          ("네일팁", "press-on fake nails"), ("폰케이스", "a phone case")]
with torch.no_grad():
    T = model.encode_text(tok([t for _, t in labels])); T = torch.nn.functional.normalize(T, dim=-1)
out = {}
for i in range(0, len(ids), 32):
    batch = ids[i:i + 32]
    ims = torch.stack([pre(Image.open(po[pid]["file"]).convert("RGB")) for pid in batch])
    with torch.no_grad():
        E = torch.nn.functional.normalize(model.encode_image(ims), dim=-1)
    best = (E @ T.T).argmax(dim=1).tolist()
    for pid, b in zip(batch, best):
        out[pid] = labels[b][0]
json.dump(out, open(os.path.join(D, "types_clip.json"), "w"), ensure_ascii=False)
import collections; print(collections.Counter(out.values()))
