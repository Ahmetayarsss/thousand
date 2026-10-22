/*
 * Bildirim kurulumu penceresi (eski hesap.js'teki kurulum): bildirimlerin gelmesi için gereken izinler, her biri tek
 * dokunuşla — bildirim izni, otomatik başlatma (yalnız uygulamaları kendiliğinden kapatan markalarda). Telefonun
 * ayarlarından dönünce durum yenilenir. Android'de; başka yerde açılmaz.
 * bildirimKurulumu({ zorla, bitti }): zorla değilse yalnız bir kez ve eksik adım varsa; açılmadıysa izni bir kez sorar.
 */
import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { Baslik, Dugme, Metin, pencereAc } from "../bilesenler/Pencere";
import { HESAP } from "../hesap";
import { useTema } from "../tema";

export function bildirimKurulumu({ zorla = false, bitti } = {}) {
  const d = HESAP.kurulumDurum();
  if (!d) { if (bitti) bitti(); return false; }
  if (!zorla && !HESAP.kurulumGosterilsin()) { HESAP.izinIlk(); if (bitti) bitti(); return false; }
  const kapat2 = (kapat) => { kapat(); if (bitti) bitti(); };
  pencereAc((kapat) => <Kurulum kapat={() => kapat2(kapat)} />, kapat2);
  return true;
}

function Kurulum({ kapat }) {
  const t = useTema();
  const [d, setD] = useState(() => HESAP.kurulumDurum());
  const [not, setNot] = useState("");
  useEffect(() => {
    const a = AppState.addEventListener("change", (s) => { if (s === "active") setTimeout(() => setD(HESAP.kurulumDurum()), 400); });
    return () => a.remove();
  }, []);
  if (!d) return null;
  const adim = async (id) => {
    const r = await HESAP.kurulumAdim(id);
    if (id === "otobas") setNot(r === "otobas" ? "" : r === "uygulama" ? "Açılan sayfada “Otomatik başlatma”yı bulup aç." : "Bu telefonda otomatik başlatma ayarı bulunamadı; gerekmeyebilir.");
    setD(HESAP.kurulumDurum());
  };
  return (
    <View>
      <Baslik>Bildirimleri ayarla 🔔</Baslik>
      <Metin>Hatırlatmalar ve dürtmeler zamanında gelsin diye telefonunda {d.adim.length > 1 ? d.adim.length + " küçük izin" : "bir izin"} gerekiyor. Her biri tek dokunuş.</Metin>
      {d.adim.map((a, i) => (
        <View key={a.id} style={[s.adim, { borderTopColor: t.kartLine }]}>
          <Text style={[s.no, { backgroundColor: a.ok ? t.green : t.soft, color: a.ok ? "#fff" : t.ink }]}>{a.ok ? "✓" : i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.t, { color: t.ink }]}>{a.t}</Text>
            <Text style={[s.alt, { color: t.muted }]}>{a.s}</Text>
          </View>
          {a.ok ? <Text style={[s.tamam, { color: t.green }]}>Tamam</Text> : <Dugme kucuk tur="mavi" metin={a.btn} onBas={() => adim(a.id)} />}
        </View>
      ))}
      {not ? <Text style={[s.not, { color: t.yaziIpucu }]}>{not}</Text> : null}
      <Dugme metin={d.tamam ? "Bitti" : "Sonra"} onBas={kapat} />
    </View>
  );
}

const s = StyleSheet.create({
  adim: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderTopWidth: 1 },
  no: { width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28, fontWeight: "900", fontSize: 14, overflow: "hidden" },
  t: { fontSize: 15, fontWeight: "800" },
  alt: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  tamam: { fontWeight: "800", fontSize: 13 },
  not: { marginTop: 8, fontSize: 13, fontWeight: "700" },
});
