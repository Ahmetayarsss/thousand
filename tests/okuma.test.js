// "Listeyi oku"nun okuma listesi (mobile/src/okuma/liste.js): servise giden diziler ve Türkçe okuma metni (beklenenler
// eski sayfanın trSay'inden alındı; o kaldırılmadan önce 3000 kelimede birebir karşılaştırılıyordu).
// Çalıştır: node tests/okuma.test.js
const assert = require("assert");
const fs = require("fs"), path = require("path");
const L = require(path.join(__dirname, "..", "mobile", "src", "okuma", "liste.js"));
const gruplar = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mobile", "src", "uretilen", "kelimeler.json"), "utf8"));

let n = 0;
const t = (ad, f) => { f(); n++; console.log("ok -", ad); };

t("Türkçe okuma metni: parantez atılır, ';' virgül olur, ek tiresi okunmaz", () => {
  const ornek = [["saat (tam)", "saat"], ["tür; yazmak (klavye)", "tür, yazmak"], ["kurs; rota; yemek servisi", "kurs, rota, yemek servisi"],
    ["boya; boyamak, resim yapmak", "boya, boyamak, resim yapmak"], ["ne zaman; -dığında", "ne zaman, dığında"], ["-de, -da", "de, da"],
    ["irade; -ecek", "irade, ecek"], ["olmak, -leşmek", "olmak, leşmek"], ["(bir şeyden) -den; -e doğru", "den, e doğru"]];
  for (const [g, b] of ornek) assert.strictEqual(L.trSay(g), b, g);
  let k = 0;
  gruplar.forEach((g) => g.items.forEach((d) => {
    const s = L.trSay(d.tr); k++;
    assert.ok(!/[();]|(^|[\s,])-|^[\s,]|[\s,]$|\s{2}/.test(s), d.w + ": " + s);
  }));
  assert.strictEqual(k, 3000);
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
