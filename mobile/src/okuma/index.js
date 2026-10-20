/*
 * "Listeyi oku": Android'de eski uygulamanın okuma servisi (modules/okuma — bildirim, kilit ekranı, kulaklık,
 * ekran kapalıyken de). Başka yerde (iOS, web) ekran açıkken JS ile okunur; bildirim ve kilit ekranı yok
 * (iOS'ta arka plan sesi: PLAN.md adım 39).
 * oku({ anahtarlar, baslangic, gap, loop, readTr }), durdur(), durum(), bekleme(ms), secenekler(loop, readTr),
 * dinle(f) → f({ etkin, kelime, index }) ve kaldırma işlevi; hata(f) → f(metin).
 */
import { requireOptionalNativeModule } from "expo";
import * as Speech from "expo-speech";
import { Image, Platform } from "react-native";
import { ANAHTARLA } from "../cekirdek";
import { durdur as sesiDurdur, kelimeyiOku, slugOf } from "../ses";
import SESLER from "../uretilen/sesler";
import { okumaListesi } from "./liste";

const HIZ = 0.8;   // eskisiyle aynı
const N = Platform.OS === "android" ? requireOptionalNativeModule("Okuma") : null;
export const YEREL = !!N;   // telefonun servisinde mi (ekran kapalıyken de)

function kaynak(w) {
  const m = SESLER[slugOf(w)];
  if (!m) return "";
  try { return Image.resolveAssetSource(m).uri || ""; } catch (e) { return ""; }
}

const dinleyenler = new Set(), hataDinleyenler = new Set();
function bildir(d) { dinleyenler.forEach((f) => f(d)); }
export function dinle(f) { dinleyenler.add(f); return () => dinleyenler.delete(f); }
export function hata(f) { hataDinleyenler.add(f); return () => hataDinleyenler.delete(f); }

if (N) {
  N.addListener("wordStart", (e) => bildir({ etkin: true, kelime: e.word, index: e.index }));
  N.addListener("state", (e) => bildir({ etkin: !!e.active, kelime: e.active ? e.word : null, index: e.index }));
  N.addListener("done", () => bildir({ etkin: false, kelime: null }));
  N.addListener("ttsError", (e) => hataDinleyenler.forEach((f) => f((e && e.msg) || "Ses/bildirim hatası")));
}

// ---- JS ile okuma (servis yoksa) ----
const J = { calisiyor: false, liste: null, i: 0, gap: 500, loop: true, readTr: false, zaman: null, nesil: 0 };
function jsDurdur() {
  J.calisiyor = false; J.nesil++;
  clearTimeout(J.zaman); sesiDurdur();
  bildir({ etkin: false, kelime: null });
}
function jsSonraki(nesil) {
  if (!J.calisiyor || nesil !== J.nesil) return;
  if (J.i >= J.liste.words.length) { if (J.loop) J.i = 0; else { jsDurdur(); return; } }
  const i = J.i, w = J.liste.words[i];
  bildir({ etkin: true, kelime: w, index: i });
  const ilerle = () => { if (nesil !== J.nesil) return; J.i++; if (J.gap > 0) J.zaman = setTimeout(() => jsSonraki(nesil), J.gap); else jsSonraki(nesil); };
  kelimeyiOku(w, () => {
    if (nesil !== J.nesil) return;
    const say = J.readTr ? J.liste.says[i] : "";
    if (!say) { ilerle(); return; }
    J.zaman = setTimeout(() => {
      if (nesil !== J.nesil) return;
      Speech.speak(say, { language: "tr-TR", rate: HIZ, onDone: ilerle, onStopped: () => {}, onError: ilerle });
    }, 400);
  });
}

export function oku({ anahtarlar, baslangic = 0, gap, loop, readTr }) {
  const liste = okumaListesi(anahtarlar, (k) => ANAHTARLA[k], N ? kaynak : () => "");
  if (!liste.words.length) return;
  if (N) {
    N.speakGroup({ ...liste, rate: HIZ, loop, readTr, gap, start: baslangic });
    return;
  }
  jsDurdur();
  Object.assign(J, { calisiyor: true, liste, i: baslangic, gap, loop, readTr });
  jsSonraki(J.nesil);
}
export function durdur() { if (N) N.stop(); else if (J.calisiyor) jsDurdur(); }
export function durum() {
  if (N) { try { const s = N.getState(); return { etkin: !!s.active, kelime: s.active ? s.word : null, index: s.index }; } catch (e) { return { etkin: false }; } }
  return { etkin: J.calisiyor, kelime: J.calisiyor && J.liste ? J.liste.words[J.i] : null, index: J.i };
}
export function bekleme(ms) { if (N) N.setGap(ms); else J.gap = ms; }
export function secenekler(loop, readTr) { if (N) N.setOptions(loop, readTr); else { J.loop = loop; J.readTr = readTr; } }
export function bildirimAyarlariniAc() { if (N) N.openNotificationSettings(); }
