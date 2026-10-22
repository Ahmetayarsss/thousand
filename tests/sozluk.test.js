// Sözlük araması (mobile/src/sozluk/arama.js): eski sözlük sayfasıyla aynı sıra ve sınır.
// Çalıştır: node tests/sozluk.test.js
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const A = require(path.join(__dirname, "..", "mobile", "src", "sozluk", "arama.js"));
const gruplar = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mobile", "src", "uretilen", "kelimeler.json"), "utf8"));
const L = A.kelimeListesi(gruplar);

let n = 0;
const t = (ad, f) => { f(); n++; console.log("ok -", ad); };

t("3000 kelimenin hepsi listede, seviyesiyle", () => {
  assert.strictEqual(L.length, 3000);
  assert.ok(L.every((x) => ["A1", "A2", "B1", "B2"].includes(x.seviye)));
});

t("boş arama sonuç vermez", () => {
  assert.deepStrictEqual(A.ara(L, ""), []);
  assert.deepStrictEqual(A.ara(L, "   "), []);
});

t("tam eşleşme önce, sonra baştan eşleşen, sonra alfabetik", () => {
  const r = A.ara(L, "art").map((x) => x.d.w);
  assert.strictEqual(r[0], "art");
  const bas = r.findIndex((w) => !w.toLowerCase().startsWith("art"));
  assert.ok(bas > 1, r.join(","));
  assert.ok(r.slice(bas).every((w) => !w.toLowerCase().startsWith("art")));
  const ilk = r.slice(1, bas);
  assert.deepStrictEqual(ilk, ilk.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

// Büyük "İ" küçük "i" sayılır (toLowerCase noktalı iki karakter yapardı; eski sözlükte "DAİRE" bulunmazdı). Türkçe
// küçültme ("tr") ise İngilizce aramayı bozardı ("It" → "ıt"), o yüzden yalnız "İ" çevrilir.
t("Türkçe anlamda da arar, baştaki büyük harf fark etmez; İ de i", () => {
  const r = A.ara(L, "Daire").map((x) => x.d.w);
  assert.ok(r.includes("apartment"), r.join(","));
  assert.ok(A.ara(L, "DAİRE").map((x) => x.d.w).includes("apartment"));
  assert.ok(A.ara(L, "İyi").map((x) => x.d.w).includes("good"));
  assert.ok(A.ara(L, "It").length > 0);
});

t("en çok 60 sonuç", () => {
  assert.strictEqual(A.ara(L, "e").length, 60);
});

console.log("\n" + n + " test geçti");
