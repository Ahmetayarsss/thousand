# Oxford 3000 — Android uygulaması (Capacitor)

İki HTML çalışma aracını (kelime listesi + flashcard) tek bir Android
uygulamasında toplar. Ana menüden iki ekrana geçilir. Ses için **yerel Android
TTS** (`@capacitor-community/text-to-speech`) kullanılır — basit WebView'in Web
Speech API sorunları böylece aşılır. İlerleme telefonda (`localStorage`) saklanır.

## Yapı

Menü yok: uygulama doğrudan **kelime listesine** (`index.html`) açılır; ekranı
**yana kaydırınca kelime kartlarına** (`kartlar.html`) geçilir, geri kaydırınca
listeye döner. Ses yalnızca **US** aksanıdır.

```
app/
  www/               # uygulamanın web varlıkları (webDir)
    index.html       # açılış = kelime listesi — build_all.py üretir
    kartlar.html     # kelime kartları — build_all.py üretir
    tts-bridge.js    # native TTS köprüsü (tarayıcıda no-op) — elle yazılır
  android/           # Capacitor'ün ürettiği native proje
  capacitor.config.json
  package.json
```

`index.html` ve `kartlar.html`, kök dizindeki `scripts/build_all.py` tarafından
şablonlardan üretilir (aynı içerik + `tts-bridge.js` + yatay kaydırma navigasyonu).
Kelime içeriği güncellenince: `python3 scripts/build_all.py` çalıştır, sonra
`cd app && npx cap sync android`.

## APK nasıl üretilir

### Yol 1 — GitHub Actions (önerilen, kurulum gerektirmez)
`.github/workflows/build-apk.yml` her push'ta veya Actions sekmesinden elle
("Run workflow") çalışır. Biten derlemede **oxford3000-debug-apk** adlı artifact'i
indir; içindeki `app-debug.apk`'yı telefona kur (Ayarlar > bilinmeyen kaynaklara izin).

### Yol 2 — Yerel makine (Android SDK gerekir)
```bash
cd app
npm ci
npx cap sync android
cd android
./gradlew assembleDebug
# çıktı: app/android/app/build/outputs/apk/debug/app-debug.apk
```

> Debug APK, Gradle'ın varsayılan debug anahtarıyla otomatik imzalanır; kişisel
> kurulum (sideload) için yeterlidir. Play Store yayını için release imzası gerekir.
