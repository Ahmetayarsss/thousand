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

- [ ] 7. Sessiz hata yutma: ilerleme/yedek yazmaları başarısız olursa kullanıcı uyarılır
      ve kayda düşer (`srs.js` `save()`, `hesap.js` `restore()`).
- [ ] 8. Kurtarma kodu ile geri yüklemede yerel ilerleme körlemesine ezilmez (hangisi
      yeni / daha dolu ise o; ya da kullanıcıya sorulur).

## Aşama 4 — Gizlilik ve hukuk

- [ ] 9. 🔸 Kullanım kayıtları: sunucuya gönderim için görünür açıklama + açma/kapama;
      varsayılan açık mı kapalı mı? Kısa gizlilik metni.
- [ ] 10. 🔸 Sözlük ses dosyaları (telif): uygulama dağıtılacak mı? Dağıtılacaksa
      lisanslı ses ya da cihaz sesi.
- [ ] 11. 🔸 "Oxford" adı ve `com.oxford3000` paket adı (marka): yalnız Play Store'a
      çıkılacaksa gerekli; paket adı değişirse uygulama yeni uygulama sayılır.

## Aşama 5 — Öğrenme (pedagoji)

- [ ] 12. Varsayılan yeni kelime sayısı 100 → 20 (ayarı elle değiştirmiş kullanıcıya dokunulmaz).
- [ ] 13. Yazılı cevap: tek harf hatası "neredeyse doğru" (doğru sayılır, doğrusu gösterilir)
      + yanlış sayılan cevapta "doğru saydır" düğmesi.
- [ ] 14. Okunuş tutarlılığı: uygulama US sesi çalıyor, bazı okunuşlar UK (`proper → PRO-pır`).
      Şüpheli kayıtlar scriptle bulunur, düzeltilir; validate.py'ye kural.
- [ ] 15. İsteğe bağlı IPA gösterimi (`data/sources/ipa_ref.json` hazır).
- [ ] 16. Hile tespiti: eşik ve mesaj tonu gözden geçirilir (bilen kullanıcı yanlışlıkla yakalanmasın).

## Aşama 6 — Arayüz

- [ ] 17. İlk açılış: takma ad hemen sorulmaz; ilk çalışmadan sonra önerilir.
- [ ] 18. Ana ekran: "0 · A1" başlığı anlamlı hale gelir, kaydırıcıya etiket, görünür
      gezinme (alt çubuk ya da sayfa noktaları).
- [ ] 19. Terminoloji tek: Grup / Bölüm / Kısım / Tur / Liste karmaşası giderilir.
- [ ] 20. Kart ekranı: boş alan, Test ile Sınav farkı ekranda anlatılır.
- [ ] 21. Erişilebilirlik (etiketler, yalnız renge dayanmayan durumlar) ve karanlık mod.

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
- [ ] 29. 🔸 `targetSdk` 35+ (Capacitor 7'ye geçiş) — yalnız Play Store için şart.

## Bilerek bırakılanlar (şimdilik)

- Güncelleme paketine ayrı imza (4b): anahtar GitHub'da duracağı için, GitHub hesabını ele
  geçiren onu da kullanırdı — ek koruma çok az. Asıl koruma GitHub hesabında iki adımlı
  doğrulama. (Kullanıcı kararı, Ekim 2026.)

- Arkadaş istatistikleri telefondan geldiği için sahtelenebilir — yalnız arkadaşlar arası
  görünüyor, ödül/sıralama yok.
- Kurtarma koduyla hesap taşınınca eski anonim giriş kaydı sunucuda kalıyor — zararsız,
  ileride temizlik işiyle silinebilir.
