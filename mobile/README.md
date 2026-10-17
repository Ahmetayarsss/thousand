# Thousand — yeni uygulama (React Native / Expo)

iOS ve Android için tek kod tabanı. Yapım aşamasında: hangi ekranın taşındığı `PLAN.md` → Aşama 9.
Yayındaki uygulama hâlâ Capacitor sürümü (`app/`).

## Yapı

| Yol | Ne |
|---|---|
| `src/app/` | Ekranlar (Expo Router: her dosya bir sekme). `_layout.js` alt sekmeleri kurar |
| `src/cekirdek.js` | Ortak çekirdeği yükler: `app/www/srs.js` ve `app/www/log.js`, değiştirilmeden. localStorage'ı telefonda `expo-sqlite` karşılar |
| `src/ses.js` | Kelime sesi: gömülü kayıt (`app/www/audio`), yoksa cihazın konuşma sentezi |
| `src/tema.js` | Açık / koyu tema renkleri |
| `src/bilesenler/` | Ekranların ortak parçaları |
| `src/uretilen/` | **Üretilen, elle düzenlenmez** (`scripts/build_all.py`): `kelimeler.json` (sıralı kelime verisi), `sesler.js` (ses haritası) |
| `metro.config.js` | `app/www`'daki ortak dosyaları pakete katar |

`android/` ve `ios/` klasörleri repoda yok: `npx expo prebuild` `app.json`'dan üretir.

## Çalıştırma

```bash
cd mobile
npm ci
npx expo start                                      # geliştirme
npx expo export --platform android --output-dir dist/android   # paketleniyor mu (CI da bunu yapar)
```

Telefonda denemek için geliştirme derlemesi: `npx expo run:android` (Android SDK gerekir) ya da Mac'te
`npx expo run:ios`.
