"""Download official (6A/야르) catalog images and 발주(1688) product images.

Usage: python3 -I download_images.py <scratch_dir> <orders.json> <overrides.json>
Writes:
  <scratch>/data/official.json        catalog rows with resolved URLs + local files
  <scratch>/data/po.json              visible 발주 products with local image file
  <scratch>/data/img/off/*, img/po/*  normalized RGB JPEGs (max 512px)
"""
import json, os, sys, io, glob, time, hashlib, concurrent.futures as cf
import urllib.request
from PIL import Image, ImageSequence

scratch, orders_path, ov_path = sys.argv[1:4]
D = os.path.join(scratch, "data")
OFF_DIR = os.path.join(D, "img", "off"); PO_DIR = os.path.join(D, "img", "po")
os.makedirs(OFF_DIR, exist_ok=True); os.makedirs(PO_DIR, exist_ok=True)

PREFIX = {
    ("6A", "c"): "https://cdn.sixshop.io/commerce/public/stores/6ashop/products/",
    ("6A", "m"): "https://contents.sixshop.com/uploadedFiles/184096/product/",
    ("YAR", "y"): "https://cdn.sixshop.io/commerce/public/stores/yarshop/products/",
    ("YAR", "m274464"): "https://contents.sixshop.com/uploadedFiles/274464/product/",
    ("YAR", "m277817"): "https://contents.sixshop.com/uploadedFiles/277817/product/",
}

def load_official():
    rows = []
    for f in sorted(glob.glob(os.path.join(D, "official_*.tsv"))):
        for line in open(f, encoding="utf-8"):
            line = line.rstrip("\n")
            if not line.strip():
                continue
            parts = line.split("\t")
            pid, brand, name = parts[0], parts[1], parts[2]
            imgs = [x for x in (parts[3].split(",") if len(parts) > 3 else []) if x]
            urls = []
            for code in imgs:
                k, fn = code.split(":", 1)
                urls.append(PREFIX[(brand, k)] + fn)
            rows.append({"id": pid, "brand": brand, "name": name, "urls": urls})
    return rows

def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except Exception as e:  # noqa
            last = e
            time.sleep(1.5 * (i + 1))
    raise last

def to_jpeg(data, out):
    im = Image.open(io.BytesIO(data))
    if getattr(im, "is_animated", False):
        im = next(ImageSequence.Iterator(im))
    im = im.convert("RGBA")
    bg = Image.new("RGB", im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[-1])
    bg.thumbnail((512, 512))
    bg.save(out, "JPEG", quality=88)

def job(url, out):
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return out, None
    try:
        to_jpeg(fetch(url), out)
        return out, None
    except Exception as e:  # noqa
        return out, f"{type(e).__name__}: {e}"

official = load_official()
od = json.load(open(orders_path)); ov = json.load(open(ov_path))
deleted = ov.get("deleted_ids", {}); img_ov = ov.get("img_overrides", {})
po = []
for p in od["products"]:
    if p["id"] in deleted:
        continue
    url = img_ov.get(p["id"]) or p.get("img") or ""
    po.append({"id": p["id"], "kor": p.get("kor", ""), "cn": p.get("cn", ""), "url": url,
               "groups": p.get("groups", []), "orders": p.get("order_count", 0),
               "latest": p.get("latest_date", "")})

tasks = []
for r in official:
    r["files"] = []
    for k, u in enumerate(r["urls"]):
        f = os.path.join(OFF_DIR, f"{r['id']}_{k}.jpg"); r["files"].append(f); tasks.append((u, f))
for p in po:
    if p["url"]:
        h = hashlib.md5(p["id"].encode()).hexdigest()[:10]
        p["file"] = os.path.join(PO_DIR, f"{h}.jpg"); tasks.append((p["url"], p["file"]))
    else:
        p["file"] = None

errs = {}
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    for out, err in ex.map(lambda t: job(*t), tasks):
        if err:
            errs[out] = err
for r in official:
    r["files"] = [f for f in r["files"] if f not in errs]
for p in po:
    if p["file"] in errs:
        p["err"] = errs[p["file"]]; p["file"] = None

json.dump(official, open(os.path.join(D, "official.json"), "w"), ensure_ascii=False, indent=0)
json.dump(po, open(os.path.join(D, "po.json"), "w"), ensure_ascii=False, indent=0)
print("official rows", len(official), "with >=1 image", sum(1 for r in official if r["files"]))
print("po rows", len(po), "with image", sum(1 for p in po if p["file"]))
print("errors", len(errs))
for k, v in list(errs.items())[:15]:
    print("  ", os.path.basename(k), v[:120])
