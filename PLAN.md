# Düzeltme planı

Eleştiride bulunan sorunlar, sırayla. Her adım ayrı commit; bitince aynı commit'te `[x]` olur
(hangi commit: `git log -- PLAN.md`). 🔸 = başlamadan kullanıcının kararı gerekiyor (önce sorulur).
Yeni oturum: ilk işaretlenmemiş adımdan devam et.

## Aşama 1 — Temizlik (risksiz)

- [x] 1. Ölü kod: `progress.js` (eski kilitli bölüm sistemi) silinir; paket listesi, CI ve
      belgeler temizlenir. README'ler gerçek yapıya göre yeniden yazılır.
- [x] 2. Artık dosyalar: `proto_*.html`, `media/` ve kökteki tarayıcı sürümleri
      (`Oxford3000_*.html` + kopya JS'ler) silindi — kullanıcı: tarayıcı sürümü kullanılmıyor.

## Aşama 2 — Güvenlik ve yayın

- [x] 3. Yayın kanalı `main` (kullanıcı kararı: main + PR). APK ve güncelleme paketi yalnız
      `main`'den, testler + bekçi geçerse çıkar; güncelleyici yalnız release'ten indirir,
      paketin içindeki sürümü doğrular; `web.json` repodan çıktı. Eski dal donduruldu.
- [x] 4. Bozuk pakette geri dönüş: paket üst üste 3 açılışta açılamazsa gömülü sürüme
      dönülür, o sürüm bir daha indirilmez, kullanıcıya söylenir (yeni APK kurulunca etkin).
- [x] 4b. Paket imzası: yapılmadı (kullanıcı kararı; aşağıda "Bilerek bırakılanlar"). Yerine
      GitHub hesabında iki adımlı doğrulama önerildi.
- [x] 5. İmza anahtarı yenilendi (kullanıcı kararı: yeni mühür). Anahtar repodan çıktı, GitHub
      gizli ayarlarında; CI yayından önce imzayı doğrular. Eski APK'lı telefonlarda yeniden kurulum
      rehberi (yedek doğrulama → kurtarma kodu → sil-kur). Eski anahtar git geçmişinde kalıyor ama
      artık hiçbir şeyi imzalamıyor.
- [x] 6. Yedekleme ve dışarıdan erişim: `allowBackup` açık kaldı (Google yedeği ekran kilidiyle
      şifreli, yeni telefonda ilerlemeyi kurtarıyor). Asıl açık hata ayıklama derlemesiydi: APK
      artık release derleniyor (USB ile veri okunamaz); CI debuggable APK'yı yayınlamaz.

## Aşama 3 — Veri kaybına karşı sağlamlık

- [x] 7. İlerleme yazılamazsa (hafıza dolu): önce kullanım kaydı kısaltılıp tekrar denenir; yine
      olmazsa ekranda kırmızı uyarı + kayda düşer (`SRS.yaz`). Geri yükleme yazılamazsa "geri geldi"
      denmez, eksik söylenir.
- [x] 8. Kurtarmada telefonda da ilerleme varsa soru artık iki tarafı sayıyla gösterir (kelime
      sayısı, en son ne zaman çalışıldı, yedek tarihi); kullanıcı bilerek seçer.

## Aşama 4 — Gizlilik ve hukuk

- [x] 9. Kullanım kayıtları yalnız izinle (kullanıcı kararı: bir kez sorulsun): hesap açılınca, kurtarma
      kodundan sonra ve izni hiç sorulmamış hesaplarda ana sayfada bir kez sorulur; "evet" anından önceki
      olaylar gönderilmez. Ayarlar → Gizlilik: aç/kapa + sunucuda neyin tutulduğunu anlatan kısa metin.
- [x] 10. Sözlük ses dosyaları: kullanıcı kararıyla kalıyor (aşağıda "Bilerek bırakılanlar").
- [x] 11. Ad "Thousand", paket `io.github.ahmetayarsss.thousand` (kullanıcı kararı; uygulama herkese
      dağıtılacak). Eski uygulamada taşıma rehberi; bekçi `marka-adi` kuralı adın geri girmesini engeller.

## Aşama 5 — Öğrenme (pedagoji)

- [x] 12. Varsayılan yeni kelime sayısı 100 → 20 (ayarı elle değiştirmiş kullanıcıya dokunulmaz;
      yarım kalan tur kendi sayısıyla biter, sonraki tur 20'lik kurulur).
- [x] 13. Yazılı cevap esnekliği: yapılmadı (kullanıcı kararı; aşağıda "Bilerek bırakılanlar").
- [x] 14. Okunuş tutarlılığı (kullanıcı kararı: Amerikan'a çevir): 243 okunuş düzeltildi
      (`proper → PRA-pır`, `ask → ESK`); validate.py İngiliz söyleyişinde kalanı yakalar.
- [x] 15. IPA gösterimi: yapılmadı (kullanıcı kararı; hazırlanan PR #11 kapatıldı).
- [x] 16. Hile tespiti kaldırıldı (kullanıcı kararı): hiç tetiklenemiyordu (Bildim düğmesi kart açılma
      animasyonundan sonra çıkıyor, tespit 0,35 sn'den hızlı basış bekliyordu). Telefondaki eski sayaç silinir.

## Aşama 6 — Arayüz

- [x] 17. İlk açılışta takma ad sorusu: yapılmadı (kullanıcı kararı, şimdiki hali kalıyor).
- [x] 18. Ana ekran: kaydırıcıda "Kelime arası 0,5 sn" etiketi; her sayfada alt sekme çubuğu (Liste ·
      Kartlar · İlerleme · Sözlük · Arkadaş · Ayarlar), kaydırma da duruyor. "0 · A1" başlığına dokunulmadı
      (kullanıcı kararı). Kullanıcı beğenmezse geri çekilir (ayrı PR).
- [x] 19. Adlar (kullanıcı seçti): tekrar sistemindeki kelimeler "döngü" → "çalışılan"; Listeyi oku'daki
      "Döngü" → "Başa dön"; sınav turu → "liste"; "Kısım" ve İlerleme'deki Olgun/Öğreniliyor/Yeni aynı.
- [x] 20. Kart ekranı düzeni: yapılmadı (kullanıcı kararı).
- [x] 21. Karanlık mod: telefon karanlıktaysa bütün sayfalar (kart çevirme görüntüsü dahil) koyu; açık
      tema eskisiyle piksel piksel aynı. Erişilebilirlik taraması: adı olmayan tek kontrol (sözlük arama
      kutusu) etiketlendi; doğru/yanlış sonucu renkle birlikte yazıyla da veriliyor.

## Aşama 7 — Performans ve mimari

- [ ] 22. `log.js`: her olayda 5000 olayı yeniden yazmak yerine toplu/ertelenmiş yazma.
- [ ] 23. Kart çevirme: 600 KB three.js + WebGL yerine CSS 3D (önce/sonra ekran kaydıyla).
- [ ] 24. Kelime verisi her sayfaya ayrı gömülmez; tek veri dosyası (paket ~3 MB → ~1 MB).
- [ ] 25. `scripts/enrich/g*.py` (veri kod içinde) → veri dosyası.
- [ ] 26. Testler: `hesap.js` ve Supabase fonksiyonları için (güncelleyici testi adım 3'te geldi).
- [x] 27. `versionCode` her derlemede artar (GitHub çalışma numarası; adım 6 ile birlikte).

## Aşama 8 — Android ve dağıtım

- [ ] 28. 🔸 Arka plan kontrolü: 15 dk'da bir sunucuya sorma + pil optimizasyonu muafiyeti
      yerine ne? (Firebase bildirimleri ya da daha seyrek kontrol.)
- [ ] 29. `targetSdk` 35+ (Capacitor 7'ye geçiş) — Play Store şartı (kullanıcı: uygulama herkese dağıtılacak).

## Bilerek bırakılanlar (şimdilik)

- Sözlük ses dosyaları (10): telif Sözlük'in; uygulama herkese dağıtılınca ihlal sayılır,
  şikâyet gelirse Play Store uygulamayı kaldırabilir / hesaba uyarı gelebilir. Kullanıcı bu riski
  bilerek sesleri tuttu (Ekim 2026). Çıkış yolu: cihaz sesi (TTS) ya da lisanslı ses.
- İmza anahtarının iç adı (`keyAlias "oxford"`) ve sertifikadaki "CN=Oxford 3000": kullanıcıya
  görünmez; değiştirmek yeni anahtar + yeni gizli ayar ister. Bekçinin marka kuralı yalnız
  "Oxford 3000" biçimini yakalar, bu yüzden takılmaz.

- Güncelleme paketine ayrı imza (4b): anahtar GitHub'da duracağı için, GitHub hesabını ele
  geçiren onu da kullanırdı — ek koruma çok az. Asıl koruma GitHub hesabında iki adımlı
  doğrulama. (Kullanıcı kararı, Ekim 2026.)

- Yazılı cevapta tek harf hatası yine yanlış sayılıyor, "doğru saydır" düğmesi yok (13): hazırlanan
  değişiklik (kapatılan PR #9) kullanıcı tarafından istenmedi — mevcut katı kontrolden memnun (Ekim 2026).
- IPA gösterimi (15, kapatılan PR #11), ilk açılışta takma ad sorusunun ertelenmesi (17) ve kart
  ekranı düzeni (20) yapılmadı: kullanıcı istemedi (Ekim 2026).
- Arkadaş istatistikleri telefondan geldiği için sahtelenebilir — yalnız arkadaşlar arası
  görünüyor, ödül/sıralama yok.
- Kurtarma koduyla hesap taşınınca eski anonim giriş kaydı sunucuda kalıyor — zararsız,
  ileride temizlik işiyle silinebilir.
