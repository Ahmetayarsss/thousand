# CLAUDE.md — bu repoda çalışan her oturum için kurallar

Bu dosya her oturumun başında okunur. Buradaki kurallar, önceki oturumlarda yapılan
hataların bir daha yapılmaması için var. "Bu sefer dikkat ederim" yerine geçer: kurala
uymayan değişiklik CI'da (`.github/workflows/kontrol.yml`) kırmızı yanar.

## Proje

**Thousand**: Türkçe konuşanlara İngilizce kelime çalışma uygulaması, Android (Capacitor + WebView),
paket `io.github.ahmetayarsss.thousand`. İçerik Oxford 3000 kelime listesine dayanır ama uygulamanın
adında, başlıklarında ve kimliğinde "Oxford" kullanılmaz (marka; kullanıcı kararı, Ekim 2026). Hesap, arkadaşlar,
yedek ve kullanım kayıtları Supabase'de (`supabase/kurulum.sql`). Kullanıcı Türkçe konuşur;
kod yorumları, commit mesajları ve arayüz metinleri Türkçe.

## Kaynak ve üretilen dosyalar

- **Kaynak (elle düzenlenir):** `data/all_groups.json`, `scripts/enrich/*.py`, `templates/*.html`,
  `templates/updater.js`, `app/www/srs.js`, `hesap.js`, `log.js`, `tts-bridge.js`,
  `supabase/kurulum.sql`, `app/android/**`.
- **Üretilen (elle DÜZENLENMEZ):** `app/www/*.html` ve `app/www/kelimeler.js` (repoda). Güncelleme paketi
  (`app/www/updater.js`, `web.json`, `web-version.txt`) de üretilir ama repoya girmez.

Üretim: `python3 scripts/build_all.py`. Şablonu ya da kaynak JS'i değiştirdikten sonra
çalıştır ve üretilenleri de commit'le; CI farkı yakalar.

## Sıradaki iş

Düzeltme planı `PLAN.md`'de; ilk işaretlenmemiş adımdan devam edilir.

## Push etmeden önce (hepsi geçmeli)

```bash
TZ=Europe/Istanbul node tests/srs.test.js
node tests/updater.test.js
node tests/hesap.test.js
node tests/log.test.js
python3 scripts/validate.py
python3 scripts/build_all.py
python3 scripts/bekci.py
```

Bir değişikliği "bitti" saymadan önce gerçekten çalıştır: test, gerekirse ekran görüntüsü
(Playwright, 390px genişlik). Çalıştırmadığın şeyi çalışıyor diye bildirme.

## Yayın — nasıl telefona ulaşır

- **`main` = yayın.** `main`'e giren her değişiklikte `build-apk.yml` testleri, doğrulamayı ve
  bekçiyi çalıştırır, geçerse APK'yı ve güncelleme paketini `apk-latest` release'ine koyar.
  Telefonlardaki güncelleyici paketi YALNIZ oradan indirir; arayüz değişikliği dakikalar
  içinde bütün telefonlarda olur.
- **`main`'e doğrudan push yok.** İş bir çalışma dalında yapılır, PR açılır, kullanıcı
  birleştirir. PR açıklaması telefonda neyin değişeceğini sade dille söyler.
- **Eski yayın dalı** (`claude/oxford-3000-pronunciation-defs-inzs33`) donduruldu: ona push edilmez.
- Güncelleme paketi (`web.json`, `web-version.txt`, `app/www/updater.js`) repoda tutulmaz;
  yalnız CI üretir (bekçi `paket-repoda` kuralı).

## Değişmez kurallar

1. **Gizli bilgi repoya girmez.** Keystore, parola, `service_role`/gizli anahtar, token.
   Supabase'in `sb_publishable_` anahtarı herkese açıktır, o serbest. Bekçi denetler.
2. **Telefona kod indiren yol** (`updater.js`) yalnız güvenliği artıran yönde değişir:
   doğrulamasız yeni indirme kaynağı eklenmez, gömülü sürüme dönüş yolu bozulmaz.
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
   kodu, paket listesini (`build_all.py` → `WEB_BUNDLE_FILES`) ve belgeleri de temizler.
9. **Belgeler kodla birlikte değişir.** Dosya ekleyen/silen ya da davranış değiştiren commit
   `README.md` / `app/README.md` / bu dosyayı da günceller.
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
