// Henüz taşınmamış ekran: hangi adımda geleceğini söyler (PLAN.md, Aşama 9).
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTema } from "../tema";

export default function Tasiniyor({ baslik, adim }) {
  const t = useTema();
  return (
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.bg }]}>
      <View style={s.orta}>
        <Text style={[s.baslik, { color: t.ink }]}>{baslik}</Text>
        <Text style={[s.metin, { color: t.muted }]}>Bu ekran yeni uygulamaya henüz taşınmadı (PLAN.md, adım {adim}).</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1 },
  orta: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  baslik: { fontSize: 20, fontWeight: "800" },
  metin: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
