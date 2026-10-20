# Thousand — İngilizce kelime çalışma uygulaması

Türkçe konuşanlar için İngilizce kelime çalışma uygulaması (Android; React Native / Expo, `mobile/`). İçerik:
CEFR A1–B2 seviyelerinde 3000 İngilizce kelime.

Bu repoda çalışırken kurallar: `CLAUDE.md`. Düzeltme planı: `PLAN.md`.

## Yapı

- 3000 kelime, her CEFR seviyesi kendi içinde karıştırılıp 100'erlik 30 gruba bölündü.
- **A1 = Grup 1–9, A2 = Grup 10–17, B1 = Grup 18–24, B2 = Grup 25–30.**
- Her grupta bölümler: İsimler / Fiiller / Sıfatlar / Zarflar / Diğer.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `mobile/` | **Uygulama:** React Native / Expo, iOS + Android. Ayrıntı: `mobile/README.md`, plan: `PLAN.md` Aşama 9 |
| `mobile/src/cekirdek/` | Tekrar sistemi (`srs.js`) ve kullanım kaydı (`log.js`); localStorage anahtarları `ox3000_*` |
| `mobile/assets/audio/` | Kelimelerin insan sesi kayıtları (`<kelime>.mp3`, ad `slugOf` kuralıyla; eş yazılan kelimeler tek kaydı paylaşır). APK'ya gömülür; kaydı olmayan kelimeyi cihazın TTS'i okur |
| `mobile/src/uretilen/` | **Üretilen** (`build_all.py`): `kelimeler.json` (sıralı kelime verisi), `sesler.js` (ses haritası) |
| `data/all_groups.json` | Tek doğruluk kaynağı — 30 grup, kelime başına `w, pos, sec, tr, ok, en, ex` |
| `scripts/build_all.py` | `all_groups.json`'u biçimler, uygulamanın kelime verisini ve ses haritasını (`mobile/src/uretilen/`) üretir |
| `scripts/validate.py` | Veri tutarlılık kontrolleri; sahipsiz ses dosyası hata, sesi olmayan kelime bildirilir |
| `scripts/bekci.py` | Bekçi: gizli bilgi, sabit dal adı, izinsiz ağ adresi, belge kayması, büyük dosya; bilinen borçlar `scripts/bekci_borc.json` |
| `tests/srs.test.js` | Tekrar sistemi (`mobile/src/cekirdek/srs.js`) testleri |
| `tests/log.test.js` | Kullanım kaydı (`mobile/src/cekirdek/log.js`): toplu/ertelenmiş yazma, çıkarken kaybolmama |
| `tests/oturum.test.js` | Kartlar mantığı (`mobile/src/kartlar/oturum.js`): Test ve Sınav kuralları |
| `tests/ilerleme.test.js` | İlerleme ve İstatistikler hesapları (`mobile/src/ilerleme/veri.js`): seri, tahmini bitiş, kutu dağılımı, 7 gün, en çok yanlış |
| `tests/sozluk.test.js` | Sözlük araması (`mobile/src/sozluk/arama.js`): sıra ve 60 sonuç sınırı |
| `tests/cevirme.test.js` | Kart çevirmesi (`mobile/src/kartlar/cevirmeGeometri.js`): her köşe noktası eski uygulamadaki çevirmeyle aynı yerde mi (karşılaştırma için three kütüphanesi `tests/cevirme/`'de) |
| `tests/hesap_yeni.test.js` | Hesap (`mobile/src/hesap/hesap.js`): sunucu çağrıları ve kayıtlar; kurtarma, yedek, oturum yenileme, kullanım kaydı izni, hesap silme; bildirimler (hatırlatma planı, bildirim anahtarı, ayarlar) |
| `tests/okuma.test.js` | "Listeyi oku" listesi (`mobile/src/okuma/liste.js`): servise giden diziler, Türkçe okuma metni |
| `tests/sunucu.test.sh` | Sunucu (`supabase/kurulum.sql`): geçici PostgreSQL'de kurulumu iki kez çalıştırır, `tests/sunucu/testler.sql`'i (yetkiler, hesap, yedek, arkadaşlık, dürtme, bildirim, kayıtlar, taşıma, silme) koşar; Supabase'in parçaları `tests/sunucu/supabase_taklit.sql`'de taklit edilir |
| `supabase/kurulum.sql` | Sunucu: hesap, arkadaşlar, dürtme, yedek, kullanım kayıtları, bildirim kontrolü |
| `.github/workflows/kontrol.yml` | Her push/PR'da testler + doğrulama + bekçi + uygulamanın paketlenmesi + üretilen dosyaların güncelliği |
| `.github/workflows/build-apk.yml` | **Yayın:** `main`'e her birleşmede APK'yı (release, mühürlü, paket `io.github.ahmetayarsss.thousand`) derleyip `apk-latest` release'ine koyar (etiket derlenen commit'e taşınır); Google Play için AAB'yi de iş akışı çıktısı olarak derler (Play'e çıkılmıyor, hazır dursun). PR'larda yalnız deneme derlemesi (mühürsüz, yayın yok) |
| `.github/workflows/ios-derle.yml` | PR'larda uygulama iOS'ta derleniyor mu (macOS, simülatör, imzasız; Apple Developer hesabı yok, hiçbir şey yayınlanmaz) |
| `.gitattributes` | GitHub'ın dil istatistiğinde üretilen dosyalar (`mobile/src/uretilen/`) ve teste konan hazır kütüphane sayılmasın |

Eski Capacitor (WebView) uygulaması (`app/`, `templates/`) kaldırıldı (PLAN.md adım 40); git geçmişinde duruyor.

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
3. Üretilen dosyaları da commit'le, PR aç; `main`'e birleşince yeni APK'ya girer (telefona APK kurulunca gelir).

