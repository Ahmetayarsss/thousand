#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Thousand üretim hattı.

1. data/all_groups.json'u yükler (30 grup x 100 kelime; okunuş, açıklama, örnekler dahil —
   içeriğin tek kaynağı bu dosya).
2. Örnek alanını (ex) liste biçimine getirip dosyayı geri yazar (biçim tek düze kalsın).
3. Kelime verisini (app/www/kelimeler.js) ve şablonlardan sayfaları (app/www/*.html) üretir.
   Yeni uygulama için de (mobile/src/uretilen/: kelimeler.json, sesler.js).
4. Güncelleme paketini (web.json, web-version.txt, app/www/updater.js) yazar.
"""
import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Uygulama sayfalarının <head>'ine eklenenler (sıra önemli: güncelleyici en önce,
# yönlendirme kararını diğer scriptlerden önce versin).
APP_HEAD = '<script src="updater.js"></script><script src="tts-bridge.js"></script>'

# Uygulama içi güncelleme paketine giren dosyalar (ses HARİÇ — ses APK'da gömülü).
WEB_BUNDLE_FILES = [
    "index.html", "kartlar.html", "sozluk.html", "istatistik.html", "ayarlar.html", "analiz.html", "arkadaslar.html",
    "tts-bridge.js", "srs.js", "log.js", "gecis.js", "hesap.js", "updater.js", "three.min.js", "kelimeler.js",
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


# Karanlık mod (adım 21): telefon karanlık moddaysa <html data-theme="dark"> olur ve renk
# değişkenleri koyu karşılıklarına döner. Sayfalar renkleri bu değişkenlerden alır; sabit renk
# yazmak yerine buradaki değişkeni kullan. Kart çevirme görüntüsü (kartlar → captureFace) de
# data-theme'i taşır. Uygulamanın Android teması DayNight olduğu için WebView telefonun
# ayarını sayfaya bildirir.
THEME_HEAD = (
    "<script>(function(){var m=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');"
    "function s(){document.documentElement.setAttribute('data-theme',m&&m.matches?'dark':'light');}"
    "s();if(m&&m.addEventListener)m.addEventListener('change',s);})();</script>"
    "<style>"
    # Açık tema: şablonlarda olmayan ortak değişkenler (şablonların kendi :root'u önce gelir).
    ":root{--solid:#1B2430;--on-solid:#fff;--field:#fff;--soft:#E9EDF3;--soft2:#EEF2F7;--en:#33414F;--ex:#5B6B7B;"
    "--sep:#D5DCE7;--face-line:#c7d2e3;--hdr:rgba(245,246,248,.95);--bad-bg:#FDECEA;--bad-line:#F5C4BD;--bad-ink:#8A2A1E;"
    "--good-bg:#E9F7EF;--warn-bg:#FCF3E3;--warn-line:#F2E0BE;--warn-ink:#8A6D3B;"
    "--kb:#D9E0EA;--key:#fff;--key2:#B9C4D4;--key3:#AEB9C9;--key4:#8E9BB0;--shade:rgba(20,30,50,.06);--scrim:rgba(20,27,38,.5);--bar:#fff}"
    ":root[data-theme=dark]{color-scheme:dark;--bg:#0F141B;--card:#19202A;--ink:#E4E9F0;--ink2:#C5CDD8;--muted:#8D99AA;"
    "--line:#2B3542;--accent:#5B8FD0;--green:#35A867;--green-d:#2E9A5E;--red:#DE5F57;--red-d:#E87A72;--tr:#EE8579;"
    "--ok:#3CC2B0;--amber:#E5892B;--neu:#3A4554;--green-bg:#17352A;--amber-bg:#3A2C1A;--secgray:#222B36;"
    "--secgray-ink:#7C8899;--gold:#D4AE3A;--gold-bg:#3A3218;--dev:#B27AD0;"
    "--solid:#2F3B4C;--on-solid:#F2F5F9;--field:#222B36;--soft:#222B36;--soft2:#1E2631;--en:#C5CDD8;--ex:#9AA6B6;"
    "--sep:#3A4554;--face-line:#2B3542;--hdr:rgba(15,20,27,.95);--bad-bg:#3A1E1C;--bad-line:#5A2C28;--bad-ink:#F2A59D;"
    "--good-bg:#17352A;--warn-bg:#3A2C1A;--warn-line:#5A4428;--warn-ink:#E8C48A;"
    "--kb:#151B23;--key:#2A3442;--key2:#3A4656;--key3:#3A4656;--key4:#4A5768;--shade:rgba(0,0,0,.35);--scrim:rgba(0,0,0,.6);--bar:#151B23}"
    "</style>"
)

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
           "background:var(--bar);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}"
           ".oxbar nav{display:flex;width:100%;max-width:600px}"
           ".oxbar a{flex:1;height:var(--navh);display:flex;flex-direction:column;align-items:center;justify-content:center;"
           "gap:3px;color:var(--muted);font:600 10.5px system-ui,-apple-system,Roboto,Arial,sans-serif;text-decoration:none}"
           ".oxbar a.on{color:var(--ink);font-weight:800}.oxbar a.on svg{stroke:var(--accent,#3B6EA5)}"
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


def render(groups):
    groups = sort_items(groups)
    # Uygulama sayfaları (app/www). Her sayfaya güncelleyici + TTS köprüsü + kaydırma eklenir.
    # Ses yolu MUTLAK ('/audio/...') olur: hem gömülü hem güncellenmiş (cihaz hafızasından
    # yüklenen) sayfalarda APK içindeki sese erişir.
    # swipe_script(sola, sağa, aşağı çekince, yukarı itince) — gezinme haritası app/README.md'de.
    def page(tpl, out, swipe, repl=(), head="", sekme=None):
        html = (ROOT / "templates" / tpl).read_text(encoding="utf-8")
        for k, v in repl:
            html = html.replace(k, v)
        html = html.replace("</head>", THEME_HEAD + head + APP_HEAD + swipe_script(*swipe) + "</head>", 1)
        html = html.replace("</body>", nav_bar(sekme or out) + "</body>", 1)
        html = html.replace("playAudioUrl('audio/", "playAudioUrl('/audio/")
        path = ROOT / "app/www" / out
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        print(f"app/www/{out}: {len(html)} bayt")

    # Kelime verisi tek dosyada (adım 24): window.KELIMELER. Eskiden her sayfaya ayrı gömülüyordu
    # (liste, sözlük, kartlar, istatistik, analiz → aynı veri 5 kez). Sayfalar kendi ihtiyacı olan
    # biçimi yüklenince türetir.
    veri = json.dumps(groups, ensure_ascii=False, separators=(",", ":"))
    (ROOT / "app/www/kelimeler.js").write_text(
        "// Üretilen dosya (scripts/build_all.py) — elle düzenleme; kaynak data/all_groups.json.\n"
        "window.KELIMELER=" + veri + ";\n", encoding="utf-8")
    print(f"app/www/kelimeler.js: {len(veri)} bayt")
    nav = (("__SOZLUK__", "sozluk.html"),)
    # Liste (açılış): sola kartlar, sağa sözlük.
    page("sesli_template.html", "index.html", ("kartlar.html", "sozluk.html"),
         nav)
    # Kartlar: sola istatistik, sağa liste.
    page("kartlar_template.html", "kartlar.html", ("istatistik.html", "index.html"),
         nav, head='<script src="three.min.js"></script>')
    # Sözlük (tüm 3000 kelime; aranınca o kelimenin kartı): sola liste, aşağı çek → ayarlar,
    # yukarı it → arkadaşlar.
    page("sozluk_template.html", "sozluk.html", ("index.html", "", "ayarlar.html", "arkadaslar.html"),
         (("__BACK__", "index.html"),))
    # Arkadaşlar (sözlüğün altı): aşağı çek → sözlük.
    page("arkadaslar_template.html", "arkadaslar.html", ("", "", "sozluk.html", ""), nav)
    # Ayarlar (sözlüğün üstü): sola analiz, yukarı it → sözlük.
    page("ayarlar_template.html", "ayarlar.html", ("analiz.html", "", "", "sozluk.html"),
         nav + (("__INDEX__", "index.html"),))
    # Ayrıntılı istatistik (ayarların sağı): sağa ayarlar.
    page("analiz_template.html", "analiz.html", ("", "ayarlar.html"),
         (("__AYARLAR__", "ayarlar.html"),), sekme="istatistik.html")
    # İlerleme: sağa kartlar.
    page("stats_template.html", "istatistik.html", ("", "kartlar.html"),
         (("__BACK__", "kartlar.html"),))
    render_mobile(groups)


def render_mobile(groups):
    """Yeni uygulama (mobile/, React Native) için: sıralı kelime verisi ve ses haritası.

    Veri app/www/kelimeler.js ile aynı (aynı sıra → srs.js aynı anahtarları ve sırayı üretir).
    Ses haritası: Metro sesleri yalnız statik require ile paketler; kelimenin adı slug_of ile.
    """
    out = ROOT / "mobile" / "src" / "uretilen"
    out.mkdir(parents=True, exist_ok=True)
    veri = json.dumps(groups, ensure_ascii=False, separators=(",", ":"))
    (out / "kelimeler.json").write_text(veri + "\n", encoding="utf-8")
    sesler = sorted(p.stem for p in (ROOT / "app/www/audio").glob("*.mp3"))
    satirlar = "".join(f'  "{s}": require("../../../app/www/audio/{s}.mp3"),\n' for s in sesler)
    (out / "sesler.js").write_text(
        "// Üretilen dosya (scripts/build_all.py) — elle düzenleme; kaynak app/www/audio/*.mp3.\n"
        "// Kelimenin ses kaydı: slugOf(kelime) → paketlenmiş mp3.\n"
        "export default {\n" + satirlar + "};\n", encoding="utf-8")
    print(f"mobile/src/uretilen: kelimeler.json {len(veri)} bayt, {len(sesler)} ses")

def main():
    groups = load_groups()
    normalize_examples(groups)
    with open(ROOT / "data" / "all_groups.json", "w", encoding="utf-8") as f:
        json.dump(groups, f, ensure_ascii=False, indent=1)
    render(groups)
    write_web_bundle()   # updater.js + web.json + web-version.txt
    done = [g["no"] for g in groups if all(it.get("ok") for it in g["items"])]
    print("okunuşu tam gruplar:", done)


if __name__ == "__main__":
    main()
