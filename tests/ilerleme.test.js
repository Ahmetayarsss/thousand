// İlerleme ve İstatistikler hesapları (mobile/src/ilerleme/veri.js): eski stats/analiz sayfalarıyla aynı mı.
// Çalıştır: TZ=Europe/Istanbul node tests/ilerleme.test.js
const assert = require("assert");
const path = require("path");
const fs = require("fs");

const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
require(path.join(__dirname, "..", "app", "www", "srs.js"));
const S = globalThis.SRS;
const V = require(path.join(__dirname, "..", "mobile", "src", "ilerleme", "veri.js"));
const gruplar = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mobile", "src", "uretilen", "kelimeler.json"), "utf8"));
S.setCatalog(S.catalogFromGroups(gruplar));
const ANAHTARLA = {};
gruplar.forEach((g) => g.items.forEach((d) => { ANAHTARLA[d._k] = { d, g }; }));

const GUN = 86400000, simdi = Date.now(), once = (g) => simdi - g * GUN;
let n = 0;
const t = (ad, f) => { S.reset(); for (const k in mem) delete mem[k]; f(); n++; console.log("ok -", ad); };

t("seviyeler ve kısımlar: başta hepsi yeni", () => {
  assert.deepStrictEqual(V.seviyeler(S, gruplar).map((x) => [x.lv, x.total, x.mature]), [["A1", 900, 0], ["A2", 800, 0], ["B1", 700, 0], ["B2", 600, 0]]);
  const k = V.kisimlar(S, gruplar);
  assert.strictEqual(k.length, 30);
  assert.deepStrictEqual([k[0].no, k[0].fresh, k[0].durum], [1, 100, ""]);
});

t("kısım durumu: çalışılan var → açık", () => {
  S.answer(S.newList(1)[0], true, "en2tr", once(0));
  assert.strictEqual(V.kisimlar(S, gruplar)[0].durum, "acik");
});

t("son sınavlar: en yeni üstte, yüzde ve renk sınıfı", () => {
  const s = V.sonSinavlar([{ t: once(1), n: 10, ok: 9, rev: 4, revOk: 4, nw: 6, nwOk: 5 }, { t: once(0), n: 4, ok: 2, nw: 4, nwOk: 2 }]);
  assert.deepStrictEqual([s[0].yuzde, s[0].sinif, s[1].yuzde, s[1].sinif], [50, "dusuk", 90, "iyi"]);
  assert.ok(s[1].ayrinti.endsWith("Tekrar 4/4 · Yeni 5/6"), s[1].ayrinti);
  assert.deepStrictEqual(V.sonSinavlar(null), []);
});

t("seri: art arda günler; bugün çalışılmadıysa dünden sayılır", () => {
  [3, 2, 1].forEach((g) => S.answer(S.newList(1)[0], true, "en2tr", once(g)));
  S.answer(S.newList(1)[0], true, "en2tr", once(6));
  assert.deepStrictEqual(V.seriler(S), { simdi: 3, enUzun: 3, bugun: false });
  S.answer(S.newList(1)[0], true, "en2tr", once(0));
  assert.deepStrictEqual(V.seriler(S), { simdi: 4, enUzun: 4, bugun: true });
});

t("tahmini bitiş: son 14 günün yeni kelime ortalaması", () => {
  assert.ok(V.bitisTahmini(S).yok);
  for (let i = 0; i < 14; i++) S.answer(S.newList(1)[0], true, "en2tr", once(0));
  const b = V.bitisTahmini(S);
  assert.strictEqual(b.gunde, 1);
  assert.strictEqual(b.gun, 2986);
});

t("kutucuklar: toplam cevap ve doğruluk", () => {
  S.answer(S.newList(1)[0], true, "en2tr", once(0));
  S.answer(S.newList(1)[0], false, "en2tr", once(0));
  const k = V.kutucuklar(S);
  assert.deepStrictEqual(k[0].slice(0, 2), ["Toplam cevap", "2"]);
  assert.deepStrictEqual(k[1].slice(0, 2), ["Doğruluk", "%50"]);
  assert.strictEqual(V.son30(S).length, 30);
  assert.deepStrictEqual(V.son30(S)[29], { d: S.today(), n: 2, ok: 1, bad: 1, nw: 2 });
});

t("kutu dağılımı, 7 gün, en çok yanlış", () => {
  const [a, b, c] = S.newList(3);
  S.answer(a, false, "tr2en", once(3));   // kutu 1, vadesi geçmiş → bugün
  S.answer(b, true, "en2tr", once(0));    // kutu 2, 3 gün sonra
  S.answer(c, false, "en2tr", once(0)); S.answer(c, false, "en2tr", once(0));   // kutu 1, 2 yanlış, yarın
  const kay = V.kayitlar(S, ANAHTARLA);
  assert.deepStrictEqual(V.kutuDagilimi(kay), [2, 1, 0, 0]);
  assert.deepStrictEqual(V.yediGun(S, kay).map((x) => x.n), [1, 1, 0, 1, 0, 0, 0]);
  assert.deepStrictEqual(V.enCokYanlis(kay).map((r) => r.k), [c, a]);
});

t("eksen: 1/2/5 adımları", () => {
  assert.deepStrictEqual(V.eksen(0, 4), { step: 1, max: 1 });
  assert.deepStrictEqual(V.eksen(37, 4), { step: 10, max: 40 });
  assert.deepStrictEqual(V.eksen(130, 4), { step: 50, max: 150 });
});

t("gün adları", () => {
  assert.strictEqual(V.gunAdi(S, 0, S.today()), "Bugün");
  assert.strictEqual(V.gunAdi(S, 1, S.today() + 1), "Yarın");
  assert.ok(["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"].includes(V.gunAdi(S, 3, S.today() + 3)));
});

console.log("\n" + n + " test geçti");
