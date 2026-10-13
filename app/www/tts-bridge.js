/*
 * TTS köprüsü — sadece Capacitor (native Android) ortamında devreye girer.
 * Tarayıcıda hiçbir şey yapmaz; mevcut Web Speech API kodu aynen çalışır.
 *
 * Native'de window.speechSynthesis ve SpeechSynthesisUtterance yerel Android
 * TTS'e (@capacitor-community/text-to-speech) yönlendirilir. Böylece liste.html
 * ve kartlar.html içindeki kod (const synth=window.speechSynthesis; new
 * SpeechSynthesisUtterance(...); synth.speak/cancel/getVoices) hiç değişmeden
 * cihaz sesini kullanır.
 *
 * Bu script <head>'e konur; sayfa sonundaki `const synth=window.speechSynthesis`
 * yakalamasından ÖNCE çalışır.
 *
 * Ayrıca (her uygulama sayfasında yüklendiği için): bildirime dokununca ilgili sayfaya geçiş
 * ("Listeyi oku" → ana sayfa, arkadaşlık isteği → Arkadaşlar).
 */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) {
    return; // Tarayıcı: dokunma.
  }
  // "Listeyi oku" bildirimine dokununca (MainActivity → oxTtsOpen) başka sayfadaysak ana sayfaya geç.
  window.addEventListener("oxTtsOpen", function () {
    var p = location.pathname.split("/").pop() || "index.html";
    if (p !== "index.html") location.href = "index.html";
  });
  // Bildirime dokununca ilgili sayfaya geç: arkadaşlık isteği → arkadaslar.html, dürtme / hatırlatma →
  // kartlar.html?exam=1. Uygulama kapalıydıysa sayfa açılırken launchTarget() verir, açıktıysa MainActivity
  // "oxHedef" olayı gönderir; hedef native'de bir kez verilip silindiğinden sayfaya bir kez gidilir.
  // Güncelleyici başka pakete yönlendiriyorsa orada bakılır.
  var BL = Cap.Plugins && Cap.Plugins.Bildirim;
  if (BL && typeof BL.launchTarget === "function") {
    var hedef = function () {
      if (window.OX_YONLENDIR) return;
      Promise.resolve(BL.launchTarget()).then(function (r) {
        var p = r && r.sayfa, cur = (location.pathname.split("/").pop() || "index.html") + location.search;
        if (!p || !/^[a-z0-9_-]+\.html(\?[a-z0-9_=&-]*)?$/i.test(p)) return;
        try { if (window.OXLOG) OXLOG.add("bildirim", { a: "ac", p: p.replace(".html", "") }); } catch (e) {}
        if (cur !== p) location.href = p;
      }).catch(function () {});
    };
    window.addEventListener("oxHedef", hedef);
    hedef();
  }
  var TTS = (Cap.Plugins && Cap.Plugins.TextToSpeech) ||
            (typeof Cap.registerPlugin === "function" && Cap.registerPlugin("TextToSpeech"));
  if (!TTS) return; // Eklenti yoksa Web Speech'e bırak.

  // SpeechSynthesisUtterance yerine geçen basit sınıf.
  function Utter(text) {
    this.text = text || "";
    this.lang = "en-US";
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
  }
  window.SpeechSynthesisUtterance = Utter;

  function fire(cb, arg) { try { if (typeof cb === "function") cb(arg || {}); } catch (e) {} }

  var shim = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices: function () { return []; },
    speak: function (u) {
      var self = this;
      self.speaking = true;
      fire(u.onstart);
      TTS.speak({
        text: u.text,
        lang: u.lang || "en-US",
        rate: typeof u.rate === "number" ? u.rate : 1.0,
        pitch: typeof u.pitch === "number" ? u.pitch : 1.0,
        volume: typeof u.volume === "number" ? u.volume : 1.0,
        category: "playback"
      }).then(function () {
        self.speaking = false;
        fire(u.onend);
      }).catch(function (err) {
        self.speaking = false;
        // Web Speech'te onerror da onend'i tetikliyordu; kuyruk akışı bozulmasın.
        fire(u.onerror, { error: err });
        fire(u.onend, { error: err });
      });
    },
    cancel: function () {
      this.speaking = false;
      try { TTS.stop(); } catch (e) {}
    },
    pause: function () {},
    resume: function () {},
    addEventListener: function () {},
    removeEventListener: function () {}
  };

  try {
    Object.defineProperty(window, "speechSynthesis", { value: shim, configurable: true });
  } catch (e) {
    try { window.speechSynthesis = shim; } catch (e2) {}
  }
})();
