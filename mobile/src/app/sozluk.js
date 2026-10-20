/*
 * Sözlük — Capacitor'daki sozluk.html (templates/sozluk_template.html) ile aynı: 3000 kelimenin hepsinde arama
 * (İngilizce ya da Türkçe), en çok 60 sonuç; boşken 📖. Karta dokununca kelime okunur. Arama src/sozluk/arama.js'te.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import KelimeKarti from "../bilesenler/KelimeKarti";
import { GRUPLAR, OXLOG } from "../cekirdek";
import { durdur, kelimeyiOku } from "../ses";
import { ara, kelimeListesi } from "../sozluk/arama";
import { useTema } from "../tema";

const LISTE = kelimeListesi(GRUPLAR);

export default function Sozluk() {
  const t = useTema();
  const [q, setQ] = useState("");
  const [okunan, setOkunan] = useState(null);
  const sonuc = useMemo(() => ara(LISTE, q), [q]);
  useFocusEffect(useCallback(() => {
    OXLOG.add("sayfa", { p: "sozluk" });
    return () => { durdur(); setOkunan(null); };
  }, []));
  const oku = useCallback((x) => {
    setOkunan(x.d._k);
    kelimeyiOku(x.d.w, () => setOkunan((o) => (o === x.d._k ? null : o)));
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.bg }]}>
      <View style={[s.ust, { borderBottomColor: t.line }]}>
        <Text style={[s.baslik, { color: t.ink }]} accessibilityRole="header">Sözlük</Text>
        <TextInput value={q} onChangeText={setQ} accessibilityLabel="Sözlükte ara (İngilizce ya da Türkçe)"
          autoCorrect={false} autoCapitalize="none" spellCheck={false} clearButtonMode="while-editing"
          style={[s.ara, { color: t.ink, backgroundColor: t.field, borderColor: t.line }]} />
      </View>
      {q.trim() ? (
        <FlatList
          data={sonuc}
          keyExtractor={(x) => x.d._k}
          renderItem={({ item: x }) => <KelimeKarti sozluk d={x.d} seviye={x.seviye} okunuyor={okunan === x.d._k} onBas={() => oku(x)} t={t} />}
          extraData={okunan}
          contentContainerStyle={s.liste}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      ) : (
        <Text style={[s.ipucu, { color: t.muted }]}>📖</Text>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1 },
  ust: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  baslik: { fontSize: 17, fontWeight: "800", letterSpacing: -0.34 },
  ara: { marginTop: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  liste: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 60 },
  ipucu: { textAlign: "center", fontSize: 34, marginTop: 40 },
});
