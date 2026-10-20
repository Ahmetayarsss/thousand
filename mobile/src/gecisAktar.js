/*
 * Eski (Capacitor) uygulamadan ilerleme aktarımının kuralları, ekrandan ve dosya sisteminden bağımsız.
 * Eski uygulama ox3000_* anahtarlarını iki dosyaya yazar (app/www/gecis.js); burada ikisinden geçerli
 * ve daha yeni olan seçilip depoya (localStorage) yazılır. tests/gecis.test.js denetler.
 *
 * Bir kez yapılır: başarılı aktarımdan sonra BAYRAK yazılır, bir daha dosyaya bakılmaz. Dosya yoksa ya da
 * okunamadıysa bayrak yazılmaz (sonraki açılışta yeniden denenir); okunamadıysa kullanıcıya söylenir.
 * Bu telefonda yeni uygulamada zaten ilerleme varsa üstüne yazılmaz.
 */
const BAYRAK = "ox3000_gecis_v1";

function coz(metin) {
  if (metin == null) return null;
  try {
    const j = JSON.parse(metin);
    if (!j || j.v !== 1 || !j.keys || typeof j.keys !== "object" || Array.isArray(j.keys)) return { bozuk: "biçim" };
    return j;
  } catch (e) {
    return { bozuk: String((e && e.message) || e).slice(0, 120) };
  }
}

// metinler: eski uygulamanın dosyalarının içeriği (yoksa null). Dönen: { durum, kelime?, hata? }
//   durum: "onceden" (zaten yapılmış) | "yok" (dosya yok) | "bozuk" | "atlandi" (zaten ilerleme var) | "aktarildi"
function aktar(depo, metinler, simdi) {
  if (depo.getItem(BAYRAK) != null) return { durum: "onceden" };
  const adaylar = metinler.map(coz).filter(Boolean);
  if (!adaylar.length) return { durum: "yok" };
  const gecerli = adaylar.filter((a) => !a.bozuk).sort((a, b) => (b.t || 0) - (a.t || 0));
  if (!gecerli.length) return { durum: "bozuk", hata: adaylar.map((a) => a.bozuk).join("; ") };
  const kaynak = gecerli[0];
  const anahtarlar = Object.keys(kaynak.keys).filter((k) => k.startsWith("ox3000_") && k !== BAYRAK && typeof kaynak.keys[k] === "string");
  let kelime = 0;
  try { kelime = Object.keys(JSON.parse(kaynak.keys.ox3000_srs_v1 || "{}") || {}).length; } catch (e) {}
  if (depo.getItem("ox3000_srs_v1") != null) {
    depo.setItem(BAYRAK, JSON.stringify({ t: simdi, kaynak: kaynak.t || 0, durum: "atlandi" }));
    return { durum: "atlandi", kelime };
  }
  // İlerleme (ox3000_srs_v1) en son: yarıda kalırsa sonraki açılış "zaten ilerleme var" sanmasın, baştan denesin.
  anahtarlar.sort((a, b) => (a === "ox3000_srs_v1") - (b === "ox3000_srs_v1")).forEach((k) => depo.setItem(k, kaynak.keys[k]));
  depo.setItem(BAYRAK, JSON.stringify({ t: simdi, kaynak: kaynak.t || 0, durum: "aktarildi", n: anahtarlar.length }));
  return { durum: "aktarildi", kelime };
}

module.exports = { aktar, BAYRAK };
