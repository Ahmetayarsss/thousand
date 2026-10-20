#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thousand üretim hattı.

1. data/all_groups.json'u yükler (30 grup x 100 kelime; okunuş, açıklama, örnekler dahil —
   içeriğin tek kaynağı bu dosya).
2. Örnek alanını (ex) liste biçimine getirip dosyayı geri yazar (biçim tek düze kalsın).
3. Uygulamanın kelime verisini ve ses haritasını üretir (mobile/src/uretilen/: kelimeler.json, sesler.js).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_groups():
    with open(ROOT / "data" / "all_groups.json", encoding="utf-8") as f:
        return json.load(f)


def normalize_examples(groups):
    """ex alanını her zaman liste (cümle listesi) yap."""
    for g in groups:
        for it in g["items"]:
            ex = it.get("ex", "")
            if isinstance(ex, str):
                it["ex"] = [ex] if ex else []
            else:
                it["ex"] = [s for s in ex if s]


# Grup içi sıra (ana sayfa, sınav, ilerleme hepsi aynı sırayı kullanır):
# isimler → fiiller → sıfatlar → zarflar → diğer, her biri alfabetik.
SEC_ORDER = ["İsimler", "Fiiller", "Sıfatlar", "Zarflar", "Diğer"]


def sort_items(groups):
    def k(it):
        sec = it.get("sec")
        return (SEC_ORDER.index(sec) if sec in SEC_ORDER else len(SEC_ORDER), it["w"].lower())
    return [dict(g, items=sorted(g["items"], key=k)) for g in groups]


def render_mobile(groups):
    """Uygulama (mobile/, React Native) için: sıralı kelime verisi ve ses haritası.

    Gruplar sort_items sırasıyla (srs.js anahtarları ve sırayı bundan üretir; eski uygulamayla aynı).
    Ses haritası: Metro sesleri yalnız statik require ile paketler; kelimenin adı slug_of ile.
    """
    groups = sort_items(groups)
    out = ROOT / "mobile" / "src" / "uretilen"
    out.mkdir(parents=True, exist_ok=True)
    veri = json.dumps(groups, ensure_ascii=False, separators=(",", ":"))
    (out / "kelimeler.json").write_text(veri + "\n", encoding="utf-8")
    sesler = sorted(p.stem for p in (ROOT / "mobile/assets/audio").glob("*.mp3"))
    satirlar = "".join(f'  "{s}": require("../../assets/audio/{s}.mp3"),\n' for s in sesler)
    (out / "sesler.js").write_text(
        "// Üretilen dosya (scripts/build_all.py) — elle düzenleme; kaynak mobile/assets/audio/*.mp3.\n"
        "// Kelimenin ses kaydı: slugOf(kelime) → paketlenmiş mp3.\n"
        "export default {\n" + satirlar + "};\n", encoding="utf-8")
    print(f"mobile/src/uretilen: kelimeler.json {len(veri)} bayt, {len(sesler)} ses")


def main():
    groups = load_groups()
    normalize_examples(groups)
    with open(ROOT / "data" / "all_groups.json", "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=1)
    render_mobile(groups)
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("okunuşu tam gruplar:", done)


if __name__ == "__main__":
    main()
