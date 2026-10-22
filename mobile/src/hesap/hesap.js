/*
 * Hesap ve arkadaşlar (Supabase), ekrandan bağımsız. Eski uygulamanın hesap.js'inin aynı sunucu
 * işlevlerini (supabase/kurulum.sql) aynı sırayla ve aynı localStorage anahtarlarıyla (ox3000_*) çağıran hali;
 * sayfa pencereleri (karşılama, kurulum) burada değil, ekranlarda (src/hesap/Karsilama.js, src/app/ayarlar.js,
 * src/app/arkadas.js). Eski uygulama kalkınca (PLAN.md adım 40) hesap.js'in tek kopyası bu olur.
 *
 * Şifre ve e-posta yok: ilk istekte kendiliğinden (anonim) giriş yapılır, kullanıcı takma ad seçer; arkadaş kodu
 * ve kurtarma kodu verilir. Telefon değişince kurtarma koduyla hesap, arkadaşlar ve ilerleme yedeği taşınır.
 * Kullanım kayıtları (log.js) yalnız kullanıcı izin verirse gider (bir kez sorulur; Ayarlar → Gizlilik).
 * Bildirimler (Android'de modules/bildirim; B yoksa — iOS, web, test — hepsi sessizce atlanır): arkadaşlık isteği ve
 * dürtme (arka planda, hesaba özel bildirim anahtarıyla), seri / tekrar hatırlatmaları (yerel, önümüzdeki 3 gün).
 *
 * kur({ depo, fetch, SRS, OXLOG, B, cihaz, surum, zamanla, simdi }) → işlevler. tests/hesap_yeni.test.js denetler.
 */
const URL0 = "https://ezztsktfyangyzrdkszb.supabase.co";
const KEY0 = "sb_publishable_vqOeOUAiwe_4K78s_tS0Iw_lhueOwhY";   // herkese açık anahtar (güvenlik sunucudaki kurallarda)
const SKEY = "ox3000_oturum_v1", AKEY = "ox3000_hesap_v1", YKEY = "ox3000_esitleme_v1", PKEY = "ox3000_pano_v1";
const GKEY = "ox3000_log_gonder_v1", IZINK = "ox3000_kayit_izni_v1";
const NKEY = "ox3000_bildirim_v1";   // bu telefona özel: {anahtar, izin: 1 (bir kez soruldu), hata: ms}
const SETK = "ox3000_settings_v1", HKEY = "ox3000_hatirlatma_v1", KKEY = "ox3000_kurulum_v1";
const BVAR = { seri: true, seriSaat: "20:00", tekrar: true, tekrarSaat: "09:00", arkadas: true, durt: true };
const GUN = 86400000, UFUK = 3 * GUN;   // en çok 3 gün sonrası planlanır
// Saat "SS:DD", 08:00–21:59 (22:00–08:00 sessiz saatler).
function saatOk(v) { return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) && v >= "08:00" && v < "22:00"; }
// Yedeklenen veriler (kayıtlar/log hariç). ox3000_parca_v1: çok anlamlı kelimenin yarım turu (kayıtlarla birlikte
// gelmeli; eski yedekte yoksa geri yüklemede silinir).
const BKEYS = ["ox3000_srs_v1", "ox3000_daily_v1", "ox3000_sessions_v1", "ox3000_settings_v1", "ox3000_exam_batch_v1", "ox3000_parca_v1"];
const LOG_PARCA = 500, LOG_BAYT = 100000;

const MSG = {
  baglanti: "İnternet bağlantısı yok.", giris_yok: "Giriş yapılamadı, tekrar dene.", profil_yok: "Hesap bulunamadı (başka telefona taşınmış olabilir).",
  ad_uzunluk: "Takma ad 3–16 karakter olmalı.", kod_yok: "Bu kodla bir kullanıcı yok.", kendin: "Bu senin kodun 🙂",
  zaten_arkadas: "Zaten arkadaşsınız.", cok_istek: "Çok fazla bekleyen isteğin var.", gecersiz: "Geçersiz veri.",
};
function errText(e) {
  const m = e && e.message ? String(e.message) : "";
  if (e && e.net) return MSG.baglanti;
  if (MSG[m]) return MSG[m];
  if (/anonymous/i.test(m)) return "Sunucuda misafir girişi kapalı.";
  return "Bir hata oldu" + (m ? " (" + m.slice(0, 80) + ")" : "") + ".";
}
function fmtRec(r) {
  const x = String(r || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return x.length === 12 ? x.slice(0, 4) + "-" + x.slice(4, 8) + "-" + x.slice(8) : x;
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }
function bytes(s) { try { return new TextEncoder().encode(s).length; } catch (e) { return s.length * 2; } }

function kur(o) {
  const depo = o.depo, SRS = o.SRS, L = o.OXLOG, B = o.B || null;
  const simdi = o.simdi || (() => Date.now());
  const zamanla = o.zamanla || setTimeout;
  let URL = URL0, KEY = KEY0;
  try {   // test için sunucu değiştirme (eskisiyle aynı anahtar)
    const t = JSON.parse(depo.getItem("ox3000_api") || "null");
    if (t && t.url) { URL = t.url; KEY = t.key || KEY; }
  } catch (e) {}

  function getJ(k, d) { try { const v = JSON.parse(depo.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function setJ(k, v) { try { depo.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function log(t, d) { try { L.add(t, d); } catch (e) {} }
  const ago = (t) => Math.abs(simdi() - (t || 0));   // saat geri alınsa da takılmasın

  // ---------------- bağlantı ----------------
  async function http(path, body, token) {
    const h = { apikey: KEY, "Content-Type": "application/json" };
    if (token) h.Authorization = "Bearer " + token;
    let res;
    try { res = await o.fetch(URL + path, { method: "POST", headers: h, body: JSON.stringify(body || {}) }); }
    catch (e) { const ne = new Error("baglanti"); ne.net = true; throw ne; }
    let txt = "";
    try { txt = await res.text(); } catch (e) {}
    let data = null;
    if (txt) { try { data = JSON.parse(txt); } catch (e) { data = txt; } }
    if (!res.ok) {
      const m = (data && typeof data === "object") ? (data.message || data.msg || data.error_description || data.error) : null;
      const er = new Error(m || ("http_" + res.status)); er.status = res.status; er.data = data; throw er;
    }
    return data;
  }
  function saveSess(r) {
    if (!r || !r.access_token) throw new Error("oturum");
    const exp = r.expires_at ? r.expires_at * 1000 : simdi() + (r.expires_in || 3600) * 1000;
    const s = { at: r.access_token, rt: r.refresh_token, exp, uid: r.user && r.user.id };
    setJ(SKEY, s);
    return s;
  }
  let inflight = null;   // aynı anda tek giriş/yenileme
  function once(fn) {
    if (!inflight) inflight = Promise.resolve().then(fn).finally(() => { inflight = null; });
    return inflight;
  }
  async function signIn() { return saveSess(await http("/auth/v1/signup", { data: {} })); }
  // Oturum geçersizse (ör. çok uzun süre sonra) yeni giriş + kayıtlı kurtarma koduyla hesabı geri al.
  async function renew() {
    const s = getJ(SKEY, null);
    if (s && s.rt) {
      try { return saveSess(await http("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.rt })); }
      catch (e) { if (e.net || e.status === 429 || !(e.status >= 400 && e.status < 500)) throw e; }   // sunucu hatasında yeni giriş yapma
    }
    const ns = await signIn(), a = account();
    if (a && a.recovery) {
      try {
        const cr = await http("/rest/v1/rpc/claim_account", { p_recovery: a.recovery }, ns.at);
        log("hesap", { a: "oturum_yenilendi" });
        if (cr && cr.ok) zamanla(() => bildirimHesapDegisti(true), 0);   // eski bildirim anahtarı geçersiz oldu
      } catch (e) {}
    }
    return ns;
  }
  async function token(force) {
    const s = getJ(SKEY, null);
    if (!s) return (await once(account() ? renew : signIn)).at;   // hesap var ama oturum yoksa kurtarma koduyla geri al
    if (force || s.exp - simdi() < 60000) return (await once(renew)).at;
    return s.at;
  }
  async function rpc(fn, args) {
    let t = await token(false);
    try { return await http("/rest/v1/rpc/" + fn, args || {}, t); }
    catch (e) {
      if (e.status === 401) { t = await token(true); return await http("/rest/v1/rpc/" + fn, args || {}, t); }
      throw e;
    }
  }
  // ---------------- hesap ----------------
  function account() { const a = getJ(AKEY, null); return (a && a.code) ? a : null; }
  async function create(nick) {
    const r = await rpc("create_profile", { p_nick: String(nick || "").trim() });
    const old = getJ(AKEY, null) || {};
    const a = { nick: r.nick, code: r.code, recovery: r.recovery || old.recovery || null, at: simdi() };
    setJ(AKEY, a);
    log("hesap", { a: "olustur" });
    syncSoon(true);
    bildirimHesapDegisti(true);   // yeni hesap: yeni bildirim anahtarı
    return a;
  }
  // Kurtarma koduyla eski hesabı al; yedek varsa döner (restore ile yazılır).
  async function claim(code) {
    const r = await rpc("claim_account", { p_recovery: code });
    if (!r || !r.ok) return { ok: false };
    const a = { nick: r.nick, code: r.code, recovery: fmtRec(code), at: simdi() };
    setJ(AKEY, a);
    setJ(YKEY, {});
    bildirimHesapDegisti(true);   // taşınan hesabın eski bildirim anahtarı sunucuda silindi: bu telefona yenisi
    let b = null;
    try { b = await rpc("get_backup", {}); } catch (e) {}
    log("hesap", { a: "kurtar", yedek: b ? 1 : 0 });
    return { ok: true, account: a, backup: b };
  }
  // Yedeği telefona yazar. Dönen: {ok, eksik: [yazılamayan anahtarlar]}. Yazma SRS.yaz ile (hafıza dolunca
  // kullanım kaydını kısaltıp tekrar dener); yine olmazsa eksik listesine girer ve kayda düşer.
  function restore(b) {
    if (!b || !b.keys) return { ok: false, eksik: [] };
    const eksik = [];
    BKEYS.forEach((k) => {
      try {
        if (b.keys[k] == null) { depo.removeItem(k); return; }
        if (!SRS.yaz(k, JSON.stringify(b.keys[k]))) eksik.push(k);
      } catch (e) { eksik.push(k); }
    });
    if (SRS._reload) SRS._reload();
    if (eksik.length) log("hesap_hata", { f: "geri_yukle", eksik: eksik.length });
    return { ok: !eksik.length, eksik };
  }
  async function setNick(n) {
    const r = await rpc("set_nick", { p_nick: String(n || "").trim() });
    const a = account(); if (a) { a.nick = r.nick; setJ(AKEY, a); }
    return r.nick;
  }
  async function newRecovery() {
    const r = await rpc("new_recovery", {});
    const a = account(); if (a) { a.recovery = r.recovery; setJ(AKEY, a); }
    return r.recovery;
  }
  async function deleteAccount() {
    await rpc("delete_account", {});
    [SKEY, AKEY, YKEY, PKEY].forEach((k) => { try { depo.removeItem(k); } catch (e) {} });
    log("hesap", { a: "sil" });
    if (B) { try { await B.disable(); } catch (e) {} }
    nset((x) => { delete x.anahtar; delete x.hata; });
  }
  // Telefonda da ilerleme varken yedeği yüklemeden önce: ikisini sayılarla göster ki kullanıcı körlemesine seçmesin.
  function ilerlemeOzeti(kayitlar) {
    let n = 0, son = 0;
    for (const k in (kayitlar || {})) { n++; const a = kayitlar[k] && kayitlar[k].a; if (a > son) son = a; }
    const gun = son ? SRS.today() - son : null;
    return n + " kelime" + (gun == null ? "" : gun <= 0 ? ", en son bugün çalışıldı" : ", en son " + gun + " gün önce çalışıldı");
  }
  function karsilastirma(b) {
    const p = (n) => ("0" + n).slice(-2), d = b.t ? new Date(b.t) : null;
    return {
      tarih: d ? p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() : "?",
      yedek: ilerlemeOzeti(b.keys && b.keys.ox3000_srs_v1),
      telefon: ilerlemeOzeti(SRS.records()),
    };
  }

  // ---------------- ilerleme özeti + yedek ----------------
  function dayStr(ms) {
    const d = new Date(ms), p = (n) => ("0" + n).slice(-2);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function todayStr() { return dayStr(SRS.now()); }
  function stats() {
    const R = SRS.records(), DL = SRS.daily(), T = SRS.today(), e = DL[T] || {};
    let dongu = 0, olgun = 0;
    for (const k in R) { dongu++; if (R[k] && R[k].b >= 4) olgun++; }
    let seri = 0, d = (DL[T] && DL[T].n > 0) ? T : T - 1;
    while (DL[d] && DL[d].n > 0) { seri++; d--; }
    return { gun: todayStr(), cevap: e.n || 0, dogru: e.ok || 0, yeni: e.nw || 0, dongu, olgun, seri };
  }
  function snapshot() {
    const keys = {};
    BKEYS.forEach((k) => { const v = getJ(k, null); if (v != null) keys[k] = v; });
    return { v: 1, t: simdi(), keys };
  }
  // Özet: değiştiyse dakikada en çok bir kez; değişmese de 10 dk'da bir ("son görülme" için).
  async function pushStats(force) {
    if (!account()) return false;
    const st = stats(), s = JSON.stringify(st);
    let y = getJ(YKEY, {}) || {};
    const age = simdi() - (y.sAt || 0);
    if (!force && (age < 60000 || (y.s === s && age < 600000))) return false;
    await rpc("push_stats", { p: st });
    y = getJ(YKEY, {}) || {}; y.s = s; y.sAt = simdi(); setJ(YKEY, y);
    return true;
  }
  // Yedek: değiştiyse ve son yedekten 5 dk geçtiyse.
  async function pushBackup(force) {
    if (!account()) return false;
    const data = snapshot(), h = String(hash(JSON.stringify(data.keys)));
    let y = getJ(YKEY, {}) || {};
    if (y.b === h) return false;
    if (!force && simdi() - (y.bAt || 0) < 300000) return false;
    await rpc("push_backup", { p: data });
    y = getJ(YKEY, {}) || {}; y.b = h; y.bAt = simdi(); setJ(YKEY, y);
    return true;
  }

  // ---------------- kullanım kayıtları → sunucu ----------------
  // Hesap VE izin ("evet") varsa gider. Her olayın sıra numarası var (OXLOG.sira); gönderilen son sıra burada
  // (GKEY) ve sunucuda cihaz başına tutulur: cevabı kaybolan parça tekrar gelirse sunucu ikinci kez yazmaz.
  // Hatalar OXLOG'a YAZILMAZ (yoksa kayıt kendini besler); hatadan sonra 30 dk beklenir.
  function kayitIzni() { const v = getJ(IZINK, null); return v === "evet" || v === "hayir" ? v : null; }
  function kayitIzniAyarla(evet) {
    if (evet && kayitIzni() !== "evet") {   // "evet" anından önceki olaylar gönderilmez
      const g = getJ(GKEY, {}) || {}; g.s = Math.max(+g.s || 0, L.sira()); setJ(GKEY, g);
    }
    setJ(IZINK, evet ? "evet" : "hayir");
    log("ayar", { kayit_izni: evet ? 1 : 0 });
  }
  let logIs = null;
  function pushLogs(force) {
    if (!logIs) logIs = sendLogs(!!force).catch(() => false).finally(() => { logIs = null; });
    return logIs;
  }
  async function sendLogs(force) {
    if (!account() || kayitIzni() !== "evet") return false;
    let g = getJ(GKEY, {}) || {};
    if (!force && ((g.hata && ago(g.hata) < 1800000) || ago(g.at) < 120000)) return false;   // hatadan sonra 30 dk, gönderimler arası 2 dk
    const top = L.sira(), ev = L.events(), sent = Math.min(+g.s || 0, top);
    const u = Math.min(top - sent, ev.length);   // gönderilmemişler: tamponun sonundakiler (baştan silinenler gitmiş olabilir)
    if (u <= 0) return 0;
    const list = ev.slice(ev.length - u), first = top - u + 1;
    let i = 0, n = 0;
    while (i < list.length) {
      const part = [];
      let size = 0;
      while (i < list.length && part.length < LOG_PARCA) {
        let e = list[i], b = bytes(JSON.stringify(e));
        if (b > 8000) { e = [e[0], e[1], { kesik: b }]; b = 40; }
        if (part.length && size + b > LOG_BAYT) break;
        part.push(e); size += b + 1; i++;
      }
      const s0 = first + i - part.length;
      try {
        await rpc("push_logs", { p: { kimlik: L.uid(), sira: s0, toplam: top, surum: o.surum || null,
          cihaz: String(o.cihaz || "").slice(0, 300), olaylar: part } });
      } catch (er) {
        g = getJ(GKEY, {}) || {}; g.hata = simdi(); g.m = String((er && er.message) || "").slice(0, 100); setJ(GKEY, g);
        return false;
      }
      n += part.length;
      g = getJ(GKEY, {}) || {}; g.s = s0 + part.length - 1; g.at = simdi(); delete g.hata; delete g.m; setJ(GKEY, g);
    }
    return n;
  }
  // Ayarlar için: gönderilmeyi bekleyen olay sayısı, son gönderim (hesap ya da izin yoksa null).
  function logDurum() {
    if (!account() || kayitIzni() !== "evet") return null;
    const g = getJ(GKEY, {}) || {}, top = L.sira();
    return { bekleyen: Math.max(0, Math.min(top - Math.min(+g.s || 0, top), L.count())), at: g.at || 0, hata: g.hata || 0 };
  }

  // Cevaptan sonra (force: sınav bitti → özet hemen; withBackup: yedek de, 5 dk'da bir).
  let syncTimer = null;
  function syncSoon(force, withBackup) {
    hatirlatSoon();   // bugünün seri hatırlatması kalksın, tekrar sayıları güncellensin
    if (!account()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = zamanla(() => {
      pushStats(!!force).catch((e) => { if (!e.net) log("hesap_hata", { f: "ozet", m: String(e.message).slice(0, 120) }); });
      if (withBackup) pushBackup(false).catch((e) => { if (!e.net) log("hesap_hata", { f: "yedek", m: String(e.message).slice(0, 120) }); });
    }, force ? 300 : 1500);
  }
  // Uygulama açılınca: hatırlatmalar; hesap varsa özet (gerekirse), son gönderimden 10 dk geçtiyse kayıtlar ve
  // arkadaş bildirim ayarları (açılışta bir kez).
  function acilis() {
    hatirlatmaPlanla(false);
    if (!account()) return;
    syncSoon(false, false);
    if (ago((getJ(GKEY, {}) || {}).at) > 600000) pushLogs(false);
    bildirimKur(false);
  }
  // Uygulama arka plana geçince: hatırlatmalar; özet, (değiştiyse) yedek ve yeni kayıtlar.
  function arkaPlan() {
    hatirlatmaPlanla(false);
    if (!account()) return;
    pushStats(false).catch(() => {});
    pushBackup(false).catch(() => {});
    pushLogs(false);
  }

  // ---------------- bildirimler ----------------
  // Açık/kapalı ve saatler ox3000_settings_v1.bildirim'de (ilerleme yedeğiyle yedeklenir); bildirim anahtarı NKEY'de
  // (telefona özel, yedeklenmez). 22:00–08:00 arası native hiç bildirim göstermez. Native sözlerinin hataları yutulur.
  function nget() { const n = getJ(NKEY, {}); return (n && typeof n === "object") ? n : {}; }
  function nset(f) { const n = nget(); f(n); setJ(NKEY, n); return n; }
  function sessiz(p) { try { if (p && p.catch) p.catch(() => {}); } catch (e) {} return p; }
  // Bildirim ayarları (varsayılanlarla). Önceki sürümdeki "arkadaş istekleri kapalı" buraya taşınır.
  function bilAyar() {
    const n = nget();
    if (n.kapali) { if (n.kapali.arkadas) bilAyarYaz({ arkadas: false }); nset((x) => { delete x.kapali; }); }
    const st = getJ(SETK, {}) || {}, b = (st.bildirim && typeof st.bildirim === "object") ? st.bildirim : {}, a = {};
    for (const k in BVAR) a[k] = Object.prototype.hasOwnProperty.call(b, k) ? b[k] : BVAR[k];
    ["seri", "tekrar", "arkadas", "durt"].forEach((k) => { a[k] = a[k] !== false; });
    if (!saatOk(a.seriSaat)) a.seriSaat = BVAR.seriSaat;
    if (!saatOk(a.tekrarSaat)) a.tekrarSaat = BVAR.tekrarSaat;
    return a;
  }
  function bilAyarYaz(p) {
    const st = getJ(SETK, {}) || {}, b = (st.bildirim && typeof st.bildirim === "object") ? st.bildirim : {};
    for (const k in p) b[k] = p[k];
    st.bildirim = b; setJ(SETK, st);
  }

  // ---- arkadaşlık isteği + dürtme (sunucu) ----
  // Uygulamada görülen en yeni istek/dürtme zamanı (sunucunun metni aynen): native tek imleçle ondan yenilerini sorar.
  function sonIstek(d) {
    let m = null;
    ((d && d.incoming) || []).concat((d && d.durtmeler) || []).forEach((r) => {
      if (r && r.at && (!m || Date.parse(r.at) > Date.parse(m))) m = r.at;
    });
    return m;
  }
  let nIs = null;
  // Kur: anahtar yoksa (ya da yeni=true) sunucudan al, native'e ver. Aynı anda tek: sonraki çağrı sıraya girer.
  function bildirimKur(yeni) {
    const run = () => bkur(!!yeni);
    const me = (nIs ? nIs.then(run, run) : run()).catch(() => false);
    nIs = me; me.then(() => { if (nIs === me) nIs = null; });
    return me;
  }
  async function bkur(yeni) {
    if (!B || !account()) return false;
    const a = bilAyar();
    if (!a.arkadas && !a.durt) { sessiz(B.disable()); return false; }   // ikisi de kapalı
    let n = nget();
    if (yeni || !n.anahtar) {
      if (!yeni && n.hata && ago(n.hata) < 1800000) return false;
      let r;
      try { r = await rpc("bildirim_anahtari", {}); }
      catch (e) { nset((x) => { x.hata = simdi(); }); return false; }
      if (!r || !r.anahtar) return false;
      n = nset((x) => { x.anahtar = r.anahtar; delete x.hata; });
    }
    const res = B.configure({ url: URL, key: KEY, secret: n.anahtar, son: sonIstek(cachedDashboard()), arkadas: a.arkadas, durt: a.durt });
    if (res && res.gecersiz) {   // sunucu bu anahtarı artık tanımıyor (hesap taşındı): yenisini al (bir kez)
      nset((x) => { delete x.anahtar; });
      return yeni ? false : bkur(true);
    }
    return true;
  }
  // Hesap açıldı / taşındı / oturum kurtarma koduyla yenilendi: (gerekirse yeni anahtarla) yeniden kur.
  function bildirimHesapDegisti(yeniAnahtar) {
    if (yeniAnahtar) nset((x) => { delete x.anahtar; });
    bildirimKur(!!yeniAnahtar);
  }
  // Uygulamada görülen en yeni istek/dürtme: native aynısını bildirmesin.
  function bildirimGordu(d) {
    const sn = sonIstek(d);
    if (B && sn) { try { B.seen(sn); } catch (e) {} }
  }

  // ---- seri / tekrar hatırlatmaları (yerel) ----
  const ymd = (d) => { const p = (x) => ("0" + x).slice(-2); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
  const saatte = (d, hhmm) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), +hhmm.slice(0, 2), +hhmm.slice(3, 5)).getTime();
  // Çalışılan gün: o gün en az bir sınav cevabı (günlük özette n > 0; stats()'taki seriyle aynı).
  function seriBitis(DL, d) { let n = 0; while (DL[d] && DL[d].n > 0) { n++; d--; } return n; }
  // Önümüzdeki hatırlatmalar — "bundan sonra hiç çalışılmazsa" varsayımıyla (çalışınca plan yeniden kurulur):
  //   seri: o gün çalışılmadıysa, ayarlı saatte; metin o güne kadarki seriye göre.
  //   tekrar: o gün vadesi gelmiş (ya da geçmiş) kelime varsa, ayarlı saatte.
  // Yalnız şu andan sonraki ve en çok 3 gün içindekiler; günde en çok 2 (seri + tekrar).
  function hatirlatmaPlani(now) {
    const a = bilAyar(), T = SRS.today(), R = SRS.records(), DL = SRS.daily(), b = new Date(now), out = [];
    function ekle(tip, gun, at, metin, baslik) {
      if (at > now && at - now <= UFUK) out.push({ id: tip + "-" + gun, tip, gun, at, baslik, metin, hedef: "kartlar.html?exam=1" });
    }
    for (let i = 0; i <= 3; i++) {
      const d = new Date(b.getFullYear(), b.getMonth(), b.getDate() + i), g = T + i, gs = ymd(d);   // g: SRS günü
      if (a.seri && !(DL[g] && DL[g].n > 0)) {
        const sr = seriBitis(DL, g - 1);
        ekle("seri", gs, saatte(d, a.seriSaat), sr >= 1 ? "🔥 " + sr + " günlük serin bozulmasın! Bugün henüz çalışmadın."
          : "📖 Bugün henüz çalışmadın. Birkaç kelimeyle başla!", "Seri hatırlatma");
      }
      if (a.tekrar) {
        let n = 0;
        for (const k in R) if (R[k] && R[k].due <= g) n++;
        if (n > 0) ekle("tekrar", gs, saatte(d, a.tekrarSaat), "📚 Bugün " + n + " kelimenin tekrar zamanı geldi.", "Tekrar zamanı");
      }
    }
    return out.sort((x, y) => x.at - y.at);
  }
  // Planı native'e ver (öncekinin yerine). Değişmediyse 6 saatte bir tazelenir. force: ayar değişti.
  let hatTimer = null;
  function hatirlatmaPlanla(force) {
    if (hatTimer) { clearTimeout(hatTimer); hatTimer = null; }
    if (!B) return false;
    const items = hatirlatmaPlani(simdi()), h = JSON.stringify(items), x = getJ(HKEY, {}) || {};
    if (!force && x.h === h && ago(x.at) < 21600000) return false;
    try { B.planla(items); setJ(HKEY, { h, at: simdi() }); } catch (e) { return false; }
    return true;
  }
  function hatirlatSoon() { if (hatTimer) clearTimeout(hatTimer); hatTimer = zamanla(() => hatirlatmaPlanla(false), 1500); }

  // ---- izin + Ayarlar ----
  // Bildirim izni: hesap açılınca bir kez, karar verilmemişse sorulur (Android 13+).
  async function izinIlk() {
    if (!B || nget().izin) return;
    nset((x) => { x.izin = 1; });
    try {
      const p = B.permission();
      if (p && p.display === "prompt") { const q = await B.requestPermission(); log("bildirim", { a: "izin", d: q && q.display }); }
    } catch (e) {}
  }
  // Ayarlar → "İzin ver": sorulabiliyorsa sor, değilse telefonun bildirim ayarlarını aç.
  async function bildirimIzinIste() {
    if (!B) return null;
    nset((x) => { x.izin = 1; });
    try {
      let d = B.permission().display;
      if (d === "prompt") {
        // Eski uygulamada kalıcı reddedildiyse telefon pencere göstermeden hemen "hayır" der: o zaman ayarları aç.
        const t0 = Date.now(), q = await B.requestPermission();
        d = q && q.display; log("bildirim", { a: "izin", d });
        if (d !== "granted" && Date.now() - t0 < 400) B.openSettings();
      } else if (d !== "granted") B.openSettings();
      return d;
    } catch (e) { return null; }
  }
  // Bildirimlerin gelmesi için gereken izinler, her biri tek dokunuşla: bildirim izni, otomatik başlatma (yalnız
  // uygulamaları kendiliğinden kapatan markalarda). Hesap açılınca bir kez kendiliğinden; Ayarlar'dan her zaman.
  function kurulumDurum() {
    if (!B) return null;
    let c = {}, izin = null;
    const k = getJ(KKEY, {}) || {};
    try { c = B.cihaz() || {}; } catch (e) {}
    try { izin = B.permission().display; } catch (e) {}
    const adim = [{ id: "izin", t: "Bildirim izni", s: "Bildirim gösterebilmesi için.", ok: izin === "granted", btn: "İzin ver" }];
    if (c.otobas) adim.push({ id: "otobas", t: "Otomatik başlatma", s: "Açılan listede Thousand'ı aç.", ok: !!k.otobas, btn: "Aç" });
    return { adim, tamam: adim.every((x) => x.ok), marka: c.marka || "" };
  }
  async function kurulumAdim(id) {
    if (!B) return "";
    try {
      log("kurulum", { a: id });
      if (id === "izin") { await bildirimIzinIste(); return ""; }
      if (id === "otobas") {
        const r = B.otomatikBaslatma(), k = getJ(KKEY, {}) || {};
        k.otobas = 1; setJ(KKEY, k);
        return (r && r.acildi) || "";
      }
    } catch (e) {}
    return "";
  }
  // Kurulum penceresi kendiliğinden bir kez: gösterilecekse işaretler ve true döner.
  function kurulumGosterilsin() {
    const d = kurulumDurum(), k = getJ(KKEY, {}) || {};
    if (!d || k.goster || d.tamam) return false;
    k.goster = 1; setJ(KKEY, k);
    return true;
  }
  // Ayarlar kartı için durum. var: bildirimler bu telefonda var mı (Android); ayar: açık/kapalı + saatler.
  function bildirimDurum() {
    let izin = null;
    if (B) { try { izin = B.permission().display; } catch (e) {} }
    return { var: !!B, hesap: !!account(), izin, ayar: bilAyar() };
  }
  // Ayarlar: bildirim ayarlarından birini değiştir, ör. {seri: false}, {tekrarSaat: "10:30"}, {durt: true}.
  async function bildirimAyarla(p) {
    if (p.seriSaat != null && !saatOk(p.seriSaat)) delete p.seriSaat;
    if (p.tekrarSaat != null && !saatOk(p.tekrarSaat)) delete p.tekrarSaat;
    bilAyarYaz(p);
    log("ayar", { bildirim: p });
    if (!B) return false;
    if ("seri" in p || "tekrar" in p || "seriSaat" in p || "tekrarSaat" in p) hatirlatmaPlanla(true);
    if ("arkadas" in p || "durt" in p) await bildirimKur(false);   // ikisi de kapalıysa kontrol durur
    let acildi = false;
    for (const k in p) if (p[k] === true) acildi = true;
    if (acildi) { try { if (B.permission().display === "prompt") await bildirimIzinIste(); } catch (e) {} }
    return true;
  }

  // ---------------- arkadaşlar ----------------
  async function dashboard() {
    const d = await rpc("dashboard", {});
    if (d) { d.at = simdi(); setJ(PKEY, d); bildirimGordu(d); }
    return d;
  }
  function cachedDashboard() { return getJ(PKEY, null); }
  const sendRequest = (code) => rpc("send_request", { p_code: code });
  const respond = (id, ok) => rpc("respond_request", { p_from: id, p_accept: !!ok });
  const cancel = (id) => rpc("cancel_request", { p_to: id });
  const removeFriend = (id) => rpc("remove_friend", { p_friend: id });
  // Dürt: {ok, msg: gonderildi | bugun_durttun | arkadas_degil, nick?} (günde bir kez, sunucu sınırlar).
  const durt = (id) => rpc("durt", { p_friend: id });

  return {
    account, create, claim, restore, setNick, newRecovery, deleteAccount, karsilastirma,
    stats, todayStr, pushStats, pushBackup, syncSoon, acilis, arkaPlan,
    kayitIzni, kayitIzniAyarla, pushLogs, logDurum,
    dashboard, cachedDashboard, sendRequest, respond, cancel, removeFriend, durt,
    bildirimKur, bildirimDurum, bildirimAyarla, bildirimIzinIste, bildirimAyar: bilAyar, hatirlatmaPlani, hatirlatmaPlanla,
    izinIlk, kurulumDurum, kurulumAdim, kurulumGosterilsin,
  };
}

module.exports = { kur, errText, fmtRec, MSG, saatOk };
