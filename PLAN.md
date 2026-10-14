# Düzeltme planı

Eleştiride bulunan sorunlar, sırayla. Her adım ayrı commit; bitince aynı commit'te `[x]` olur
(hangi commit: `git log -- PLAN.md`). 🔸 = başlamadan kullanıcının kararı gerekiyor (önce sorulur).
Yeni oturum: ilk işaretlenmemiş adımdan devam et.

## Aşama 1 — Temizlik (risksiz)

- [x] 1. Ölü kod: `progress.js` (eski kilitli bölüm sistemi) silinir; paket listesi, CI ve
      belgeler temizlenir. README'ler gerçek yapıya göre yeniden yazılır.
- [ ] 2. Artık dosyalar: `proto_*.html` silinir. 🔸 Kökteki tarayıcı sürümleri
      (`Oxford3000_*.html` + kopya JS'ler) hâlâ kullanılıyor mu? Kullanılmıyorsa kalkar.

## Aşama 2 — Güvenlik ve yayın

- [ ] 3. 🔸 Yayın kanalı: eski `claude/...` dalı yerine `main` + sürüm etiketi. APK ve
      güncelleme paketi yalnız CI'dan geçmiş commit'ten çıkar.
- [ ] 4. Güncelleyici: paket yalnız release'ten iner, imzası doğrulanır (imzasızsa
      uygulanmaz); bozuk paket açılmazsa gömülü sürüme kendiliğinden döner. `web.json`
      repodan çıkar.
- [ ] 5. 🔸 İmza anahtarı: parola ve keystore CI secret'ına taşınır. Anahtar yenilensin mi
      (herkes bir kez kaldır-kur; ilerleme yalnız hesap yedeğiyle döner)?
- [ ] 6. Yedekleme: `allowBackup` gözden geçirilir (kurtarma kodu Google yedeğine düz metin
      gidiyor; öte yandan yerel ilerlemeyi de kurtarıyor).

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
- [ ] 26. Testler: `hesap.js`, güncelleyici, Supabase fonksiyonları için.
- [ ] 27. `versionCode` her derlemede artar.

## Aşama 8 — Android ve dağıtım

- [ ] 28. 🔸 Arka plan kontrolü: 15 dk'da bir sunucuya sorma + pil optimizasyonu muafiyeti
      yerine ne? (Firebase bildirimleri ya da daha seyrek kontrol.)
- [ ] 29. 🔸 `targetSdk` 35+ (Capacitor 7'ye geçiş) — yalnız Play Store için şart.

## Bilerek bırakılanlar (şimdilik)

- Arkadaş istatistikleri telefondan geldiği için sahtelenebilir — yalnız arkadaşlar arası
  görünüyor, ödül/sıralama yok.
- Kurtarma koduyla hesap taşınınca eski anonim giriş kaydı sunucuda kalıyor — zararsız,
  ileride temizlik işiyle silinebilir.
