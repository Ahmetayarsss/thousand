#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""data/all_groups.json tutarlılık kontrolleri.

- 30 grup x 100 kelime; seviye toplamları A1=900, A2=800, B1=700, B2=600.
- Her kelimede tr ve cam dolu; cam linki english-turkish biçiminde.
- ok dolu ise: yalnız Türkçe harfler + tire, heceler tireli, en az bir hece
  TAMAMEN BÜYÜK (vurgu). en/ex de dolu olmalı.
- ex dolu ise kelimeyi (ya da bir çekimini) içermeli — <b>...</b> işaretli.
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


def check_ok(gno, w, ok):
    if not OK_RE.match(ok):
        err(f"G{gno} {w!r}: okunuşta izinsiz karakter: {ok!r}")
        return
    syls = ok.split("-")
    stressed = [s for s in syls if s == s.upper() and s != s.lower()]
    if len(syls) > 1 and not stressed:
        err(f"G{gno} {w!r}: vurgulu (BÜYÜK) hece yok: {ok!r}")
    for s in syls:
        if s not in (s.upper(), s.lower()):
            err(f"G{gno} {w!r}: hece karışık büyük/küçük: {ok!r}")


def check_ex(gno, w, ex):
    m = re.search(r"<b>(.+?)</b>", ex)
    if not m:
        err(f"G{gno} {w!r}: örnekte <b>kelime</b> yok: {ex!r}")
        return
    marked = m.group(1).lower()
    base = w.lower()
    if base not in marked and marked not in base and not marked.startswith(base[:4]):
        err(f"G{gno} {w!r}: işaretli kelime uyumsuz: {marked!r}")


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
            cam = it.get("cam", "")
            if not re.match(r"^https://dictionary\.cambridge\.org/dictionary/english-turkish/[a-z0-9-]+$", cam):
                err(f"G{gno} {w!r}: cam linki bozuk: {cam!r}")
            ok, en, ex = it.get("ok", ""), it.get("en", ""), it.get("ex", "")
            if ok:
                check_ok(gno, w, ok)
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
