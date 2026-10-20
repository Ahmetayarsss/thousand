/*
 * Uygulamanın hesabı: hesap.js'i bu telefonun depolarıyla kurar. Açılıştan 2 sn sonra özet/kayıtlar, arka plana
 * geçerken özet, yedek ve kayıtlar gönderilir (eski sayfalardaki açılış ve visibilitychange'in karşılığı).
 * Hesap değişince (açıldı, taşındı, silindi, ad değişti) ekranlar useHesap ile yeniden çizilir.
 */
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

export const HESAP = kur({ depo: globalThis.localStorage, fetch: (u, o) => fetch(u, o), SRS, OXLOG, cihaz: cihaz(), surum });
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
