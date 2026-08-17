#!/usr/bin/env python3
"""Cambridge'den US telaffuz mp3'lerini indirip app/www/audio/ altına kaydeder.

Kullanım:  python3 scripts/fetch_cambridge_audio.py 1 2      # Grup 1 ve 2 (ilk 200 kelime)
Dosya adı: kelimenin slug'ı ({slug}.mp3). slug = küçük harf, harf/rakam dışı → '-'.
Bu slug, HTML şablonlarındaki JS ile birebir aynıdır; uygulama yerel dosyayı bulur.

Yalnızca US telaffuz (us_pron) alınır; yoksa kelime atlanır (uygulamada o kelime
native Cambridge / cihaz sesine düşer). Bu ortamdan Cambridge kapalı olduğu için
script GitHub Actions runner'ında çalıştırılır.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
OUT_DIR = "app/www/audio"
US_RE = re.compile(r"/media/[\w./-]*?us_pron/[\w./-]+?\.mp3")


def base(word):
    # Parantez içi açıklamayı ("(similar)" gibi) ve virgülden sonrasını at → temel kelime.
    b = re.sub(r"\(.*?\)", "", word)
    b = b.split(",")[0]
    return b.strip()


def slug(word):
    # Dosya adı = temel kelimenin slug'ı (JS'teki slugOf ile birebir aynı).
    return re.sub(r"[^a-z0-9]+", "-", base(word).lower()).strip("-")


def get(url, referer=None):
    headers = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}
    if referer:
        headers["Referer"] = referer
    else:
        headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def fetch_word(word):
    """(bytes, None) başarılıysa; (None, sebep) değilse."""
    page_slug = base(word).lower().replace(" ", "-")
    page = "https://dictionary.cambridge.org/dictionary/english/" + urllib.parse.quote(page_slug)
    try:
        html = get(page).decode("utf-8", "ignore")
    except Exception as e:
        return None, "page:" + type(e).__name__
    m = US_RE.search(html)
    if not m:
        return None, "no-us-audio"
    mp3 = "https://dictionary.cambridge.org" + m.group(0)
    try:
        audio = get(mp3, referer="https://dictionary.cambridge.org/")
    except Exception as e:
        return None, "mp3:" + type(e).__name__
    if len(audio) < 500:
        return None, "small(%d)" % len(audio)
    return audio, None


def main():
    want = [int(x) for x in sys.argv[1:]] or [1, 2]
    data = json.load(open("data/all_groups.json"))
    words = []
    for g in data:
        if g.get("no") in want:
            for it in g.get("items", []):
                w = it.get("w")
                if w:
                    words.append(w)
    print("Hedef gruplar: %s  → %d kelime" % (want, len(words)))
    os.makedirs(OUT_DIR, exist_ok=True)

    ok, miss = 0, []
    for i, w in enumerate(words, 1):
        path = os.path.join(OUT_DIR, slug(w) + ".mp3")
        if os.path.exists(path) and os.path.getsize(path) > 500:
            ok += 1
            continue
        audio, reason = fetch_word(w)
        if audio is None:
            miss.append((w, reason))
            print("  [%3d/%d] %-18s ✗ %s" % (i, len(words), w, reason))
        else:
            with open(path, "wb") as f:
                f.write(audio)
            ok += 1
            print("  [%3d/%d] %-18s ✓ %d bayt" % (i, len(words), w, len(audio)))
        time.sleep(0.25)

    print("\nSONUÇ: %d başarılı, %d eksik" % (ok, len(miss)))
    if miss:
        print("Eksikler:", ", ".join("%s(%s)" % (w, r) for w, r in miss))
    # En az yarısı gelmeliyse başarı say; hepsi boşsa hata ver.
    if ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
