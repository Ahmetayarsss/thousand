/*
 * hesap.js — Hesap ve arkadaşlar (Supabase).
 *
 * Şifre ve e-posta yok: telefon ilk açılışta kendiliğinden (anonim) giriş yapar, kullanıcı
 * takma ad seçer; arkadaş kodu ve kurtarma kodu verilir. Telefon değişince kurtarma koduyla
 * hesap, arkadaşlar ve ilerleme yedeği yeni telefona taşınır.
 * İlerleme özeti (bugün + toplam) dakikada en çok bir kez, yedek arada bir gönderilir.
 * Kullanım kayıtları (log.js) da hesap varsa sunucuya gider (geliştirici için, sessizce).
 * Telefonda (yeni APK) bildirimler (Bildirim eklentisi): arkadaşlık isteği ve dürtme (uygulama kapalıyken de),
 * seri / tekrar hatırlatmaları.
 * Sunucu tarafı: supabase/kurulum.sql — yalnız oradaki fonksiyonlar çağrılır.
 */
window.OXACC = (function () {
  var URL = "https://ezztsktfyangyzrdkszb.supabase.co";
  var KEY = "sb_publishable_vqOeOUAiwe_4K78s_tS0Iw_lhueOwhY";   // herkese açık anahtar (güvenlik sunucudaki kurallarda)
  var SKEY = "ox3000_oturum_v1", AKEY = "ox3000_hesap_v1", YKEY = "ox3000_esitleme_v1", PKEY = "ox3000_pano_v1";
  // Yedeklenen veriler (kayıtlar/log hariç).
  var BKEYS = ["ox3000_srs_v1", "ox3000_daily_v1", "ox3000_sessions_v1", "ox3000_settings_v1",
               "ox3000_exam_batch_v1", "ox3000_cheat_v1"];
  try {   // test için sunucu değiştirme
    var o = JSON.parse(localStorage.getItem("ox3000_api") || "null");
    if (o && o.url) { URL = o.url; KEY = o.key || KEY; }
  } catch (e) {}

  function getJ(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function setJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function log(t, d) { try { if (window.OXLOG) OXLOG.add(t, d); } catch (e) {} }

  // ---------------- bağlantı ----------------
  async function http(path, body, token) {
    var h = { "apikey": KEY, "Content-Type": "application/json" };
    if (token) h.Authorization = "Bearer " + token;
    var res;
    try { res = await fetch(URL + path, { method: "POST", headers: h, body: JSON.stringify(body || {}) }); }
    catch (e) { var ne = new Error("baglanti"); ne.net = true; throw ne; }
    var txt = "";
    try { txt = await res.text(); } catch (e) {}
    var data = null;
    if (txt) { try { data = JSON.parse(txt); } catch (e) { data = txt; } }
    if (!res.ok) {
      var m = (data && typeof data === "object") ? (data.message || data.msg || data.error_description || data.error) : null;
      var er = new Error(m || ("http_" + res.status)); er.status = res.status; er.data = data; throw er;
    }
    return data;
  }

  function saveSess(r) {
    if (!r || !r.access_token) throw new Error("oturum");
    var exp = r.expires_at ? r.expires_at * 1000 : Date.now() + (r.expires_in || 3600) * 1000;
    var s = { at: r.access_token, rt: r.refresh_token, exp: exp, uid: r.user && r.user.id };
    setJ(SKEY, s);
    return s;
  }
  var inflight = null;   // aynı anda tek giriş/yenileme
  function once(fn) {
    if (!inflight) inflight = Promise.resolve().then(fn).finally(function () { inflight = null; });
    return inflight;
  }
  async function signIn() { return saveSess(await http("/auth/v1/signup", { data: {} })); }
  // Oturum geçersizse (ör. çok uzun süre sonra) yeni giriş + kayıtlı kurtarma koduyla hesabı geri al.
  async function renew() {
    var s = getJ(SKEY, null);
    if (s && s.rt) {
      try { return saveSess(await http("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.rt })); }
      catch (e) { if (e.net || e.status === 429 || !(e.status >= 400 && e.status < 500)) throw e; }   // sunucu hatasında yeni giriş yapma
    }
    var ns = await signIn(), a = account();
    if (a && a.recovery) {
      try {
        var cr = await http("/rest/v1/rpc/claim_account", { p_recovery: a.recovery }, ns.at);
        log("hesap", { a: "oturum_yenilendi" });
        if (cr && cr.ok) setTimeout(function () { bildirimHesapDegisti(true); }, 0);   // eski bildirim anahtarı geçersiz oldu
      } catch (e) {}
    }
    return ns;
  }
  async function token(force) {
    var s = getJ(SKEY, null);
    if (!s) return (await once(account() ? renew : signIn)).at;   // hesap var ama oturum yoksa kurtarma koduyla geri al
    if (force || s.exp - Date.now() < 60000) return (await once(renew)).at;
    return s.at;
  }
  async function rpc(fn, args) {
    var t = await token(false);
    try { return await http("/rest/v1/rpc/" + fn, args || {}, t); }
    catch (e) {
      if (e.status === 401) { t = await token(true); return await http("/rest/v1/rpc/" + fn, args || {}, t); }
      throw e;
    }
  }

  // ---------------- hesap ----------------
  function account() { var a = getJ(AKEY, null); return (a && a.code) ? a : null; }
  function fmtRec(r) {
    var x = String(r || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return x.length === 12 ? x.slice(0, 4) + "-" + x.slice(4, 8) + "-" + x.slice(8) : x;
  }
  async function create(nick) {
    var r = await rpc("create_profile", { p_nick: String(nick || "").trim() });
    var old = getJ(AKEY, null) || {};
    var a = { nick: r.nick, code: r.code, recovery: r.recovery || old.recovery || null, at: Date.now() };
    setJ(AKEY, a);
    log("hesap", { a: "olustur" });
    syncSoon(true);
    bildirimHesapDegisti(true);   // yeni hesap: yeni bildirim anahtarı
    return a;
  }
  // Yeni telefonda kurtarma koduyla eski hesabı al; yedek varsa döner (restore ile yazılır).
  async function claim(code) {
    var r = await rpc("claim_account", { p_recovery: code });
    if (!r || !r.ok) return { ok: false };
    var a = { nick: r.nick, code: r.code, recovery: fmtRec(code), at: Date.now() };
    setJ(AKEY, a);
    setJ(YKEY, {});
    bildirimHesapDegisti(true);   // taşınan hesabın eski bildirim anahtarı sunucuda silindi: bu telefona yenisi
    var b = null;
    try { b = await rpc("get_backup", {}); } catch (e) {}
    log("hesap", { a: "kurtar", yedek: b ? 1 : 0 });
    return { ok: true, account: a, backup: b };
  }
  function restore(b) {
    if (!b || !b.keys) return false;
    BKEYS.forEach(function (k) {
      try {
        if (b.keys[k] == null) localStorage.removeItem(k);
        else localStorage.setItem(k, JSON.stringify(b.keys[k]));
      } catch (e) {}
    });
    return true;
  }
  async function setNick(n) {
    var r = await rpc("set_nick", { p_nick: String(n || "").trim() });
    var a = account(); if (a) { a.nick = r.nick; setJ(AKEY, a); }
    return r.nick;
  }
  async function newRecovery() {
    var r = await rpc("new_recovery", {});
    var a = account(); if (a) { a.recovery = r.recovery; setJ(AKEY, a); }
    return r.recovery;
  }
  async function deleteAccount() {
    await rpc("delete_account", {});
    [SKEY, AKEY, YKEY, PKEY].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    log("hesap", { a: "sil" });
    var B = nplug();
    if (B && typeof B.disable === "function") { try { await B.disable(); } catch (e) {} }
    nset(function (x) { delete x.anahtar; delete x.hata; });
  }

  // ---------------- ilerleme özeti + yedek ----------------
  function dayStr(ms) {
    var d = new Date(ms), p = function (n) { return ("0" + n).slice(-2); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function todayStr() { return dayStr(window.SRS ? SRS.now() : Date.now()); }
  function stats() {
    if (!window.SRS) return null;
    var R = SRS.records(), DL = SRS.daily(), T = SRS.today(), e = DL[T] || {}, dongu = 0, olgun = 0;
    for (var k in R) { dongu++; if (R[k] && R[k].b >= 4) olgun++; }
    var seri = 0, d = (DL[T] && DL[T].n > 0) ? T : T - 1;
    while (DL[d] && DL[d].n > 0) { seri++; d--; }
    return { gun: todayStr(), cevap: e.n || 0, dogru: e.ok || 0, yeni: e.nw || 0, dongu: dongu, olgun: olgun, seri: seri };
  }
  function snapshot() {
    var keys = {};
    BKEYS.forEach(function (k) { var v = getJ(k, null); if (v != null) keys[k] = v; });
    return { v: 1, t: Date.now(), keys: keys };
  }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h; }

  // Özet: değiştiyse dakikada en çok bir kez; değişmese de 10 dk'da bir ("son görülme" için).
  async function pushStats(force) {
    if (!account()) return false;
    var st = stats(); if (!st) return false;
    var y = getJ(YKEY, {}) || {}, s = JSON.stringify(st), age = Date.now() - (y.sAt || 0);
    if (!force && (age < 60000 || (y.s === s && age < 600000))) return false;
    await rpc("push_stats", { p: st });
    y = getJ(YKEY, {}) || {}; y.s = s; y.sAt = Date.now(); setJ(YKEY, y);
    return true;
  }
  // Yedek: değiştiyse ve son yedekten 5 dk geçtiyse.
  async function pushBackup(force) {
    if (!account() || !window.SRS) return false;
    var data = snapshot(), h = String(hash(JSON.stringify(data.keys))), y = getJ(YKEY, {}) || {};
    if (y.b === h) return false;
    if (!force && Date.now() - (y.bAt || 0) < 300000) return false;
    await rpc("push_backup", { p: data });
    y = getJ(YKEY, {}) || {}; y.b = h; y.bAt = Date.now(); setJ(YKEY, y);
    return true;
  }
  // ---------------- kullanım kayıtları → sunucu ----------------
  // log.js olayları hesap varsa sunucuya da gider (geliştirici Supabase'de kayitlar_gorunum'den bakar).
  // Her olayın sıra numarası var (OXLOG.sira); gönderilen son sıra burada (GKEY) ve sunucuda cihaz başına
  // tutulur: cevabı kaybolan parça (ör. sayfa değişirken) tekrar gelirse sunucu ikinci kez yazmaz.
  // En çok 500 olayluk parçalar. Hatalar sessizdir ve OXLOG'a YAZILMAZ (yoksa kayıt kendini besler);
  // hata olunca (internet yok, sunucuda fonksiyon henüz yok…) 30 dk sonra yeniden denenir.
  var GKEY = "ox3000_log_gonder_v1", LOG_PARCA = 500, LOG_BAYT = 100000;
  var logIs = null, leaving = false;   // leaving: sayfa değişiyor (bu sırada kopan istek hata sayılmaz)
  try {
    window.addEventListener("beforeunload", function () { leaving = true; setTimeout(function () { leaving = false; }, 5000); });
    window.addEventListener("pagehide", function () { leaving = true; });
    window.addEventListener("pageshow", function () { leaving = false; });
  } catch (e) {}
  function bytes(s) { try { return new TextEncoder().encode(s).length; } catch (e) { return s.length * 2; } }
  function ago(t) { return Math.abs(Date.now() - (t || 0)); }   // saat geri alınsa da takılmasın
  function pushLogs(force) {
    if (!logIs) logIs = sendLogs(!!force).catch(function () { return false; }).finally(function () { logIs = null; });
    return logIs;
  }
  async function sendLogs(force) {
    var L = window.OXLOG;
    if (!account() || !L || typeof L.sira !== "function") return false;
    var g = getJ(GKEY, {}) || {};
    if (!force && ((g.hata && ago(g.hata) < 1800000) || ago(g.at) < 120000)) return false;   // hatadan sonra 30 dk, gönderimler arası 2 dk
    var top = L.sira(), ev = L.events(), sent = Math.min(+g.s || 0, top);
    var u = Math.min(top - sent, ev.length);   // gönderilmemiş olaylar: tamponun sonundakiler (baştan silinenler gitmiş olabilir)
    if (u <= 0) return 0;
    var list = ev.slice(ev.length - u), first = top - u + 1, i = 0, n = 0;
    while (i < list.length) {
      var part = [], size = 0;
      while (i < list.length && part.length < LOG_PARCA) {
        var e = list[i], b = bytes(JSON.stringify(e));
        if (b > 8000) { e = [e[0], e[1], { kesik: b }]; b = 40; }
        if (part.length && size + b > LOG_BAYT) break;
        part.push(e); size += b + 1; i++;
      }
      var s0 = first + i - part.length;
      try {
        await rpc("push_logs", { p: { kimlik: L.uid(), sira: s0, toplam: top, surum: window.OX_WEBVER || null,
          cihaz: String(navigator.userAgent || "").slice(0, 300), olaylar: part } });
      } catch (er) {
        if (!leaving) { g = getJ(GKEY, {}) || {}; g.hata = Date.now(); g.m = String((er && er.message) || "").slice(0, 100); setJ(GKEY, g); }
        return false;
      }
      n += part.length;
      g = getJ(GKEY, {}) || {}; g.s = s0 + part.length - 1; g.at = Date.now(); delete g.hata; delete g.m; setJ(GKEY, g);
    }
    return n;
  }
  // Ayarlar için: gönderilmeyi bekleyen olay sayısı, son gönderim (hesap yoksa null).
  function logDurum() {
    var L = window.OXLOG;
    if (!account() || !L || typeof L.sira !== "function") return null;
    var g = getJ(GKEY, {}) || {}, top = L.sira();
    return { bekleyen: Math.max(0, Math.min(top - Math.min(+g.s || 0, top), L.count())), at: g.at || 0, hata: g.hata || 0 };
  }

  var syncTimer = 0;
  function syncSoon(force, withBackup) {
    hatirlatSoon();   // sınav cevabından sonra: bugünün seri hatırlatması kalksın, tekrar sayıları güncellensin
    if (!account()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      pushStats(!!force).catch(function (e) { if (!e.net) log("hesap_hata", { f: "ozet", m: String(e.message).slice(0, 120) }); });
      if (withBackup) pushBackup(false).catch(function (e) { if (!e.net) log("hesap_hata", { f: "yedek", m: String(e.message).slice(0, 120) }); });
    }, force ? 300 : 1500);
  }
  // Uygulama arka plana geçince (ya da sayfa değişince): hatırlatmaları yeniden kur; özeti, (değiştiyse) yedeği
  // ve yeni kayıtları gönder.
  try {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) return;
      hatirlatmaPlanla(false);
      if (account()) {
        pushStats(false).catch(function () {});
        pushBackup(false).catch(function () {});
        if (!leaving) pushLogs(false);   // sayfa değişirken değil: yeni sayfa açılınca gerekirse gönderir
      }
    });
  } catch (e) {}

  // ---------------- bildirimler ----------------
  // Native Bildirim eklentisi (yeni APK) iki iş yapar:
  //  1) Arkadaşlık isteği ve dürtme: arka planda ~15 dk'da bir sunucuya sorar (WorkManager; uygulama kapalıyken de).
  //     Uygulamanın oturumu (JWT) yerine hesaba özel bir bildirim anahtarı kullanılır: bildirim_anahtari ile
  //     alınır, burada saklanır, configure ile native'e verilir.
  //  2) Seri / tekrar hatırlatmaları (yerel, hesap gerekmez): içerikleri burada önümüzdeki en çok 3 gün için
  //     hesaplanır, planla ile native'e verilir; uygulama açılınca, her sınav cevabında (syncSoon) ve arka plana
  //     geçerken yeniden kurulur. Uygulama 3 gün açılmazsa hatırlatmalar biter.
  // 22:00–08:00 arası native hiç bildirim göstermez (arkadaş bildirimleri sabaha kalır). Tarayıcıda, eski APK'da,
  // internet yokken ya da sunucuda fonksiyon henüz yokken her şey sessizce atlanır (hata olursa 30 dk sonra,
  // sonraki açılışta yeniden denenir). Açık/kapalı ve saatler ox3000_settings_v1.bildirim'de: ilerleme
  // yedeğiyle birlikte yedeklenir (bildirim anahtarı yedeklenmez; telefona özeldir).
  var NKEY = "ox3000_bildirim_v1";   // bu telefona özel: {anahtar, izin: 1 (bir kez soruldu), hata: ms}
  var SETK = "ox3000_settings_v1", HKEY = "ox3000_hatirlatma_v1";   // HKEY: native'e son verilen plan {h, at}
  var BVAR = { seri: true, seriSaat: "20:00", tekrar: true, tekrarSaat: "09:00", arkadas: true, durt: true };
  function nativeMi() { try { var C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); } catch (e) { return false; } }
  function nplug() { try { return (nativeMi() && window.Capacitor.Plugins && window.Capacitor.Plugins.Bildirim) || null; } catch (e) { return null; } }
  function nget() { var n = getJ(NKEY, {}); return (n && typeof n === "object") ? n : {}; }
  function nset(f) { var n = nget(); f(n); setJ(NKEY, n); return n; }
  function nflag(v) { try { if (v) sessionStorage.setItem("oxbil_kur", "1"); else sessionStorage.removeItem("oxbil_kur"); } catch (e) {} }
  function sessiz(p) { try { if (p && p.catch) p.catch(function () {}); } catch (e) {} return p; }   // native sözü: hata yutulur
  // Saat "SS:DD", 08:00–21:59 (22:00–08:00 sessiz saatler).
  function saatOk(v) { return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) && v >= "08:00" && v < "22:00"; }
  // Bildirim ayarları (varsayılanlarla). Önceki sürümdeki "arkadaş istekleri kapalı" buraya taşınır.
  function bilAyar() {
    var n = nget();
    if (n.kapali) { if (n.kapali.arkadas) bilAyarYaz({ arkadas: false }); nset(function (x) { delete x.kapali; }); }
    var s = getJ(SETK, {}) || {}, b = (s.bildirim && typeof s.bildirim === "object") ? s.bildirim : {}, o = {};
    for (var k in BVAR) o[k] = Object.prototype.hasOwnProperty.call(b, k) ? b[k] : BVAR[k];
    ["seri", "tekrar", "arkadas", "durt"].forEach(function (k) { o[k] = o[k] !== false; });
    if (!saatOk(o.seriSaat)) o.seriSaat = BVAR.seriSaat;
    if (!saatOk(o.tekrarSaat)) o.tekrarSaat = BVAR.tekrarSaat;
    return o;
  }
  function bilAyarYaz(p) {
    var s = getJ(SETK, {}) || {}, b = (s.bildirim && typeof s.bildirim === "object") ? s.bildirim : {};
    for (var k in p) b[k] = p[k];
    s.bildirim = b; setJ(SETK, s);
  }

  // ---- arkadaşlık isteği + dürtme (sunucu) ----
  // Uygulamada görülen en yeni istek/dürtme zamanı (sunucunun metni aynen): native tek imleçle ondan yenilerini sorar.
  function sonIstek(d) {
    var m = null;
    ((d && d.incoming) || []).concat((d && d.durtmeler) || []).forEach(function (r) {
      if (r && r.at && (!m || Date.parse(r.at) > Date.parse(m))) m = r.at;
    });
    return m;
  }
  var nIs = null;
  // Kur: anahtar yoksa (ya da yeni=true) sunucudan al, native'e ver. Aynı anda tek: sonraki çağrı sıraya girer.
  function bildirimKur(yeni) {
    var run = function () { return kur(!!yeni); };
    var me = (nIs ? nIs.then(run, run) : run()).catch(function () { return false; });
    nIs = me; me.then(function () { if (nIs === me) nIs = null; });
    return me;
  }
  async function kur(yeni) {
    var B = nplug();
    if (!B || typeof B.configure !== "function" || !account()) return false;
    var a = bilAyar();
    if (!a.arkadas && !a.durt) { sessiz(B.disable()); nflag(true); return false; }   // ikisi de kapalı
    var n = nget();
    if (yeni || !n.anahtar) {
      if (!yeni && n.hata && ago(n.hata) < 1800000) return false;
      var r;
      try { r = await rpc("bildirim_anahtari", {}); }
      catch (e) { nset(function (x) { x.hata = Date.now(); }); return false; }   // ör. kurulum.sql henüz çalıştırılmadı
      if (!r || !r.anahtar) return false;
      n = nset(function (x) { x.anahtar = r.anahtar; delete x.hata; });
    }
    var res = await B.configure({ url: URL, key: KEY, secret: n.anahtar, son: sonIstek(cachedDashboard()), arkadas: a.arkadas, durt: a.durt });
    if (res && res.gecersiz) {   // sunucu bu anahtarı artık tanımıyor (hesap taşındı): yenisini al (bir kez)
      nset(function (x) { delete x.anahtar; });
      return yeni ? false : kur(true);
    }
    nflag(true);
    return true;
  }
  // Hesap açıldı / taşındı / oturum kurtarma koduyla yenilendi: (gerekirse yeni anahtarla) yeniden kur.
  function bildirimHesapDegisti(yeniAnahtar) {
    if (yeniAnahtar) nset(function (x) { delete x.anahtar; });
    nflag(false);
    bildirimKur(!!yeniAnahtar);
  }
  // Uygulamada görülen en yeni istek/dürtme: native aynısını bildirmesin.
  function bildirimGordu(d) {
    var B = nplug(), s = sonIstek(d);
    if (B && s && typeof B.seen === "function") { try { sessiz(B.seen({ son: s })); } catch (e) {} }
  }

  // ---- seri / tekrar hatırlatmaları (yerel) ----
  var GUN = 86400000, UFUK = 3 * GUN, hatTimer = 0;   // en çok 3 gün sonrası planlanır
  function ymd(d) { var p = function (x) { return ("0" + x).slice(-2); }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function saatte(d, hhmm) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), +hhmm.slice(0, 2), +hhmm.slice(3, 5)).getTime(); }
  // Çalışılan gün: o gün en az bir sınav cevabı (günlük özette n > 0; hesap.js stats()'taki seriyle aynı).
  function seriBitis(DL, d) { var n = 0; while (DL[d] && DL[d].n > 0) { n++; d--; } return n; }
  // Önümüzdeki hatırlatmalar — "bundan sonra hiç çalışılmazsa" varsayımıyla (çalışınca plan yeniden kurulur):
  //   seri: o gün çalışılmadıysa, ayarlı saatte; metin o güne kadarki seriye göre.
  //   tekrar: o gün vadesi gelmiş (ya da geçmiş) kelime varsa, ayarlı saatte.
  // Yalnız şu andan sonraki ve en çok 3 gün içindekiler; günde en çok 2 (seri + tekrar).
  function hatirlatmaPlani(now) {
    if (!window.SRS) return null;
    var a = bilAyar(), T = SRS.today(), R = SRS.records(), DL = SRS.daily(), b = new Date(now), out = [];
    function ekle(tip, gun, at, metin, baslik) {
      if (at > now && at - now <= UFUK) out.push({ id: tip + "-" + gun, tip: tip, gun: gun, at: at, baslik: baslik, metin: metin, hedef: "kartlar.html?exam=1" });
    }
    for (var i = 0; i <= 3; i++) {
      var d = new Date(b.getFullYear(), b.getMonth(), b.getDate() + i), g = T + i, gs = ymd(d);   // g: SRS günü
      if (a.seri && !(DL[g] && DL[g].n > 0)) {
        var s = seriBitis(DL, g - 1);
        ekle("seri", gs, saatte(d, a.seriSaat), s >= 1 ? "🔥 " + s + " günlük serin bozulmasın! Bugün henüz çalışmadın."
          : "📖 Bugün henüz çalışmadın. Birkaç kelimeyle başla!", "Seri hatırlatma");
      }
      if (a.tekrar) {
        var n = 0;
        for (var k in R) if (R[k] && R[k].due <= g) n++;
        if (n > 0) ekle("tekrar", gs, saatte(d, a.tekrarSaat), "📚 Bugün " + n + " kelimenin tekrar zamanı geldi.", "Tekrar zamanı");
      }
    }
    return out.sort(function (x, y) { return x.at - y.at; });
  }
  // Planı native'e ver (öncekinin yerine). Değişmediyse 6 saatte bir tazelenir. force: ayar değişti.
  function hatirlatmaPlanla(force) {
    clearTimeout(hatTimer);
    var B = nplug();
    if (!B || typeof B.planla !== "function") return false;
    var items = hatirlatmaPlani(Date.now());
    if (!items) return false;
    var h = JSON.stringify(items), o = getJ(HKEY, {}) || {};
    if (!force && o.h === h && ago(o.at) < 21600000) return false;
    try {
      var p = B.planla({ items: items });
      if (p && p.then) p.then(function () { setJ(HKEY, { h: h, at: Date.now() }); }, function () {});
    } catch (e) { return false; }
    return true;
  }
  function hatirlatSoon() { clearTimeout(hatTimer); hatTimer = setTimeout(function () { hatirlatmaPlanla(false); }, 1500); }

  // ---- izin + Ayarlar ----
  // Bildirim izni: hesap açılınca bir kez, karar verilmemişse sorulur (Android 13+).
  async function izinIlk() {
    var B = nplug();
    if (!B || typeof B.permission !== "function" || nget().izin) return;
    nset(function (x) { x.izin = 1; });
    try {
      var p = await B.permission();
      if (p && p.display === "prompt") { var q = await B.requestPermission(); log("bildirim", { a: "izin", d: q && q.display }); }
    } catch (e) {}
  }
  // Ayarlar → "İzin ver": sorulabiliyorsa sor, değilse telefonun bildirim ayarlarını aç.
  async function bildirimIzinIste() {
    var B = nplug();
    if (!B || typeof B.permission !== "function") return null;
    nset(function (x) { x.izin = 1; });
    try {
      var p = await B.permission(), d = p && p.display;
      if (d === "prompt") { var q = await B.requestPermission(); d = q && q.display; log("bildirim", { a: "izin", d: d }); }
      else if (d !== "granted" && typeof B.openSettings === "function") await B.openSettings();
      return d;
    } catch (e) { return null; }
  }
  // ---- bildirim kurulumu (telefon ayarları) ----
  // Bildirimlerin zamanında gelmesi için gereken izinler, her biri tek dokunuşla: bildirim izni, arka planda
  // çalışma (pil), otomatik başlatma (yalnız uygulamaları kendiliğinden kapatan markalarda: Xiaomi, Huawei, Oppo…).
  // Hesap açılınca ve ana sayfada bir kez kendiliğinden çıkar; Ayarlar → Bildirimler'den her zaman açılır.
  var KKEY = "ox3000_kurulum_v1";   // {goster: 1 (kendiliğinden bir kez gösterildi), otobas: 1 (ekranı açıldı → yapıldı sayılır)}
  async function kurulumDurum() {
    var B = nplug();
    if (!B || typeof B.cihaz !== "function") return null;   // tarayıcı ya da eski APK
    var c = {}, izin = null, k = getJ(KKEY, {}) || {};
    try { c = (await B.cihaz()) || {}; } catch (e) {}
    try { var p = await B.permission(); izin = p && p.display; } catch (e) {}
    var adim = [{ id: "izin", t: "Bildirim izni", s: "Bildirim gösterebilmesi için.", ok: izin === "granted", btn: "İzin ver" }];
    if ((c.sdk || 0) >= 23) adim.push({ id: "pil", t: "Arka planda çalışma", s: "Uygulama kapalıyken de hatırlatabilmesi için.", ok: !!c.pil, btn: "İzin ver" });
    if (c.otobas) adim.push({ id: "otobas", t: "Otomatik başlatma", s: "Açılan listede Oxford 3000'i aç.", ok: !!k.otobas, btn: "Aç" });
    return { adim: adim, tamam: adim.every(function (a) { return a.ok; }), marka: c.marka || "" };
  }
  async function kurulumAdim(id) {
    var B = nplug();
    if (!B) return "";
    try {
      log("kurulum", { a: id });
      if (id === "izin") { await bildirimIzinIste(); return ""; }
      if (id === "pil") { await B.pilIzni(); return ""; }
      if (id === "otobas") {
        var r = await B.otomatikBaslatma(), k = getJ(KKEY, {}) || {};
        k.otobas = 1; setJ(KKEY, k);
        return (r && r.acildi) || "";
      }
    } catch (e) {}
    return "";
  }
  var kurAcik = false;
  // force: Ayarlar'dan açılınca. Değilse yalnız bir kez ve eksik adım varsa gösterir. Gösterildiyse true döner.
  async function kurulum(force, done) {
    var d = await kurulumDurum(), k = getJ(KKEY, {}) || {};
    if (!d || kurAcik || (!force && (k.goster || d.tamam))) return false;
    k.goster = 1; setJ(KKEY, k);
    kurAcik = true;
    var not = "";
    function bitir() { kurAcik = false; document.removeEventListener("visibilitychange", vis); close(); if (done) done(); }
    function ciz(d) {
      var b = el('<h2>Bildirimleri ayarla 🔔</h2><p>Hatırlatmalar ve dürtmeler zamanında gelsin diye telefonunda ' +
        (d.adim.length > 1 ? d.adim.length + ' küçük izin' : 'bir izin') + ' gerekiyor. Her biri tek dokunuş.</p>' +
        d.adim.map(function (a, i) {
          return '<div class="kst' + (a.ok ? ' ok' : '') + '"><span class="kn">' + (a.ok ? "✓" : (i + 1)) + '</span>' +
            '<div class="kt"><b>' + a.t + '</b><small>' + a.s + '</small></div>' +
            (a.ok ? '<span class="kok">Tamam</span>' : '<button data-k="' + a.id + '">' + a.btn + '</button>') + '</div>';
        }).join('') + (not ? '<p class="knot">' + not + '</p>' : '') +
        '<button id="oxok">' + (d.tamam ? "Bitti" : "Sonra") + '</button>');
      b.querySelectorAll("[data-k]").forEach(function (x) {
        x.onclick = async function () {
          x.disabled = true;
          var r = await kurulumAdim(x.dataset.k);
          if (x.dataset.k === "otobas") not = r === "otobas" ? "" :
            (r === "uygulama" ? "Açılan sayfada “Otomatik başlatma”yı bulup aç." : "Bu telefonda otomatik başlatma ayarı bulunamadı; gerekmeyebilir.");
          yenile();
        };
      });
      b.querySelector("#oxok").onclick = bitir;
    }
    async function yenile() { if (!kurAcik) return; var n = await kurulumDurum(); if (n && kurAcik) ciz(n); }
    function vis() { if (!document.hidden) setTimeout(yenile, 400); }   // telefonun ayarlarından dönünce
    document.addEventListener("visibilitychange", vis);
    ciz(d);
    log("kurulum", { a: "goster", tamam: d.tamam ? 1 : 0 });
    return true;
  }
  // Ayarlar kartı için durum. native: telefonda mı; var: eklenti yeni APK'daki gibi mi; ayar: açık/kapalı + saatler.
  async function bildirimDurum() {
    var B = nplug(), izin = null;
    if (B && typeof B.permission === "function") { try { var p = await B.permission(); izin = p && p.display; } catch (e) {} }
    return { native: nativeMi(), var: !!(B && typeof B.planla === "function"), hesap: !!account(), izin: izin, ayar: bilAyar() };
  }
  // Ayarlar: bildirim ayarlarından birini değiştir, ör. {seri: false}, {tekrarSaat: "10:30"}, {durt: true}.
  async function bildirimAyarla(p) {
    if (p.seriSaat != null && !saatOk(p.seriSaat)) delete p.seriSaat;
    if (p.tekrarSaat != null && !saatOk(p.tekrarSaat)) delete p.tekrarSaat;
    bilAyarYaz(p);
    log("ayar", { bildirim: p });
    var B = nplug();
    if (!B) return false;
    if ("seri" in p || "tekrar" in p || "seriSaat" in p || "tekrarSaat" in p) hatirlatmaPlanla(true);
    if ("arkadas" in p || "durt" in p) await bildirimKur(false);   // ikisi de kapalıysa kontrol durur
    var acildi = false;
    for (var k in p) if (p[k] === true) acildi = true;
    if (acildi) { try { var q = await B.permission(); if (q && q.display === "prompt") await bildirimIzinIste(); } catch (e) {} }
    return true;
  }

  // ---------------- arkadaşlar ----------------
  async function dashboard() {
    var d = await rpc("dashboard", {});
    if (d) { d.at = Date.now(); setJ(PKEY, d); bildirimGordu(d); }
    return d;
  }
  function cachedDashboard() { return getJ(PKEY, null); }
  async function sendRequest(code) { return rpc("send_request", { p_code: code }); }
  async function respond(id, ok) { return rpc("respond_request", { p_from: id, p_accept: !!ok }); }
  async function cancel(id) { return rpc("cancel_request", { p_to: id }); }
  async function removeFriend(id) { return rpc("remove_friend", { p_friend: id }); }
  // Dürt: {ok, msg: gonderildi | bugun_durttun | arkadas_degil, nick?} (günde bir kez, sunucu sınırlar).
  async function durt(id) { return rpc("durt", { p_friend: id }); }

  var MSG = {
    baglanti: "İnternet bağlantısı yok.", giris_yok: "Giriş yapılamadı, tekrar dene.", profil_yok: "Hesap bulunamadı (başka telefona taşınmış olabilir).",
    ad_uzunluk: "Takma ad 3–16 karakter olmalı.", kod_yok: "Bu kodla bir kullanıcı yok.", kendin: "Bu senin kodun 🙂",
    zaten_arkadas: "Zaten arkadaşsınız.", cok_istek: "Çok fazla bekleyen isteğin var.", gecersiz: "Geçersiz veri."
  };
  function errText(e) {
    var m = e && e.message ? String(e.message) : "";
    if (e && e.net) return MSG.baglanti;
    if (MSG[m]) return MSG[m];
    if (/anonymous/i.test(m)) return "Sunucuda misafir girişi kapalı.";
    return "Bir hata oldu" + (m ? " (" + m.slice(0, 80) + ")" : "") + ".";
  }

  // ---------------- karşılama (ilk açılış) ----------------
  var CSS = ".oxacc{position:fixed;inset:0;z-index:100000;background:rgba(20,27,38,.55);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
    ".oxacc .bx{width:100%;max-width:400px;background:#fff;border-radius:20px;padding:22px 20px;box-shadow:0 18px 50px rgba(0,0,0,.3);color:#1B2430}" +
    ".oxacc h2{margin:0 0 6px;font-size:22px;font-weight:800}.oxacc p{margin:0 0 14px;color:#5B6B7B;font-size:14px;line-height:1.45}" +
    ".oxacc input{width:100%;box-sizing:border-box;border:2px solid #E6EAF1;border-radius:12px;padding:12px 14px;font-size:17px;font-weight:700;outline:none;font-family:inherit}" +
    ".oxacc input:focus{border-color:#3B6EA5}.oxacc .err{color:#D9544D;font-size:13px;font-weight:700;min-height:18px;margin:8px 0 2px}" +
    ".oxacc button{width:100%;border:0;border-radius:12px;padding:14px 0;font-size:16px;font-weight:800;cursor:pointer;background:#1B2430;color:#fff;margin-top:6px}" +
    ".oxacc button.ghost{background:#F4F6F9;color:#1B2430}.oxacc button:disabled{opacity:.6}" +
    ".oxacc .lnk{display:block;text-align:center;margin-top:14px;color:#3B6EA5;font-weight:700;font-size:14px;cursor:pointer}" +
    ".oxacc .code{font-size:30px;font-weight:900;letter-spacing:4px;text-align:center;background:#F4F6F9;border-radius:12px;padding:12px 0;margin:4px 0 12px}" +
    ".oxacc .rec{font-size:21px;letter-spacing:2px;background:#FFF6DD;border:2px dashed #E2C463}" +
    ".oxacc .kst{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid #E6EAF1}" +
    ".oxacc .kn{flex:0 0 28px;height:28px;border-radius:50%;background:#E9EDF3;color:#1B2430;font-weight:900;font-size:14px;display:flex;align-items:center;justify-content:center}" +
    ".oxacc .kst.ok .kn{background:#2E9E5B;color:#fff}.oxacc .kt{flex:1;min-width:0;text-align:left}" +
    ".oxacc .kt b{display:block;font-size:15px}.oxacc .kt small{display:block;color:#7A8699;font-size:12.5px;margin-top:2px;line-height:1.35}" +
    ".oxacc .kst button{width:auto;flex:0 0 auto;margin:0;padding:10px 14px;font-size:14px;border-radius:10px;background:#3B6EA5}" +
    ".oxacc .kok{color:#2E9E5B;font-weight:800;font-size:13px}.oxacc .knot{margin:8px 0 0;color:#B8902C;font-size:13px;font-weight:700}" +
    ".oxacc .lbl{font-size:12px;font-weight:800;color:#7A8699;text-transform:uppercase;letter-spacing:.04em}";
  var box = null;
  function el(html) {
    if (!document.getElementById("oxacc-css")) { var st = document.createElement("style"); st.id = "oxacc-css"; st.textContent = CSS; document.head.appendChild(st); }
    if (!box) { box = document.createElement("div"); box.className = "oxacc"; document.body.appendChild(box); }
    box.innerHTML = '<div class="bx">' + html + "</div>";
    return box;
  }
  function close() { if (box) { box.remove(); box = null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // force: Ayarlar/Arkadaşlar'dan açılınca ("sonra" seçilmiş olsa da göster).
  function onboard(force, done) {
    if (account()) { if (done) done(account()); return; }
    try { if (!force && sessionStorage.getItem("oxacc_sonra")) return; } catch (e) {}
    stepNick(done);
  }
  function stepNick(done) {
    var b = el('<h2>Hoş geldin! 👋</h2><p>Arkadaşlarının göreceği bir takma ad seç.</p>' +
      '<input id="oxn" maxlength="16" placeholder="Takma ad (3–16 karakter)" autocomplete="off">' +
      '<div class="err" id="oxe"></div><button id="oxgo">Başla</button>' +
      '<button class="ghost" id="oxlater">Sonra</button>' +
      '<span class="lnk" id="oxhas">Hesabım var → kurtarma kodu gir</span>');
    var inp = b.querySelector("#oxn"), go = b.querySelector("#oxgo"), er = b.querySelector("#oxe");
    function submit() {
      var n = inp.value.trim();
      if (n.length < 3 || n.length > 16) { er.textContent = MSG.ad_uzunluk; return; }
      go.disabled = true; go.textContent = "Hesap açılıyor…"; er.textContent = "";
      create(n).then(function (a) { stepCodes(a, done); })
        .catch(function (e) { go.disabled = false; go.textContent = "Tekrar dene"; er.textContent = errText(e); log("hesap_hata", { f: "olustur", m: String(e.message).slice(0, 120) }); });
    }
    go.onclick = submit;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    b.querySelector("#oxlater").onclick = function () { try { sessionStorage.setItem("oxacc_sonra", "1"); } catch (e) {} close(); };
    b.querySelector("#oxhas").onclick = function () { stepRecover(done); };
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 50);
  }
  function stepCodes(a, done) {
    var b = el('<h2>Hesabın hazır 🎉</h2>' +
      '<div class="lbl">Arkadaş kodun</div><div class="code">' + esc(a.code) + '</div>' +
      '<div class="lbl">Kurtarma kodun</div><div class="code rec">' + esc(a.recovery || "—") + '</div>' +
      '<p>Telefonunu değiştirirsen hesabını, arkadaşlarını ve ilerlemeni bu kodla geri alırsın. ' +
      '<b>Ekran görüntüsü al</b> ya da bir yere yaz. Ayarlar\'da da görebilirsin.</p>' +
      '<button id="oxok">Kaydettim</button>');
    b.querySelector("#oxok").onclick = function () {
      close(); if (done) done(a);
      kurulum(false).then(function (g) { if (!g) izinIlk(); }, function () { izinIlk(); });
    };
  }
  function stepRecover(done) {
    var b = el('<h2>Hesabını geri al</h2><p>Kurtarma kodunu yaz (ör. ABCD-EFGH-JKLM).</p>' +
      '<input id="oxr" maxlength="16" placeholder="XXXX-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase">' +
      '<div class="err" id="oxe"></div><button id="oxgo">Hesabımı getir</button>' +
      '<span class="lnk" id="oxback">← Yeni hesap aç</span>');
    var inp = b.querySelector("#oxr"), go = b.querySelector("#oxgo"), er = b.querySelector("#oxe");
    function submit() {
      var c = inp.value.replace(/[^A-Za-z0-9]/g, "");
      if (c.length !== 12) { er.textContent = "Kurtarma kodu 12 harf/rakam olmalı."; return; }
      go.disabled = true; go.textContent = "Aranıyor…"; er.textContent = "";
      claim(c).then(function (r) {
        if (!r.ok) { go.disabled = false; go.textContent = "Hesabımı getir"; er.textContent = "Bu kurtarma koduyla bir hesap bulunamadı."; return; }
        var hasLocal = window.SRS && Object.keys(SRS.records()).length > 0;
        if (r.backup && (!hasLocal || confirm("Yedekteki ilerleme bu telefondakinin yerine yüklensin mi?"))) restore(r.backup);
        el('<h2>Tekrar hoş geldin, ' + esc(r.account.nick) + '!</h2><p>' +
          (r.backup ? "Hesabın, arkadaşların ve ilerlemen geri geldi." : "Hesabın ve arkadaşların geri geldi.") +
          '</p><button id="oxok">Devam</button>').querySelector("#oxok").onclick = function () {
          close();
          if (r.backup) { try { sessionStorage.setItem("oxbil_izin", "1"); } catch (e) {} location.reload(); }   // izin yenilenen sayfada sorulur
          else { izinIlk(); if (done) done(r.account); }
        };
      }).catch(function (e) { go.disabled = false; go.textContent = "Tekrar dene"; er.textContent = errText(e); });
    }
    go.onclick = submit;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    b.querySelector("#oxback").onclick = function () { stepNick(done); };
  }
  function askRecover(done) { stepRecover(done); }

  // Sayfa açılınca: hatırlatmaları kur; hesap varsa özeti (gerekirse), son gönderimden 10 dk geçtiyse kayıtları
  // gönder; arkadaş bildirim ayarlarını uygulama açılışında (oturum başına) bir kez native'e ver.
  try {
    setTimeout(function () {
      hatirlatmaPlanla(false);
      if (!account()) return;
      syncSoon(false, false);
      if (ago((getJ(GKEY, {}) || {}).at) > 600000) pushLogs(false);
      var kurulu = false; try { kurulu = !!sessionStorage.getItem("oxbil_kur"); } catch (e) {}
      if (!kurulu) bildirimKur(false);
      var izin = false; try { izin = !!sessionStorage.getItem("oxbil_izin"); sessionStorage.removeItem("oxbil_izin"); } catch (e) {}
      if (izin) izinIlk();
    }, 2000);
  } catch (e) {}

  return {
    account: account, onboard: onboard, askRecover: askRecover, close: close,
    create: create, claim: claim, restore: restore, setNick: setNick, newRecovery: newRecovery, deleteAccount: deleteAccount,
    stats: stats, todayStr: todayStr, pushStats: pushStats, pushBackup: pushBackup, syncSoon: syncSoon,
    pushLogs: pushLogs, logDurum: logDurum,
    bildirimKur: bildirimKur, bildirimDurum: bildirimDurum, bildirimAyarla: bildirimAyarla, bildirimIzinIste: bildirimIzinIste,
    bildirimAyar: bilAyar, hatirlatmaPlani: hatirlatmaPlani, hatirlatmaPlanla: hatirlatmaPlanla, durt: durt,
    kurulum: kurulum, kurulumDurum: kurulumDurum,
    dashboard: dashboard, cachedDashboard: cachedDashboard, sendRequest: sendRequest, respond: respond,
    cancel: cancel, removeFriend: removeFriend, errText: errText, esc: esc, fmtRec: fmtRec
  };
})();
