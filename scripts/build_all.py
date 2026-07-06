#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Oxford 3000 üretim hattı.

1. data/all_groups.json'u yükler (30 grup x 100 kelime).
2. scripts/enrich/ altındaki grup modüllerini uygular (ok/en/ex alanları).
3. data/all_groups.json'u günceller.
4. templates/ içindeki şablonlardan iki HTML'i üretir:
   - Oxford3000_30grup_sesli.html  (tam alanlar: w,pos,sec,tr,ok,en,ex,cam)
   - Oxford3000_kartlar.html       (kart alanları: w,tr,ok,ex — ex'te <b> etiketi yok)

Yeni bir grup zenginleştirildiğinde: scripts/enrich/gN.py oluştur ve
aşağıdaki ENRICH_MODS listesine "gN" ekle, sonra bu scripti çalıştır.
"""
import importlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "enrich"))

ENRICH_MODS = ["g2", "g3"]


def load_groups():
    with open(ROOT / "data" / "all_groups.json", encoding="utf-8") as f:
        return json.load(f)


def apply_enrichment(groups):
    by_no = {g["no"]: g for g in groups}
    for name in ENRICH_MODS:
        mod = importlib.import_module(name)
        grp = by_no[mod.GRUP_NO]
        data = mod.DATA
        missing = [it["w"] for it in grp["items"] if it["w"] not in data]
        extra = [w for w in data if w not in {it["w"] for it in grp["items"]}]
        if missing or extra:
            raise SystemExit(f"{name}: eksik kelime {missing[:5]} / fazla kelime {extra[:5]}")
        for it in grp["items"]:
            ok, en, ex = data[it["w"]]
            it["ok"], it["en"], it["ex"] = ok, en, ex
    return groups


def render(groups):
    sesli_groups = groups
    kart_groups = [
        {
            "no": g["no"], "level": g["level"], "lo": g["lo"], "hi": g["hi"],
            "items": [
                {"w": it["w"], "tr": it["tr"], "ok": it.get("ok", ""),
                 "ex": re.sub(r"</?b>", "", it.get("ex", ""))}
                for it in g["items"]
            ],
        }
        for g in groups
    ]
    for tpl, data, out in [
        ("sesli_template.html", sesli_groups, "Oxford3000_30grup_sesli.html"),
        ("kartlar_template.html", kart_groups, "Oxford3000_kartlar.html"),
    ]:
        html = (ROOT / "templates" / tpl).read_text(encoding="utf-8")
        blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        html = html.replace("__GROUPS_JSON__", blob)
        (ROOT / out).write_text(html, encoding="utf-8")
        print(f"{out}: {len(html)} bayt")


def main():
    groups = apply_enrichment(load_groups())
    with open(ROOT / "data" / "all_groups.json", "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=1)
    render(groups)
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("okunuşu tam gruplar:", done)


if __name__ == "__main__":
    main()
