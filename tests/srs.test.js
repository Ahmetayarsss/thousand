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

t("sınav kuyruğu: tekrarlar kutu yüksekten düşüğe, sonra turun yenileri", () => {
  const ks = S.newList(6);
  S.answer(ks[0], false, null, at(0));                                        // kutu 1
  S.answer(ks[1], false, null, at(0));                                        // kutu 1
  S.answer(ks[2], true, null, at(0));                                         // kutu 2
  S.answer(ks[3], true, null, at(0)); S.answer(ks[3], true, null, at(3));     // kutu 3
  const q = S.examQueue(at(30));
  assert.strictEqual(q.reviews.length, 4);
  assert.deepStrictEqual(q.reviews.map(S.level), [3, 2, 1, 1]);
  assert.deepStrictEqual(new Set(q.reviews.slice(2)), new Set([ks[0], ks[1]]));
  assert.strictEqual(q.news.length, 100);
  assert.deepStrictEqual(new Set(q.news), new Set(S.newList(100)));
});

t("aynı kutudaki tekrarlar karışık gelir", () => {
  const ks = S.newList(8);
  ks.forEach(k => S.answer(k, false, null, at(0)));
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(S.examQueue(at(5)).reviews.join());
  assert.ok(seen.size > 1);
});

t("tur: yarıda bırakılınca kalanlarla sürer, bitince yeni tur kurulur", () => {
  S.setListSize(10);
  const first = S.examQueue(at(0)).news;
  assert.strictEqual(first.length, 10);
  first.slice(0, 4).forEach(k => S.answer(k, true, null, at(0)));
  const again = S.examQueue(at(0)).news;                                      // liste yenilendi ama tur aynı
  assert.deepStrictEqual(new Set(again), new Set(first.slice(4)));
  again.forEach(k => S.answer(k, true, null, at(0)));
  const next = S.examQueue(at(0)).news;                                       // tur bitti → yeni tur = güncel liste
  assert.deepStrictEqual(new Set(next), new Set(S.newList(10)));
  assert.ok(next.every(k => !first.includes(k)));
  S.setListSize(100);
});

t("liste sayısı ayarı: sınırlar, varsayılan 100, değişince tur sıfırlanır", () => {
  assert.strictEqual(S.listSize(), 100);
  assert.strictEqual(S.setListSize(30), 30);
  assert.strictEqual(S.topLevel(), "A1");
  assert.strictEqual(S.examQueue(at(0)).news.length, 30);
  S.setListSize(12);
  assert.strictEqual(S.examQueue(at(0)).news.length, 12);
  assert.strictEqual(S.setListSize(1), S.LMIN);
  assert.strictEqual(S.setListSize(9999), S.LMAX);
  S.setListSize(100);
});

t("geliştirici: gün kaydırma vadeyi öne çeker", () => {
  S.answer(k1, false, null);                                                  // bugün, kutu 1
  assert.strictEqual(S.isDue(k1), false);
  S.setDev({ off: 1 });
  assert.strictEqual(S.isDue(k1), true);
  assert.strictEqual(S.today(), S.today(Date.now()) + 1);
  S.setDev({ off: 0 });
});

t("günlük özet: cevap, doğru ve yeni sayıları", () => {
  S.answer(k1, true, null, at(0));
  S.answer(k2, false, null, at(0));
  S.answer(k1, true, null, at(3));
  const d = S.daily();
  assert.deepStrictEqual(d[S.today(at(0))], { n: 2, ok: 1, nw: 2 });
  assert.deepStrictEqual(d[S.today(at(3))], { n: 1, ok: 1, nw: 0 });
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

const W = w => { for (const g of groups) for (const it of g.items) if (it.w === w) return it; throw new Error(w); };
const C = (w, dir, ins) => S.checkTyped(W(w), dir, ins);

t("yazılı: kutu sayısı = anlam sayısı, parantezli not kutu açmaz", () => {
  assert.strictEqual(S.answerSlots(W("live"), "en2tr").length, 2);       // yaşamak; canlı
  assert.strictEqual(S.answerSlots(W("course"), "en2tr").length, 3);     // kurs; rota; yemek servisi
  assert.strictEqual(S.answerSlots(W("reason"), "en2tr").length, 1);     // neden, sebep
  assert.strictEqual(S.answerSlots(W("to"), "en2tr").length, 1);         // -e, -a; (mastar eki)
  assert.strictEqual(S.answerSlots(W("live"), "tr2en").length, 1);
});

t("yazılı: harf büyüklüğü, noktalama, Türkçe harf farkı önemsiz", () => {
  assert.ok(C("winter", "en2tr", ["KIŞ"]).ok);
  assert.ok(C("winter", "en2tr", ["kis"]).ok);
  assert.ok(C("winter", "en2tr", ["  Kış. "]).ok);
  assert.ok(C("boring", "tr2en", ["Boring!"]).ok);
  assert.ok(!C("winter", "en2tr", ["kiş yaz"]).ok);
});

t("yazılı: çok anlamlıda her anlam ayrı kutu, sıra serbest", () => {
  assert.ok(C("live", "en2tr", ["yaşamak", "canlı"]).ok);
  assert.ok(C("live", "en2tr", ["canli", "yasamak"]).ok);
  const r = C("live", "en2tr", ["yaşamak", ""]);
  assert.ok(!r.ok); assert.deepStrictEqual(r.marks, [true, false]);
  assert.ok(!C("live", "en2tr", ["yaşamak", "yaşamak"]).ok);
});

t("yazılı: eş anlamlılardan biri yeterli, ikisi birlikte de olur", () => {
  assert.ok(C("reason", "en2tr", ["sebep"]).ok);
  assert.ok(C("reason", "en2tr", ["neden"]).ok);
  assert.ok(C("reason", "en2tr", ["neden, sebep"]).ok);
  assert.ok(!C("reason", "en2tr", ["neden, araba"]).ok);
  assert.ok(C("paint", "en2tr", ["resim yapmak", "boya"]).ok);           // boya; boyamak, resim yapmak
  assert.ok(C("grandparent", "en2tr", ["büyükbaba"]).ok);                // büyükanne/büyükbaba
});

t("yazılı: parantez ve tire yazılmasa da olur", () => {
  assert.ok(C("he", "en2tr", ["o"]).ok);                                 // o (erkek)
  assert.ok(C("he", "en2tr", ["o (erkek)"]).ok);
  assert.ok(C("from", "en2tr", ["dan"]).ok);                             // -den, -dan
  assert.ok(C("o'clock", "tr2en", ["oclock"]).ok);
  assert.ok(C("a, an", "tr2en", ["an"]).ok);
  assert.ok(C("ice cream", "tr2en", ["Ice-cream"]).ok);
  assert.ok(C("last (final)", "tr2en", ["last"]).ok);
});

t("yazılı: başka kelimenin karşılığı ve yazım hatası kabul edilmez", () => {
  assert.ok(!C("sick", "tr2en", ["ill"]).ok);
  assert.ok(!C("receive", "tr2en", ["recieve"]).ok);
  assert.ok(!C("winter", "en2tr", ["kışş"]).ok);
});

console.log(`\n${n} test geçti`);
