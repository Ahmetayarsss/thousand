/*
 * Liste (açılış): sıradaki yeni kelimeler — ayarlardaki sayı kadar, sınavın soracağı sırayla
 * (SRS.newList). Sınavda cevaplanan kelime listeden düşer, alttan sıradaki gelir. Kelimeye
 * dokununca okunur. Ekrana her dönüşte liste yeniden hesaplanır.
 * Bütün kelimeler çalışılıyorsa liste yerine havai fişek (geliştirici modunda Ayarlar'dan ya da /?kutla=1).
 * Açılışta (bir kez): eski uygulamadan ilerleme aktarıldıysa (ya da aktarılamadıysa) söylenir (gecis.js); hesap
 * yoksa takma ad sorulur, varsa ve kullanım kaydı izni hiç sorulmadıysa izin; yeni arkadaşlık istekleri ve
 * dürtmeler haber verilir.
 * "Listeyi oku": listedeki kelimeler sırayla (src/okuma — Android'de ekran kapalıyken de, bildirim ve kilit ekranı
 * düğmeleriyle; ekrandan çıkınca sürer, Spotify gibi). Okunan kart işaretlenir ve ortaya kaydırılır. Kelime arası
 * bekleme sürgüyle (sürerken de uygulanır); döngü ve Türkçe okuma Ayarlar'da.
 */
import Slider from "@react-native-community/slider";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { duyur } from "../bilesenler/Duyuru";
import HavaiFisek from "../bilesenler/HavaiFisekKatmani";
import KelimeKarti from "../bilesenler/KelimeKarti";
import { Baslik, Dugme, Metin, pencereAc } from "../bilesenler/Pencere";
import { ANAHTARLA, GECIS, OXLOG, SRS } from "../cekirdek";
import { HESAP, useHesap } from "../hesap";
import { karsilama } from "../hesap/Karsilama";
import * as Okuma from "../okuma";
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
  const [okuyor, setOkuyor] = useState(false);
  const [bekle, setBekle] = useState(() => { const g = parseFloat(SRS.opt("gap", 0.5)); return g >= 0 && g <= 3 ? g : 0.5; });
  const liste = useRef(null), gorunenRef = useRef([]), bekleZaman = useRef(null);
  const { kutla } = useLocalSearchParams();
  const hesap = useHesap();
  useEffect(() => { if (kutla !== "1") acilis(); }, [kutla]);

  const listele = useCallback(() => { setAnahtarlar(SRS.newList(SRS.listSize())); setBaslik(ustBaslik()); }, []);
  useEffect(listele, [hesap, listele]);   // kurtarma koduyla yedek yüklenince
  // Okunan kelime: kartı işaretle, ortaya kaydır.
  const isaretle = useCallback((d, kaydir) => {
    setOkuyor(!!d.etkin);
    if (!d.etkin) { setOkunan(null); return; }
    const i = gorunenRef.current.findIndex((k) => ANAHTARLA[k].d.w === d.kelime);
    if (i < 0) return;
    setOkunan(gorunenRef.current[i]);
    if (kaydir && liste.current) { try { liste.current.scrollToIndex({ index: i, viewPosition: 0.5, animated: true }); } catch (e) {} }
  }, []);
  useEffect(() => {
    const k1 = Okuma.dinle((d) => isaretle(d, true));
    const k2 = Okuma.hata((m) => {
      OXLOG.add("okuma_hata", { m });
      if (/Bildirim KAPALI/.test(m)) {
        pencereAc((kapat) => (
          <View><Baslik>Bildirimler kapalı</Baslik><Metin>{m}</Metin>
            <Dugme metin="Bildirimleri aç" onBas={() => { kapat(); Okuma.bildirimAyarlariniAc(); }} />
            <Dugme metin="Kapat" tur="bos" onBas={kapat} /></View>
        ));
      } else duyur("🔎 " + m, 4000);
    });
    // Bildirimden ya da arka plandan dönünce süren okumayı göster.
    const k3 = AppState.addEventListener("change", (d) => { if (d === "active") isaretle(Okuma.durum(), true); });
    return () => { k1(); k2(); k3.remove(); };
  }, [isaretle]);

  useFocusEffect(useCallback(() => {
    listele();
    OXLOG.add("sayfa", { p: "index" });
    setTimeout(() => isaretle(Okuma.durum(), true), 300);   // telefonda süren okuma (başka ekrandan dönünce)
    return () => {
      durdur(); setOkunan(null);
      if (!Okuma.YEREL) Okuma.durdur();   // ekran açıkken okunuyorsa (servis yok) ekrandan çıkınca durur
      if (kutla) router.setParams({ kutla: undefined });
    };
  }, [listele, kutla, isaretle]));

  const gorunen = useMemo(() => {
    const q = ara.trim().toLowerCase();
    if (!q) return anahtarlar;
    return anahtarlar.filter((k) => { const d = ANAHTARLA[k].d; return (d.w + " " + (d.tr || "")).toLowerCase().includes(q); });
  }, [anahtarlar, ara]);
  gorunenRef.current = gorunen;

  const listeyiOku = () => {
    if (okuyor) { Okuma.durdur(); setOkuyor(false); setOkunan(null); return; }
    if (!gorunen.length) return;
    durdur();
    const loop = !!SRS.opt("loop", true), readTr = !!SRS.opt("readTr", false);
    OXLOG.add("okuma", { mod: Okuma.YEREL ? "native" : "js", n: gorunen.length, dongu: loop ? 1 : 0, tr: readTr ? 1 : 0 });
    Okuma.oku({ anahtarlar: gorunen, gap: Math.round(bekle * 1000), loop, readTr });
    setOkuyor(true);
  };
  const bekleDegisti = (v) => {
    setBekle(v); SRS.setOpt("gap", v);
    clearTimeout(bekleZaman.current);
    bekleZaman.current = setTimeout(() => { Okuma.bekleme(Math.round(v * 1000)); OXLOG.add("ayar", { bekleme: Math.round(v * 1000) }); }, 400);
  };

  const oku = useCallback((k) => {
    Okuma.durdur(); setOkuyor(false);   // tek kelime: okuma durur (eskisi gibi)
    setOkunan(k);
    kelimeyiOku(ANAHTARLA[k].d.w, () => setOkunan((o) => (o === k ? null : o)));
  }, []);

  const kutlama = (!anahtarlar.length && baslik !== "") || kutla === "1";
  return (
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.bg }]}>
      <View style={[s.ust, { borderBottomColor: t.line }]}>
        <Text style={[s.baslik, { color: t.ink }]} accessibilityRole="header">{baslik}</Text>
        {kutlama ? null : (
        <View style={s.denetim}>
          <Text style={[s.bekleYazi, { color: t.muted }]}>Kelime arası</Text>
          <Slider style={s.surgu} minimumValue={0} maximumValue={3} step={0.25} value={bekle} onValueChange={bekleDegisti}
            minimumTrackTintColor={t.accent} maximumTrackTintColor={t.line} thumbTintColor={t.accent}
            accessibilityLabel="Kelimeler arası bekleme" />
          <Text style={[s.bekleDeger, { color: t.ink }]}>{String(bekle).replace(".", ",")} sn</Text>
          <Pressable onPress={listeyiOku} accessibilityRole="button"
            style={[s.okuDugme, { backgroundColor: okuyor ? t.speakKoyu : t.solid }]}>
            <Text style={[s.okuYazi, { color: t.onSolid }]}>{okuyor ? "■ Durdur" : "▶ Listeyi oku"}</Text>
          </Pressable>
        </View>
        )}
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
        ref={liste}
        data={gorunen}
        onScrollToIndexFailed={(e) => { try { liste.current.scrollToOffset({ offset: e.averageItemLength * e.index, animated: true }); } catch (x) {} }}
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
  denetim: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  bekleYazi: { fontSize: 12 },
  surgu: { width: 96, height: 30 },
  bekleDeger: { fontSize: 12, fontWeight: "700", minWidth: 38 },
  okuDugme: { marginLeft: "auto", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13 },
  okuYazi: { fontSize: 13, fontWeight: "700" },
  ara: { marginTop: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  liste: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 24 },
  bos: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
