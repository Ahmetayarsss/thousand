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
  var VER = 1791211258;
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
        // Yalnız GÖMÜLÜ sayfada ve gömülü sürüm işareti geçince temizle. Uygulanmış
        // pakette (inUpdate) VER==u.ver olduğundan burada temizlersek işaret silinir
        // ve kapat-aç sonrası eskiye döner — bu yüzden !inUpdate şart.
        if (u.ver <= VER && !inUpdate) { try { localStorage.removeItem("ox_webupd"); } catch (e) {} }
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
          t.style.cssText = "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#2E9E5B;color:#fff;font:600 12px system-ui;padding:8px 14px;border-radius:18px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);pointer-events:none";
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

  // İndirip cihaza yazar ve HEMEN uygular (bir sonraki açılışı beklemeden): gömülü
  // sayfadaysak indirilen pakete yönleniriz, yeşil "güncellendi ✓" balonu çıkar.
  // Tek açılışta güncelleme olur — "iki kez kapat-aç" gerekmez.
  async function check() {
    try {
      var Fs = plugin("Filesystem");
      if (!Fs) return;
      var rv = await getRemoteVer();
      if (!rv.ver) return;
      var applied = 0;
      try { var a = JSON.parse(localStorage.getItem("ox_webupd") || "{}"); applied = a.ver || 0; } catch (e) {}
      if (rv.ver <= Math.max(VER, applied)) return; // zaten güncel

      var jtxt = await getBundle();
      if (!jtxt) return;
      var files = JSON.parse(jtxt);
      if (!files || !files["index.html"]) return;

      var dir = "webupd/v" + rv.ver;
      for (var name in files) {
        if (!Object.prototype.hasOwnProperty.call(files, name)) continue;
        await Fs.writeFile({ path: dir + "/" + name, data: String(files[name]), directory: "DATA", encoding: "utf8", recursive: true });
      }
      var uri = (await Fs.getUri({ directory: "DATA", path: dir })).uri;
      var base = Cap.convertFileSrc(uri);
      if (base.slice(-1) !== "/") base += "/";
      localStorage.setItem("ox_webupd", JSON.stringify({ ver: rv.ver, base: base }));
      localStorage.setItem("ox_webupd_new", "1");
      // Hemen uygula: gömülü sayfadaysak indirilen pakete yönlen (tek açılışta güncelle).
      if (!inUpdate) {
        var page = location.pathname.split("/").pop() || "index.html";
        location.replace(base + page + location.search + location.hash);
      }
    } catch (e) { /* sessiz: gömülü sürümle devam */ }
  }

  if (document.readyState === "complete") setTimeout(check, 600);
  else window.addEventListener("load", function () { setTimeout(check, 800); });
})();
