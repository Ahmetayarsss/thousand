// Eski uygulamadan yeni uygulamaya ilerleme aktarımı: eski taraf (app/www/gecis.js) dosyaları yazar,
// yeni taraf (mobile/src/gecisAktar.js) okur. Uçtan uca: eskide ne varsa yenide aynısı olmalı.
// Çalıştır: node tests/gecis.test.js
const assert = require("assert");
const fs = require("fs"), vm = require("vm"), path = require("path");
const G = require(path.join(__dirname, "..", "mobile", "src", "gecisAktar.js"));

function depo(ilk = {}) {
  const ls = { ...ilk }, sira = [];
  return {
    ls, sira,
    get length() { return Object.keys(ls).length; },
    key: (i) => Object.keys(ls)[i] ?? null,
    getItem: (k) => (k in ls ? ls[k] : null),
    setItem: (k, v) => { ls[k] = String(v); sira.push(k); },
    removeItem: (k) => delete ls[k],
  };
}

// Eski uygulama: Capacitor + Filesystem eklentisi taklidi; yazılan dosyalar `dosyalar`da.
function eskiUygulama(ls, { hata = false } = {}) {
  const dosyalar = {}, olaylar = [];
  const ctx = {
    localStorage: depo(ls),
    Capacitor: {
      isNativePlatform: () => true,
      Plugins: { Filesystem: { writeFile: async (o) => {
        if (hata) throw new Error("disk dolu");
        assert.strictEqual(o.directory, "DATA"); assert.strictEqual(o.encoding, "utf8");
        dosyalar[o.path] = o.data;
      } } },
    },
    OXLOG: { add: (t, d) => olaylar.push([t, d]) },
    document: { readyState: "loading", hidden: false, addEventListener() {} },
    addEventListener() {}, setTimeout: () => 0, JSON, Date, Promise, Object, String,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "app", "www", "gecis.js"), "utf8"), ctx);
  return { ctx, dosyalar, olaylar };
}
const oku = (d) => [d["gecis/ox3000.json"] ?? null, d["gecis/ox3000.yedek.json"] ?? null];

const ESKI = {
  ox3000_srs_v1: JSON.stringify({ "1|apple": { b: 3 }, "1|zebra|2": { b: 1 } }),
  ox3000_daily_v1: JSON.stringify({ 20003: { n: 4, ok: 3, nw: 1 } }),
  ox3000_settings_v1: JSON.stringify({ listN: 20 }),
  ox3000_hesap_v1: JSON.stringify({ nick: "Test", code: "AB12CD" }),
  ox_webupd: JSON.stringify({ ver: 5, base: "x" }),   // eski uygulamanın kendi işi: taşınmaz
};

let n = 0;
const t = async (ad, f) => { await f(); n++; console.log("ok -", ad); };

(async () => {
  await t("eski uygulama ox3000_* anahtarlarını iki dosyaya yazar, başkasını yazmaz", async () => {
    const e = eskiUygulama(ESKI);
    assert.strictEqual(await e.ctx.OXGECIS.yaz(), true);
    const [ana, yedek] = oku(e.dosyalar);
    assert.ok(ana && ana === yedek);
    const j = JSON.parse(ana);
    assert.strictEqual(j.v, 1);
    assert.deepStrictEqual(Object.keys(j.keys).sort(), Object.keys(ESKI).filter((k) => k.startsWith("ox3000_")).sort());
  });

  await t("uçtan uca: yenide eskideki anahtarların aynısı, bir kez", async () => {
    const e = eskiUygulama(ESKI);
    await e.ctx.OXGECIS.yaz();
    const y = depo();
    const r = G.aktar(y, oku(e.dosyalar), 1000);
    assert.deepStrictEqual(r, { durum: "aktarildi", kelime: 2 });
    for (const k of Object.keys(ESKI)) assert.strictEqual(y.ls[k], k.startsWith("ox3000_") ? ESKI[k] : undefined, k);
    assert.strictEqual(y.sira.filter((k) => k !== G.BAYRAK).pop(), "ox3000_srs_v1", "ilerleme en son yazılır");
    assert.strictEqual(G.aktar(y, oku(e.dosyalar), 2000).durum, "onceden");
  });

  await t("yarım kalmış dosya: diğeri kullanılır; ikisi geçerliyse yenisi", async () => {
    const e = eskiUygulama(ESKI);
    await e.ctx.OXGECIS.yaz();
    const [ana, yedek] = oku(e.dosyalar);
    let y = depo();
    assert.strictEqual(G.aktar(y, [ana.slice(0, 40), yedek], 1).durum, "aktarildi");
    assert.strictEqual(y.ls.ox3000_srs_v1, ESKI.ox3000_srs_v1);
    const eski = JSON.stringify({ v: 1, t: 1, keys: { ox3000_srs_v1: "{}" } });
    y = depo();
    G.aktar(y, [eski, yedek], 1);
    assert.strictEqual(y.ls.ox3000_srs_v1, ESKI.ox3000_srs_v1);
  });

  await t("dosya yok: bayrak yazılmaz (sonra yeniden denenir); bozuk: hata söylenir", async () => {
    const y = depo();
    assert.deepStrictEqual(G.aktar(y, [null, null], 1), { durum: "yok" });
    const r = G.aktar(y, ["{bozuk", JSON.stringify({ v: 2 })], 1);
    assert.strictEqual(r.durum, "bozuk");
    assert.ok(r.hata);
    assert.strictEqual(y.getItem(G.BAYRAK), null);
  });

  await t("yeni uygulamada zaten ilerleme varsa üstüne yazılmaz", async () => {
    const e = eskiUygulama(ESKI);
    await e.ctx.OXGECIS.yaz();
    const y = depo({ ox3000_srs_v1: "{\"9|x\":{}}" });
    assert.strictEqual(G.aktar(y, oku(e.dosyalar), 1).durum, "atlandi");
    assert.strictEqual(y.ls.ox3000_srs_v1, "{\"9|x\":{}}");
    assert.strictEqual(y.ls.ox3000_daily_v1, undefined);
  });

  await t("yazma hatası sessiz geçmez: kayda düşer", async () => {
    const e = eskiUygulama(ESKI, { hata: true });
    assert.strictEqual(await e.ctx.OXGECIS.yaz(), false);
    assert.strictEqual(e.olaylar[0][0], "gecis_hata");
  });

  console.log(n + " test geçti");
})().catch((e) => { console.error(e); process.exit(1); });
