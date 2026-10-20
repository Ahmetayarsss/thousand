/*
 * Liste (açılış): sıradaki yeni kelimeler — ayarlardaki sayı kadar, sınavın soracağı sırayla
 * (SRS.newList). Sınavda cevaplanan kelime listeden düşer, alttan sıradaki gelir. Kelimeye
 * dokununca okunur. Ekrana her dönüşte liste yeniden hesaplanır.
 * Bütün kelimeler çalışılıyorsa liste yerine havai fişek (geliştirici modunda Ayarlar'dan ya da /?kutla=1).
 * Açılışta (bir kez): eski uygulamadan ilerleme aktarıldıysa (ya da aktarılamadıysa) söylenir (gecis.js); hesap
 * yoksa takma ad sorulur, varsa ve kullanım kaydı izni hiç sorulmadıysa izin; yeni arkadaşlık istekleri ve
 * dürtmeler haber verilir.
 * Henüz yok: "Listeyi oku" ve bekleme sürgüsü (adım 35).
 */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { duyur } from "../bilesenler/Duyuru";
import HavaiFisek from "../bilesenler/HavaiFisekKatmani";
import KelimeKarti from "../bilesenler/KelimeKarti";
import { Baslik, Dugme, Metin, pencereAc } from "../bilesenler/Pencere";
import { ANAHTARLA, GECIS, OXLOG, SRS } from "../cekirdek";
import { HESAP, useHesap } from "../hesap";
import { karsilama } from "../hesap/Karsilama";
import { durdur, kelimeyiOku } from "../ses";
import { useTema } from "../tema";

function gecisiSoyle() {
  const ac = (baslik, metin) => pencereAc((kapat) => (
    <View><Baslik>{baslik}</Baslik><Metin>{metin}</Metin><Dugme metin="Tamam" onBas={kapat} /></View>
  ));
  if (GECIS.durum === "aktarildi") {
    ac("İlerlemen aktarıldı", "Eski uygulamadaki ilerlemen bu uygulamaya geçti: " + GECIS.kelime + " kelime.");
  } else if (GECIS.durum === "bozuk") {
    ac("İlerleme aktarılamadı", "Eski uygulamadaki ilerlemen okunamadı (" + GECIS.hata + "). Eski veriler telefonda duruyor; " +
      "uygulamayı silme, bu ekranın görüntüsünü gönder.");
  }
}

// Arkadaş haberleri: görülmemiş istekler ve (son 24 saatteki) dürtmeler; görülenler eskisiyle aynı anahtarlarda.
function haberler(d) {
  const oku = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } };
  const yaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const gelen = (d && d.incoming) || [], m = [];
  const gorulen = oku("ox3000_istek_gor"), yeni = gelen.filter((r) => !gorulen.includes(r.id));
  if (yeni.length) m.push("👥 " + (yeni.length === 1 ? yeni[0].nick + " sana arkadaşlık isteği gönderdi" : yeni.length + " yeni arkadaşlık isteği") + " — Arkadaş sekmesinde.");
  yaz("ox3000_istek_gor", gelen.map((r) => r.id));
  const dz = (d && d.durtmeler) || [], dg = oku("ox3000_durt_gor"), kim = [];
  dz.filter((x) => !dg.includes(x.id)).forEach((x) => { if (!kim.some((y) => y.from === x.from)) kim.push(x); });
  if (kim.length) m.push("👉 " + kim[0].nick + (kim.length > 1 ? " ve " + (kim.length - 1) + " kişi daha" : "") + " seni dürttü: Hadi çalış!");
  yaz("ox3000_durt_gor", dz.map((x) => x.id));
  m.forEach((x, i) => setTimeout(() => duyur(x), i * 4300));
}

let acildi = false;
function acilis() {
  if (acildi) return;
  acildi = true;
  gecisiSoyle();
  setTimeout(() => {
    if (!HESAP.account()) { karsilama(); return; }
    if (HESAP.kayitIzni() === null) karsilama({ adim: "izin" });
    HESAP.dashboard().then(haberler, () => {});
  }, 800);
}

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
  const hesap = useHesap();
  useEffect(() => { if (kutla !== "1") acilis(); }, [kutla]);

  const listele = useCallback(() => { setAnahtarlar(SRS.newList(SRS.listSize())); setBaslik(ustBaslik()); }, []);
  useEffect(listele, [hesap, listele]);   // kurtarma koduyla yedek yüklenince
  useFocusEffect(useCallback(() => {
    listele();
    OXLOG.add("sayfa", { p: "index" });
    return () => { durdur(); setOkunan(null); if (kutla) router.setParams({ kutla: undefined }); };
  }, [listele, kutla]));

  const gorunen = useMemo(() => {
    const q = ara.trim().toLowerCase();
    if (!q) return anahtarlar;
    return anahtarlar.filter((k) => { const d = ANAHTARLA[k].d; return (d.w + " " + (d.tr || "")).toLowerCase().includes(q); });
  }, [anahtarlar, ara]);

  const oku = useCallback((k) => {
    setOkunan(k);
    kelimeyiOku(ANAHTARLA[k].d.w, () => setOkunan((o) => (o === k ? null : o)));
  }, []);

  const kutlama = (!anahtarlar.length && baslik !== "") || kutla === "1";
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
