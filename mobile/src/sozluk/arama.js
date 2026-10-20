/*
 * Sözlük araması — Capacitor'daki sözlük sayfasıyla (templates/sozluk_template.html) aynı: 3000 kelimenin hepsinde,
 * İngilizce kelimede ya da Türkçe anlamda geçen; tam eşleşme önce, sonra baştan eşleşen, sonra alfabetik; en çok 60.
 * tests/sozluk.test.js denetler.
 */
function kelimeListesi(gruplar) {
  const out = [];
  gruplar.forEach((g) => g.items.forEach((d) => out.push({ d, seviye: g.level, s: (d.w + " " + (d.tr || "")).toLowerCase() })));
  return out;
}

function ara(liste, metin, enCok = 60) {
  const q = String(metin || "").trim().toLowerCase();
  if (!q) return [];
  const sira = (x) => { const w = x.d.w.toLowerCase(); return w === q ? 0 : w.startsWith(q) ? 1 : 2; };
  return liste.filter((x) => x.s.includes(q))
    .sort((a, b) => (sira(a) - sira(b)) || a.d.w.toLowerCase().localeCompare(b.d.w.toLowerCase()))
    .slice(0, enCok);
}

module.exports = { kelimeListesi, ara };
