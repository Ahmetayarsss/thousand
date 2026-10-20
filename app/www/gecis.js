/*
 * gecis.js — eski (Capacitor) uygulamadan yeni uygulamaya (mobile/) ilerleme aktarımı, eski taraf.
 *
 * Yeni uygulama aynı paket adı ve imzayla bunun ÜSTÜNE kurulur (güncelleme gibi). Ama eski uygulamanın
 * verisi WebView'in localStorage'ında; yeni uygulama oraya erişemez. Bu yüzden eski uygulama her sayfa
 * açılışında ve arka plana geçerken bütün ox3000_* anahtarlarını uygulamanın kendi dosya klasörüne
 * (Android: files/gecis/) yazar; yeni uygulama ilk açılışta oradan okur (mobile/src/gecis.js).
 * Dosya telefondan çıkmaz, ağa gitmez.
 *
 * Yazma yarıda kesilirse (uygulama kapatıldı) dosya bozuk kalmasın diye aynı içerik iki dosyaya sırayla
 * yazılır (önce ox3000.yedek.json, sonra ox3000.json): en az biri hep tam. Yeni uygulama ikisinden
 * geçerli ve daha yeni olanı alır.
 * Tarayıcıda (native değil) hiçbir şey yapmaz.
 */
window.OXGECIS = (function () {
  var Cap = window.Capacitor;
  var native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var DOSYALAR = ["gecis/ox3000.yedek.json", "gecis/ox3000.json"];

  function anlik() {
    var keys = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("ox3000_") === 0) keys[k] = localStorage.getItem(k);
    }
    return { v: 1, t: Date.now(), keys: keys };
  }

  var son = "", suruyor = null, bekleyen = false;
  // Değişiklik yoksa yazmaz. Aynı anda tek yazma; sürerken gelen istek ardından bir kez daha yazar.
  function yaz() {
    if (!native) return Promise.resolve(false);
    if (suruyor) { bekleyen = true; return suruyor; }
    suruyor = (async function () {
      var Fs = (Cap.Plugins && Cap.Plugins.Filesystem) || (typeof Cap.registerPlugin === "function" && Cap.registerPlugin("Filesystem"));
      if (!Fs) return false;
      var a = anlik(), icerik = JSON.stringify(a.keys);
      if (icerik === son) return true;
      var metin = JSON.stringify(a);
      try {
        for (var i = 0; i < DOSYALAR.length; i++) {
          await Fs.writeFile({ path: DOSYALAR[i], data: metin, directory: "DATA", encoding: "utf8", recursive: true });
        }
        son = icerik;
        return true;
      } catch (e) {
        // Veri kaybettirebilir (yeni uygulama ilerlemeyi bulamaz): kayda düşsün, sonraki açılışta yeniden denenir.
        try { if (window.OXLOG) OXLOG.add("gecis_hata", { m: String((e && e.message) || e).slice(0, 200) }); } catch (e2) {}
        return false;
      }
    })().finally(function () {
      suruyor = null;
      if (bekleyen) { bekleyen = false; yaz(); }
    });
    return suruyor;
  }

  if (native) {
    if (document.readyState === "complete") setTimeout(yaz, 300);
    else window.addEventListener("load", function () { setTimeout(yaz, 300); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) yaz(); });
    window.addEventListener("pagehide", function () { yaz(); });
  }

  return { yaz: yaz, anlik: anlik, DOSYALAR: DOSYALAR };
})();
