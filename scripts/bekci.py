#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bekçi: repoya bir daha girmemesi gereken hataları yakalar.

Her push'ta CI'da çalışır (.github/workflows/kontrol.yml). Yerelde:
    python3 scripts/bekci.py

Kurallar (her ihlal "kural: dosya — açıklama" olarak yazılır):
  gizli-dosya     keystore / özel anahtar / .env gibi dosyalar repoda
  gizli-icerik    dosya içinde parola, özel anahtar, gizli API anahtarı
  sabit-dal       kodda/CI'da sabit "claude/..." dal adı (yayın kanalı dal adına bağlanmasın)
  ag-adresi       uygulama kodunda izin listesinde olmayan bir alan adı (yeni sunucu / veri gönderimi)
  olu-dosya       app/www'da hiçbir sayfanın yüklemediği .js dosyası
  belge-kaymasi   README'lerde adı geçen ama repoda olmayan dosya
  buyuk-dosya     1,5 MB'tan büyük dosya (repo şişmesi)
  paket-repoda    güncelleme paketi (web.json, web-version.txt, app/www/updater.js) repoya girmiş;
                  paketi yalnız CI üretip release'e koyar, güncelleyici yalnız oradan indirir

Bilinen, henüz düzeltilmemiş ihlaller scripts/bekci_borc.json'da gerekçesiyle durur.
Listede olmayan her ihlal CI'ı kırar. Bir borç düzeltilince kaydı da silinmelidir:
artık ihlal üretmeyen borç kaydı da CI'ı kırar (liste hep gerçeği gösterir).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BORC_DOSYASI = ROOT / "scripts" / "bekci_borc.json"

# Uygulamanın konuşabileceği alan adları. Yeni bir adres eklemek = kullanıcı verisinin
# gidebileceği yeni bir yer demek: önce kullanıcıya sorulur, gerekçesi buraya yazılır.
IZINLI_ALANLAR = {
    "ezztsktfyangyzrdkszb.supabase.co": "hesap, arkadaşlar, yedek, kayıtlar (supabase/kurulum.sql)",
    "github.com": "uygulama içi güncelleme: yalnız apk-latest release'i (templates/updater.js)",
    "schemas.android.com": "XML ad alanı (ağ isteği değil)",
    "www.w3.org": "SVG/XML ad alanı (ağ isteği değil)",
    "d.android.com": "yorum içindeki belge bağlantısı",
}

GIZLI_UZANTILAR = (".keystore", ".jks", ".p12", ".pfx", ".pem", ".key")
GIZLI_ADLAR = {"google-services.json", ".env", "local.properties"}
GIZLI_DESENLER = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "özel anahtar"),
    (re.compile(r"""(storePassword|keyPassword)\s*[=:]?\s*['"][^'"]+['"]"""), "imza parolası açık yazılmış"),
    (re.compile(r"sb_secret_[A-Za-z0-9_-]{10,}"), "Supabase gizli anahtarı"),
    (re.compile(r"service_role[\"']?\s*[:=]\s*[\"']ey"), "Supabase service_role anahtarı"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "JWT anahtar/oturum"),
    (re.compile(r"\b(ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}"), "GitHub token"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AWS anahtarı"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), "Google API anahtarı"),
]
IKILI_UZANTILAR = (".mp3", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".jar", ".ico", ".ttf", ".woff", ".woff2") + GIZLI_UZANTILAR
# Bekçinin kendi dosyaları ve kuralları anlatan belge içerik taramalarına girmez.
TARAMA_DISI = {"scripts/bekci.py", "scripts/bekci_borc.json", "CLAUDE.md"}
PAKET_DOSYALARI = ("web.json", "web-version.txt", "app/www/updater.js")
BUYUK_SINIR = 1_500_000

# Uygulama kodu (ağ adresi taraması): şablonlar, app/www'daki elle yazılan JS, native Java,
# yeni uygulamanın (mobile/) kodu ve yapılandırması.
def uygulama_kodu(dosyalar):
    for d in dosyalar:
        if d.startswith("templates/") or (d.startswith("app/www/") and d.endswith(".js")) \
                or (d.startswith("app/android/app/src/main/") and d.endswith((".java", ".xml"))) \
                or (d.startswith("mobile/") and d.endswith((".js", ".json")) and not d.endswith("package-lock.json")):
            if not d.endswith("three.min.js"):
                yield d


def git_dosyalari():
    cikti = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return [d for d in cikti.decode("utf-8").split("\0") if d and (ROOT / d).exists()]


def oku(d):
    try:
        return (ROOT / d).read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def denetle():
    ihlaller = []   # (kural, dosya, açıklama)
    dosyalar = git_dosyalari()
    metin = {d: oku(d) for d in dosyalar if not d.endswith(IKILI_UZANTILAR)}

    # gizli-dosya
    for d in dosyalar:
        ad = d.rsplit("/", 1)[-1]
        if d.endswith(GIZLI_UZANTILAR) or ad in GIZLI_ADLAR or ad.startswith(".env"):
            ihlaller.append(("gizli-dosya", d, "anahtar/gizli dosya repoda"))

    # gizli-icerik
    for d, t in metin.items():
        if t is None or d in TARAMA_DISI:
            continue
        for desen, ne in GIZLI_DESENLER:
            if desen.search(t):
                ihlaller.append(("gizli-icerik", d, ne))

    # sabit-dal
    for d, t in metin.items():
        if t is None or d in TARAMA_DISI:
            continue
        if re.search(r"claude/[a-z0-9]+-[a-z0-9-]+", t):
            ihlaller.append(("sabit-dal", d, "sabit 'claude/...' dal adı"))

    # ag-adresi
    for d in uygulama_kodu(dosyalar):
        t = metin.get(d)
        if not t:
            continue
        for alan in sorted(set(re.findall(r"https?://([A-Za-z0-9.-]+)", t))):
            if alan not in IZINLI_ALANLAR:
                ihlaller.append(("ag-adresi", d, f"izin listesinde olmayan adres: {alan}"))

    # olu-dosya: app/www'daki her .js en az bir app/www sayfasında <script src> ile yüklenmeli
    sayfalar = "".join(t or "" for d, t in metin.items() if d.startswith("app/www/") and d.endswith(".html"))
    for d in dosyalar:
        if d.startswith("app/www/") and d.endswith(".js") and d.count("/") == 2:
            ad = d.rsplit("/", 1)[-1]
            if not re.search(r"""<script[^>]+src=["']/?%s["']""" % re.escape(ad), sayfalar):
                ihlaller.append(("olu-dosya", d, "hiçbir sayfa yüklemiyor"))

    # belge-kaymasi: README'lerde adı geçen dosyalar var mı (yol ya da dosya adı olarak)
    # CI'ın ürettiği paket dosyaları repoda olmasa da belgelerde anılabilir.
    uretilen = set(PAKET_DOSYALARI) | {d.rsplit("/", 1)[-1] for d in PAKET_DOSYALARI}
    adlar = {d.rsplit("/", 1)[-1] for d in dosyalar} | set(dosyalar) | uretilen
    for belge in ("README.md", "app/README.md"):
        t = metin.get(belge) or ""
        for ad in sorted(set(re.findall(r"[A-Za-z0-9_./-]+\.(?:html|js|py|json|md|yml|sql|java|txt)\b", t))):
            ad = ad.strip("./") if ad.startswith("./") else ad
            if "gN" in ad or ad.startswith("http") or "/" in ad and ad.split("/")[0].endswith(".com"):
                continue   # yer tutucu (gN.py) ya da web adresi
            if ad not in adlar and ad.rsplit("/", 1)[-1] not in adlar:
                ihlaller.append(("belge-kaymasi", belge, f"adı geçen dosya yok: {ad}"))

    # buyuk-dosya
    for d in dosyalar:
        if (ROOT / d).stat().st_size > BUYUK_SINIR:
            ihlaller.append(("buyuk-dosya", d, f"{(ROOT / d).stat().st_size // 1024} KB"))

    # paket-repoda
    for d in PAKET_DOSYALARI:
        if d in dosyalar:
            ihlaller.append(("paket-repoda", d, "güncelleme paketi repoda; yalnız CI üretir (.gitignore)"))

    return ihlaller


def main():
    ihlaller = denetle()
    borclar = json.loads(BORC_DOSYASI.read_text(encoding="utf-8"))
    borc_anahtar = {(b["kural"], b["dosya"]) for b in borclar}
    ihlal_anahtar = {(k, d) for k, d, _ in ihlaller}

    yeni = [(k, d, a) for k, d, a in ihlaller if (k, d) not in borc_anahtar]
    kapanan = [b for b in borclar if (b["kural"], b["dosya"]) not in ihlal_anahtar]

    bilinen = len(ihlal_anahtar & borc_anahtar)
    if bilinen:
        print(f"Bilinen borç: {bilinen} kayıt (scripts/bekci_borc.json) — düzeltilmeyi bekliyor.")
    if yeni:
        print("\nYENİ İHLAL — düzelt (ya da bilinçli bir karar ise gerekçesiyle borç listesine yaz):")
        for k, d, a in sorted(set(yeni)):
            print(f"  {k}: {d} — {a}")
    if kapanan:
        print("\nBorç kapanmış — bu kayıtları scripts/bekci_borc.json'dan sil:")
        for b in kapanan:
            print(f"  {b['kural']}: {b['dosya']}")
    if yeni or kapanan:
        sys.exit(1)
    print("Bekçi: yeni ihlal yok.")


if __name__ == "__main__":
    main()
