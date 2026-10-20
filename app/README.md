# Thousand — eski Android uygulaması (Capacitor)

> **Artık APK'sı derlenmiyor.** Yayındaki uygulama yeni uygulama (`mobile/`, React Native): aynı ad, aynı paket
> ve imzayla bunun üstüne kurulur (`mobile/README.md`). Bu klasör geçiş için duruyor: telefonunda hâlâ eski
> uygulama olanların güncelleyicisi web paketini (`build-apk.yml`) indirmeye devam eder; paketteki `www/gecis.js`
> ilerlemeyi yeni uygulamanın ilk açılışta okuyacağı dosyaya yazar. Eski uygulama tamamen kalkınca (PLAN.md adım 40) silinir.

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

**Ses:** kelime için `www/audio/<kelime>.mp3` (insan sesi, 2976 kayıt) varsa o çalar, yoksa
cihazın TTS'i (`www/tts-bridge.js`, yalnız US aksanı). Dosya adı sayfalardaki `slugOf` ile
türetilir (`next to` → `next-to.mp3`); eş yazılan kelimeler (`live`, `close`, `IT`/`it`…) tek
kaydı paylaşır. Sesler APK'nın içindedir, güncelleme paketiyle gelmez: yeni ses yeni APK ister.

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
    audio/*.mp3        # kelimelerin insan sesi kayıtları — elle eklenir, APK'ya gömülür
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
"Güncelleme açılamadı — önceki sürüm kullanılıyor" der.

**Karanlık mod:** telefon karanlık moddaysa sayfalar da koyu olur (`scripts/build_all.py` →
`THEME_HEAD`: `<html data-theme="dark">` + renk değişkenleri). Şablonda sabit renk yazma; değişken
kullan (`--card`, `--ink`, `--solid`…), yoksa karanlık modda o parça açık kalır.

Kelime içeriği ya da şablon değişince: `python3 scripts/build_all.py` çalıştır. Yerel
derlemeden önce de çalıştır: `app/www/updater.js` repoda değil, bu script üretir.

## Geçiş: yeni uygulamaya ilerleme aktarımı

`www/gecis.js` her sayfa açılışında ve uygulama arka plana geçerken bütün `ox3000_*` anahtarlarını uygulamanın
kendi dosya klasörüne (gecis klasörü, aynı içerikte iki kopya) yazar; dosya telefondan çıkmaz. Yeni
uygulama eskisinin üstüne kurulunca ilk açılışta bu dosyayı okur (`mobile/src/gecis.js`). Sıra: eski uygulamayı
bir kez aç (güncelleme paketi gelir, "güncellendi ✓"), sonra yeni APK'yı kur. Testi: `tests/gecis.test.js`.

**İmza ve paket:** yeni uygulama da GitHub gizli ayarlarındaki anahtarla (`IMZA_ANAHTARI`, `IMZA_PAROLA`) imzalanır,
paket `io.github.ahmetayarsss.thousand`; `build-apk.yml` ikisini de yayından önce doğrular.

> **Yeniden kurma uyarısı:** APK'daki güncelleyici açılışta `ox_apk_imza` işaretini yazar
> (`templates/updater.js`). İşaret `hesap.js`'teki `APK_IMZA` değerinden farklıysa (telefondaki APK
> güncel paket ya da imzayla kurulmamış) ana sayfada uyarı ve Ayarlar'da rehber çıkar: yedek doğrulanır
> (`OXACC.yedekDogrula`), kurtarma kodu gösterilir, sonra yeni APK kurulur.
