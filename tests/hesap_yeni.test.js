// Uygulamanın hesabı (mobile/src/hesap/hesap.js): sunucu çağrıları (supabase/kurulum.sql), localStorage anahtarları,
// hatırlatma planı. Beklenenler eski uygulamanın hesap.js'inden alındı (o kaldırılmadan önce birebir karşılaştırılıyordu).
// Sahte sunucu; srs.js ve log.js gerçek. Çalıştır: TZ=Europe/Istanbul node tests/hesap_yeni.test.js
const assert = require("assert");
const fs = require("fs"), vm = require("vm"), path = require("path");
const CEKIRDEK = path.join(__dirname, "..", "mobile", "src", "cekirdek");
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
    if (fn === "dashboard") return cevap({ me: { nick: "Test" }, friends: [], incoming: [{ id: "i1", at: "2026-10-20T10:00:00.123456+00:00" }], outgoing: [], durtmeler: [{ id: "d1", from: "f", at: "2026-10-20T11:00:00.5+00:00" }] });
    if (fn === "bildirim_anahtari") { s.anahtarNo = (s.anahtarNo || 0) + 1; return cevap({ anahtar: "k" + s.anahtarNo }); }
    return cevap(null);
  };
  return s;
}

// srs.js + log.js gerçek, localStorage sahte.
function ortam(ls = {}, ayar = {}) {
  const sv = sunucu(ayar);
  const depo = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => (ls[k] = String(v)), removeItem: (k) => delete ls[k] };
  const ctx = {
    localStorage: depo, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { userAgent: "test" }, setTimeout: () => 0, clearTimeout() {}, console, JSON, Promise, Object, Date, Math, String, Error, Array,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["log.js", "srs.js"]) vm.runInContext(fs.readFileSync(path.join(CEKIRDEK, f), "utf8"), ctx);
  const A = H.kur({ depo, fetch: sv.fetch, SRS: ctx.SRS, OXLOG: ctx.OXLOG, B: ayar.B, cihaz: "Android 14; Test", surum: "2.5",
    zamanla: ayar.zamanla || (() => 0) });
  return { A, ls, sv, ctx };
}
// Native bildirim modülü taklidi: çağrıları kaydeder.
function sahteB({ izin = "granted", gecersiz = [] } = {}) {
  const c = [];
  return {
    c,
    configure: (o) => { c.push(["configure", o.secret, o.arkadas, o.durt, o.son]); return gecersiz.includes(o.secret) ? { ok: false, gecersiz: true } : { ok: true, izin }; },
    disable: () => c.push(["disable"]),
    planla: (items) => { c.push(["planla", items.length]); return { ok: true, n: items.length }; },
    seen: (son) => c.push(["seen", son]),
    permission: () => ({ display: izin }),
    requestPermission: async () => { c.push(["izinIste"]); return { display: "granted" }; },
    openSettings: () => c.push(["ayarlar"]),
    cihaz: () => ({ marka: "xiaomi redmi", sdk: 34, otobas: true }),
    otomatikBaslatma: () => { c.push(["otobas"]); return { acildi: "otobas" }; },
  };
}
const OTURUM = () => JSON.stringify({ at: "tok", rt: "r", exp: Date.now() + 3600e3, uid: "u1" });

let n = 0;
const t = async (ad, f) => { await f(); n++; console.log("ok -", ad); };

(async () => {
  await t("hesap aç: giriş + create_profile, kayıt eskisinin biçiminde", async () => {
    const o = ortam();
    const a = await o.A.create(" Ayşe ");
    assert.deepStrictEqual(o.sv.cagri, ["/auth/v1/signup", "create_profile"]);
    assert.deepStrictEqual(o.sv.son, ["create_profile", { p_nick: "Ayşe" }]);
    assert.strictEqual(a.nick, "Ayşe");
    const y = JSON.parse(o.ls.ox3000_hesap_v1);
    assert.ok(y.at > 0);
    delete y.at;
    assert.deepStrictEqual(y, { nick: "Ayşe", code: "AB12CD", recovery: "ABCD-EFGH-JKLM" });
    assert.deepStrictEqual(Object.keys(JSON.parse(o.ls.ox3000_oturum_v1)), ["at", "rt", "exp", "uid"]);
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
    }, { yenilemeYok: true, zamanla: (f) => { f(); return 0; } });
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

  await t("hatırlatma planı (seri, tekrar, saatler, 3 gün) eskisinin verdiğiyle aynı", async () => {
    const ls = {
      ox3000_srs_v1: JSON.stringify({ "1|apple": { b: 2, n: 1, l: 1, f: 20380, due: 20380, a: 20379 }, "1|area": { b: 1, n: 0, l: 1, f: 20380, due: 20382, a: 20380 } }),
      ox3000_daily_v1: JSON.stringify({ 20378: { n: 5, ok: 4, nw: 1 }, 20379: { n: 3, ok: 3, nw: 0 } }),
      ox3000_settings_v1: JSON.stringify({ bildirim: { seriSaat: "19:30", tekrarSaat: "08:15" } }),
    };
    const o = ortam({ ...ls }), now = new Date(2026, 9, 20, 7, 0).getTime();
    const T = "📚 Bugün 2 kelimenin tekrar zamanı geldi.", S = "📖 Bugün henüz çalışmadın. Birkaç kelimeyle başla!";
    // [kimlik, şu andan sonra ms, metin] — eski hesap.js'in aynı veriyle verdiği plan
    assert.deepStrictEqual(o.A.hatirlatmaPlani(now).map((x) => [x.id, x.at - now, x.metin]), [
      ["tekrar-2026-10-20", 4500000, T], ["seri-2026-10-20", 45000000, S], ["tekrar-2026-10-21", 90900000, T],
      ["seri-2026-10-21", 131400000, S], ["tekrar-2026-10-22", 177300000, T], ["seri-2026-10-22", 217800000, S]]);
    assert.ok(o.A.hatirlatmaPlani(now).every((x) => x.hedef === "kartlar.html?exam=1"));
    assert.strictEqual(H.saatOk("21:59"), true);
    assert.strictEqual(H.saatOk("22:00"), false);
  });

  await t("bildirimler: anahtar alınır, native'e verilir; geçersizse yenisi; ikisi kapalıysa durur; görülen iletilir", async () => {
    const B = sahteB({ gecersiz: ["k1"] });
    const o = ortam({ ox3000_hesap_v1: JSON.stringify({ nick: "T", code: "AB12CD" }), ox3000_oturum_v1: OTURUM() }, { B });
    assert.strictEqual(await o.A.bildirimKur(false), true);
    assert.deepStrictEqual(B.c.map((x) => x.slice(0, 2)), [["configure", "k1"], ["configure", "k2"]]);
    assert.strictEqual(JSON.parse(o.ls.ox3000_bildirim_v1).anahtar, "k2");
    await o.A.dashboard();
    assert.deepStrictEqual(B.c[B.c.length - 1], ["seen", "2026-10-20T11:00:00.5+00:00"]);
    await o.A.bildirimAyarla({ arkadas: false });
    await o.A.bildirimAyarla({ durt: false });
    assert.deepStrictEqual(B.c[B.c.length - 1], ["disable"]);
    assert.deepStrictEqual(o.A.bildirimAyar(), { seri: true, seriSaat: "20:00", tekrar: true, tekrarSaat: "09:00", arkadas: false, durt: false });
    await o.A.bildirimAyarla({ seriSaat: "23:00" });   // sessiz saatte: yok sayılır
    assert.strictEqual(o.A.bildirimAyar().seriSaat, "20:00");
  });

  await t("bildirimler yoksa (iOS, web) hiçbir şey denenmez; kurulum penceresi bir kez", async () => {
    const o = ortam({ ox3000_hesap_v1: JSON.stringify({ nick: "T", code: "AB12CD" }), ox3000_oturum_v1: OTURUM() });
    assert.strictEqual(await o.A.bildirimKur(false), false);
    assert.strictEqual(o.A.hatirlatmaPlanla(true), false);
    assert.strictEqual(o.A.kurulumDurum(), null);
    assert.ok(!o.sv.cagri.includes("bildirim_anahtari"));
    const B = sahteB({ izin: "prompt" }), b = ortam({}, { B });
    const d = b.A.kurulumDurum();
    assert.deepStrictEqual(d.adim.map((x) => [x.id, x.ok]), [["izin", false], ["otobas", false]]);
    assert.strictEqual(b.A.kurulumGosterilsin(), true);
    assert.strictEqual(b.A.kurulumGosterilsin(), false);
    await b.A.kurulumAdim("izin");
    assert.ok(B.c.some((x) => x[0] === "izinIste"));
  });

  await t("hata metinleri", async () => {
    assert.deepStrictEqual([{ net: true }, { message: "kod_yok" }, { message: "anonymous sign-ins are disabled" }, { message: "xyz" }, {}].map(H.errText),
      ["İnternet bağlantısı yok.", "Bu kodla bir kullanıcı yok.", "Sunucuda misafir girişi kapalı.", "Bir hata oldu (xyz).", "Bir hata oldu."]);
    assert.strictEqual(H.fmtRec("abcdefghjklm"), "ABCD-EFGH-JKLM");
  });

  console.log(n + " test geçti");
})().catch((e) => { console.error(e); process.exit(1); });
