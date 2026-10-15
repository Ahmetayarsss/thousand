/*
 * log.js — Kullanım kaydı (olay günlüğü). Olaylar telefonda birikir; hesap VE kullanıcı izni varsa
 * hesap.js bunları arada bir sunucuya da gönderir (Supabase: kayitlar tablosu — geliştirici
 * kayitlar_gorunum'den bakar; izin bir kez sorulur, Ayarlar → Gizlilik), yoksa yalnız telefonda kalır. Ayarlar → Destek'ten
 * dosya olarak da dışa aktarılır (geliştirme için).
 *
 * Her olay: [zaman(ms), tür, veri?]. Türler:
 *   sayfa {p}             sayfa açıldı
 *   test_bas {n}          Test başladı        test {k, ok}   Test kartı
 *   sinav_bas {rev,nw,yz} Sınav başladı       cevap {k, y, ok, b, ms, yz, g?}
 *   sinav_bit {n,ok,tum}  Sınav bitti/bırakıldı
 *   okuma {…}             Listeyi oku         okuma_hata {m}
 *   hesap {a}             hesap işlemi        hesap_hata {f, m}
 *   bildirim {a, …}       bildirim izni (a: izin, d) / bildirime dokunup açma (a: ac, p)
 *   durt {s}              arkadaşını dürttü (s: gonderildi | bugun_durttun)
 *   ayar {...}            ayar değişti        dev {a}        geliştirici işlemi
 *   hata {m, f, l}        yakalanmamış JS hatası (f: kayit = ilerleme telefona yazılamadı, k: anahtar)
 *   guncelleme {a, v}     güncelleme olayı (a: geri = v sürümü açılamadı, gömülü sürüme dönüldü)
 * En fazla MAX olay tutulur (eskiler silinir). Her olayın bir sıra numarası var: sira() şimdiye
 * dek eklenen olay sayısı (silinenler dahil), son olayın numarası budur; sunucuya hangi olayların
 * gittiği bununla izlenir. Kimlik: rastgele, anonim (cihaz kimliği).
 */
(typeof window !== "undefined" ? window : globalThis).OXLOG = (function () {
  var KEY = "ox3000_log_v1", UIDK = "ox3000_uid", SEQK = "ox3000_log_sira", MAX = 5000, buf = null, seq = -1;

  function load() {
    if (buf) return buf;
    try { buf = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { buf = []; }
    if (!Array.isArray(buf)) buf = [];
    return buf;
  }
  // Son olayın sıra numarası (= şimdiye dek eklenen olay sayısı). Sayaç yoksa (eski sürüm) eldeki olay sayısı.
  function sira() {
    if (seq >= 0) return seq;
    var n = 0;
    try { n = parseInt(localStorage.getItem(SEQK), 10) || 0; } catch (e) {}
    seq = Math.max(n, load().length);
    return seq;
  }
  function uid() {
    try {
      var u = localStorage.getItem(UIDK);
      if (!u) { u = Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-4); localStorage.setItem(UIDK, u); }
      return u;
    } catch (e) { return ""; }
  }
  function add(type, data) {
    try {
      var b = load(), s = sira() + 1, e = [Date.now(), type];
      if (data != null) e.push(data);
      b.push(e); seq = s;
      if (b.length > MAX) b.splice(0, b.length - MAX);
      localStorage.setItem(KEY, JSON.stringify(b));
      localStorage.setItem(SEQK, String(s));
    } catch (e) {}
  }
  function count() { return load().length; }
  function events() { return load(); }   // salt okunur (hesap.js sunucuya gönderirken)
  function size() { try { return (localStorage.getItem(KEY) || "").length; } catch (e) { return 0; } }
  function clear() { buf = []; try { localStorage.removeItem(KEY); } catch (e) {} }
  // Telefon hafızası dolunca (srs.js ilerlemeyi yazamayınca) yer açar: en eski yarıyı siler.
  // Kayıt en önemsiz veri; ilerleme ondan önce gelir. Silinen bir şey olduysa true.
  function yerAc() {
    var b = load();
    if (b.length < 2) { if (!b.length) return false; clear(); return true; }
    b.splice(0, Math.ceil(b.length / 2));
    try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) { clear(); }
    return true;
  }

  // Dışa aktarılacak tüm veri: olaylar + ilerleme durumu (anlamak için gerekenler).
  function snapshot() {
    function j(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    return {
      uygulama: "thousand", kimlik: uid(), surum: window.OX_WEBVER || null,
      zaman: Date.now(), cihaz: navigator.userAgent,
      ayar: j("ox3000_settings_v1", {}), gelistirici: j("ox3000_dev_v1", {}),
      kelimeler: j("ox3000_srs_v1", {}), gunluk: j("ox3000_daily_v1", {}),
      sinavlar: j("ox3000_sessions_v1", []),
      olaylar: load()
    };
  }
  function fileName() {
    var d = new Date(), p = function (n) { return ("0" + n).slice(-2); };
    return "thousand_kayit_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + ".json";
  }
  // Dosyaya kaydet. Telefonda: Belgeler/Thousand/ (olmazsa uygulamanın kendi klasörü).
  // Tarayıcıda: indirme. Dönen: kaydedilen yer (metin) ya da null.
  async function exportFile() {
    var text = JSON.stringify(snapshot()), name = fileName();
    var Cap = window.Capacitor, native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
    if (native) {
      var Fs = (Cap.Plugins && Cap.Plugins.Filesystem) || (typeof Cap.registerPlugin === "function" && Cap.registerPlugin("Filesystem"));
      if (!Fs) return null;
      try {
        await Fs.writeFile({ path: "Thousand/" + name, data: text, directory: "DOCUMENTS", encoding: "utf8", recursive: true });
        return "Belgeler › Thousand › " + name;
      } catch (e) {}
      try {
        var r = await Fs.writeFile({ path: name, data: text, directory: "EXTERNAL", encoding: "utf8", recursive: true });
        return (r && r.uri) ? decodeURIComponent(String(r.uri).replace(/^file:\/\//, "")) : name;
      } catch (e) {}
      return null;
    }
    try {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      return "İndirilenler › " + name;
    } catch (e) { return null; }
  }
  // Panoya kopyala (dosya kaydı olmazsa yedek yol).
  async function copy() {
    var text = JSON.stringify(snapshot());
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    try {
      var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); var ok = document.execCommand("copy"); t.remove(); return ok;
    } catch (e) { return false; }
  }

  // Sayfa açılışı + yakalanmamış hatalar otomatik kaydedilir.
  try {
    if (typeof window !== "undefined" && window.addEventListener) {
      // Geri tuşuyla önbellekten dönen sayfa eski kopyayı yazmasın (arada başka sayfalar olay ekledi).
      window.addEventListener("pageshow", function (e) { if (e.persisted) { buf = null; seq = -1; } });
      add("sayfa", { p: (location.pathname.split("/").pop() || "index.html").replace(".html", "") });
      window.addEventListener("error", function (e) {
        add("hata", { m: String(e.message || "").slice(0, 200), f: String(e.filename || "").split("/").pop(), l: e.lineno || 0 });
      });
      window.addEventListener("unhandledrejection", function (e) {
        add("hata", { m: String((e.reason && (e.reason.message || e.reason)) || "promise").slice(0, 200), f: "promise" });
      });
    }
  } catch (e) {}

  return { add: add, count: count, size: size, clear: clear, yerAc: yerAc, snapshot: snapshot, exportFile: exportFile, copy: copy, uid: uid,
           sira: sira, events: events };
})();
