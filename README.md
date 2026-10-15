# Thousand — İngilizce kelime çalışma uygulaması

Türkçe konuşanlar için İngilizce kelime çalışma uygulaması (Android, `app/`). İçerik, Oxford 3000
kelime listesinin (A1–B2) kelimeleri üzerine kurulu; uygulamanın adı ve kimliği Oxford'la ilişkili
değildir (Ekim 2026'da "Oxford 3000"den "Thousand"a değiştirildi).

Bu repoda çalışırken kurallar: `CLAUDE.md`. Düzeltme planı: `PLAN.md`.

## Yapı

- 3000 kelime, her CEFR seviyesi kendi içinde karıştırılıp 100'erlik 30 gruba bölündü.
- **A1 = Grup 1–9, A2 = Grup 10–17, B1 = Grup 18–24, B2 = Grup 25–30.**
- Her grupta bölümler: İsimler / Fiiller / Sıfatlar / Zarflar / Diğer.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `data/all_groups.json` | Tek doğruluk kaynağı — 30 grup, kelime başına `w, pos, sec, tr, ok, en, ex, cam` |
| `data/sources/ipa_ref.json` | Okunuş yazarken referans IPA (Oxford Learner's, [tyypgzl/Oxford-5000-words](https://github.com/tyypgzl/Oxford-5000-words)) |
| `scripts/enrich/gN.py` | Grup N'nin okunuş/açıklama/örnek içeriği (Grup 1 ve 10 doğrudan `all_groups.json`'da) |
| `scripts/enrich/multi_examples.py` | Kelimelere eklenen ek örnek cümleler |
| `templates/` | Sayfa şablonları (`__GROUPS_JSON__` vb. yer tutucular build'de doldurulur) ve `updater.js` |
| `scripts/build_all.py` | İçeriği uygular, `all_groups.json`'u günceller, uygulama sayfalarını (`app/www/*.html`) ve güncelleme paketini (`web.json`, `web-version.txt`, `app/www/updater.js` — repoda tutulmaz) üretir |
| `scripts/validate.py` | Veri tutarlılık kontrolleri |
| `scripts/bekci.py` | Bekçi: gizli bilgi, sabit dal adı, izinsiz ağ adresi, ölü dosya, belge kayması, paket tutarlılığı; bilinen borçlar `scripts/bekci_borc.json` |
| `tests/srs.test.js` | Tekrar sistemi (`app/www/srs.js`) testleri |
| `tests/updater.test.js` | Uygulama içi güncelleyici (`templates/updater.js`) testleri |
| `tests/hesap.test.js` | Hesap (`app/www/hesap.js`): yedek doğrulama, geri yükleme, kullanım kaydı izni testleri |
| `supabase/kurulum.sql` | Sunucu: hesap, arkadaşlar, dürtme, yedek, kullanım kayıtları, bildirim kontrolü |
| `.github/workflows/kontrol.yml` | Her push/PR'da testler + doğrulama + bekçi + üretilen dosyaların güncelliği |
| `.github/workflows/build-apk.yml` | **Yayın:** `main`'e her birleşmede APK'yı (release, mühürlü) ve güncelleme paketini derleyip `apk-latest` release'ine koyar. PR'larda yalnız deneme derlemesi (mühürsüz, yayın yok) |
| `.github/workflows/fetch-audio.yml` | Sözlük US seslerini `app/www/audio/`'ya indirir (elle, bir çalışma dalında) |
| `app/` | Android uygulaması (Capacitor) — yapı ve APK için `app/README.md` |

## Alanlar

- `tr`: Türkçe anlam. Birden çok anlam `;`, eş anlamlılar `,` ile ayrılır.
- `cam`: Sözlük linki — `/dictionary/english-turkish/SLUG`
  (küçük harf, boşluk/özel karakter → tire, `o'clock → o-clock`).
- `ok` (okunuş), `en` (İngilizce açıklama), `ex` (örnek cümleler, kelime `<b>` içinde).

30 grubun hepsinde bütün alanlar dolu; `validate.py` bunu denetler.

### Okunuş kuralı

Heceler tireli, vurgulu hece BÜYÜK harf, yalnız Türkçe harfler
(w→u/v, th→t/d yaklaşık). Örnek: `apartment → ı-PART-mınt`,
`language → LENG-güiç`, `winter → UİN-tır`.

## İçerik düzeltme

1. Grubun `scripts/enrich/gN.py` dosyasında
   `DATA = {"kelime": ("okunuş", "açıklama", "örnek <b>kelime</b> cümlesi"), ...}` kaydını düzelt
   (Grup 1 ve 10 için `data/all_groups.json`).
2. `python3 scripts/build_all.py && python3 scripts/validate.py && python3 scripts/bekci.py`
3. Üretilen dosyaları da commit'le, PR aç; `main`'e birleşince telefonlara gider.

## Notlar

- CEFR seviyeleri Oxford'a göredir; Sözlük bazı kelimeleri bir seviye farklı
  gösterebilir (ör. apartment: Oxford A1, Sözlük A2) — ikisi de geçerli.
