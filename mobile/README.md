# Thousand — yeni uygulama (React Native / Expo)

iOS ve Android için tek kod tabanı. Yapım aşamasında: hangi ekranın taşındığı `PLAN.md` → Aşama 9.
Yayındaki uygulama hâlâ Capacitor sürümü (`app/`).

**Ayrı deneme uygulaması:** ad "Thousand Yeni", paket `io.github.ahmetayarsss.thousand.yeni` — telefonda ana
uygulamanın (Thousand) yanına kurulur, ilerlemesi ayrı tutulur. Yayın dalı `mobil`: her push'ta
`.github/workflows/mobil-apk.yml` APK'yı derleyip `mobil-latest` release'ine koyar (`ThousandYeni.apk`).
Sürüm kodu = o iş akışının çalışma numarası (`app.config.js`).

## Yapı

| Yol | Ne |
|---|---|
| `src/app/` | Ekranlar (Expo Router: her dosya bir sekme). `_layout.js` alt sekmeleri kurar; `ilerleme/` bir yığın: İlerleme ve ondan açılan İstatistikler (`analiz.js`) |
| `src/cekirdek.js` | Ortak çekirdeği yükler: `app/www/srs.js` ve `app/www/log.js`, değiştirilmeden. localStorage'ı telefonda `expo-sqlite` karşılar |
| `src/ses.js` | Kelime sesi: gömülü kayıt (`app/www/audio`), yoksa cihazın konuşma sentezi |
| `src/tema.js` | Açık / koyu tema renkleri |
| `src/bilesenler/` | Ekranların ortak parçaları: `KelimeKarti.js`, `Pano.js` (İlerleme kartı), `HavaiFisek.js` (bütün kelimeler bitince, Skia), `Tasiniyor.js` |
| `src/ilerleme/` | İlerleme / İstatistikler: `veri.js` (hesaplar, ekrandan bağımsız), `Grafikler.js` (SVG grafikler, eskisinin ölçüleriyle) |
| `src/sozluk/arama.js` | Sözlük araması (ekrandan bağımsız) |
| `src/skiaWeb.web.js` | Webde Skia'yı yükler; Skia kullanan bileşenler webde `…Katmani.web.js` ile tembel yüklenir |
| `src/kartlar/` | Kartlar ekranının parçaları: `oturum.js` (Test/Sınav kuralları, ekrandan bağımsız), `Deste.js` (üst üste kartlar, fırlatma), `KartYuzu.js`, `Klavye.js` (yazılı kart için uygulama içi klavye), `Cevirme.js` + `cevirmeGeometri.js` (kart çevirme, Skia — eski three.js çevirmesiyle birebir), `yuzYakala.js` (kart yüzünün resmi; `.web.js` webde) |
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
