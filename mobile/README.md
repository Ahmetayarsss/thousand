# Thousand — uygulama (React Native / Expo)

iOS ve Android için tek kod tabanı; yayındaki uygulama bu. Eski Capacitor uygulamasının (`app/`) yerine geçti:
ad "Thousand", paket `io.github.ahmetayarsss.thousand`, aynı imza — telefonda eskisinin üstüne kurulur.
Henüz olmayanlar (bildirimler): `PLAN.md` → Aşama 9.

**Yayın:** `main`'e her birleşmede `.github/workflows/build-apk.yml` APK'yı derleyip `apk-latest` release'ine
koyar (`Thousand.apk`). Sürüm kodu = o iş akışının çalışma numarası (`app.config.js`); eski uygulama da aynı
numarayı kullandığı için yeni APK onun üstüne kurulur. Uzaktan (APK'sız) güncelleme yok.

**Eski ilerlemenin aktarımı:** eski uygulama ilerlemeyi uygulama klasörüne bir dosyaya yazar (`app/www/gecis.js`);
bu uygulama ilk açılışta onu alır (`src/gecis.js`, kuralları `src/gecisAktar.js`) ve Liste'de bir kez söyler.

## Yapı

| Yol | Ne |
|---|---|
| `src/app/` | Ekranlar (Expo Router: her dosya bir sekme). `_layout.js` alt sekmeleri kurar; `ilerleme/` bir yığın: İlerleme ve ondan açılan İstatistikler (`analiz.js`) |
| `src/gecis.js`, `src/gecisAktar.js` | Eski uygulamanın ilerlemesini ilk açılışta alır (çekirdekten önce) |
| `src/cekirdek.js` | Ortak çekirdeği yükler: `app/www/srs.js` ve `app/www/log.js`, değiştirilmeden. localStorage'ı telefonda `expo-sqlite` karşılar |
| `src/ses.js` | Kelime sesi: gömülü kayıt (`app/www/audio`), yoksa cihazın konuşma sentezi |
| `src/tema.js` | Açık / koyu tema renkleri |
| `src/bilesenler/` | Ekranların ortak parçaları: `KelimeKarti.js`, `Pano.js` (beyaz kart), `HavaiFisek.js` (bütün kelimeler bitince, Skia), `Pencere.js` (ortadaki pencere, onay, girdi), `Duyuru.js` (alttaki kısa bildirim) |
| `src/hesap/` | Hesap ve arkadaşlar: `hesap.js` (eski `app/www/hesap.js`'in ekrandan bağımsız hali; aynı sunucu işlevleri ve anahtarlar), `index.js` (bu telefonda kurulumu, açılış/arka plan gönderimleri, `useHesap`), `Karsilama.js` (takma ad, kodlar, kurtarma kodu, kayıt izni) |
| `src/ilerleme/` | İlerleme / İstatistikler: `veri.js` (hesaplar, ekrandan bağımsız), `Grafikler.js` (SVG grafikler, eskisinin ölçüleriyle) |
| `src/sozluk/arama.js` | Sözlük araması (ekrandan bağımsız) |
| `src/skiaWeb.web.js` | Webde Skia'yı yükler; Skia kullanan bileşenler webde `…Katmani.web.js` ile tembel yüklenir |
| `src/kartlar/` | Kartlar ekranının parçaları: `oturum.js` (Test/Sınav kuralları, ekrandan bağımsız), `Deste.js` (üst üste kartlar, fırlatma), `KartYuzu.js`, `Klavye.js` (yazılı kart için uygulama içi klavye), `Cevirme.js` + `cevirmeGeometri.js` (kart çevirme, Skia — eski three.js çevirmesiyle birebir), `yuzYakala.js` (kart yüzünün resmi; `.web.js` webde) |
| `src/okuma/` | "Listeyi oku": `index.js` (Android'de `modules/okuma` servisi; başka yerde ekran açıkken JS ile), `liste.js` (okuma listesi, ekrandan bağımsız) |
| `modules/okuma/` | Android "Listeyi oku" servisi (Expo yerel modülü): eski uygulamanın `GroupTtsService`'i (`OkumaServisi.java`; bildirim, kilit ekranı, kulaklık düğmeleri, ekran kapalıyken okuma) ve köprüsü (`OkumaModule.kt`). `expo prebuild` kendiliğinden bağlar |
| `src/cikis.js` | Sınav sürerken başka sekmeye geçişte onay |
| `src/uretilen/` | **Üretilen, elle düzenlenmez** (`scripts/build_all.py`): `kelimeler.json` (sıralı kelime verisi), `sesler.js` (ses haritası) |
| `app.config.js` | `app.json`'un üstüne derleme numarası (sürüm kodu) |
| `metro.config.js` | `app/www`'daki ortak dosyaları pakete katar |

`android/` ve `ios/` klasörleri repoda yok: `npx expo prebuild` `app.json`'dan üretir.

## Çalıştırma

```bash
cd mobile
npm ci
npx expo start                                      # geliştirme
npx expo export --platform android --output-dir dist/android   # paketleniyor mu (CI da bunu yapar)
```

Webde deneme (ekran görüntüsü vb.): önce `npm run web-hazirla` (Skia'nın `canvaskit.wasm`'ını `public/`'e
kopyalar; repoya girmez), sonra `npx expo start --web`. Webde kart yüzü SVG ile yakalanır; telefonda Skia yakalar.

Telefonda denemek için geliştirme derlemesi: `npx expo run:android` (Android SDK gerekir) ya da Mac'te
`npx expo run:ios`.
