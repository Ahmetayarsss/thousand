/*
 * Tek kelimenin sesi: önce uygulamaya gömülü insan sesi (assets/audio, çevrimdışı), kaydı yoksa
 * cihazın konuşma sentezi (en-US). Aynı anda tek ses: yenisi başlayınca öncekisi durur.
 */
import { createAudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import SESLER from "./uretilen/sesler";

// Ses dosyasının adı. scripts/validate.py → slug_of ile aynı kural:
// parantez atılır, virgülden önceki ilk biçim, harf/rakam dışı "-".
export function slugOf(w) {
  const b = w.replace(/\(.*?\)/g, "").split(",")[0];
  return b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

let calan = null;

export function durdur() {
  if (calan) { try { calan.remove(); } catch (e) { /* zaten kapanmış */ } calan = null; }
  Speech.stop();
}

// bitti: ses bitince (ya da çalınamazsa) bir kez çağrılır.
export function kelimeyiOku(w, bitti) {
  durdur();
  let bir = false;
  const son = () => { if (!bir) { bir = true; if (bitti) bitti(); } };
  const kayit = SESLER[slugOf(w)];
  if (kayit) {
    const p = createAudioPlayer(kayit);
    calan = p;
    p.addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish) { if (calan === p) durdur(); son(); }
    });
    p.play();
    return;
  }
  Speech.speak(w, { language: "en-US", rate: 0.85, onDone: son, onStopped: son, onError: son });
}
