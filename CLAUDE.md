# CLAUDE.md — bu repoda çalışan her oturum için kurallar

Bu dosya her oturumun başında okunur. Buradaki kurallar, önceki oturumlarda yapılan
hataların bir daha yapılmaması için var. "Bu sefer dikkat ederim" yerine geçer: kurala
uymayan değişiklik CI'da (`.github/workflows/kontrol.yml`) kırmızı yanar.

## Proje

**Thousand**: Türkçe konuşanlara İngilizce kelime çalışma uygulaması, Android (React Native / Expo, `mobile/`),
paket `io.github.ahmetayarsss.thousand`. İçerik CEFR A1–B2 seviyelerinde 3000 İngilizce kelime. Hesap, arkadaşlar,
yedek ve kullanım kayıtları Supabase'de (`supabase/kurulum.sql`). Kullanıcı Türkçe konuşur;
kod yorumları, commit mesajları ve arayüz metinleri Türkçe.

Uygulama `mobile/`'da (React Native / Expo, iOS + Android; `PLAN.md` Aşama 9). Eski Capacitor (WebView) uygulamasının
yerine geçti ve onun kodu kaldırıldı (adım 40; git geçmişinde): aynı ad ("Thousand"), paket ve imzayla onun üstüne
kurulur; ilerleme kurtarma koduyla (sunucudaki yedekten) gelir (kullanıcı kararı: ayrı aktarım yok). Android'e özgü
işler (Listeyi oku servisi, bildirimler) Expo yerel modülleri (`mobile/modules/`); iOS karşılıkları henüz yok
(PLAN.md adım 39).

## Kaynak ve üretilen dosyalar

- **Kaynak (elle düzenlenir):** `data/all_groups.json` (bütün kelime içeriği), `supabase/kurulum.sql`,
  `mobile/` (`src/uretilen/` hariç; `assets/audio/*.mp3` kelime ses kayıtları, adları `slugOf` kuralıyla,
  `validate.py` denetler).
- **Üretilen (elle DÜZENLENMEZ):** `mobile/src/uretilen/*` (repoda).

Üretim: `python3 scripts/build_all.py`. Kelime verisini ya da sesleri değiştirdikten sonra
çalıştır ve üretilenleri de commit'le; CI farkı yakalar.

## Sıradaki iş

Düzeltme planı `PLAN.md`'de; ilk işaretlenmemiş adımdan devam edilir.

## Push etmeden önce (hepsi geçmeli)

```bash
TZ=Europe/Istanbul node tests/srs.test.js
node tests/log.test.js
TZ=Europe/Istanbul node tests/hesap_yeni.test.js  # hesap, arkadaşlar, yedek, kayıt izni, bildirimler
TZ=Europe/Istanbul node tests/oturum.test.js   # Kartlar mantığı
TZ=Europe/Istanbul node tests/ilerleme.test.js # İlerleme / İstatistikler hesapları
node tests/sozluk.test.js      # Sözlük araması
node tests/okuma.test.js       # Listeyi oku listesi, Türkçe okuma metni
node tests/cevirme.test.js     # kart çevirme eskisiyle (three.js) birebir mi
bash tests/sunucu.test.sh      # sunucu (kurulum.sql) — geçici PostgreSQL açar
python3 scripts/validate.py
python3 scripts/build_all.py
python3 scripts/bekci.py
(cd mobile && npx expo export --platform android --output-dir dist/android)   # mobile/ değiştiyse
```

Bir değişikliği "bitti" saymadan önce gerçekten çalıştır: test, gerekirse ekran görüntüsü
(Playwright, 390px genişlik). Çalıştırmadığın şeyi çalışıyor diye bildirme.

## Yayın — nasıl telefona ulaşır

- **`main` = yayın.** `main`'e giren her değişiklikte `build-apk.yml` testleri, doğrulamayı ve
  bekçiyi çalıştırır, geçerse APK'yı (`Thousand.apk`) `apk-latest` release'ine koyar. Uzaktan güncelleme yok:
  değişiklik telefona yeni APK kurulunca gelir (kullanıcı kararı). Google Play AAB'si iş akışı çıktısı olarak
  derlenir, yayınlanmaz. iOS yalnız derleniyor mu diye denetlenir
  (`ios-derle.yml`, PR'larda); Apple Developer hesabı açılınca imzalı derleme ve TestFlight eklenir.
- **Açılış denemesi:** PR'larda `acilis-denemesi.yml` uygulamayı yayın ayarlarıyla derleyip emülatörde açar; çökerse
  kırmızı yanar. Ardından emülatörde gezinme denenir (kaydırma, geri tuşu, pencere; `gezinme-denemesi.sh`). Yerel modüllerde (Java/Kotlin) ya da yerel bağımlılıkta değişiklik varsa yeşil olmadan birleştirilmez
  (adım 36'da WorkManager yalnız telefonda, açılışta çöküyordu).
- **`main`'e doğrudan push yok.** İş bir çalışma dalında yapılır, PR açılır, kullanıcı
  birleştirir. PR açıklaması telefonda neyin değişeceğini sade dille söyler.

## Değişmez kurallar

1. **Gizli bilgi repoya girmez.** Keystore, parola, `service_role`/gizli anahtar, token.
   Supabase'in `sb_publishable_` anahtarı herkese açıktır, o serbest. Bekçi denetler.
2. **Telefona kod indiren yol yok** (kullanıcı kararı: uzaktan JS güncellemesi yok; eski uygulamanın güncelleyicisi
   kaldırıldı). Eklenmesi kullanıcıya sorulur.
3. **Yeni ağ adresi = kullanıcı verisinin gidebileceği yeni yer.** Önce kullanıcıya sor;
   onaylanırsa `scripts/bekci.py` içindeki `IZINLI_ALANLAR`'a gerekçesiyle ekle.
4. **Kullanıcıdan veri toplayan yeni kod** (kayıt, istatistik, cihaz bilgisi) kullanıcıya
   sorulmadan ve uygulamada görünür bir açıklama/onay olmadan eklenmez.
5. **İmza anahtarı kullanıcı onayı olmadan değiştirilmez.** Değişirse telefondaki uygulama
   güncellenemez; kaldır-kur yerel ilerlemeyi siler. Anahtar repoda değil, GitHub gizli
   ayarlarında (`IMZA_ANAHTARI`, `IMZA_PAROLA`); yoksa `build-apk.yml` yayın yapmaz.
6. **localStorage anahtarlarını** (`ox3000_*`) yeniden adlandıran ya da biçimini değiştiren
   değişiklik eski veriyi taşıyan bir geçiş kodu içerir. İlerleme yalnız telefonda durur.
7. **Sabit dal adı** kodda ve CI'da kullanılmaz (yeni kodda; mevcutlar borç listesinde).
8. **Ölü kod bırakılmaz.** Kullanılmayan dosya silinir; bir özelliği kaldıran commit ilgili
   kodu, bağımlılığı (`mobile/package.json`) ve belgeleri de temizler.
9. **Belgeler kodla birlikte değişir.** Dosya ekleyen/silen ya da davranış değiştiren commit
   `README.md` / `mobile/README.md` / bu dosyayı da günceller.
10. **Supabase:** tablolara doğrudan erişim açılmaz (RLS açık, politika yok). Yeni işlev
    `security definer`, `_me()` ile kimlik, girdi boyutu sınırı ve açık `grant` ile yazılır;
    `kurulum.sql` tekrar çalıştırılabilir kalır.
11. **Kestirme yaparsan söyle.** Güvenlik ya da kalite pahasına bir kolaylık seçildiyse
    kullanıcıya açıkça yaz ve gerekçesiyle `scripts/bekci_borc.json`'a ekle; sessizce geçme.
12. **Hataları sessizce yutma.** Yeni kodda `catch (e) {}` yalnız gerçekten önemsiz yerlerde;
    veri kaybettirebilecek yazmalarda (ilerleme, yedek) hata kullanıcıya ya da kayda düşer.

## Bekçi ve borç listesi

`scripts/bekci.py` kuralları otomatik denetler. Bilinen ve henüz düzeltilmemiş sorunlar
`scripts/bekci_borc.json`'da gerekçesiyle durur. Listede olmayan yeni ihlal CI'ı kırar;
bir borç düzeltilince kaydı silinmezse de CI kırılır. Borç listesine kayıt eklemek
istisnadır, kullanıcıya söylenir.
