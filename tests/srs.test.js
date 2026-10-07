// srs.js kurallarının testi. Çalıştır: TZ=UTC node tests/srs.test.js
const assert = require("assert");
const path = require("path");
const fs = require("fs");

const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
};
require(path.join(__dirname, "..", "app", "www", "srs.js"));
const S = globalThis.SRS;

const groups = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "all_groups.json"), "utf8"));
S.setCatalog(S.catalogFromGroups(groups));

const D = 86400000, T0 = Date.UTC(2026, 0, 10, 12);   // gün ortası
const at = d => T0 + d * D;
const k1 = S.key(1, groups[0].items[0].w), k2 = S.key(1, groups[0].items[1].w);
let n = 0; const t = (name, fn) => { S.reset(); fn(); n++; console.log("ok -", name); };

t("katalog: 3000 benzersiz anahtar", () => {
  const ks = S.catalogFromGroups(groups).map(x => x.k);
  assert.strictEqual(ks.length, 3000);
  assert.strictEqual(new Set(ks).size, 3000);
});

t("başta her şey yeni, döngü 0, liste 100", () => {
  assert.strictEqual(S.inCycle(), 0);
  assert.strictEqual(S.newList(100).length, 100);
  assert.strictEqual(S.newList(100)[0], k1);
  assert.deepStrictEqual(S.dueList(at(0)), []);
});

t("yeni doğru → kutu 2, 3 gün sonra vade", () => {
  const r = S.answer(k1, true, "en2tr", at(0));
  assert.deepStrictEqual([r.from, r.to], [0, 2]);
  assert.strictEqual(S.isNew(k1), false);
  assert.strictEqual(S.isDue(k1, at(2)), false);
  assert.strictEqual(S.isDue(k1, at(3)), true);
});

t("yeni yanlış → kutu 1, ertesi gün vade, yön kilitli", () => {
  S.answer(k1, false, "tr2en", at(0));
  assert.strictEqual(S.level(k1), 1);
  assert.strictEqual(S.dirOf(k1), "tr2en");
  assert.strictEqual(S.isDue(k1, at(1)), true);
});

t("cevaplanan listeden düşer, alttan sıradaki gelir", () => {
  const before = S.newList(100);
  S.answer(k1, true, null, at(0));
  const after = S.newList(100);
  assert.strictEqual(after.length, 100);
  assert.strictEqual(after[0], k2);
  assert.strictEqual(after[99], S.newList(101)[99]);
  assert.ok(!after.includes(k1) && before.includes(k1));
  assert.strictEqual(S.inCycle(), 1);
});

t("kutu yolculuğu 1→2→3→olgun, aralıklar 1/3/7/7", () => {
  S.answer(k1, false, null, at(0));          // 1  vade +1
  let r = S.answer(k1, true, null, at(1));   // 2  vade +3
  assert.deepStrictEqual([r.to, r.due - S.today(at(1))], [2, 3]);
  r = S.answer(k1, true, null, at(4));       // 3  vade +7
  assert.deepStrictEqual([r.to, r.due - S.today(at(4))], [3, 7]);
  r = S.answer(k1, true, null, at(11));      // olgun vade +7
  assert.deepStrictEqual([r.to, r.due - S.today(at(11))], [4, 7]);
  r = S.answer(k1, true, null, at(18));      // olgun kalır
  assert.strictEqual(r.to, 4);
});

t("yanlış → bir kutu aşağı (olgun → 2, 1'de 1 kalır)", () => {
  S.answer(k1, true, null, at(0));           // 2
  S.answer(k1, true, null, at(3));           // 3
  S.answer(k1, true, null, at(10));          // 4 olgun
  let r = S.answer(k1, false, null, at(17));
  assert.deepStrictEqual([r.to, r.due - S.today(at(17))], [2, 3]);
  assert.strictEqual(S.answer(k1, false, null, at(20)).to, 1);
  assert.strictEqual(S.answer(k1, false, null, at(21)).to, 1);
  S.answer(k2, true, null, at(0));           // 2
  S.answer(k2, true, null, at(3));           // 3
  assert.strictEqual(S.answer(k2, false, null, at(10)).to, 2);
});

t("doğru cevap yön kilidini kaldırır", () => {
  S.answer(k1, false, "tr2en", at(0));
  S.answer(k1, true, "tr2en", at(1));
  assert.strictEqual(S.dirOf(k1), null);
});

t("sınav sırası: yüksek kutu önce, eşitse en çok geciken", () => {
  const [a, b, c] = S.newList(3);
  S.answer(a, false, null, at(0));           // a: kutu 1, vade gün 1
  S.answer(b, true, null, at(0));            // b: kutu 2, vade gün 3
  S.answer(c, false, null, at(2));           // c: kutu 1, vade gün 3
  assert.deepStrictEqual(S.dueList(at(5)), [b, a, c]);
  assert.deepStrictEqual(S.dueList(at(1)), [a]);   // vadesi gelmeyen girmez
});

t("sınav kuyruğu: önce tekrarlar sonra yeniler", () => {
  S.answer(k1, false, null, at(0));
  const q = S.examQueue(at(1));
  assert.deepStrictEqual(q.reviews, [k1]);
  assert.strictEqual(q.news[0], k2);
  assert.strictEqual(q.news.length, 2999);
});

t("gün değişimi yerel gece 00:00", () => {
  const L = (...a) => new Date(...a).getTime();   // yerel saat
  S.answer(k1, false, null, L(2026, 0, 10, 23, 59));
  assert.strictEqual(S.isDue(k1, L(2026, 0, 10, 23, 59, 59)), false);
  assert.strictEqual(S.isDue(k1, L(2026, 0, 11, 0, 0, 1)), true);
});

t("seviye etiketi: listede bir üst seviyeden tek kelime girince değişir", () => {
  assert.strictEqual(S.topLevel(), "A1");
  const a1 = S.catalogFromGroups(groups).filter(x => x.lv === "A1").map(x => x.k);
  a1.slice(0, a1.length - 100).forEach(k => S.answer(k, true, null, at(0)));
  assert.strictEqual(S.topLevel(), "A1");     // liste tam son 100 A1
  S.answer(a1[a1.length - 100], true, null, at(0));
  assert.strictEqual(S.topLevel(), "A2");     // listeye 1 A2 girdi
});

t("kısım sayaçları: olgun · öğreniliyor · yeni", () => {
  const ks = S.newList(3);
  S.answer(ks[0], false, null, at(0));
  S.answer(ks[1], true, null, at(0)); S.answer(ks[1], true, null, at(3)); S.answer(ks[1], true, null, at(10));
  assert.deepStrictEqual(S.groupCounts(0), { mature: 1, learning: 1, fresh: 98, total: 100 });
  assert.deepStrictEqual(S.groupCounts(1), { mature: 0, learning: 0, fresh: 100, total: 100 });
  assert.strictEqual(S.totals().fresh, 2998);
});

t("veri kalıcı (yeniden yükleme sonrası aynı)", () => {
  S.answer(k1, true, null, at(0));
  S._reload();
  assert.strictEqual(S.level(k1), 2);
});

t("sonraki vade günü", () => {
  assert.strictEqual(S.nextDue(at(0)), null);
  S.answer(k1, true, null, at(0));
  assert.strictEqual(S.nextDue(at(0)), 3);
});

console.log(`\n${n} test geçti`);
