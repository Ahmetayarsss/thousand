/*
 * Liste (açılış): sıradaki yeni kelimeler — ayarlardaki sayı kadar, sınavın soracağı sırayla
 * (SRS.newList). Sınavda cevaplanan kelime listeden düşer, alttan sıradaki gelir. Kelimeye
 * dokununca okunur. Ekrana her dönüşte liste yeniden hesaplanır.
 * Bütün kelimeler çalışılıyorsa liste yerine havai fişek (webde denemek için: /?kutla=1).
 * Henüz yok: "Listeyi oku" ve bekleme sürgüsü (adım 35), ilk açılış penceresi ve arkadaş
 * haberleri (adım 34).
 */
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HavaiFisek from "../bilesenler/HavaiFisekKatmani";
import KelimeKarti from "../bilesenler/KelimeKarti";
import { ANAHTARLA, OXLOG, SRS } from "../cekirdek";
import { durdur, kelimeyiOku } from "../ses";
import { useTema } from "../tema";

function ustBaslik() {
  const lv = SRS.topLevel();
  return SRS.inCycle() + (lv ? " · " + lv : "");
}

export default function Liste() {
  const t = useTema();
  const [anahtarlar, setAnahtarlar] = useState([]);
  const [baslik, setBaslik] = useState("");
  const [ara, setAra] = useState("");
  const [okunan, setOkunan] = useState(null);
  const { kutla } = useLocalSearchParams();

  useFocusEffect(useCallback(() => {
    setAnahtarlar(SRS.newList(SRS.listSize()));
    setBaslik(ustBaslik());
    OXLOG.add("sayfa", { p: "index" });
    return () => { durdur(); setOkunan(null); };
  }, []));

  const gorunen = useMemo(() => {
    const q = ara.trim().toLowerCase();
    if (!q) return anahtarlar;
    return anahtarlar.filter((k) => { const d = ANAHTARLA[k].d; return (d.w + " " + (d.tr || "")).toLowerCase().includes(q); });
  }, [anahtarlar, ara]);

  const oku = useCallback((k) => {
    setOkunan(k);
    kelimeyiOku(ANAHTARLA[k].d.w, () => setOkunan((o) => (o === k ? null : o)));
  }, []);

  const kutlama = (!anahtarlar.length && baslik !== "") || (Platform.OS === "web" && kutla === "1");
  return (
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.bg }]}>
      <View style={[s.ust, { borderBottomColor: t.line }]}>
        <Text style={[s.baslik, { color: t.ink }]} accessibilityRole="header">{baslik}</Text>
        {kutlama ? null : (
        <TextInput
          value={ara}
          onChangeText={setAra}
          placeholder="Listede ara… (İngilizce/Türkçe)"
          placeholderTextColor={t.muted}
          accessibilityLabel="Listede ara"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          style={[s.ara, { color: t.ink, backgroundColor: t.field, borderColor: t.line }]}
        />
        )}
      </View>
      {kutlama ? <View style={s.liste}><HavaiFisek /></View> : (
      <FlatList
        data={gorunen}
        keyExtractor={(k) => k}
        renderItem={({ item: k }) => {
          const e = ANAHTARLA[k];
          return <KelimeKarti d={e.d} seviye={e.g.level} okunuyor={okunan === k} onBas={() => oku(k)} t={t} />;
        }}
        extraData={okunan}
        contentContainerStyle={s.liste}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={<Text style={[s.bos, { color: t.muted }]}>Aramaya uyan kelime yok.</Text>}
      />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1 },
  ust: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  baslik: { fontSize: 16, fontWeight: "800", paddingVertical: 4 },
  ara: { marginTop: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  liste: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 24 },
  bos: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
