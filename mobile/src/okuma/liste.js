/*
 * "Listeyi oku"nun okuma listesi, ekrandan bağımsız: eski sayfadaki readGroup'un servise verdiği diziler
 * (kelime, ses kaynağı, Türkçe anlam, okunacak Türkçe metin, seviye). tests/okuma.test.js denetler.
 */
// Türkçe okuma metni: parantez içi atılır, ";" virgül olur, ek tiresi okunmaz ("-den" → "den").
function trSay(t) {
  return String(t || "").replace(/\([^)]*\)/g, " ").replace(/;/g, ",").replace(/(^|[\s,])-+/g, "$1")
    .replace(/\s+,/g, ",").replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
}

// anahtarlar: listedeki sırayla; bul(k) → { d, g }; kaynak(w) → sesin kaynağı ("" = kayıt yok, TTS okur).
function okumaListesi(anahtarlar, bul, kaynak) {
  const es = anahtarlar.map(bul).filter(Boolean);
  return {
    words: es.map((e) => e.d.w),
    slugs: es.map((e) => kaynak(e.d.w) || ""),
    trs: es.map((e) => e.d.tr || ""),
    says: es.map((e) => trSay(e.d.tr)),
    levels: es.map((e) => e.g.level || ""),
  };
}

module.exports = { trSay, okumaListesi };
