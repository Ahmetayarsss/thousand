/*
 * Uygulama içi güncelleme.
 *
 * APK BİR KEZ kurulur (ses dosyaları içinde gömülü kalır). Arayüz (HTML/JS/CSS)
 * daha sonra küçük bir web paketiyle (web.json, ~3 MB) güncellenir;
 * yeni APK kurmaya gerek kalmaz. Ses hiç yeniden inmez.
 *
 * Çalışma:
 *  1) Daha önce indirilmiş (uygulanmış) daha yeni bir paket varsa ve hâlâ gömülü
 *     sayfadaysak, o pakete yönleniriz (dosyalar cihaz hafızasından yüklenir).
 *     Ses hep mutlak '/audio/...' yolundan APK içindeki dosyalara gider.
 *  2) Arka planda GitHub release'teki (apk-latest) sürümü kontrol ederiz; daha yeniyse
 *     paketi indirip cihaza yazar ve hemen uygularız.
 *
 * Kaynak YALNIZ release: oraya paketi yalnız CI (build-apk.yml) koyar, o da main dalına
 * birleşen ve testler + bekçi geçen commit'ten. Herhangi bir dalın ham dosyasından
 * paket indirilmez.
 *
 * Her şey try/catch içinde: güncelleme başarısız olursa uygulama gömülü (APK'daki)
 * sürümle sorunsuz çalışmaya devam eder. Tarayıcıda (native değil) hiçbir şey yapmaz.
 */
(function () {
  var VER = __WEBVER__;
  window.OX_WEBVER = VER;   // kayıt dışa aktarımı için (log.js)
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
          window.OX_YONLENDIR = 1;   // bu sayfa terk ediliyor (tts-bridge bildirim hedefine yenisinde baksın)
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
  var REL = "https://github.com/Ahmetayarsss/thousand/releases/download/apk-latest/";

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
        if (!res || res.status !== 200) return "";   // 404 sayfası vb. içerik sayılmaz
        var d = (res.data != null) ? ("" + res.data) : "";
        if (d) return d;
      }
    } catch (e) {}
    return "";
  }
  function toVer(s) { var t = ("" + (s || "")).trim(); return /^\d{1,20}$/.test(t) ? parseInt(t, 10) : 0; } // sadece saf sayı (404 sayfası vb. elenir)

  async function getRemoteVer() {
    return { ver: toVer(await oneGet(REL + "web-version.txt")) };
  }
  async function getBundle() {
    var t = await oneGet(REL + "web.json");
    return (t && t.charAt(0) === "{") ? t : "";
  }

  // Eski paketleri sil: her güncelleme webupd/v<sürüm> klasörüne yazılır; önceden silinmediği için
  // birikip telefonda yer kaplıyordu (≈3 MB × güncelleme sayısı). Yalnız uygulanan sürüm ve şu an
  // açık olan sayfanın klasörü kalır (açık sayfanın dosyaları silinirse sayfalar arası geçiş bozulur).
  async function temizle(Fs, keep) {
    try {
      var r = await Fs.readdir({ path: "webupd", directory: "DATA" });
      var list = (r && r.files) || [];
      for (var i = 0; i < list.length; i++) {
        var f = list[i], name = typeof f === "string" ? f : (f && f.name);
        if (!name || keep.indexOf(name) >= 0) continue;
        try { await Fs.rmdir({ path: "webupd/" + name, directory: "DATA", recursive: true }); } catch (e) {}
      }
    } catch (e) {}
  }
  function acikKlasor() { var m = /\/webupd\/(v\d+)\//.exec(location.href); return m ? m[1] : ""; }

  // İndirip cihaza yazar ve HEMEN uygular (bir sonraki açılışı beklemeden): gömülü
  // sayfadaysak indirilen pakete yönleniriz, yeşil "güncellendi ✓" balonu çıkar.
  // Tek açılışta güncelleme olur — "iki kez kapat-aç" gerekmez.
  async function check() {
    try {
      var Fs = plugin("Filesystem");
      if (!Fs) return;
      var applied = 0;
      try { var a = JSON.parse(localStorage.getItem("ox_webupd") || "{}"); applied = a.ver || 0; } catch (e) {}
      await temizle(Fs, [applied ? "v" + applied : "", acikKlasor()]);   // internet olmasa da
      var rv = await getRemoteVer();
      if (!rv.ver) return;
      if (rv.ver <= Math.max(VER, applied)) return; // zaten güncel

      var jtxt = await getBundle();
      if (!jtxt) return;
      var files = JSON.parse(jtxt);
      if (!files || !files["index.html"]) return;
      // Paket gerçekten bu sürümün paketi mi? (release'e yükleme sürerken sürüm dosyası yeni,
      // paket eski olabilir; eski paket yeni numarayla kurulmasın.)
      var pv = /var VER = (\d+);/.exec(String(files["updater.js"] || ""));
      if (!pv || parseInt(pv[1], 10) !== rv.ver) return;

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
      await temizle(Fs, ["v" + rv.ver, acikKlasor()]);
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
