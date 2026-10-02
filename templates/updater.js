/*
 * Uygulama içi güncelleme.
 *
 * APK BİR KEZ kurulur (ses dosyaları içinde gömülü kalır). Arayüz (HTML/JS/CSS)
 * daha sonra küçük bir web paketiyle (web.json.gz, ~birkaç yüz KB) güncellenir;
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
  var REL = "https://github.com/Ahmetayarsss/thousand/releases/download/apk-latest/";

  function b64ToU8(b64) {
    var bin = atob(b64), n = bin.length, a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  async function gunzipToText(u8) {
    var ds = new DecompressionStream("gzip");
    var stream = new Blob([u8]).stream().pipeThrough(ds);
    var buf = await new Response(stream).arrayBuffer();
    return new TextDecoder("utf-8").decode(buf);
  }

  async function check() {
    try {
      var Http = plugin("CapacitorHttp");
      var Fs = plugin("Filesystem");
      if (!Http || !Fs || typeof DecompressionStream === "undefined") return;

      var vr = await Http.request({ url: REL + "web-version.txt?ts=" + Date.now(), method: "GET", responseType: "text" });
      var remote = parseInt(("" + (vr && vr.data || "")).trim(), 10);
      if (!remote) return;

      var applied = 0;
      try { var a = JSON.parse(localStorage.getItem("ox_webupd") || "{}"); applied = a.ver || 0; } catch (e) {}
      if (remote <= Math.max(VER, applied)) return; // zaten güncel

      var zr = await Http.request({ url: REL + "web.json.gz?ts=" + Date.now(), method: "GET", responseType: "arraybuffer" });
      if (!zr || zr.data == null) return;
      var bytes = (typeof zr.data === "string") ? b64ToU8(zr.data) : new Uint8Array(zr.data);
      var json = await gunzipToText(bytes);
      var files = JSON.parse(json); // { "index.html": "...", ... }
      if (!files || !files["index.html"]) return;

      var dir = "webupd/v" + remote;
      for (var name in files) {
        if (!Object.prototype.hasOwnProperty.call(files, name)) continue;
        await Fs.writeFile({ path: dir + "/" + name, data: String(files[name]), directory: "DATA", encoding: "utf8", recursive: true });
      }
      var uri = (await Fs.getUri({ directory: "DATA", path: dir })).uri;
      var base = Cap.convertFileSrc(uri);
      if (base.slice(-1) !== "/") base += "/";
      localStorage.setItem("ox_webupd", JSON.stringify({ ver: remote, base: base }));
      localStorage.setItem("ox_webupd_new", "1");
    } catch (e) { /* sessiz: gömülü sürümle devam */ }
  }

  if (document.readyState === "complete") setTimeout(check, 600);
  else window.addEventListener("load", function () { setTimeout(check, 800); });
})();
