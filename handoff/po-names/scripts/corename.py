"""Official product name -> short '이름만' name (e.g. 'Coffs S925 Ring (2 color)' -> 'Coffs')."""
import re, unicodedata

CATEGORY = [
    "Necklace Bracelet", "Open Ring", "Opne Ring", "Hair pin", "Smart Tok",
    "Keyhchain", "Keychain", "Necklace", "Bracelet", "Bangle", "Earrings", "Earring",
    "Anklet", "Choker", "Pendant", "Brooch", "Ring",
]
MATERIAL = re.compile(r"\b(?:S925|Silver ?925|925)\b", re.I)

def strip_marks(s):
    # 야르 쪽 장식용 결합문자(U+0591 등) 제거, 악센트 문자(ş, á, š)는 유지
    return "".join(ch for ch in s if not (unicodedata.category(ch) == "Mn" and 0x0591 <= ord(ch) <= 0x05C7))

def core_name(name):
    s = strip_marks(name).strip()
    s = re.sub(r"^\s*\[[^\]]*\]\s*", "", s)          # [SILVER925]
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)            # (black Set), (2 color) ...
    s = MATERIAL.sub(" ", s)
    full = re.sub(r"\s+", " ", s).strip()
    out = full
    for c in CATEGORY:
        out = re.sub(r"\b" + re.escape(c) + r"\b", " ", out, flags=re.I)
    out = re.sub(r"\s+", " ", out).strip()
    if len(out) < 2:          # 'P Keychain' 처럼 이름이 한 글자면 종류까지 유지
        return full
    return out

def is_set(name):
    return " + " in name

if __name__ == "__main__":
    import json, sys
    rows = json.load(open(sys.argv[1]))
    for r in rows:
        print(f"{r['brand']:3} | {r['name'][:48]:48} -> {core_name(r['name'])}{'   [SET-skip]' if is_set(r['name']) else ''}")
