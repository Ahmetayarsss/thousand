/*
 * Çekirdek: srs.js (tekrar sistemi) ve log.js (kullanım kaydı) — eski (Capacitor) uygulamadan, aynı localStorage
 * anahtarlarıyla (ox3000_*). İkisi de localStorage kullanır; telefonda onu expo-sqlite karşılar (uygulamanın kendi
 * veritabanı). Webde (yalnız geliştirme) tarayıcının localStorage'ı kullanılır. Testler: tests/srs.test.js, log.test.js.
 */
import "expo-sqlite/localStorage/install";   // srs.js / log.js yüklenmeden ÖNCE
import { AppState } from "react-native";
import "./log.js";
import "./srs.js";
import KELIMELER from "../uretilen/kelimeler.json";

export const SRS = globalThis.SRS;
export const OXLOG = globalThis.OXLOG;

// Kelimeler sırasıyla katalog (grup 1 → 30); her kelimeye anahtarı (_k) iliştirilir.
SRS.setCatalog(SRS.catalogFromGroups(KELIMELER));
export const GRUPLAR = KELIMELER;
export const ANAHTARLA = {};   // anahtar → { d: kelime, g: grup }
KELIMELER.forEach((g) => g.items.forEach((d) => { ANAHTARLA[d._k] = { d, g }; }));

// Uygulama arka plana geçerken biriken kayıtlar hemen yazılsın (sayfadaki pagehide'ın karşılığı).
AppState.addEventListener("change", (durum) => { if (durum !== "active") OXLOG.yaz(); });
