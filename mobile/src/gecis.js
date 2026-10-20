/*
 * Eski (Capacitor) uygulamadan ilerleme aktarımı, ilk açılışta: eski uygulamanın uygulama klasörüne yazdığı
 * dosyalar (app/www/gecis.js; Android'de files/gecis/ — Paths.document aynı klasör) okunup ox3000_*
 * anahtarları buraya alınır. srs.js / log.js yüklenmeden ÖNCE çalışmalı (cekirdek.js). Kurallar: gecisAktar.js.
 * Eski WebView verisi telefonda olduğu gibi kalır (silinmez).
 */
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { aktar } from "./gecisAktar";

function oku(ad) {
  const f = new File(Paths.document, "gecis", ad);
  return f.exists ? f.textSync() : null;
}

function calistir() {
  if (Platform.OS !== "android") return { durum: "yok" };   // eski uygulama yalnız Android'de vardı
  try {
    return aktar(globalThis.localStorage, [oku("ox3000.json"), oku("ox3000.yedek.json")], Date.now());
  } catch (e) {
    return { durum: "bozuk", hata: String((e && e.message) || e).slice(0, 200) };
  }
}

export const GECIS = calistir();
