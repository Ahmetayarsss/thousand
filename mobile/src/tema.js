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
  // Kartlar sayfası
  kartBg: "#F4F6F9", kartLine: "#E6EAF1", yuzCizgi: "#c7d2e3", ayrac: "#D5DCE7", soft: "#E9EDF3",
  accent: "#3B6EA5", green: "#2E9E5B", red: "#D9544D", redKoyu: "#B83E38", scrim: "rgba(20,27,38,.5)",
  goodBg: "#E9F7EF", badBg: "#FDECEA",
  altin: ["#FCF1C8", "#F3D77E", "#E9C35A", "#F8E6A8"], yaziIpucu: "#8A6A12",
  kutu: "#FFFBEA", kutuCizgi: "#E2C463", kutuEtkin: "#C9A227", kutuIpucu: "#B6A266", imlec: "#8A6A12",
  klavye: "#D9E0EA", tus: "#fff", tusBasili: "#B9C4D4", tusIslev: "#AEB9C9", tusIslevBasili: "#8E9BB0",
  // İlerleme / İstatistikler
  amber: "#E5892B", neu: "#C7D0DB", greenBg: "#E7F5EC", secgray: "#EDF0F4", secgrayInk: "#9AA6B4", golge: "rgba(20,30,50,.06)",
  dev: "#8E44AD",
  ink2: "#52514e", izgara: "#e9ecf1", eksen: "#c3c9d3", s1: "#2a78d6", s2: "#eb6834", o: ["#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
};

const KOYU = {
  ...ORTAK, koyu: true,
  bg: "#0F141B", card: "#19202A", ink: "#E4E9F0", muted: "#8D99AA", line: "#2B3542",
  tr: "#EE8579", ok: "#3CC2B0", en: "#C5CDD8", ex: "#9AA6B6", field: "#222B36", bar: "#151B23",
  solid: "#2F3B4C", onSolid: "#F2F5F9",
  kartBg: "#0F141B", kartLine: "#2B3542", yuzCizgi: "#2B3542", ayrac: "#3A4554", soft: "#222B36",
  accent: "#5B8FD0", green: "#35A867", red: "#DE5F57", redKoyu: "#E87A72", scrim: "rgba(0,0,0,.6)",
  goodBg: "#17352A", badBg: "#3A1E1C",
  altin: ["#3E3313", "#5E4C17", "#544314", "#3E3313"], yaziIpucu: "#E2C463",
  kutu: "#2A2410", kutuCizgi: "#6B5A22", kutuEtkin: "#C9A227", kutuIpucu: "#9C8B55", imlec: "#8A6A12",
  klavye: "#151B23", tus: "#2A3442", tusBasili: "#3A4656", tusIslev: "#3A4656", tusIslevBasili: "#4A5768",
  // Eski sayfalarda grafik renklerinin koyu karşılığı yoktu; aynı kalır.
  amber: "#E5892B", neu: "#3A4554", greenBg: "#17352A", secgray: "#222B36", secgrayInk: "#7C8899", golge: "rgba(0,0,0,.35)",
  dev: "#B27AD0",
  ink2: "#C5CDD8", izgara: "#e9ecf1", eksen: "#c3c9d3", s1: "#2a78d6", s2: "#eb6834", o: ["#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
};

export function useTema() {
  return useColorScheme() === "dark" ? KOYU : ACIK;
}

// Bölüm rengi (kartın sol şeridi).
export function bolumRengi(t, sec) {
  return { "İsimler": t.isim, "Fiiller": t.fiil, "Sıfatlar": t.sifat, "Zarflar": t.zarf }[sec] || t.diger;
}
