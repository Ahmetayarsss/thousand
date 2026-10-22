/*
 * Uygulamanın hesabı: hesap.js'i bu telefonun depolarıyla (ve Android'de bildirim modülüyle) kurar. Açılıştan 2 sn
 * sonra hatırlatmalar, özet/kayıtlar ve arkadaş bildirimleri; arka plana geçerken hatırlatmalar, özet, yedek ve
 * kayıtlar (eski sayfalardaki açılış ve visibilitychange'in karşılığı).
 * Hesap değişince (açıldı, taşındı, silindi, ad değişti) ekranlar useHesap ile yeniden çizilir.
 */
import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { OXLOG, SRS } from "../cekirdek";
import { errText, fmtRec, kur } from "./hesap";

const surum = (Constants.expoConfig && Constants.expoConfig.version) || null;
function cihaz() {   // kullanım kaydına giden telefon bilgisi (izin penceresinde "telefon modeli" diye söyleniyor)
  const c = Platform.constants || {};
  if (Platform.OS === "android") return "Android " + c.Release + "; " + c.Manufacturer + " " + c.Model + "; Thousand " + surum;
  return Platform.OS + " " + Platform.Version + "; Thousand " + surum;
}

// Bildirimler yalnız Android'de (modules/bildirim); başka yerde B yok, bildirim işleri atlanır.
export const B = Platform.OS === "android" ? requireOptionalNativeModule("Bildirim") : null;
export const HESAP = kur({ depo: globalThis.localStorage, fetch: (u, o) => fetch(u, o), SRS, OXLOG, B, cihaz: cihaz(), surum });
export { errText, fmtRec };

const dinleyenler = new Set();
export function hesapDegisti() { dinleyenler.forEach((f) => f()); }
export function useHesap() {
  const [a, setA] = useState(() => HESAP.account());
  useEffect(() => {
    const f = () => setA(HESAP.account());
    dinleyenler.add(f);
    return () => { dinleyenler.delete(f); };
  }, []);
  return a;
}

setTimeout(() => HESAP.acilis(), 2000);
AppState.addEventListener("change", (d) => { if (d === "background") HESAP.arkaPlan(); });

// Bildirime dokunarak açıldıysa gidilecek ekran: { ad, mod } (gezinme.js → git). Bildirimdeki hedef eski sayfa
// adıyla gelir ("index.html": Listeyi oku bildirimi). Bir kez verir.
const EKRAN = {
  "index.html": { ad: "index" }, "arkadaslar.html": { ad: "arkadas" },
  "kartlar.html?exam=1": { ad: "kartlar", mod: "sinav" }, "kartlar.html": { ad: "kartlar" },
};
export function bildirimHedefi() {
  if (!B) return null;
  try { const r = B.launchTarget(); return (r && r.sayfa && (EKRAN[r.sayfa] || EKRAN["index.html"])) || null; } catch (e) { return null; }
}
