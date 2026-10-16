# Thousand — Android uygulaması (Capacitor)

Capacitor 7, hedef Android 15 (`targetSdk` 35), en düşük Android 6 (`minSdk` 23). Sürümler
`android/variables.gradle`'da; Android 15'te sayfa durum/gezinme çubuklarının altına girmesin diye
`capacitor.config.json` → `android.adjustMarginsForEdgeToEdge: auto`.

Kelime listesi, kartlar (test + sınav), sözlük, istatistik, ayarlar ve arkadaşlar
sayfalarını tek bir Android uygulamasında toplar. İlerleme telefonda (`localStorage`)
saklanır; hesap açılırsa Supabase'e yedeklenir.

## Sayfalar ve gezinme

Her sayfanın altında sekme çubuğu var: Liste · Kartlar · İlerleme · Sözlük · Arkadaş · Ayarlar
(`scripts/build_all.py` → `nav_bar`; sınav sürerken çıkış onayı sorulur). Ayrıca sayfalar arasında
kaydırarak da geçilir (`swipe_script`); analiz yalnız ayarlardan kaydırarak açılır:

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
  yazmaz). *Sınav* = vadesi gelen tekrarlar + listenin yeni kelimeleri; cevaplar tekrar
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
    kelimeler.js       # 3000 kelimenin verisi (bütün sayfalar ortak) — build_all.py üretir
    updater.js         # uygulama içi güncelleme — build_all.py templates/'ten üretir
    srs.js             # tekrar sistemi — elle yazılır
    hesap.js           # hesap, arkadaşlar, yedek, bildirim ayarı (Supabase) — elle yazılır
    log.js             # kullanım kaydı — elle yazılır
    tts-bridge.js      # native TTS köprüsü + bildirimden sayfa açma — elle yazılır
    three.min.js       # kart çevirme animasyonu
    audio/             # gömülü sesler
  android/             # native proje; io/github/ahmetayarsss/thousand/ altında:
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

**Karanlık mod:** telefon karanlık moddaysa sayfalar da koyu olur (`scripts/build_all.py` →
`THEME_HEAD`: `<html data-theme="dark">` + renk değişkenleri). Şablonda sabit renk yazma; değişken
kullan (`--card`, `--ink`, `--solid`…), yoksa karanlık modda o parça açık kalır.

Kelime içeriği ya da şablon değişince: `python3 scripts/build_all.py` çalıştır. Yerel
derlemeden önce de çalıştır: `app/www/updater.js` repoda değil, bu script üretir.

## APK nasıl üretilir

### Yol 1 — GitHub Actions (önerilen, kurulum gerektirmez)
`.github/workflows/build-apk.yml` `main`'e her birleşmede veya Actions sekmesinden elle
("Run workflow") çalışır ve **yayın (release)** APK'sını derler: hata ayıklanamaz (USB ile
bağlanan biri uygulamanın verisini okuyamaz), `versionCode` her derlemede artar (GitHub çalışma
numarası). APK `apk-latest` release'inde **`Thousand.apk`** adıyla durur; telefona oradan
kurulur (Ayarlar > bilinmeyen kaynaklara izin). Release'te yalnız `Thousand.apk`, `web.json`,
`web-version.txt` kalır; başka (eski adlı) dosyalar her yayından sonra silinir.

**Yedekleme:** `allowBackup` açık bırakıldı: Android'in Google yedeği uygulama verisini
(ilerleme dahil) telefonun ekran kilidiyle şifreli olarak saklar; yeni telefonda işe yarar.
İçinde kurtarma kodu da var, ama yedeğe yalnız kullanıcının kendi Google hesabı erişir.

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

> **İmza:** CI, APK'yı GitHub gizli ayarlarındaki anahtarla (`IMZA_ANAHTARI` = base64 PKCS12,
> `IMZA_PAROLA`) imzalar ve yayından önce APK'nın gerçekten o anahtarla imzalandığını doğrular;
> ayarlar yoksa yayın yapılmaz. Anahtar repoda değil. Yerel derleme Android'in debug anahtarını
> kullanır; o APK telefondakinin üstüne kurulamaz (yalnız deneme için).
>
> **Ad ve paket kimliği:** uygulama "Thousand", paket `io.github.ahmetayarsss.thousand` (Ekim 2026'ya
> kadar "3000" / `com.oxford3000.study`). Paket değişince Android onu ayrı uygulama sayar: eski
> uygulamada ana sayfada uyarı ve Ayarlar'da taşıma rehberi çıkar (yedek doğrula → kurtarma kodu →
> yeni uygulamayı yanına kur → kodu gir → eskisini sil). İşaret: gömülü güncelleyicinin yazdığı
> `ox_apk_imza = "3"`; eski uygulamalarda yok ya da `"2"`.
>
> Eski anahtar (repoda açıktı) Ekim 2026'da değiştirildi. Eski APK'lı telefonlarda ana sayfada
> uyarı ve Ayarlar'da "Uygulamayı bir kez yeniden kur" kartı çıkar: yedek doğrulanır
> (`OXACC.yedekDogrula`), kurtarma kodu gösterilir, sonra sil-kur yapılır.
