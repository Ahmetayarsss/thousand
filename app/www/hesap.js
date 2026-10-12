/*
 * hesap.js — Hesap ve arkadaşlar (Supabase).
 *
 * Şifre ve e-posta yok: telefon ilk açılışta kendiliğinden (anonim) giriş yapar, kullanıcı
 * takma ad seçer; arkadaş kodu ve kurtarma kodu verilir. Telefon değişince kurtarma koduyla
 * hesap, arkadaşlar ve ilerleme yedeği yeni telefona taşınır.
 * İlerleme özeti (bugün + toplam) dakikada en çok bir kez, yedek arada bir gönderilir.
 * Kullanım kayıtları (log.js) da hesap varsa sunucuya gider (geliştirici için, sessizce).
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
      try { await http("/rest/v1/rpc/claim_account", { p_recovery: a.recovery }, ns.at); log("hesap", { a: "oturum_yenilendi" }); } catch (e) {}
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
    return a;
  }
  // Yeni telefonda kurtarma koduyla eski hesabı al; yedek varsa döner (restore ile yazılır).
  async function claim(code) {
    var r = await rpc("claim_account", { p_recovery: code });
    if (!r || !r.ok) return { ok: false };
    var a = { nick: r.nick, code: r.code, recovery: fmtRec(code), at: Date.now() };
    setJ(AKEY, a);
    setJ(YKEY, {});
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
    if (!account()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      pushStats(!!force).catch(function (e) { if (!e.net) log("hesap_hata", { f: "ozet", m: String(e.message).slice(0, 120) }); });
      if (withBackup) pushBackup(false).catch(function (e) { if (!e.net) log("hesap_hata", { f: "yedek", m: String(e.message).slice(0, 120) }); });
    }, force ? 300 : 1500);
  }
  // Uygulama arka plana geçince (ya da sayfa değişince): özeti, (değiştiyse) yedeği ve yeni kayıtları gönder.
  try {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && account()) {
        pushStats(false).catch(function () {});
        pushBackup(false).catch(function () {});
        if (!leaving) pushLogs(false);   // sayfa değişirken değil: yeni sayfa açılınca gerekirse gönderir
      }
    });
  } catch (e) {}

  // ---------------- arkadaşlar ----------------
  async function dashboard() {
    var d = await rpc("dashboard", {});
    if (d) { d.at = Date.now(); setJ(PKEY, d); }
    return d;
  }
  function cachedDashboard() { return getJ(PKEY, null); }
  async function sendRequest(code) { return rpc("send_request", { p_code: code }); }
  async function respond(id, ok) { return rpc("respond_request", { p_from: id, p_accept: !!ok }); }
  async function cancel(id) { return rpc("cancel_request", { p_to: id }); }
  async function removeFriend(id) { return rpc("remove_friend", { p_friend: id }); }

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
    b.querySelector("#oxok").onclick = function () { close(); if (done) done(a); };
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
          close(); if (r.backup) location.reload(); else if (done) done(r.account);
        };
      }).catch(function (e) { go.disabled = false; go.textContent = "Tekrar dene"; er.textContent = errText(e); });
    }
    go.onclick = submit;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    b.querySelector("#oxback").onclick = function () { stepNick(done); };
  }
  function askRecover(done) { stepRecover(done); }

  // Sayfa açılınca: hesap varsa özeti (gerekirse), son gönderimden 10 dk geçtiyse kayıtları gönder.
  try {
    setTimeout(function () {
      if (!account()) return;
      syncSoon(false, false);
      if (ago((getJ(GKEY, {}) || {}).at) > 600000) pushLogs(false);
    }, 2000);
  } catch (e) {}

  return {
    account: account, onboard: onboard, askRecover: askRecover, close: close,
    create: create, claim: claim, restore: restore, setNick: setNick, newRecovery: newRecovery, deleteAccount: deleteAccount,
    stats: stats, todayStr: todayStr, pushStats: pushStats, pushBackup: pushBackup, syncSoon: syncSoon,
    pushLogs: pushLogs, logDurum: logDurum,
    dashboard: dashboard, cachedDashboard: cachedDashboard, sendRequest: sendRequest, respond: respond,
    cancel: cancel, removeFriend: removeFriend, errText: errText, esc: esc, fmtRec: fmtRec
  };
})();
