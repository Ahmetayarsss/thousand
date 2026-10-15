#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thousand üretim hattı (içerik: Oxford 3000 kelime listesi).

1. data/all_groups.json'u yükler (30 grup x 100 kelime).
2. scripts/enrich/ altındaki grup modüllerini uygular (ok/en/ex alanları).
3. data/all_groups.json'u günceller.
4. templates/ içindeki şablonlardan uygulama sayfalarını (app/www/*.html) üretir.
5. Güncelleme paketini (web.json, web-version.txt, app/www/updater.js) yazar.

Yeni bir grup zenginleştirildiğinde: scripts/enrich/gN.py oluştur ve
aşağıdaki ENRICH_MODS listesine "gN" ekle, sonra bu scripti çalıştır.
"""
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
    "index.html", "kartlar.html", "sozluk.html", "istatistik.html", "ayarlar.html", "analiz.html", "arkadaslar.html",
    "tts-bridge.js", "srs.js", "log.js", "hesap.js", "updater.js", "three.min.js",
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
def swipe_script(next_t, prev_t, up_t="", down_t=""):
    """Yatay kaydırma: sola → next_t, sağa → prev_t.
    Dikey: sayfa en üstteyken aşağı çekince → up_t (üstteki sayfa),
    sayfa en alttayken yukarı itince → down_t (alttaki sayfa)."""
    return (
        "<script>(function(){var N=%r,P=%r,U=%r,D=%r;var x0=0,y0=0,t0=0,ok=false,top=false,bot=false;"
        # Sayfa isterse (ör. sınav sürerken) geçişten önce onay sorar: window.oxCikisSor(git).
        "function go(u){if(window.oxCikisSor)window.oxCikisSor(function(){location.href=u;},u);else location.href=u;}"
        "addEventListener('touchstart',function(e){"
        "if(e.touches.length!==1){ok=false;return;}"
        "var el=e.target;"
        "if(el.closest&&el.closest('input,select,button,a,textarea')){ok=false;return;}"
        "var t=e.touches[0];x0=t.clientX;y0=t.clientY;t0=Date.now();ok=true;"
        "var se=document.scrollingElement||document.documentElement;"
        "top=se.scrollTop<=0;bot=se.scrollTop+innerHeight>=se.scrollHeight-2;},{passive:true});"
        "addEventListener('touchend',function(e){if(!ok)return;ok=false;"
        "var t=e.changedTouches[0];var dx=t.clientX-x0,dy=t.clientY-y0;"
        "if(Date.now()-t0>800)return;"
        "if(Math.abs(dy)>=90&&Math.abs(dy)>Math.abs(dx)*1.8){"
        "if(dy>0&&U&&top)go(U);else if(dy<0&&D&&bot)go(D);return;}"
        "if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.8)return;"
        "if(dx<0&&N)go(N);else if(dx>0&&P)go(P);},{passive:true});"
        "})();</script>"
    ) % (next_t, prev_t, up_t, down_t)


# Alt gezinme çubuğu (adım 18): kaydırmayı bilmeyen de sayfalar arasında geçebilsin. Kaydırma
# da çalışmaya devam eder. Sınav sürerken çıkış onayı (window.oxCikisSor) burada da sorulur.
NAV_TABS = [   # (sayfa, ad, SVG yolu — 24x24, çizgi)
    ("index.html", "Liste", "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"),
    ("kartlar.html", "Kartlar", "M7 4h11a2 2 0 0 1 2 2v13M4 8h11a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2z"),
    ("istatistik.html", "İlerleme", "M4 20V10M10 20V4M16 20v-7M22 20H2"),
    ("sozluk.html", "Sözlük", "M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h8"),
    ("arkadaslar.html", "Arkadaş", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6"),
    ("ayarlar.html", "Ayarlar", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"),
]


def nav_bar(active):
    """Sayfanın altına sabit sekme çubuğu. active: vurgulanacak sayfa (NAV_TABS'taki ad)."""
    css = ("<style>:root{--navh:58px}body{padding-bottom:calc(var(--navh) + env(safe-area-inset-bottom))}"
           ".oxbar{position:fixed;left:0;right:0;bottom:0;z-index:9990;display:flex;justify-content:center;"
           "background:rgba(255,255,255,.97);border-top:1px solid #E6EAF1;padding-bottom:env(safe-area-inset-bottom)}"
           ".oxbar nav{display:flex;width:100%;max-width:600px}"
           ".oxbar a{flex:1;height:var(--navh);display:flex;flex-direction:column;align-items:center;justify-content:center;"
           "gap:3px;color:#7A8699;font:600 10.5px system-ui,-apple-system,Roboto,Arial,sans-serif;text-decoration:none}"
           ".oxbar a.on{color:#1B2430;font-weight:800}.oxbar a.on svg{stroke:#3B6EA5}"
           ".oxbar svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}"
           "</style>")
    links = "".join(
        f'<a href="{u}"{" class=on aria-current=page" if u == active else ""}>'
        f'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="{d}"/></svg>{ad}</a>'
        for u, ad, d in NAV_TABS)
    js = ("<script>document.querySelectorAll('.oxbar a').forEach(function(a){a.addEventListener('click',function(e){"
          "e.preventDefault();var u=a.getAttribute('href');if(a.classList.contains('on'))return;"
          "if(window.oxCikisSor)window.oxCikisSor(function(){location.href=u;},u);else location.href=u;});});</script>")
    return css + f'<div class="oxbar"><nav aria-label="Sayfalar">{links}</nav></div>' + js


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


# Grup içi sıra (ana sayfa, sınav, ilerleme hepsi aynı sırayı kullanır):
# isimler → fiiller → sıfatlar → zarflar → diğer, her biri alfabetik.
SEC_ORDER = ["İsimler", "Fiiller", "Sıfatlar", "Zarflar", "Diğer"]


def sort_items(groups):
    def k(it):
        sec = it.get("sec")
        return (SEC_ORDER.index(sec) if sec in SEC_ORDER else len(SEC_ORDER), it["w"].lower())
    return [dict(g, items=sorted(g["items"], key=k)) for g in groups]


def render(groups):
    groups = sort_items(groups)
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
    # Uygulama sayfaları (app/www). Her sayfaya güncelleyici + TTS köprüsü + kaydırma eklenir.
    # Ses yolu MUTLAK ('/audio/...') olur: hem gömülü hem güncellenmiş (cihaz hafızasından
    # yüklenen) sayfalarda APK içindeki sese erişir.
    # swipe_script(sola, sağa, aşağı çekince, yukarı itince) — gezinme haritası app/README.md'de.
    def page(tpl, out, swipe, repl=(), head="", sekme=None):
        html = (ROOT / "templates" / tpl).read_text(encoding="utf-8")
        for k, v in repl:
            html = html.replace(k, v)
        html = html.replace("</head>", head + APP_HEAD + swipe_script(*swipe) + "</head>", 1)
        html = html.replace("</body>", nav_bar(sekme or out) + "</body>", 1)
        html = html.replace("playAudioUrl('audio/", "playAudioUrl('/audio/")
        path = ROOT / "app/www" / out
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        print(f"app/www/{out}: {len(html)} bayt")

    def blob(data):
        return json.dumps(data, ensure_ascii=False, separators=(",", ":"))

    # İstatistik / ilerleme sayfaları (kelime listesi + Türkçe: no, level, ws, tr)
    stats_data = [
        {"no": g["no"], "level": g["level"], "ws": [it["w"] for it in g["items"]],
         "tr": [it["tr"] for it in g["items"]]}
        for g in groups
    ]
    nav = (("__SOZLUK__", "sozluk.html"),)
    # Liste (açılış): sola kartlar, sağa sözlük.
    page("sesli_template.html", "index.html", ("kartlar.html", "sozluk.html"),
         (("__GROUPS_JSON__", blob(sesli_groups)),) + nav)
    # Kartlar: sola istatistik, sağa liste.
    page("kartlar_template.html", "kartlar.html", ("istatistik.html", "index.html"),
         (("__GROUPS_JSON__", blob(kart_groups)),) + nav, head='<script src="three.min.js"></script>')
    # Sözlük (tüm 3000 kelime; aranınca o kelimenin kartı): sola liste, aşağı çek → ayarlar,
    # yukarı it → arkadaşlar.
    page("sozluk_template.html", "sozluk.html", ("index.html", "", "ayarlar.html", "arkadaslar.html"),
         (("__GROUPS_JSON__", blob(sesli_groups)), ("__BACK__", "index.html")))
    # Arkadaşlar (sözlüğün altı): aşağı çek → sözlük.
    page("arkadaslar_template.html", "arkadaslar.html", ("", "", "sozluk.html", ""), nav)
    # Ayarlar (sözlüğün üstü): sola analiz, yukarı it → sözlük.
    page("ayarlar_template.html", "ayarlar.html", ("analiz.html", "", "", "sozluk.html"),
         nav + (("__INDEX__", "index.html"),))
    # Ayrıntılı istatistik (ayarların sağı): sağa ayarlar.
    page("analiz_template.html", "analiz.html", ("", "ayarlar.html"),
         (("__GROUPS_JSON__", blob(stats_data)), ("__AYARLAR__", "ayarlar.html")), sekme="istatistik.html")
    # İlerleme: sağa kartlar.
    page("stats_template.html", "istatistik.html", ("", "kartlar.html"),
         (("__GROUPS_JSON__", blob(stats_data)), ("__BACK__", "kartlar.html")))

def main():
    groups = apply_enrichment(load_groups())
    normalize_examples(groups)
    apply_multi_examples(groups)
    with open(ROOT / "data" / "all_groups.json", "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=1)
    render(groups)
    write_web_bundle()   # updater.js + web.json + web-version.txt
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("okunuşu tam gruplar:", done)


if __name__ == "__main__":
    main()
