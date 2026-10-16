#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""data/all_groups.json tutarlılık kontrolleri.

- 30 grup x 100 kelime; seviye toplamları A1=900, A2=800, B1=700, B2=600.
- Her kelimede tr dolu.
- ok dolu ise: yalnız Türkçe harfler + tire, heceler tireli, en az bir hece
  TAMAMEN BÜYÜK (vurgu). en/ex de dolu olmalı.
- ex dolu ise kelimeyi (ya da bir çekimini) içermeli — <b>...</b> işaretli.
- Okunuş Amerikan söyleyişine göre (uygulama US sesi çalar): data/sources/ipa_ref.json'da
  İngiliz /ɒ/ → Amerikan /ɑ/ olan kelimede "O" değil "A" (hot → HAT), İngiliz /ɑː/ →
  Amerikan /æ/ olanda "A" değil "E" (ask → ESK) yazılır.
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

# İngiliz söyleyişinden kalan sesli: o / a (ou, oy, au, ay ikili sesleri değil).
UK_O = re.compile(r"[oO](?![uUyY])")
UK_A = re.compile(r"[aA](?![uUyY])")


def err(msg):
    errors.append(msg)


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


def ipa_of(ipa_ref, w):
    w = re.sub(r"\s*\(.*?\)", "", w).split(",")[0].strip()
    e = ipa_ref.get(w) or ipa_ref.get(w.lower())
    return (e[0].get("ipa_uk", ""), e[0].get("ipa_us", "")) if e else None


def check_us(gno, w, ok, ipa_ref):
    # Sayılar tutuyorsa (ör. İngilizcede 1 /ɒ/, okunuşta 1 tane "o") okunuş İngiliz söyleyişinde
    # kalmış demektir. Tutmuyorsa kelime elle yazılmıştır (ör. vurgu yeri farklı), dokunulmaz.
    ipa = ipa_of(ipa_ref, w)
    if not ipa:
        return
    uk, us = ipa
    n_ae = us.count("æ") - uk.count("æ") if "ɑː" in uk else 0
    n_a = us.count("ɑ") - uk.count("ɑ") + max(n_ae, 0) if "ɒ" in uk else 0
    n_o = len(UK_O.findall(ok))
    a_dan = max(n_a - n_o, 0) if n_a > 0 else 0   # o'dan çevrilmiş a'lar (contrast → KAN-trest) sayılmaz
    if n_ae > 0 and len(UK_A.findall(ok)) - a_dan == n_ae:
        err(f"G{gno} {w!r}: okunuş İngiliz söyleyişi ({uk}); Amerikan {us} → 'a' yerine 'e': {ok!r}")
    if n_a > 0 and n_o == n_a:
        err(f"G{gno} {w!r}: okunuş İngiliz söyleyişi ({uk}); Amerikan {us} → 'o' yerine 'a': {ok!r}")


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


def main():
    groups = json.load(open(ROOT / "data" / "all_groups.json", encoding="utf-8"))
    ipa_ref = json.load(open(ROOT / "data" / "sources" / "ipa_ref.json", encoding="utf-8"))
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
                check_us(gno, w, ok, ipa_ref)
                if not en:
                    err(f"G{gno} {w!r}: ok dolu ama en boş")
                if not ex:
                    err(f"G{gno} {w!r}: ok dolu ama ex boş")
            if ex:
                check_ex(gno, w, ex)
    want = {"A1": 900, "A2": 800, "B1": 700, "B2": 600}
    if totals != want:
        err(f"seviye toplamları {totals} != {want}")
    if errors:
        print(f"{len(errors)} HATA:")
        for e in errors[:80]:
            print(" -", e)
        sys.exit(1)
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("OK — kontrol geçti. Okunuşu tam gruplar:", done)


if __name__ == "__main__":
    main()
