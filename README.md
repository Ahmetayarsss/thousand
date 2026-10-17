# Thousand — İngilizce kelime çalışma uygulaması

Türkçe konuşanlar için İngilizce kelime çalışma uygulaması (Android, `app/`). İçerik: CEFR A1–B2
seviyelerinde 3000 İngilizce kelime.

Bu repoda çalışırken kurallar: `CLAUDE.md`. Düzeltme planı: `PLAN.md`.

## Yapı

- 3000 kelime, her CEFR seviyesi kendi içinde karıştırılıp 100'erlik 30 gruba bölündü.
- **A1 = Grup 1–9, A2 = Grup 10–17, B1 = Grup 18–24, B2 = Grup 25–30.**
- Her grupta bölümler: İsimler / Fiiller / Sıfatlar / Zarflar / Diğer.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `data/all_groups.json` | Tek doğruluk kaynağı — 30 grup, kelime başına `w, pos, sec, tr, ok, en, ex` |
| `app/www/audio/` | Kelimelerin insan sesi kayıtları (`<kelime>.mp3`, ad sayfalardaki `slugOf` kuralıyla; eş yazılan kelimeler tek kaydı paylaşır). APK'ya gömülür, güncelleme paketine girmez; kaydı olmayan kelimeyi cihazın TTS'i okur |
| `templates/` | Sayfa şablonları (`__SOZLUK__` vb. yer tutucular build'de doldurulur; kelime verisi `app/www/kelimeler.js`'ten gelir) ve `updater.js` |
| `scripts/build_all.py` | İçeriği uygular, `all_groups.json`'u günceller, uygulama sayfalarını (`app/www/*.html`), sayfaların ortak kelime verisini (`app/www/kelimeler.js`) ve güncelleme paketini (`web.json`, `web-version.txt`, `app/www/updater.js` — repoda tutulmaz) üretir |
| `scripts/validate.py` | Veri tutarlılık kontrolleri; sahipsiz ses dosyası hata, sesi olmayan kelime bildirilir |
| `scripts/bekci.py` | Bekçi: gizli bilgi, sabit dal adı, izinsiz ağ adresi, ölü dosya, belge kayması, paket tutarlılığı; bilinen borçlar `scripts/bekci_borc.json` |
| `tests/srs.test.js` | Tekrar sistemi (`app/www/srs.js`) testleri |
| `tests/updater.test.js` | Uygulama içi güncelleyici (`templates/updater.js`) testleri |
| `tests/hesap.test.js` | Hesap (`app/www/hesap.js`): yedek doğrulama, geri yükleme, kullanım kaydı izni testleri |
| `tests/log.test.js` | Kullanım kaydı (`app/www/log.js`): toplu/ertelenmiş yazma, sayfadan çıkarken kaybolmama |
| `tests/sunucu.test.sh` | Sunucu (`supabase/kurulum.sql`): geçici PostgreSQL'de kurulumu iki kez çalıştırır, `tests/sunucu/testler.sql`'i (yetkiler, hesap, yedek, arkadaşlık, dürtme, bildirim, kayıtlar, taşıma, silme) koşar; Supabase'in parçaları `tests/sunucu/supabase_taklit.sql`'de taklit edilir |
| `supabase/kurulum.sql` | Sunucu: hesap, arkadaşlar, dürtme, yedek, kullanım kayıtları, bildirim kontrolü |
| `.github/workflows/kontrol.yml` | Her push/PR'da testler + doğrulama + bekçi + yeni uygulamanın paketlenmesi + üretilen dosyaların güncelliği |
| `.github/workflows/build-apk.yml` | **Yayın:** `main`'e her birleşmede APK'yı (release, mühürlü) ve güncelleme paketini derleyip `apk-latest` release'ine koyar (etiket derlenen commit'e taşınır). PR'larda yalnız deneme derlemesi (mühürsüz, yayın yok) |
| `app/` | Android uygulaması (Capacitor) — yapı ve APK için `app/README.md` |
| `mobile/` | **Yeni uygulama (yapım aşamasında):** React Native / Expo, iOS + Android. `srs.js` ve `log.js`'i `app/www`'dan aynen kullanır; `mobile/src/uretilen/` (`kelimeler.json`, `sesler.js`) `build_all.py`'nin ürünü. Ayrıntı: `mobile/README.md`, plan: `PLAN.md` Aşama 9 |

## Alanlar

- `tr`: Türkçe anlam. Birden çok anlam `;`, eş anlamlılar `,` ile ayrılır.
- `ok` (okunuş), `en` (İngilizce açıklama), `ex` (örnek cümleler, kelime `<b>` içinde).

30 grubun hepsinde bütün alanlar dolu; `validate.py` bunu denetler.

### Okunuş kuralı

Heceler tireli, vurgulu hece BÜYÜK harf, yalnız Türkçe harfler
(w→u/v, th→t/d yaklaşık). Örnek: `apartment → ı-PART-mınt`,
`language → LENG-güiç`, `winter → UİN-tır`.

Söyleyiş **Amerikan** (uygulama US aksanıyla okur): `hot → HAT`, `body → BA-di`,
`ask → ESK`, `after → EF-tır`.

## İçerik düzeltme

1. `data/all_groups.json`'da kelimenin kaydını düzelt (`ok` okunuş, `en` açıklama, `ex` örnek
   cümle listesi — kelime `<b>` içinde). İçeriğin tek kaynağı bu dosya.
2. `python3 scripts/build_all.py && python3 scripts/validate.py && python3 scripts/bekci.py`
3. Üretilen dosyaları da commit'le, PR aç; `main`'e birleşince telefonlara gider.

