/*
 * Uygulama içi güncelleme.
 *
 * APK BİR KEZ kurulur (ses dosyaları içinde gömülü kalır). Arayüz (HTML/JS/CSS)
 * daha sonra küçük bir web paketiyle (web.json, ~2 MB) güncellenir;
 * yeni APK kurmaya gerek kalmaz. Ses hiç yeniden inmez.
 *
 * Çalışma:
 *  1) Daha önce indirilmiş (uygulanmış) daha yeni bir paket varsa ve hâlâ gömülü
 *     sayfadaysak, o pakete yönleniriz (dosyalar cihaz hafızasından yüklenir).
 *     Ses hep mutlak '/audio/...' yolundan APK içindeki dosyalara gider.
 *  2) Arka planda GitHub release'teki sürümü kontrol ederiz; daha yeniyse paketi
 *     indirip cihaza yazarız — bir SONRAKİ açılışta uygulanır.
 *
 * Her şey try/catch içinde: güncelleme başarısız olursa uygulama gömülü (APK'daki)
 * sürümle sorunsuz çalışmaya devam eder. Tarayıcıda (native değil) hiçbir şey yapmaz.
 */
(function () {
  var VER = __WEBVER__;
  var Cap = window.Capacitor;
  var native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  if (!native) return;

  function plugin(name) {
    return (Cap.Plugins && Cap.Plugins[name]) ||
           (typeof Cap.registerPlugin === "function" && Cap.registerPlugin(name));
  }
  var inUpdate = location.href.indexOf("_capacitor_file_") > -1;

  // 1) Uygulanmış güncellemeye yönlen (yalnız gömülü sayfadayken).
  try {
    var raw = localStorage.getItem("ox_webupd");
    if (raw) {
      var u = JSON.parse(raw);
      if (u && u.ver && u.base) {
        if (u.ver > VER && !inUpdate) {
          var page = location.pathname.split("/").pop() || "index.html";
          location.replace(u.base + page + location.search + location.hash);
          return;
        }
        if (u.ver <= VER) { try { localStorage.removeItem("ox_webupd"); } catch (e) {} } // eskimiş işaret
      }
    }
  } catch (e) {}

  // Güncellenmiş sayfadaysak ve yeni uygulandıysa küçük bilgi balonu.
  try {
    if (inUpdate && localStorage.getItem("ox_webupd_new")) {
      localStorage.removeItem("ox_webupd_new");
      window.addEventListener("DOMContentLoaded", function () {
        try {
          var t = document.createElement("div");
          t.textContent = "Uygulama güncellendi ✓";
          t.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#2E9E5B;color:#fff;font:600 12px system-ui;padding:8px 14px;border-radius:18px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3)";
          document.body.appendChild(t);
          setTimeout(function () { t.style.transition = "opacity .5s"; t.style.opacity = "0"; }, 2500);
        } catch (e) {}
      });
    }
  } catch (e) {}

  // 2) Arka planda güncelleme kontrolü + indirme.
  var OWNER = "Ahmetayarsss", REPO = "thousand", BRANCH = "claude/oxford-3000-pronunciation-defs-inzs33";
  var API = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/";   // taze, önbeleksiz
  var RAW = "https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/refs/heads/" + BRANCH + "/";
  var REL = "https://github.com/" + OWNER + "/" + REPO + "/releases/download/apk-latest/";

  function toast(msg, color, ms) {
    try {
      var t = document.createElement("div");
      t.textContent = msg;
      t.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:" + (color || "#1B2430") + ";color:#fff;font:600 12px system-ui;padding:8px 14px;border-radius:18px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:92%;text-align:center";
      (document.body || document.documentElement).appendChild(t);
      setTimeout(function () { t.style.transition = "opacity .5s"; t.style.opacity = "0"; }, ms || 3000);
    } catch (e) {}
  }

  async function oneGet(url, headers) {
    try {
      var r = await fetch(url, { cache: "no-store", headers: headers || {} });
      if (r && r.ok) { var t = await r.text(); if (t) return t; }
    } catch (e) {}
    try {
      var H = plugin("CapacitorHttp");
      if (H) {
        var hd = headers || {}; hd["Cache-Control"] = "no-cache";
        var res = await H.request({ url: url, method: "GET", responseType: "text", headers: hd });
        var d = (res && res.data != null) ? ("" + res.data) : "";
        if (d) return d;
      }
    } catch (e) {}
    return "";
  }
  function toVer(s) { var t = ("" + (s || "")).trim(); return /^\d{1,20}$/.test(t) ? parseInt(t, 10) : 0; } // sadece saf sayı (404 sayfası vb. elenir)

  // Sürüm: API (taze) + raw + release → geçerli sayıların EN BÜYÜĞÜ (bayat kaynak eler).
  async function getRemoteVer() {
    var best = 0, src = "yok";
    try {
      var a = await oneGet(API + "web-version.txt?ref=" + BRANCH, { "Accept": "application/vnd.github.raw+json" });
      var n = toVer(a);
      if (!n) { try { var j = JSON.parse(a); if (j && j.content) n = toVer(atob(j.content.replace(/\s/g, ""))); } catch (e) {} }
      if (n > best) { best = n; src = "api"; }
    } catch (e) {}
    try { var n2 = toVer(await oneGet(RAW + "web-version.txt")); if (n2 > best) { best = n2; src = "raw"; } } catch (e) {}
    try { var n3 = toVer(await oneGet(REL + "web-version.txt")); if (n3 > best) { best = n3; src = "rel"; } } catch (e) {}
    return { ver: best, src: src };
  }
  async function getBundle() {
    var t = await oneGet(RAW + "web.json"); if (t && t.charAt(0) === "{") return t;
    t = await oneGet(REL + "web.json"); if (t && t.charAt(0) === "{") return t;
    return "";
  }

  async function check() {
    var reached = "başlangıç";
    try {
      var Fs = plugin("Filesystem");
      if (!Fs) { toast("Güncelleme: Filesystem yok", "#B83E38", 6000); return; }

      reached = "sürüm";
      var rv = await getRemoteVer();
      var applied = 0;
      try { var a = JSON.parse(localStorage.getItem("ox_webupd") || "{}"); applied = a.ver || 0; } catch (e) {}
      var local = Math.max(VER, applied);
      // TEŞHİS: her açılışta yerel + sunucu sürümünü göster (sorun netleşsin).
      toast("Yerel: v" + local + " · Sunucu: v" + (rv.ver || "?") + " (" + rv.src + ")", "#1B2430", 6000);
      if (!rv.ver) return;
      if (rv.ver <= local) return; // güncel

      toast("Güncelleme indiriliyor… v" + rv.ver, "#3B6EA5", 5000);
      reached = "paket";
      var jtxt = await getBundle();
      if (!jtxt) { toast("Paket inmedi", "#B83E38", 6000); return; }
      reached = "çöz";
      var files = JSON.parse(jtxt);
      if (!files || !files["index.html"]) { toast("Güncelleme: paket bozuk", "#B83E38", 6000); return; }

      reached = "yaz";
      var dir = "webupd/v" + rv.ver;
      for (var name in files) {
        if (!Object.prototype.hasOwnProperty.call(files, name)) continue;
        await Fs.writeFile({ path: dir + "/" + name, data: String(files[name]), directory: "DATA", encoding: "utf8", recursive: true });
      }
      reached = "konum";
      var uri = (await Fs.getUri({ directory: "DATA", path: dir })).uri;
      var base = Cap.convertFileSrc(uri);
      if (base.slice(-1) !== "/") base += "/";
      localStorage.setItem("ox_webupd", JSON.stringify({ ver: rv.ver, base: base }));
      localStorage.setItem("ox_webupd_new", "1");
      toast("Güncellendi ✓ — yeniden açınca aktif", "#2E9E5B", 6000);
    } catch (e) {
      toast("Güncelleme hatası (" + reached + "): " + (e && e.message ? e.message : e), "#B83E38", 7000);
    }
  }

  if (document.readyState === "complete") setTimeout(check, 600);
  else window.addEventListener("load", function () { setTimeout(check, 800); });
})();
