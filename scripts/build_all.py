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
import gzip
import importlib
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "enrich"))

# Uygulama sayfalarının <head>'ine eklenenler (sıra önemli: güncelleyici en önce,
# yönlendirme kararını diğer scriptlerden önce versin).
APP_HEAD = '<script src="updater.js"></script><script src="tts-bridge.js"></script>'

# Uygulama içi güncelleme paketine giren dosyalar (ses HARİÇ — ses APK'da gömülü).
WEB_BUNDLE_FILES = [
    "index.html", "kartlar.html", "sozluk.html", "istatistik.html",
    "tts-bridge.js", "progress.js", "srs.js", "updater.js", "three.min.js",
]


def write_web_bundle():
    """updater.js'i sürümler ve web-version.txt'yi yazar.

    web.json (ses HARİÇ sayfaların {ad: içerik} JSON'u) CI'da app/www'dan
    üretilip release'e yüklenir (bkz. build-apk.yml). Uygulama onu indirip
    cihaza açar; yeni APK kurmadan arayüz güncellenir. Sürüm (VER) her
    derlemede artan bir sayıdır (derleme zamanı, saniye).
    """
    ver = int(time.time())
    upd = (ROOT / "templates" / "updater.js").read_text(encoding="utf-8")
    upd = upd.replace("__WEBVER__", str(ver))
    (ROOT / "app/www/updater.js").write_text(upd, encoding="utf-8")
    # web.json: ses HARİÇ sayfaların {ad: içerik} JSON'u. Hem release'e yüklenir
    # hem de repoda tutulur ki raw.githubusercontent'ten de çekilebilsin.
    bundle = {}
    for name in WEB_BUNDLE_FILES:
        p = ROOT / "app/www" / name
        if p.exists():
            bundle[name] = p.read_text(encoding="utf-8")
    (ROOT / "web.json").write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    (ROOT / "web-version.txt").write_text(str(ver), encoding="utf-8")
    print(f"web paketi: sürüm {ver}, web.json {(ROOT / 'web.json').stat().st_size} bayt, "
          f"{len(bundle)} dosya")

ENRICH_MODS = ["g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g11", "g12", "g13", "g14", "g15", "g16", "g17", "g18", "g19", "g20", "g21", "g22", "g23", "g24", "g25", "g26", "g27", "g28", "g29", "g30"]

# Android uygulaması: menü yok. Sayfa sırası liste ⇄ kartlar ⇄ istatistik.
# Yatay kaydırma: sola → NEXT sayfa, sağa → PREV sayfa (boş ise o yön no-op).
# Slider/buton/link/select üzerindeki dokunuşlar hariç (yanlış tetiklenmesin).
def swipe_script(next_t, prev_t):
    return (
        "<script>(function(){var N=%r,P=%r;var x0=0,y0=0,t0=0,ok=false;"
        "addEventListener('touchstart',function(e){"
        "if(e.touches.length!==1){ok=false;return;}"
        "var el=e.target;"
        "if(el.closest&&el.closest('input,select,button,a,textarea')){ok=false;return;}"
        "var t=e.touches[0];x0=t.clientX;y0=t.clientY;t0=Date.now();ok=true;},{passive:true});"
        "addEventListener('touchend',function(e){if(!ok)return;ok=false;"
        "var t=e.changedTouches[0];var dx=t.clientX-x0,dy=t.clientY-y0;"
        "if(Date.now()-t0>800)return;"
        "if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.8)return;"
        "if(dx<0&&N)location.href=N;else if(dx>0&&P)location.href=P;},{passive:true});"
        "})();</script>"
    ) % (next_t, prev_t)


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


def normalize_examples(groups):
    """ex alanını her zaman liste (cümle listesi) yap."""
    for g in groups:
        for it in g["items"]:
            ex = it.get("ex", "")
            if isinstance(ex, str):
                it["ex"] = [ex] if ex else []
            else:
                it["ex"] = [s for s in ex if s]


def apply_multi_examples(groups):
    """multi_examples.EX overlay'i: (grup_no, kelime) -> [cümle, ...].

    Çok anlamlı kelimeler için her anlama bir örnek cümle. 100-kelime
    kısıtı yok; hem enrich'li gruplara hem de JSON'daki Grup 1/10'a uygulanır.
    """
    try:
        import multi_examples as ME
    except ImportError:
        return
    for g in groups:
        for it in g["items"]:
            sents = ME.EX.get((g["no"], it["w"]))
            if sents:
                it["ex"] = list(sents)


def render(groups):
    sesli_groups = groups
    kart_groups = [
        {
            "no": g["no"], "level": g["level"], "lo": g["lo"], "hi": g["hi"],
            "items": [
                {"w": it["w"], "tr": it["tr"], "ok": it.get("ok", ""),
                 "ex": [re.sub(r"</?b>", "", s) for s in it.get("ex", [])]}
                for it in g["items"]
            ],
        }
        for g in groups
    ]
    # app_out: uygulama sayfası. swipe: (next, prev) yatay kaydırma hedefleri.
    #   sözlük         → sola: liste
    #   liste (index)  → sola: kartlar | sağa: sözlük
    #   kartlar        → sola: istatistik | sağa: liste
    for tpl, data, out, app_out, swipe in [
        ("sesli_template.html", sesli_groups, "Oxford3000_30grup_sesli.html",
         "app/www/index.html", ("kartlar.html", "sozluk.html")),
        ("kartlar_template.html", kart_groups, "Oxford3000_kartlar.html",
         "app/www/kartlar.html", ("istatistik.html", "index.html")),
    ]:
        html = (ROOT / "templates" / tpl).read_text(encoding="utf-8")
        blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        html = html.replace("__GROUPS_JSON__", blob)

        # 1) Bağımsız kök HTML (tarayıcıda çift tıkla aç)
        root_html = html.replace("__SOZLUK__", "Oxford3000_sozluk.html")
        (ROOT / out).write_text(root_html, encoding="utf-8")
        print(f"{out}: {len(root_html)} bayt")

        # 2) Android uygulaması sürümü: güncelleyici + TTS köprüsü + yatay kaydırma
        #    Ses yolu MUTLAK ('/audio/...') olur: hem gömülü hem güncellenmiş
        #    (cihaz hafızasından yüklenen) sayfalarda APK içindeki sese erişir.
        three = '<script src="three.min.js"></script>' if tpl == "kartlar_template.html" else ""
        inject = three + APP_HEAD + swipe_script(*swipe) + "</head>"
        app_html = html.replace("__SOZLUK__", "sozluk.html").replace("</head>", inject, 1)
        app_html = app_html.replace("playAudioUrl('audio/", "playAudioUrl('/audio/")
        app_path = ROOT / app_out
        app_path.parent.mkdir(parents=True, exist_ok=True)
        app_path.write_text(app_html, encoding="utf-8")
        print(f"{app_out}: {len(app_html)} bayt")

    # Sözlük sayfası: tüm 3000 kelime; boş, aranınca yalnız o kelimenin kartı.
    sesli_blob = json.dumps(sesli_groups, ensure_ascii=False, separators=(",", ":"))
    soz_tpl = (ROOT / "templates" / "sozluk_template.html").read_text(encoding="utf-8")
    soz_tpl = soz_tpl.replace("__GROUPS_JSON__", sesli_blob)
    root_soz = soz_tpl.replace("__BACK__", "Oxford3000_30grup_sesli.html")
    (ROOT / "Oxford3000_sozluk.html").write_text(root_soz, encoding="utf-8")
    print(f"Oxford3000_sozluk.html: {len(root_soz)} bayt")
    app_soz = soz_tpl.replace("__BACK__", "index.html").replace(
        "</head>", APP_HEAD + swipe_script("index.html", "") + "</head>", 1
    )
    app_soz = app_soz.replace("playAudioUrl('audio/", "playAudioUrl('/audio/")
    (ROOT / "app/www/sozluk.html").write_text(app_soz, encoding="utf-8")
    print(f"app/www/sozluk.html: {len(app_soz)} bayt")

    # İstatistik / ilerleme sayfası (yalnız kelime listesi lazım: no, level, ws)
    stats_data = [
        {"no": g["no"], "level": g["level"], "ws": [it["w"] for it in g["items"]]}
        for g in groups
    ]
    stats_tpl = (ROOT / "templates" / "stats_template.html").read_text(encoding="utf-8")
    stats_blob = json.dumps(stats_data, ensure_ascii=False, separators=(",", ":"))
    stats_tpl = stats_tpl.replace("__GROUPS_JSON__", stats_blob)
    # Kök (tarayıcı) sürümü: kartlar'a geri döner, swipe yok
    root_stats = stats_tpl.replace("__BACK__", "Oxford3000_kartlar.html")
    (ROOT / "istatistik.html").write_text(root_stats, encoding="utf-8")
    print(f"istatistik.html: {len(root_stats)} bayt")
    # Uygulama sürümü: geri = kartlar.html, sağa kaydır → kartlar
    app_stats = stats_tpl.replace("__BACK__", "kartlar.html").replace(
        "</head>", APP_HEAD + swipe_script("", "kartlar.html") + "</head>", 1
    )
    (ROOT / "app/www/istatistik.html").write_text(app_stats, encoding="utf-8")
    print(f"app/www/istatistik.html: {len(app_stats)} bayt")

    # progress.js: kanonik kopya app/www'da; kök (tarayıcı) sürümü için kopyala
    for js in ("progress.js", "srs.js"):
        (ROOT / js).write_text((ROOT / "app/www" / js).read_text(encoding="utf-8"), encoding="utf-8")
        print(f"{js}: köke kopyalandı")


def main():
    groups = apply_enrichment(load_groups())
    normalize_examples(groups)
    apply_multi_examples(groups)
    with open(ROOT / "data" / "all_groups.json", "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=1)
    render(groups)
    write_web_bundle()   # updater.js + web.json.gz + web-version.txt
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("okunuşu tam gruplar:", done)


if __name__ == "__main__":
    main()
