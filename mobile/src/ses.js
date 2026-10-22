/*
 * Tek kelimenin sesi: önce uygulamaya gömülü insan sesi (assets/audio, çevrimdışı), kaydı yoksa ya da çalınamazsa
 * cihazın konuşma sentezi (en-US; eskisi gibi). Aynı anda tek ses: yenisi başlayınca öncekisi durur.
 * hiz: konuşma sentezinin hızı — eski sayfalardaki gibi Liste 0,8, Kartlar 0,85, Sözlük 0,9.
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

let calan = null, bekci = null;

export function durdur() {
  clearTimeout(bekci);
  if (calan) { try { calan.remove(); } catch (e) { /* zaten kapanmış */ } calan = null; }
  Speech.stop();
}

// bitti: ses bitince (ya da hiç çalınamazsa) bir kez çağrılır.
export function kelimeyiOku(w, bitti, hiz = 0.85) {
  durdur();
  let bir = false;
  const son = () => { if (!bir) { bir = true; if (bitti) bitti(); } };
  const sentez = () => Speech.speak(w, { language: "en-US", rate: hiz, onDone: son, onStopped: son, onError: son });
  const kayit = SESLER[slugOf(w)];
  if (!kayit) { sentez(); return; }
  const p = createAudioPlayer(kayit);
  calan = p;
  // Kayıt çalınamazsa (bozuk dosya, ses aygıtı hatası) cihaz sesine geç; hiç haber gelmezse 10 sn sonra bitmiş say.
  bekci = setTimeout(() => { if (calan === p) { durdur(); son(); } }, 10000);
  p.addListener("playbackStatusUpdate", (st) => {
    if (bir || calan !== p) return;
    if (st.didJustFinish) { durdur(); son(); }
    else if (st.error) { durdur(); sentez(); }
  });
  try { p.play(); } catch (e) { durdur(); sentez(); }
}
