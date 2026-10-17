// İlerleme ve İstatistikler sayfalarındaki beyaz kart (.card): başlık (büyük harf), isteğe bağlı açıklama.
import { StyleSheet, Text, View } from "react-native";

export default function Pano({ baslik, aciklama, t, children, style }) {
  return (
    <View style={[s.pano, { backgroundColor: t.card, borderColor: t.kartLine, boxShadow: "0 6px 20px " + t.golge }, style]}>
      {baslik ? <Text style={[s.baslik, { color: t.muted }, aciklama ? s.aciklamali : null]} accessibilityRole="header">{baslik.toLocaleUpperCase("tr-TR")}</Text> : null}
      {aciklama ? <Text style={[s.aciklama, { color: t.muted }]}>{aciklama}</Text> : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  pano: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
  baslik: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4, marginBottom: 12 },
  aciklamali: { marginBottom: 4 },
  aciklama: { fontSize: 12, marginBottom: 10 },
});
