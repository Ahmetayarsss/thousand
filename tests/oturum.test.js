// Kartlar ekranının mantığı (mobile/src/kartlar/oturum.js): Test ve Sınav kuralları, Capacitor'daki
// kartlar sayfasıyla aynı mı. Çalıştır: TZ=Europe/Istanbul node tests/oturum.test.js
const assert = require("assert");
const path = require("path");
const fs = require("fs");

const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};
require(path.join(__dirname, "..", "mobile", "src", "cekirdek", "srs.js"));
const S = globalThis.SRS;
const O = require(path.join(__dirname, "..", "mobile", "src", "kartlar", "oturum.js"));
// Yeni uygulamanın kullandığı veri (build_all.py üretir; eski uygulamadaki kelimeler.js ile aynı sıra).
const groups = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mobile", "src", "uretilen", "kelimeler.json"), "utf8"));
S.setCatalog(S.catalogFromGroups(groups));

const GUN = 86400000;
// Anlam sayısı: TEK = her kelime tek anlamlı (anlamlardan bağımsız kurallar), ANLAM = gerçek veri.
const TEK = () => 1, BUL = {};
groups.forEach((g) => g.items.forEach((d) => { BUL[d._k] = d; }));
const ANLAM = (k) => S.meanings(BUL[k]).length;
let n = 0;
const t = (ad, f) => { S.reset(); for (const k in mem) delete mem[k]; f(); n++; console.log("ok -", ad); };

t("test: listedeki kelimeler (20), karışık; ilerleme değişmez", () => {
  const o = O.testKur(S, TEK);
  assert.strictEqual(O.kalan(o), 20);
  assert.deepStrictEqual([o.cur, ...o.kuyruk].sort(), S.newList(20).slice().sort());
  assert.strictEqual(O.sayac(o), "20 kaldı");
  O.testCevap(o, true);
  assert.strictEqual(O.kalan(o), 19);
  assert.strictEqual(S.inCycle(), 0);
});

t("test: bilemediğin sona döner, yönü aynı kalır; hepsi bilinince biter", () => {
  const o = O.testKur(S, TEK), ilk = o.cur, y = O.yon(S, o, ilk);
  O.testCevap(o, false);
  assert.strictEqual(o.kuyruk[o.kuyruk.length - 1], ilk);
  assert.strictEqual(O.yon(S, o, ilk), y);
  let adim = 0;
  while (o.cur && adim++ < 100) O.testCevap(o, true);
  assert.strictEqual(o.cur, null);
  assert.strictEqual(O.oran(o), 1);
  assert.strictEqual(O.testSonu(o).buyuk, "20");
});

t("test: yeni kelime kalmadıysa 🎉", () => {
  const o = { mod: "test", cur: null, kuyruk: [], toplam: 0, yon: {} };
  assert.strictEqual(O.testSonu(o).kucuk, "yeni kelime kalmadı");
});

t("sınav: önce tekrarlar, sonra turun yenileri; %10 yazılı (yukarı yuvarlanır)", () => {
  const eski = Date.now() - 3 * GUN;
  const k = S.newList(3);
  k.forEach((x) => S.answer(x, false, "tr2en", eski));   // vadesi geldi
  const o = O.sinavKur(S, TEK);
  assert.strictEqual(o.tekrar, 3);
  assert.deepStrictEqual(o.liste.slice(0, 3).sort(), k.slice().sort());
  assert.strictEqual(o.liste.length, 23);
  assert.strictEqual(o.yazili.size, 3);
  assert.strictEqual(O.sayac(o), "Tekrar 1/3");
  assert.strictEqual(O.yon(S, o, o.cur), "tr2en");   // yanlışın yönü kilitli
});

t("sınav: cevap kaydedilir, sayaçlar ve yanlışlar tutulur, yanlış aynı sınavda gelmez", () => {
  const o = O.sinavKur(S, TEK), ilk = o.cur, ikinci = o.liste[1];
  O.yon(S, o, ilk);
  const r = O.sinavCevap(S, o, false);
  assert.strictEqual(r.yeniydi, true);
  assert.strictEqual(S.level(ilk), 1);
  assert.strictEqual(o.cur, ikinci);
  assert.deepStrictEqual(o.ot.yanlis, [ilk]);
  assert.ok(!o.liste.slice(o.i).includes(ilk));
  O.yon(S, o, o.cur);
  O.sinavCevap(S, o, true);
  assert.deepStrictEqual([o.ot.nw, o.ot.nwOk], [2, 1]);
  assert.strictEqual(O.sayac(o), "Yeni 3/20");
});

t("sınav sonu: oturum kaydı ve özet metni", () => {
  const o = O.sinavKur(S, TEK);
  for (let i = 0; i < 4; i++) { O.yon(S, o, o.cur); O.sinavCevap(S, o, i % 2 === 0); }
  const s = O.sinavSonu(S, o);
  assert.strictEqual(s.buyuk, "2/4");
  assert.strictEqual(s.dugme, "Sınava devam");
  assert.ok(s.mesaj.startsWith("Yeni: 2/4"), s.mesaj);
  assert.ok(s.mesaj.includes("4 kelime çalışılanlara eklendi."), s.mesaj);
  const kayit = JSON.parse(mem[O.OTURUM_ANAHTARI]);
  assert.strictEqual(kayit.length, 1);
  assert.deepStrictEqual([kayit[0].n, kayit[0].ok, kayit[0].nw], [4, 2, 4]);
});

t("sınav sonu: tur bitince 'Yeni liste'; cevapsız bırakılınca kayıt yok", () => {
  const o = O.sinavKur(S, TEK);
  while (o.cur) { O.yon(S, o, o.cur); O.sinavCevap(S, o, true); }
  const s = O.sinavSonu(S, o);
  assert.strictEqual(s.tumu, true);
  assert.strictEqual(s.dugme, "Yeni liste");
  assert.ok(s.mesaj.includes("Bu listenin bütün kelimeleri bitti."), s.mesaj);
  for (const k in mem) delete mem[k];
  S._reload();
  const bos = O.sinavKur(S, TEK), s2 = O.sinavSonu(S, bos);
  assert.strictEqual(s2.buyuk, "0");
  assert.strictEqual(mem[O.OTURUM_ANAHTARI], undefined);
});

t("deste: arkadaki kartlar sıradakiler", () => {
  const o = O.sinavKur(S, TEK);
  assert.strictEqual(O.bak(o, 0), o.liste[0]);
  assert.strictEqual(O.bak(o, 3), o.liste[3]);
  const tt = O.testKur(S, TEK);
  assert.strictEqual(O.bak(tt, 2), tt.kuyruk[1]);
});

// ---- çok anlamlı kelimeler (PLAN.md adım 41) ----
const COK = Object.keys(BUL).find((k) => ANLAM(k) === 3), IKI = Object.keys(BUL).find((k) => ANLAM(k) === 2);

t("anlam kartları: her anlam ayrı kart, hep Türkçeden İngilizceye; test hepsini sorar", () => {
  const o = { mod: "sinav", yon: {} };
  assert.deepStrictEqual(O.kartCoz(COK + "#2"), { k: COK, i: 2 });
  assert.deepStrictEqual(O.kartCoz(COK), { k: COK, i: null });
  for (let i = 0; i < 50; i++) { o.yon = {}; assert.strictEqual(O.yon(S, o, COK + "#1"), "tr2en"); }
  S.setListSize(5);
  const tt = O.testKur(S, ANLAM), beklenen = [].concat(...S.newList(5).map((k) => (ANLAM(k) > 1 ? Array.from({ length: ANLAM(k) }, (_, i) => k + "#" + i) : [k])));
  assert.deepStrictEqual([tt.cur, ...tt.kuyruk].sort(), beklenen.sort());
});

t("sınav: çok anlamlı kelime turu — sayılar kelime başına, karar hepsi cevaplanınca", () => {
  mem.ox3000_exam_batch_v1 = JSON.stringify([COK, IKI]); S._reload();
  const o = O.sinavKur(S, ANLAM);
  assert.strictEqual(o.liste.length, 5);
  assert.deepStrictEqual(o.liste.slice().sort(), [COK + "#0", COK + "#1", COK + "#2", IKI + "#0", IKI + "#1"].sort());
  const sira = o.liste.slice(), yanlisAnlam = COK + "#1";
  for (const id of sira) { O.yon(S, o, id); O.sinavCevap(S, o, id !== yanlisAnlam); }
  assert.deepStrictEqual([o.ot.nw, o.ot.nwOk], [2, 1], "iki kelime, biri doğru");
  assert.deepStrictEqual(o.ot.yanlis, [COK]);
  assert.strictEqual(S.level(COK), 1);
  assert.strictEqual(S.level(IKI), 2);
  assert.deepStrictEqual(S.daily()[S.today()], { n: 2, ok: 1, nw: 2 });
});

t("sınav yarıda bırakıldı: cevaplanan anlamlar bir daha gelmez, kelime yeni kalır", () => {
  mem.ox3000_exam_batch_v1 = JSON.stringify([COK]); S._reload();
  const o = O.sinavKur(S, ANLAM), ilk = o.cur;
  O.yon(S, o, ilk); const r = O.sinavCevap(S, o, true);
  assert.strictEqual(r.sonuc, null);
  assert.deepStrictEqual([o.ot.nw, o.ot.rev], [0, 0]);
  assert.strictEqual(S.isNew(COK), true);
  const o2 = O.sinavKur(S, ANLAM);
  assert.strictEqual(o2.liste.length, 2);
  assert.ok(!o2.liste.includes(ilk));
});

t("başka karşılık: aynı Türkçe anlamın başka kelimesi yazıldı mı", () => {
  const dz = O.esAnlamDizini(S, groups);
  assert.strictEqual(O.baskaKarsilik(S, dz, "rota", "course", "Route"), "route");
  assert.strictEqual(O.baskaKarsilik(S, dz, "rota", "course", "course"), null, "doğru cevap başka değil");
  assert.strictEqual(O.baskaKarsilik(S, dz, "rota", "course", "apple"), null);
  assert.strictEqual(O.baskaKarsilik(S, dz, "futbol", "football", "soccer"), "soccer");
  assert.strictEqual(O.baskaKarsilik(S, dz, "rota", "course", ""), null);
});

console.log("\n" + n + " test geçti");
