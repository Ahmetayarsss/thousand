// Liste kartı: kelime, tür · seviye, okunuş, Türkçe anlam, İngilizce açıklama, örnekler.
// Dokununca kelime okunur; okunurken kartın çevresi turuncu.
// sozluk: Sözlük'teki biçim (eskisi gibi biraz büyük yazı, sol şerit bölüm renginde değil gri).
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { bolumRengi } from "../tema";

const TUR = { "yardımcı fiil": "yard. fiil" };

// Örnek cümlede kelime <b>…</b> içinde: kalın yazılır, başka etiket yok.
function Ornek({ metin, stil }) {
  const parcalar = String(metin).split(/<b>(.*?)<\/b>/);
  return (
    <Text style={stil}>
      {parcalar.map((p, i) => (i % 2 ? <Text key={i} style={s.kalin}>{p}</Text> : p))}
    </Text>
  );
}

function KelimeKarti({ d, seviye, okunuyor, onBas, t, sozluk }) {
  const b = sozluk ? sz : {};
  return (
    <Pressable
      onPress={onBas}
      accessibilityRole="button"
      accessibilityLabel={`${d.w}, ${d.tr}. Dinlemek için dokun`}
      style={[s.kart, b.kart, { backgroundColor: t.card, borderColor: okunuyor ? t.speak : t.line, borderLeftColor: sozluk ? t.diger : bolumRengi(t, d.sec) }]}
    >
      <View style={s.satir}>
        <Text style={[s.kelime, b.kelime, { color: t.ink }]}>{d.w}</Text>
        <Text style={[s.etiket, { color: t.muted }]}>{(TUR[d.pos] || d.pos)}{d.pos ? " · " : ""}{seviye}</Text>
      </View>
      {d.ok ? <Text style={[s.okunus, b.okunus, { color: t.ok }]}>Okunuş: {d.ok}</Text> : null}
      <Text style={[s.tr, b.tr, { color: t.tr }]}>{d.tr}</Text>
      {d.en ? <Text style={[s.en, b.en, { color: t.en }]}>{d.en}</Text> : null}
      {(d.ex || []).map((x, i) => (
        <Ornek key={i} metin={x} stil={[s.ornek, b.ornek, { color: t.ex, borderTopColor: t.line }]} />
      ))}
    </Pressable>
  );
}

export default memo(KelimeKarti);

const s = StyleSheet.create({
  kart: { borderWidth: 1, borderLeftWidth: 5, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, marginVertical: 5 },
  satir: { flexDirection: "row", alignItems: "center", gap: 11 },
  kelime: { fontSize: 19, fontWeight: "800" },
  etiket: { fontSize: 11, marginLeft: "auto" },
  okunus: { fontSize: 13.5, fontWeight: "700", marginTop: 6 },
  tr: { fontSize: 14, marginTop: 3 },
  en: { fontSize: 13, marginTop: 3 },
  ornek: { fontSize: 13, fontStyle: "italic", marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderStyle: "dashed" },
  kalin: { fontWeight: "800" },
});
const sz = StyleSheet.create({
  kart: { paddingVertical: 12, paddingHorizontal: 14, marginVertical: 4.5 },
  kelime: { fontSize: 21 },
  okunus: { fontSize: 14, marginTop: 7 },
  tr: { fontSize: 15, marginTop: 4 },
  en: { fontSize: 13.5, marginTop: 4 },
  ornek: { fontSize: 13.5, marginTop: 6, paddingTop: 6 },
});
