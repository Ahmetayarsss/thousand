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
    # app_out: uygulama sayfası. swipe: (next, prev) yatay kaydırma hedefleri.
    #   liste (index)  → sola: kartlar
    #   kartlar        → sola: istatistik | sağa: liste
    for tpl, data, out, app_out, swipe in [
        ("sesli_template.html", sesli_groups, "Oxford3000_30grup_sesli.html",
         "app/www/index.html", ("kartlar.html", "")),
        ("kartlar_template.html", kart_groups, "Oxford3000_kartlar.html",
         "app/www/kartlar.html", ("istatistik.html", "index.html")),
    ]:
        html = (ROOT / "templates" / tpl).read_text(encoding="utf-8")
        blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        html = html.replace("__GROUPS_JSON__", blob)

        # 1) Bağımsız kök HTML (tarayıcıda çift tıkla aç)
        (ROOT / out).write_text(html, encoding="utf-8")
        print(f"{out}: {len(html)} bayt")

        # 2) Android uygulaması sürümü: TTS köprüsü + yatay kaydırma navigasyonu
        inject = '<script src="tts-bridge.js"></script>' + swipe_script(*swipe) + "</head>"
        app_html = html.replace("</head>", inject, 1)
        app_path = ROOT / app_out
        app_path.parent.mkdir(parents=True, exist_ok=True)
        app_path.write_text(app_html, encoding="utf-8")
        print(f"{app_out}: {len(app_html)} bayt")

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
        "</head>", swipe_script("", "kartlar.html") + "</head>", 1
    )
    (ROOT / "app/www/istatistik.html").write_text(app_stats, encoding="utf-8")
    print(f"app/www/istatistik.html: {len(app_stats)} bayt")

    # progress.js: kanonik kopya app/www'da; kök (tarayıcı) sürümü için kopyala
    prog = (ROOT / "app/www/progress.js").read_text(encoding="utf-8")
    (ROOT / "progress.js").write_text(prog, encoding="utf-8")
    print("progress.js: köke kopyalandı")


def main():
    groups = apply_enrichment(load_groups())
    with open(ROOT / "data" / "all_groups.json", "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=1)
    render(groups)
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("okunuşu tam gruplar:", done)


if __name__ == "__main__":
    main()
