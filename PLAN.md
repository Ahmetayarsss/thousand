# Düzeltme planı

Eleştiride bulunan sorunlar, sırayla. Her adım ayrı commit; bitince aynı commit'te `[x]` olur
(hangi commit: `git log -- PLAN.md`). 🔸 = başlamadan kullanıcının kararı gerekiyor (önce sorulur).
Yeni oturum: ilk işaretlenmemiş adımdan devam et.

## Aşama 1 — Temizlik (risksiz)

- [x] 1. Ölü kod: `progress.js` (eski kilitli bölüm sistemi) silinir; paket listesi, CI ve
      belgeler temizlenir. README'ler gerçek yapıya göre yeniden yazılır.
- [x] 2. Artık dosyalar: `proto_*.html`, `media/` ve kökteki tarayıcı sürümleri
      (tarayıcı sürümü sayfaları + kopya JS'ler) silindi — kullanıcı: tarayıcı sürümü kullanılmıyor.

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
- [x] 11. Ad "Thousand", paket `io.github.ahmetayarsss.thousand` (kullanıcı kararı; uygulama herkese
      dağıtılacak). Eski uygulamada taşıma rehberi.

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

- [x] 22. `log.js`: olaylar bellekte birikir, en geç 1 sn sonra tek seferde yazılır; sayfadan çıkarken /
      arka plana geçerken hemen yazılır (`tests/log.test.js`). Dolu kayıtta 100 olay: 272 ms → <1 ms.
- [x] 23. Kart çevirme: yapılmadı (kullanıcı kararı; aşağıda "Bilerek bırakılanlar"). three.js kalıyor.
- [x] 24. Kelime verisi tek dosyada (`app/www/kelimeler.js`, build üretir); sayfalar ihtiyaç duyduğu biçimi
      yüklenince türetir. Paket 3,08 → 1,74 MB (three.js kaldığı için ~1 MB'a inmedi). Sayfalar piksel aynı.
- [x] 25. `scripts/enrich/` silindi: okunuş/açıklama/örnekler zaten `data/all_groups.json`'daydı (build her
      seferinde kopyalıyordu). Artık tek kaynak o dosya; build çıktısı birebir aynı.
- [x] 26. Sunucu testleri (`tests/sunucu.test.sh`, 40 denetim): geçici PostgreSQL'de kurulum.sql iki kez +
      yetkiler, hesap, yedek, arkadaşlık, dürtme, bildirim, kayıtlar, taşıma, silme. hesap.js testleri adım 7–9'da geldi.
- [x] 27. `versionCode` her derlemede artar (GitHub çalışma numarası; adım 6 ile birlikte).

## Aşama 8 — Android ve dağıtım

- [x] 28. Arka plan kontrolü (kullanıcı kararı: seyrek kontrol): arkadaş isteği/dürtme kontrolü saatte bir;
      pil optimizasyonu muafiyeti (izin + kurulum adımı) kaldırıldı. Bedeli: telefon uykudayken bildirim
      ve hatırlatmalar gecikebilir. Yeni APK ile etkin.
- [x] 29. Capacitor 7, `targetSdk`/`compileSdk` 35 (Play Store şartı), Gradle 8.11.1 / AGP 8.7.2. En düşük Android 6
      (minSdk 23; eskiden 5.1). Android 15'te ekran kenarı payı: `adjustMarginsForEdgeToEdge: auto`. Yeni APK ile etkin.

## Aşama 9 — Yeni uygulama: React Native (Expo), iOS + Android

Kullanıcı kararı (Ekim 2026): App Store'un 4.2 kuralı ("paketlenmiş web sitesi") ve iOS için HTML yapısından
çıkılır; tek kod tabanı iki platformu besler. Yeni uygulama `mobile/`'da yazılır. Capacitor uygulaması (`app/`)
yeni uygulama onun yaptığı her şeyi yapana ve geçiş yapılana dek yayında kalır. Tekrar sistemi (`srs.js`) ve
kullanım kaydı (`log.js`) iki uygulamada ortak ve değişmeden kullanılır; localStorage anahtarları (`ox3000_*`) aynı.

- [x] 30. İskelet: Expo (JavaScript), alt sekmeler, çekirdek (`srs.js`, `log.js`) telefonda SQLite üstünde
      değişmeden çalışır (`expo-sqlite` localStorage'ı), kelime verisi ve ses haritası build'den
      (`mobile/src/uretilen/`), Liste ekranı (kelimeye dokununca ses). CI'da Android paketleme denetimi;
      bekçi `mobile/`'daki ağ adreslerini de tarar.
- [ ] 31. Kartlar: Test + Sınav, yazılı kart ve uygulama içi klavye, çıkış onayı.
      🔸 Kart çevirme: three.js'deki kâğıt gibi bükülme Skia ile birebir mi, yoksa sade 3D çevirme mi?
- [ ] 32. İlerleme, İstatistik, Analiz; bütün kelimeler bitince havai fişek.
- [ ] 33. Sözlük.
- [ ] 34. Hesap ve Arkadaşlar (`hesap.js`'in ekrandan bağımsız hali; aynı Supabase işlevleri), Ayarlar,
      ilk açılış penceresi, kullanım kaydı izni.
- [ ] 35. Listeyi oku: arka planda ses, kilit ekranı / bildirim denetimleri (Android + iOS), Türkçe okuma,
      bekleme sürgüsü.
- [ ] 36. Bildirimler: yerel seri/tekrar hatırlatmaları; arkadaş isteği ve dürtme.
      🔸 iOS'ta bunlar için push (APNs) gerekir: yeni ağ adresi + sunucu işi.
- [ ] 37. Android'de geçiş: aynı paket adı ve imza, yeni uygulama eskisinin üstüne kurulur. Capacitor'ın son
      web paketi ilerlemeyi bir dosyaya yazar, yeni uygulama ilk açılışta onu okur (6. kural); kurtarma
      kodu ve yedek ikinci yol. 🔸 Geçiş zamanı.
- [ ] 38. Yayın hattı: GitHub Actions'ta `expo prebuild` + Gradle (APK/AAB), macOS'ta iOS; imza anahtarları
      GitHub gizli ayarlarında. 🔸 Uzaktan JS güncellemesi (EAS Update) olacak mı — yeni ağ adresi ve
      App Store 2.5.2; önerilen: yok, güncellemeler mağazadan.
- [ ] 39. App Store hazırlığı: gizlilik politikası, App Privacy etiketi, şikâyet/engelleme ve takma ad
      süzgeci (1.2), iOS'a özgü özellikler (widget, kilit ekranından okuma).
- [ ] 40. Capacitor uygulaması kaldırılır (`app/`, `templates/`, güncelleyici, `build-apk.yml`); ortak
      çekirdek ve sesler `mobile/`'a taşınır (8. kural).

## Bilerek bırakılanlar (şimdilik)

- Güncelleme paketine ayrı imza (4b): anahtar GitHub'da duracağı için, GitHub hesabını ele
  geçiren onu da kullanırdı — ek koruma çok az. Asıl koruma GitHub hesabında iki adımlı
  doğrulama. (Kullanıcı kararı, Ekim 2026.)

- Yazılı cevapta tek harf hatası yine yanlış sayılıyor, "doğru saydır" düğmesi yok (13): hazırlanan
  değişiklik (kapatılan PR #9) kullanıcı tarafından istenmedi — mevcut katı kontrolden memnun (Ekim 2026).
- IPA gösterimi (15, kapatılan PR #11), ilk açılışta takma ad sorusunun ertelenmesi (17) ve kart
  ekranı düzeni (20) yapılmadı: kullanıcı istemedi (Ekim 2026).
- Kart çevirme three.js + WebGL ile kalıyor (23): CSS 3D sürümü (kapatılan PR #15) kartın kâğıt gibi
  bükülmesini yapamıyordu; kullanıcı birebir aynısı olmayacaksa istemedi (Ekim 2026). Bedeli: paket
  ~600 KB büyük.
- Arkadaş istatistikleri telefondan geldiği için sahtelenebilir — yalnız arkadaşlar arası
  görünüyor, ödül/sıralama yok.
- Kurtarma koduyla hesap taşınınca eski anonim giriş kaydı sunucuda kalıyor — zararsız,
  ileride temizlik işiyle silinebilir.
