// "Listeyi oku"nun okuma listesi (mobile/src/okuma/liste.js): servise giden diziler ve Türkçe okuma metni
// eski sayfadakiyle (templates/sesli_template.html → trSay) aynı mı. Çalıştır: node tests/okuma.test.js
const assert = require("assert");
const fs = require("fs"), path = require("path");
const L = require(path.join(__dirname, "..", "mobile", "src", "okuma", "liste.js"));
const gruplar = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mobile", "src", "uretilen", "kelimeler.json"), "utf8"));
const sablon = fs.readFileSync(path.join(__dirname, "..", "templates", "sesli_template.html"), "utf8");
const eskiTrSay = new Function("return " + /function trSay\(t\)\{[^\n]*?\}(?=\n)/.exec(sablon)[0])();

let n = 0;
const t = (ad, f) => { f(); n++; console.log("ok -", ad); };

t("Türkçe okuma metni: 3000 kelimenin hepsinde eskisiyle aynı", () => {
  let k = 0;
  gruplar.forEach((g) => g.items.forEach((d) => { assert.strictEqual(L.trSay(d.tr), eskiTrSay(d.tr), d.w); k++; }));
  assert.strictEqual(k, 3000);
  assert.strictEqual(L.trSay("(bir şeyden) -den; -e doğru"), "den, e doğru");
});

t("okuma listesi: sırayla kelime, kaynak, anlam, okunacak metin, seviye; bilinmeyen anahtar atlanır", () => {
  const g = gruplar[0], a = g.items[0], b = g.items.find((d) => d.w !== a.w);   // eş yazılan kelimeler var
  const bul = { a: { d: a, g }, b: { d: b, g } }, ilk = ["a", "b"];
  const r = L.okumaListesi([ilk[0], "yok|yok", ilk[1]], (k) => bul[k], (w) => (w === bul[ilk[0]].d.w ? "ses_" + w : ""));
  assert.deepStrictEqual(r.words, [bul[ilk[0]].d.w, bul[ilk[1]].d.w]);
  assert.deepStrictEqual(r.slugs, ["ses_" + bul[ilk[0]].d.w, ""]);
  assert.deepStrictEqual(r.trs, [bul[ilk[0]].d.tr, bul[ilk[1]].d.tr]);
  assert.strictEqual(r.says[0], L.trSay(bul[ilk[0]].d.tr));
  assert.deepStrictEqual(r.levels, ["A1", "A1"]);
});

console.log(n + " test geçti");
