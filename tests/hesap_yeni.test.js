// Yeni uygulamanın hesabı (mobile/src/hesap/hesap.js): eski uygulamanın hesap.js'iyle aynı sunucu çağrıları,
// aynı localStorage anahtarları. Sahte sunucu; srs.js ve log.js gerçek. Çalıştır: node tests/hesap_yeni.test.js
const assert = require("assert");
const fs = require("fs"), vm = require("vm"), path = require("path");
const WWW = path.join(__dirname, "..", "app", "www");
const H = require(path.join(__dirname, "..", "mobile", "src", "hesap", "hesap.js"));

function sunucu(ayar = {}) {
  const s = { cagri: [], yedek: ayar.yedek || null };
  s.fetch = async (url, opt) => {
    const body = JSON.parse(opt.body || "{}"), yol = url.replace(/^https:\/\/[^/]+/, "");
    s.cagri.push(yol.replace("/rest/v1/rpc/", ""));
    const cevap = (o, st = 200) => ({ ok: st < 400, status: st, text: async () => (o == null ? "" : JSON.stringify(o)) });
    if (yol === "/auth/v1/signup") return cevap({ access_token: "yeni", refresh_token: "r2", expires_in: 3600, user: { id: "u2" } });
    if (yol.startsWith("/auth/v1/token")) return ayar.yenilemeYok ? cevap({ msg: "Invalid Refresh Token" }, 400) : cevap({ access_token: "t3", refresh_token: "r3", expires_in: 3600 });
    const fn = yol.split("/rpc/")[1];
    s.son = [fn, body];
    if (fn === "create_profile") return cevap({ nick: body.p_nick, code: "AB12CD", recovery: "ABCD-EFGH-JKLM" });
    if (fn === "claim_account") return cevap(body.p_recovery.replace(/-/g, "").length === 12 ? { ok: true, nick: "Eski", code: "ZZ99YY" } : { ok: false });
    if (fn === "get_backup") return cevap(s.yedek);
    if (fn === "push_backup") { s.yedek = JSON.parse(JSON.stringify(body.p)); return cevap(null); }
    if (fn === "push_logs") { (s.loglar = s.loglar || []).push(body.p); return cevap(null); }
    if (fn === "dashboard") return cevap({ me: { nick: "Test" }, friends: [], incoming: [], outgoing: [], durtmeler: [] });
    return cevap(null);
  };
  return s;
}

// srs.js + log.js gerçek, localStorage sahte. eski: eski uygulamanın hesap.js'i de yüklensin (karşılaştırma için).
function ortam(ls = {}, ayar = {}, eski = false) {
  const sv = sunucu(ayar);
  const depo = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => (ls[k] = String(v)), removeItem: (k) => delete ls[k] };
  const ctx = {
    localStorage: depo, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { href: "http://localhost/ayarlar.html", pathname: "/ayarlar.html", search: "", hash: "" },
    document: { addEventListener() {}, hidden: false }, navigator: { userAgent: "test" },
    addEventListener() {}, setTimeout: () => 0, clearTimeout() {}, console, JSON, Promise, Object, Date, Math, String, Error, Array,
    fetch: sv.fetch,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of eski ? ["log.js", "srs.js", "hesap.js"] : ["log.js", "srs.js"]) vm.runInContext(fs.readFileSync(path.join(WWW, f), "utf8"), ctx);
  const A = H.kur({ depo, fetch: sv.fetch, SRS: ctx.SRS, OXLOG: ctx.OXLOG, cihaz: "Android 14; Test", surum: "2.5", zamanla: () => 0 });
  return { A, ls, sv, ctx };
}
const OTURUM = () => JSON.stringify({ at: "tok", rt: "r", exp: Date.now() + 3600e3, uid: "u1" });

let n = 0;
const t = async (ad, f) => { await f(); n++; console.log("ok -", ad); };

(async () => {
  await t("hesap aç: giriş + create_profile, eskisiyle aynı çağrılar ve aynı kayıt", async () => {
    const yeni = ortam(), eski = ortam({}, {}, true);
    const a = await yeni.A.create(" Ayşe ");
    await eski.ctx.OXACC.create(" Ayşe ");
    assert.deepStrictEqual(yeni.sv.cagri, eski.sv.cagri);
    assert.deepStrictEqual(yeni.sv.cagri, ["/auth/v1/signup", "create_profile"]);
    assert.strictEqual(a.nick, "Ayşe");
    const y = JSON.parse(yeni.ls.ox3000_hesap_v1), e = JSON.parse(eski.ls.ox3000_hesap_v1);
    delete y.at; delete e.at;
    assert.deepStrictEqual(y, e);
    assert.ok(yeni.ls.ox3000_oturum_v1);
  });

  await t("kurtarma koduyla hesap al, yedeği geri yükle", async () => {
    const yedek = { v: 1, t: 1, keys: { ox3000_srs_v1: { "1|apple": { b: 3, n: 2, l: 1, f: 20000, due: 20010, a: 20003 } }, ox3000_daily_v1: { 20003: { n: 4, ok: 3, nw: 1 } } } };
    const o = ortam({ ox3000_sessions_v1: "[1]" }, { yedek });
    const r = await o.A.claim("abcdefghjklm");
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.account.recovery, "ABCD-EFGH-JKLM");
    assert.deepStrictEqual(o.sv.cagri.slice(-2), ["claim_account", "get_backup"]);
    const g = o.A.restore(r.backup);
    assert.deepStrictEqual(g, { ok: true, eksik: [] });
    assert.ok(o.ctx.SRS.records()["1|apple"]);
    assert.strictEqual(o.ls.ox3000_sessions_v1, undefined, "yedekte olmayan anahtar silinir");
    const k = o.A.karsilastirma(yedek);
    assert.ok(/^1 kelime/.test(k.yedek), k.yedek);
    assert.strictEqual((await ortam().A.claim("kısa")).ok, false);
  });

  await t("oturum yenilenemezse yeni giriş + kayıtlı kurtarma koduyla hesap geri alınır", async () => {
    const o = ortam({
      ox3000_hesap_v1: JSON.stringify({ nick: "T", code: "AB12CD", recovery: "ABCD-EFGH-JKLM" }),
      ox3000_oturum_v1: JSON.stringify({ at: "eski", rt: "r", exp: 0 }),
      ox3000_bildirim_v1: JSON.stringify({ anahtar: "x", izin: 1 }),
    }, { yenilemeYok: true });
    await o.A.dashboard();
    assert.deepStrictEqual(o.sv.cagri, ["/auth/v1/token?grant_type=refresh_token", "/auth/v1/signup", "claim_account", "dashboard"]);
    assert.strictEqual(JSON.parse(o.ls.ox3000_oturum_v1).at, "yeni");
    assert.deepStrictEqual(JSON.parse(o.ls.ox3000_bildirim_v1), { izin: 1 }, "eski bildirim anahtarı silinir");
    assert.ok(o.ls.ox3000_pano_v1, "pano saklanır (bağlantı yokken gösterilir)");
  });

  await t("özet dakikada en çok bir; yedek yalnız değişince", async () => {
    const o = ortam({ ox3000_hesap_v1: JSON.stringify({ nick: "T", code: "AB12CD" }), ox3000_oturum_v1: OTURUM() });
    assert.strictEqual(await o.A.pushStats(false), true);
    assert.strictEqual(await o.A.pushStats(false), false);
    assert.strictEqual(await o.A.pushStats(true), true);
    assert.strictEqual(await o.A.pushBackup(true), true);
    assert.strictEqual(await o.A.pushBackup(true), false, "değişmedi");
    o.ctx.SRS.setListSize(30);
    assert.strictEqual(await o.A.pushBackup(true), true);
    assert.strictEqual(o.sv.yedek.keys.ox3000_settings_v1.listN, 30);
  });

  await t("kullanım kayıtları: izinsiz gitmez; izinden önceki olaylar gitmez", async () => {
    const o = ortam({ ox3000_hesap_v1: JSON.stringify({ nick: "T", code: "AB12CD" }), ox3000_oturum_v1: OTURUM() });
    o.ctx.OXLOG.add("sayfa", { p: "index" });
    assert.strictEqual(o.A.kayitIzni(), null);
    assert.strictEqual(await o.A.pushLogs(true), false);
    assert.strictEqual(o.A.logDurum(), null);
    o.A.kayitIzniAyarla(true);   // bu da bir olay ("ayar")
    o.ctx.OXLOG.add("cevap", { ok: 1 });
    assert.strictEqual(await o.A.pushLogs(true), 2);
    const p = o.sv.loglar[0];
    assert.deepStrictEqual(p.olaylar.map((e) => e[1]), ["ayar", "cevap"]);
    assert.strictEqual(p.cihaz, "Android 14; Test");
    assert.strictEqual(p.surum, "2.5");
    assert.strictEqual(o.A.logDurum().bekleyen, 0);
    o.A.kayitIzniAyarla(false);
    o.ctx.OXLOG.add("cevap", { ok: 0 });
    assert.strictEqual(await o.A.pushLogs(true), false);
  });

  await t("hesap silinince sunucu ve telefondaki hesap kayıtları silinir, ilerleme kalır", async () => {
    const o = ortam({ ox3000_hesap_v1: JSON.stringify({ nick: "T", code: "AB12CD" }), ox3000_oturum_v1: OTURUM(), ox3000_pano_v1: "{}", ox3000_srs_v1: "{}" });
    await o.A.deleteAccount();
    assert.strictEqual(o.sv.son[0], "delete_account");
    assert.strictEqual(o.A.account(), null);
    for (const k of ["ox3000_oturum_v1", "ox3000_pano_v1"]) assert.strictEqual(o.ls[k], undefined, k);
    assert.strictEqual(o.ls.ox3000_srs_v1, "{}");
  });

  await t("hata metinleri eskisiyle aynı", async () => {
    const eski = ortam({}, {}, true).ctx.OXACC;
    for (const e of [{ net: true }, { message: "kod_yok" }, { message: "anonymous sign-ins are disabled" }, { message: "xyz" }, {}]) {
      assert.strictEqual(H.errText(e), eski.errText(e));
    }
    assert.strictEqual(H.fmtRec("abcdefghjklm"), "ABCD-EFGH-JKLM");
  });

  console.log(n + " test geçti");
})().catch((e) => { console.error(e); process.exit(1); });
