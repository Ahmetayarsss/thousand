#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""data/all_groups.json tutarlılık kontrolleri.

- 30 grup x 100 kelime; seviye toplamları A1=900, A2=800, B1=700, B2=600.
- Her kelimede tr dolu.
- ok dolu ise: yalnız Türkçe harfler + tire, heceler tireli, en az bir hece
  TAMAMEN BÜYÜK (vurgu). en/ex de dolu olmalı.
- ex dolu ise kelimeyi (ya da bir çekimini) içermeli — <b>...</b> işaretli.
- ipucu (çok anlamlı kelimede ek anlamının kartta altında görünen açıklaması): {anlam: metin}; anahtar
  kelimenin anlamlarından biri olmalı (srs.js meanings ile aynı kural), metin İngilizce kelimeyi vermemeli.
- mobile/assets/audio/*.mp3: her ses bir kelimeye ait olmalı (adı uygulamadaki slugOf ile aynı
  kurala uyar — mobile/src/ses.js). Sesi olmayan kelimeler yalnız bildirilir; onları cihazın TTS'i okur.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

LOWER = "abcçdefgğhıijklmnoöprsştuüvyz"
UPPER = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"
OK_RE = re.compile(rf"^[{LOWER}{UPPER}]+(-[{LOWER}{UPPER}]+)*$")

errors = []

def err(msg):
    errors.append(msg)


def slug_of(w):
    # mobile/src/ses.js içindeki slugOf ile aynı: parantez atılır, virgülden önceki ilk biçim.
    b = re.sub(r"\(.*?\)", "", w).split(",")[0]
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", b.lower()))


def check_ok(gno, w, ok):
    # Çoklu-biçim kelimeler (ör. "a, an") " / " ile ayrılabilir; her parça ayrı denetlenir.
    for part in [p.strip() for p in ok.split("/")]:
        if not OK_RE.match(part):
            err(f"G{gno} {w!r}: okunuşta izinsiz karakter: {ok!r}")
            continue
        syls = part.split("-")
        stressed = [s for s in syls if s == s.upper() and s != s.lower()]
        if len(syls) > 1 and not stressed:
            err(f"G{gno} {w!r}: vurgulu (BÜYÜK) hece yok: {ok!r}")
        for s in syls:
            if s not in (s.upper(), s.lower()):
                err(f"G{gno} {w!r}: hece karışık büyük/küçük: {ok!r}")


def check_ex(gno, w, ex):
    # ex bir cümle listesidir; her cümlede <b>kelime</b> olmalı.
    sents = ex if isinstance(ex, list) else [ex]
    base = w.lower()
    for s in sents:
        m = re.search(r"<b>(.+?)</b>", s)
        if not m:
            err(f"G{gno} {w!r}: örnekte <b>kelime</b> yok: {s!r}")
            continue
        marked = m.group(1).lower()
        if base not in marked and marked not in base and not marked.startswith(base[:4]):
            err(f"G{gno} {w!r}: işaretli kelime uyumsuz: {marked!r}")


def meanings(tr):
    # srs.js meanings: ";" ile ayrılır; yalnız parantezden oluşan not anlam sayılmaz.
    return [m.strip() for m in tr.split(";") if re.sub(r"\([^)]*\)", "", m).strip(" ,/")]


def check_ipucu(gno, w, tr, ipucu):
    if not isinstance(ipucu, dict) or not ipucu:
        err(f"G{gno} {w!r}: ipucu {{anlam: metin}} olmalı")
        return
    ms = meanings(tr)
    if len(ms) < 2:
        err(f"G{gno} {w!r}: ipucu var ama kelime tek anlamlı (ipucu yalnız anlam kartında görünür)")
    for anlam, metin in ipucu.items():
        if anlam not in ms:
            err(f"G{gno} {w!r}: ipucu anahtarı {anlam!r} anlamlardan biri değil: {ms}")
        if not isinstance(metin, str) or not metin.strip():
            err(f"G{gno} {w!r}: ipucu {anlam!r} boş")
        elif re.search(rf"\b{re.escape(w.lower())}\b", metin.lower()):
            err(f"G{gno} {w!r}: ipucu {anlam!r} cevabı veriyor")


def main():
    groups = json.load(open(ROOT / "data" / "all_groups.json", encoding="utf-8"))
    if len(groups) != 30:
        err(f"grup sayısı {len(groups)} != 30")
    totals = {}
    for g in groups:
        gno = g["no"]
        if len(g["items"]) != 100:
            err(f"G{gno}: {len(g['items'])} kelime != 100")
        totals[g["level"]] = totals.get(g["level"], 0) + len(g["items"])
        for it in g["items"]:
            w = it["w"]
            if not it.get("tr"):
                err(f"G{gno} {w!r}: tr boş")
            ok, en, ex = it.get("ok", ""), it.get("en", ""), it.get("ex", "")
            if ok:
                check_ok(gno, w, ok)
                if not en:
                    err(f"G{gno} {w!r}: ok dolu ama en boş")
                if not ex:
                    err(f"G{gno} {w!r}: ok dolu ama ex boş")
            if ex:
                check_ex(gno, w, ex)
            if "ipucu" in it:
                check_ipucu(gno, w, it.get("tr", ""), it["ipucu"])
    want = {"A1": 900, "A2": 800, "B1": 700, "B2": 600}
    if totals != want:
        err(f"seviye toplamları {totals} != {want}")
    slugs = {slug_of(it["w"]) for g in groups for it in g["items"]}
    sesler = {f.stem for f in (ROOT / "mobile" / "assets" / "audio").glob("*.mp3")}
    for s in sorted(sesler - slugs):
        err(f"mobile/assets/audio/{s}.mp3: hiçbir kelimeye ait değil")
    sessiz = sorted(slugs - sesler)
    if errors:
        print(f"{len(errors)} HATA:")
        for e in errors[:80]:
            print(" -", e)
        sys.exit(1)
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("OK — kontrol geçti. Okunuşu tam gruplar:", done)
    print(f"Ses: {len(slugs) - len(sessiz)}/{len(slugs)} kelimenin kaydı var"
          + (f"; TTS okuyacak: {', '.join(sessiz)}" if sessiz else ""))


if __name__ == "__main__":
    main()
