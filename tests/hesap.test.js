// hesap.js testleri: yeniden kurulumdan önce yedeğin doğrulanması (yedekDogrula).
// Sahte sunucu, Postgres jsonb gibi nesne anahtarlarını yeniden sıralar.
// Çalıştır: node tests/hesap.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const WWW = path.join(__dirname, "..", "app", "www");

// jsonb anahtar sırası: önce kısa anahtarlar, eşitse sözlük sırası.
function jsonb(v) {
  if (Array.isArray(v)) return v.map(jsonb);
  if (v && typeof v === "object") {
    const o = {};
    Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).forEach((k) => (o[k] = jsonb(v[k])));
    return o;
  }
  return v;
}

function ortam({ bozuk = false, agYok = false } = {}) {
  const ls = {}, sunucu = {};
  ls.ox3000_hesap_v1 = JSON.stringify({ nick: "Test", code: "AB12CD", recovery: "ABCD-EFGH-JKLM", at: 1 });
  ls.ox3000_oturum_v1 = JSON.stringify({ at: "tok", rt: "r", exp: Date.now() + 3600e3, uid: "u1" });
  ls.ox3000_srs_v1 = JSON.stringify({ "1|apple": { b: 3, n: 2, l: 1, f: 20000, due: 20010, a: 20003 }, "1|zebra|2": { b: 1, n: 0, l: 1, f: 20001, due: 20002, a: 20001, d: "tr2en" } });
  ls.ox3000_daily_v1 = JSON.stringify({ 20003: { n: 4, ok: 3, nw: 1 } });
  ls.ox3000_settings_v1 = JSON.stringify({ listN: 20, loop: true });
  const ctx = {
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => (ls[k] = String(v)), removeItem: (k) => delete ls[k] },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { href: "http://localhost/ayarlar.html", pathname: "/ayarlar.html", search: "", hash: "" },
    document: { addEventListener() {}, hidden: false },
    navigator: { userAgent: "test" },
    addEventListener() {}, setTimeout: () => 0, clearTimeout() {}, console, JSON, Promise, Object, Date, Math, String, Error, Array,
    fetch: async (url, opt) => {
      if (agYok) throw new TypeError("Failed to fetch");
      const fn = url.split("/rpc/")[1], body = JSON.parse(opt.body || "{}");
      let cevap = null;
      if (fn === "push_backup") { sunucu.yedek = jsonb(JSON.parse(JSON.stringify(body.p))); }
      else if (fn === "get_backup") {
        cevap = sunucu.yedek ? JSON.parse(JSON.stringify(sunucu.yedek)) : null;
        if (bozuk && cevap) delete cevap.keys.ox3000_srs_v1["1|apple"];   // sunucu bir kelimeyi kaybetmiş
      }
      const t = cevap == null ? "" : JSON.stringify(cevap);
      return { ok: true, status: 200, text: async () => t };
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["srs.js", "hesap.js"]) vm.runInContext(fs.readFileSync(path.join(WWW, f), "utf8"), ctx);
  return { ctx, ls, sunucu };
}

let hata = 0;
function bak(ad, kosul, bilgi) {
  console.log((kosul ? "ok" : "HATA") + " - " + ad + (kosul ? "" : "  " + JSON.stringify(bilgi)));
  if (!kosul) hata++;
}

(async () => {
  let o = ortam();
  let r = await o.ctx.OXACC.yedekDogrula();
  bak("yedek sunucuya gidip aynen geri geliyor → doğrulandı (anahtar sırası farklı olsa da)", r.ok === true && r.kelime === 2, r);
  bak("sunucudaki yedek gerçekten anahtar sırası değişmiş halde (test geçerli)",
    JSON.stringify(o.sunucu.yedek.keys) !== JSON.stringify(JSON.parse(JSON.stringify({ ox3000_srs_v1: JSON.parse(o.ls.ox3000_srs_v1), ox3000_daily_v1: JSON.parse(o.ls.ox3000_daily_v1), ox3000_settings_v1: JSON.parse(o.ls.ox3000_settings_v1) }))), null);

  o = ortam({ bozuk: true });
  r = await o.ctx.OXACC.yedekDogrula();
  bak("sunucudaki yedek eksikse → doğrulanmadı (kullanıcıya 'silme' denir)", r.ok === false, r);

  o = ortam({ agYok: true });
  let hataVar = false;
  try { await o.ctx.OXACC.yedekDogrula(); } catch (e) { hataVar = true; }
  bak("internet yoksa hata fırlatır (doğrulandı sanılmaz)", hataVar, null);

  o = ortam();
  delete o.ls.ox3000_hesap_v1;
  hataVar = false;
  try { await o.ctx.OXACC.yedekDogrula(); } catch (e) { hataVar = /hesap_yok/.test(e.message); }
  bak("hesap yoksa hata fırlatır", hataVar, null);

  bak("tarayıcıda (native değil) yeniden kurulum istenmez", o.ctx.OXACC.yenidenKurulmali() === false, null);

  // Geri yükleme: telefona yazılamayan anahtar varsa "tamam" denmez.
  o = ortam();
  const yedek = { v: 1, t: 1, keys: { ox3000_srs_v1: { "1|apple": { b: 4 } }, ox3000_daily_v1: { 1: { n: 1 } } } };
  let g = o.ctx.OXACC.restore(yedek);
  bak("geri yükleme: hepsi yazıldı → ok", g.ok === true && JSON.parse(o.ls.ox3000_srs_v1)["1|apple"].b === 4, g);
  o = ortam();
  o.ctx.localStorage.setItem = (k, v) => { if (k === "ox3000_srs_v1") { const e = new Error("dolu"); e.name = "QuotaExceededError"; throw e; } o.ls[k] = String(v); };
  g = o.ctx.OXACC.restore(yedek);
  bak("geri yükleme: ilerleme yazılamadı → ok değil, eksik listesinde", g.ok === false && g.eksik.indexOf("ox3000_srs_v1") >= 0, g);

  // Kurtarmada telefonda da ilerleme varsa sorulan soru sayıları ve tarihleri göstermeli.
  o = ortam();
  const T = o.ctx.SRS.today();
  o.ls.ox3000_srs_v1 = JSON.stringify({ x: { a: T }, y: { a: T - 2 } }); o.ctx.SRS._reload();
  const soru = o.ctx.OXACC.karsilastirma({ t: Date.UTC(2026, 9, 1), keys: { ox3000_srs_v1: { a: { a: T - 3 }, b: { a: T - 5 }, c: { a: T - 4 } } } });
  bak("kurtarma sorusu: yedekte 3 kelime / 3 gün önce, telefonda 2 kelime / bugün",
    /Yedek \(.*\): 3 kelime, en son 3 gün önce/.test(soru) && /Bu telefon: 2 kelime, en son bugün/.test(soru) && /İptal = bu telefondakini koru/.test(soru), soru);

  if (hata) { console.log(hata + " test BAŞARISIZ"); process.exitCode = 1; }
})();
