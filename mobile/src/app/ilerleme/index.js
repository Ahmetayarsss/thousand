/*
 * İlerleme — Capacitor'daki istatistik.html (templates/stats_template.html) ile aynı: genel olgun/öğreniliyor/yeni,
 * seviyeye göre, 30 kısım, son sınavlar. Hesaplar src/ilerleme/veri.js'te. Yeni: alttaki bağlantı İstatistikler'i
 * açar (eskiden Ayarlar'dan kaydırarak açılıyordu; yeni uygulamada kaydırarak geçiş yok).
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Pano from "../../bilesenler/Pano";
import { GRUPLAR, OXLOG, SRS } from "../../cekirdek";
import * as V from "../../ilerleme/veri";
import { OTURUM_ANAHTARI } from "../../kartlar/oturum";
import { useTema } from "../../tema";

const yuzde = (x, top) => (top ? (x / top) * 100 + "%" : "0%");

function oturumlar() {
  try { return JSON.parse(localStorage.getItem(OTURUM_ANAHTARI) || "[]"); } catch (e) { return []; }
}

export default function Ilerleme() {
  const t = useTema();
  const [v, setV] = useState(null);
  useFocusEffect(useCallback(() => {
    const lv = SRS.topLevel();
    setV({
      baslik: SRS.inCycle() + (lv ? " · " + lv : ""), top: SRS.totals(),
      seviye: V.seviyeler(SRS, GRUPLAR), kisim: V.kisimlar(SRS, GRUPLAR), sinav: V.sonSinavlar(oturumlar()),
    });
    OXLOG.add("sayfa", { p: "istatistik" });
  }, []));
  if (!v) return <View style={{ flex: 1, backgroundColor: t.kartBg }} />;
  const T = v.top;
  const sinifRengi = { iyi: t.green, orta: t.amber, dusuk: t.red };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.kartBg }}>
      <ScrollView contentContainerStyle={s.icerik}>
        <View style={s.ust}>
          <Text style={[s.h1, { color: t.ink }]} accessibilityRole="header">İlerleme</Text>
          <Text style={[s.alt, { color: t.muted }]}>{v.baslik}</Text>
        </View>

        <Pano baslik="Genel" t={t}>
          <View style={s.buyuk}>
            {[[T.mature, "Olgun", t.green], [T.learning, "Öğreniliyor", t.amber], [T.fresh, "Yeni", t.ink]].map(([n, ad, renk]) => (
              <View key={ad} style={[s.hucre, { backgroundColor: t.kartBg }]}>
                <Text style={[s.n, { color: renk }]}>{n}</Text>
                <Text style={[s.l, { color: t.muted }]}>{ad}</Text>
              </View>
            ))}
          </View>
          <View style={[s.pbar, { backgroundColor: t.neu }]}>
            <View style={{ width: yuzde(T.mature, T.total), backgroundColor: t.green }} />
            <View style={{ width: yuzde(T.learning, T.total), backgroundColor: t.amber }} />
          </View>
        </Pano>

        <Pano baslik="Seviyeye göre" t={t}>
          {v.seviye.map((x) => (
            <View key={x.lv} style={s.svSatir}>
              <Text style={[s.svEtiket, { backgroundColor: t.accent }]}>{x.lv}</Text>
              <View style={[s.iz, { backgroundColor: t.neu }]}><View style={{ width: yuzde(x.mature, x.total), height: "100%", backgroundColor: t.green }} /></View>
              <Text style={[s.svSayi, { color: t.muted }]}>{x.mature}/{x.total}</Text>
            </View>
          ))}
        </Pano>

        <Pano baslik="Kısımlar" t={t}>
          <View style={s.lejant}>
            {[["olgun", t.green], ["öğreniliyor", t.amber], ["yeni", t.neu]].map(([ad, renk]) => (
              <View key={ad} style={s.lejantOge}><View style={[s.lejantKare, { backgroundColor: renk }]} /><Text style={[s.lejantYazi, { color: t.muted }]}>{ad}</Text></View>
            ))}
          </View>
          <View style={s.izgara}>
            {v.kisim.map((k) => (
              <View key={k.no} style={[s.kisim, {
                backgroundColor: k.durum === "tamam" ? t.greenBg : k.durum === "acik" ? t.card : t.secgray,
                borderColor: k.durum === "tamam" ? t.green : t.kartLine,
              }]}>
                <View style={s.kisimUst}>
                  <Text style={[s.kisimNo, { color: t.ink }]}>Kısım {k.no}</Text>
                  <Text style={[s.kisimSv, { backgroundColor: t.accent }]}>{k.level}</Text>
                </View>
                <View style={s.kisimSayi}>
                  <Text style={[s.kisimN, { color: t.green }]}>{k.mature}</Text>
                  <Text style={[s.kisimN, { color: t.amber }]}>{k.learning}</Text>
                  <Text style={[s.kisimN, { color: t.secgrayInk }]}>{k.fresh}</Text>
                </View>
                <View style={[s.mini, { backgroundColor: t.neu }]}>
                  <View style={{ width: yuzde(k.mature, k.total), backgroundColor: t.green }} />
                  <View style={{ width: yuzde(k.learning, k.total), backgroundColor: t.amber }} />
                </View>
              </View>
            ))}
          </View>
        </Pano>

        <Pano baslik="Son sınavlar" t={t}>
          {v.sinav.length ? v.sinav.map((e, i) => (
            <View key={i} style={[s.sinav, i > 0 && { borderTopWidth: 1, borderTopColor: t.kartLine }]}>
              <Text style={[s.sinavG, { color: t.ink }]}>{e.ok}/{e.n}</Text>
              <Text style={[s.sinavD, { color: t.muted }]}>{e.ayrinti}</Text>
              <Text style={[s.sinavP, { color: sinifRengi[e.sinif] }]}>%{e.yuzde}</Text>
            </View>
          )) : <Text style={[s.bos, { color: t.muted }]}>Henüz sınav yapmadın. Çalışma sayfasında “Sınav”ı dene.</Text>}
        </Pano>

        <Pressable onPress={() => router.push("/ilerleme/analiz")} accessibilityRole="button"
          style={({ pressed }) => [s.bag, { backgroundColor: t.card, borderColor: t.kartLine, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[s.bagYazi, { color: t.ink }]}>Ayrıntılı istatistikler</Text>
          <Text style={[s.bagOk, { color: t.muted }]}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  icerik: { width: "100%", maxWidth: 600, alignSelf: "center", paddingTop: 8, paddingHorizontal: 14, paddingBottom: 24 },
  ust: { paddingTop: 6, paddingBottom: 10 },
  h1: { fontSize: 20, fontWeight: "800" },
  alt: { fontSize: 14, fontWeight: "800", marginTop: 2 },
  buyuk: { flexDirection: "row", gap: 10, marginBottom: 14 },
  hucre: { flex: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, alignItems: "center" },
  n: { fontSize: 26, fontWeight: "800", lineHeight: 28 },
  l: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  pbar: { height: 12, borderRadius: 8, overflow: "hidden", flexDirection: "row" },
  svSatir: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10 },
  svEtiket: { width: 34, fontWeight: "800", fontSize: 13, color: "#fff", borderRadius: 6, overflow: "hidden", textAlign: "center", paddingVertical: 3 },
  iz: { flex: 1, height: 9, borderRadius: 6, overflow: "hidden" },
  svSayi: { fontSize: 12, fontWeight: "700", minWidth: 62, textAlign: "right" },
  lejant: { flexDirection: "row", gap: 12, marginTop: -4, marginBottom: 10 },
  lejantOge: { flexDirection: "row", alignItems: "center" },
  lejantKare: { width: 9, height: 9, borderRadius: 3, marginRight: 4 },
  lejantYazi: { fontSize: 11, fontWeight: "700" },
  izgara: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kisim: { width: "30%", flexGrow: 1, borderRadius: 14, borderWidth: 1.5, paddingTop: 9, paddingHorizontal: 8, paddingBottom: 8 },
  kisimUst: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kisimNo: { fontSize: 12, fontWeight: "800" },
  kisimSv: { fontSize: 10, fontWeight: "800", color: "#fff", borderRadius: 5, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 1 },
  kisimSayi: { flexDirection: "row", justifyContent: "space-between", marginTop: 7, marginBottom: 6 },
  kisimN: { fontSize: 15, fontWeight: "800" },
  mini: { height: 5, borderRadius: 3, overflow: "hidden", flexDirection: "row" },
  sinav: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  sinavG: { fontWeight: "800", fontSize: 13 },
  sinavD: { flex: 1, fontSize: 11.5 },
  sinavP: { fontWeight: "800", fontSize: 15 },
  bos: { fontSize: 13, textAlign: "center", paddingVertical: 14 },
  bag: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  bagYazi: { flex: 1, fontSize: 15, fontWeight: "800" },
  bagOk: { fontSize: 22, fontWeight: "700" },
});
