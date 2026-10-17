// Renkler: Capacitor sayfalarındaki CSS değişkenleriyle aynı (açık + koyu tema).
import { useColorScheme } from "react-native";

const ORTAK = {
  speak: "#E5892B", speakKoyu: "#C9741A",
  isim: "#1E88E5", fiil: "#2E9E5B", sifat: "#8E44AD", zarf: "#E67E22", diger: "#5D6D7E",
  A1: "#2E7D32", A2: "#C79100", B1: "#C2185B", B2: "#1565C0",
};

const ACIK = {
  ...ORTAK, koyu: false,
  bg: "#F5F6F8", card: "#fff", ink: "#1B2430", muted: "#7A8699", line: "#E7EAF0",
  tr: "#B03A2E", ok: "#0E8074", en: "#33414F", ex: "#5B6B7B", field: "#fff", bar: "#fff",
  solid: "#1B2430", onSolid: "#fff",
};

const KOYU = {
  ...ORTAK, koyu: true,
  bg: "#0F141B", card: "#19202A", ink: "#E4E9F0", muted: "#8D99AA", line: "#2B3542",
  tr: "#EE8579", ok: "#3CC2B0", en: "#C5CDD8", ex: "#9AA6B6", field: "#222B36", bar: "#151B23",
  solid: "#2F3B4C", onSolid: "#F2F5F9",
};

export function useTema() {
  return useColorScheme() === "dark" ? KOYU : ACIK;
}

// Bölüm rengi (kartın sol şeridi).
export function bolumRengi(t, sec) {
  return { "İsimler": t.isim, "Fiiller": t.fiil, "Sıfatlar": t.sifat, "Zarflar": t.zarf }[sec] || t.diger;
}
