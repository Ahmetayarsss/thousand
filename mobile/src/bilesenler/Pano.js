// Eski sayfalardaki beyaz kart (.card): başlık (büyük harf), başlığın yanında isteğe bağlı ek (ör. sayı rozeti),
// isteğe bağlı açıklama. baslikRengi: başlığın rengi (ör. geliştirici modu mor); sik: başlık altı 4 px (eski analiz
// sayfasındaki .card h2).
import { StyleSheet, Text, View } from "react-native";

export default function Pano({ baslik, ek, aciklama, t, children, style, baslikRengi, sik }) {
  return (
    <View style={[s.pano, { backgroundColor: t.card, borderColor: t.kartLine, boxShadow: "0 6px 20px " + t.golge }, style]}>
      {baslik ? (
        <View style={[s.ust, aciklama || sik ? s.aciklamali : null]}>
          <Text style={[s.baslik, { color: baslikRengi || t.muted }]} accessibilityRole="header">{baslik.toLocaleUpperCase("tr-TR")}</Text>
          {ek}
        </View>
      ) : null}
      {aciklama ? <Text style={[s.aciklama, { color: t.muted }]}>{aciklama}</Text> : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  pano: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
  ust: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  baslik: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  aciklamali: { marginBottom: 4 },
  aciklama: { fontSize: 12, marginBottom: 10 },
});
