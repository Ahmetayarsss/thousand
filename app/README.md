# Oxford 3000 — Android uygulaması (Capacitor)

Kelime listesi, kartlar (test + sınav), sözlük, istatistik, ayarlar ve arkadaşlar
sayfalarını tek bir Android uygulamasında toplar. İlerleme telefonda (`localStorage`)
saklanır; hesap açılırsa Supabase'e yedeklenir.

## Sayfalar ve gezinme

Menü yok; sayfalar arasında kaydırarak geçilir (`scripts/build_all.py` → `swipe_script`):

```
                 ayarlar ⇄ analiz          (ayarlar: sözlükte en üstte aşağı çek)
                    ↕
istatistik ⇄ kartlar ⇄ liste ⇄ sözlük
                                 ↕
                             arkadaşlar    (sözlükte en altta yukarı it)
```

- **liste** (`index.html`): sıradaki yeni kelimeler (ayarlardaki sayı kadar), arama,
  "Listeyi oku" (ekran kapalıyken de okuyan native servis, kulaklık tuşlarıyla).
- **kartlar** (`kartlar.html`): *Test* = listeyi kartlarla çalışma (tekrar sistemine
  yazmaz). *Sınav* = vadesi gelen tekrarlar + turun yeni kelimeleri; cevaplar tekrar
  sistemine yazılır, altın kartlarda cevap yazılır.
- **sözlük**, **istatistik** (genel ilerleme), **analiz** (ayrıntılı istatistik),
  **ayarlar** (hesap, kelime sayısı, okuma ayarları, bildirimler), **arkadaşlar**
  (arkadaş kodu, istekler, dürtme).

**Tekrar sistemi** (`www/srs.js`, testleri `tests/srs.test.js`): kelime başına kutu;
aralıklar 1 → 3 → 7 gün, sonra olgun 7 → 14 → 30 → 60 gün. Yanlış cevap bir kutu
düşürür (en az 1. kutu; olgun kelime 2. kutuya iner). Günler yerel saatle gece yarısı değişir.

**Ses:** önce APK'ya gömülü Sözlük US kaydı (`www/audio/`), yoksa cihazın TTS'i
(`www/tts-bridge.js`, yalnız US aksanı).

```
app/
  www/                 # uygulamanın web varlıkları (webDir)
    *.html             # sayfalar — build_all.py üretir, elle düzenlenmez
    updater.js         # uygulama içi güncelleme — build_all.py templates/'ten üretir
    srs.js             # tekrar sistemi — elle yazılır
    hesap.js           # hesap, arkadaşlar, yedek, bildirim ayarı (Supabase) — elle yazılır
    log.js             # kullanım kaydı — elle yazılır
    tts-bridge.js      # native TTS köprüsü + bildirimden sayfa açma — elle yazılır
    three.min.js       # kart çevirme animasyonu
    audio/             # gömülü sesler
  android/             # native proje; com/oxford3000/study/ altında:
                       #   GroupTts*  "Listeyi oku" servisi, Bildirim* / *Worker bildirimler,
                       #   Uygulama   geri tuşu, MainActivity eklenti kaydı
  capacitor.config.json
  package.json
```

**Uygulama içi güncelleme:** arayüz (HTML/JS) APK yeniden kurulmadan güncellenir
(`templates/updater.js`). Güncelleyici yalnız `apk-latest` release'indeki `web-version.txt`'ye
bakar; daha yeniyse `web.json`'u indirir, içindeki sürüm aynıysa cihaza yazıp hemen uygular.
Paketi yalnız CI (`main`'e birleşince) üretir. İndirilen paket üst üste 3 açılışta açılamazsa
uygulama kendiliğinden APK'daki sürüme döner, o sürümü bir daha indirmez ve kullanıcıya
"Güncelleme açılamadı — önceki sürüm kullanılıyor" der (bu koruma APK'daki güncelleyicide
çalışır: bu sürümü içeren APK kurulduktan sonra etkindir).

Kelime içeriği ya da şablon değişince: `python3 scripts/build_all.py` çalıştır. Yerel
derlemeden önce de çalıştır: `app/www/updater.js` repoda değil, bu script üretir.

## APK nasıl üretilir

### Yol 1 — GitHub Actions (önerilen, kurulum gerektirmez)
`.github/workflows/build-apk.yml` `main`'e her birleşmede veya Actions sekmesinden elle
("Run workflow") çalışır. Biten derlemede **oxford3000-debug-apk** adlı artifact'i
indir; içindeki `app-debug.apk`'yı telefona kur (Ayarlar > bilinmeyen kaynaklara izin).

### Yol 2 — Yerel makine (Android SDK gerekir)
```bash
python3 scripts/build_all.py   # sayfalar + updater.js
cd app
npm ci
npx cap sync android
cd android
./gradlew assembleDebug
# çıktı: app/android/app/build/outputs/apk/debug/app-debug.apk
```

> APK, repodaki sabit anahtarla (`app/android/app/oxford.keystore`) imzalanır ki her yeni
> APK öncekinin üstüne güncelleme olarak kurulsun. Anahtar ve parolası açıkta; CI secret'ına
> taşınması `PLAN.md` adım 5'te.
