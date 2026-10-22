// Liste kartı: kelime, tür · seviye, okunuş, Türkçe anlam, İngilizce açıklama, örnekler.
// Dokununca kelime okunur; okunurken kartın çevresinde turuncu halka ve gölge (eski .card.playing).
// sozluk: Sözlük'teki biçim (eskisi gibi biraz büyük yazı, sol şerit bölüm renginde değil gri).
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { bolumRengi } from "../tema";

const TUR = { "yardımcı fiil": "yard. fiil" };

// Örnek cümlede kelime <b>…</b> içinde: kalın yazılır, başka etiket yok. Üstünde kesik çizgi (Android yalnız dört
// kenarı eşit kenarlıkta kesik çizer: tam kenarlıklı ince kutunun yalnız üst kenarı görünür).
function Ornek({ metin, stil, kap, cizgi }) {
  const parcalar = String(metin).split(/<b>(.*?)<\/b>/);
  return (
    <View style={kap}>
      <View style={s.kesikKap}><View style={[s.kesik, { borderColor: cizgi }]} /></View>
      <Text style={stil}>
        {parcalar.map((p, i) => (i % 2 ? <Text key={i} style={s.kalin}>{p}</Text> : p))}
      </Text>
    </View>
  );
}

function KelimeKarti({ d, seviye, okunuyor, onBas, t, sozluk }) {
  const b = sozluk ? sz : {};
  return (
    <Pressable
      onPress={onBas}
      accessibilityRole="button"
      accessibilityLabel={`${d.w}, ${d.tr}. Dinlemek için dokun`}
      style={({ pressed }) => [s.kart, b.kart, { backgroundColor: t.card, borderColor: okunuyor ? t.speak : t.line, borderLeftColor: sozluk ? t.diger : bolumRengi(t, d.sec) },
        okunuyor && { boxShadow: "0 0 0 2px " + t.speak + ", 0 6px 18px rgba(229,137,43,.18)" }, sozluk && pressed && s.basili]}
    >
      <View style={s.satir}>
        <Text style={[s.kelime, b.kelime, { color: t.ink }]}>{d.w}</Text>
        <Text style={[s.etiket, { color: t.muted }]}>{(TUR[d.pos] || d.pos)}{d.pos ? " · " : ""}{seviye}</Text>
      </View>
      {d.ok ? <Text style={[s.okunus, b.okunus, { color: t.ok }]}>Okunuş: {d.ok}</Text> : null}
      <Text style={[s.tr, b.tr, { color: t.tr }]}>{d.tr}</Text>
      {d.en ? <Text style={[s.en, b.en, { color: t.en }]}>{d.en}</Text> : null}
      {(d.ex || []).map((x, i) => (
        <Ornek key={i} metin={x} kap={[s.ornekKap, b.ornekKap]} stil={[s.ornek, b.ornek, { color: t.ex }]} cizgi={t.line} />
      ))}
    </Pressable>
  );
}

export default memo(KelimeKarti);

const s = StyleSheet.create({
  kart: { borderWidth: 1, borderLeftWidth: 5, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, marginVertical: 4.5 },
  satir: { flexDirection: "row", alignItems: "center", gap: 11 },
  kelime: { fontSize: 19, fontWeight: "800", letterSpacing: -0.19 },
  etiket: { fontSize: 11, marginLeft: "auto" },
  okunus: { fontSize: 13.5, fontWeight: "700", marginTop: 6 },
  tr: { fontSize: 14, marginTop: 3 },
  en: { fontSize: 13, marginTop: 3 },
  ornekKap: { marginTop: 5 },
  kesikKap: { height: 1, overflow: "hidden" },
  kesik: { height: 3, borderWidth: 1, borderStyle: "dashed" },
  ornek: { fontSize: 13, fontStyle: "italic", paddingTop: 5 },
  kalin: { fontWeight: "700" },
  basili: { transform: [{ scale: 0.99 }] },
});
const sz = StyleSheet.create({
  kart: { paddingVertical: 12, paddingHorizontal: 14, marginVertical: 4.5 },
  kelime: { fontSize: 21 },
  okunus: { fontSize: 14, marginTop: 7 },
  tr: { fontSize: 15, marginTop: 4 },
  en: { fontSize: 13.5, marginTop: 4 },
  ornekKap: { marginTop: 6 },
  ornek: { fontSize: 13.5, paddingTop: 6 },
});
