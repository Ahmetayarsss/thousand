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
 */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) {
    return; // Tarayıcı: dokunma.
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
