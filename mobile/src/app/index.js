/*
 * Liste (açılış): sıradaki yeni kelimeler — ayarlardaki sayı kadar, sınavın soracağı sırayla
 * (SRS.newList). Sınavda cevaplanan kelime listeden düşer, alttan sıradaki gelir. Kelimeye
 * dokununca okunur. Ekrana her dönüşte liste yeniden hesaplanır.
 * Bütün kelimeler çalışılıyorsa liste yerine havai fişek (geliştirici modunda Ayarlar'dan ya da /?kutla=1).
 * Açılışta (bir kez): hesap yoksa takma ad (ya da kurtarma kodu) sorulur; varsa ve kullanım kaydı izni hiç
 * sorulmadıysa izin, bildirim ayarları eksikse kurulum (bir kez); yeni arkadaşlık istekleri ve dürtmeler haber verilir.
 * "Listeyi oku": listedeki kelimeler sırayla (src/okuma — Android'de ekran kapalıyken de, bildirim ve kilit ekranı
 * düğmeleriyle; ekrandan çıkınca sürer, Spotify gibi). Okunan kart işaretlenir ve ortaya kaydırılır. Kelime arası
 * bekleme sürgüyle (sürerken de uygulanır); döngü ve Türkçe okuma Ayarlar'da. Dokunulan kart da ortaya kaydırılır.
 * İlk açılışta bir kez sayfa haritası (Tanitim). Kaydırma: sola Kartlar, sağa Sözlük. Ekrandan çıkınca arama silinir.
 */
import Slider from "@react-native-community/slider";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { duyur } from "../bilesenler/Duyuru";
import HavaiFisek from "../bilesenler/HavaiFisekKatmani";
import Kaydir, { kaydirmayiEngelle } from "../bilesenler/Kaydir";
import KelimeKarti from "../bilesenler/KelimeKarti";
import { tanitim } from "../bilesenler/Tanitim";
import { Baslik, Dugme, Metin, pencereAc } from "../bilesenler/Pencere";
import { ANAHTARLA, OXLOG, SRS } from "../cekirdek";
import { HESAP, useHesap } from "../hesap";
import { haberler } from "../hesap/haberler";
import { bildirimKurulumu } from "../bildirim/Kurulum";
import { karsilama } from "../hesap/Karsilama";
import * as Okuma from "../okuma";
import { durdur, kelimeyiOku } from "../ses";
import { useTema } from "../tema";

let acildi = false;
function acilis() {
  if (acildi) return;
  acildi = true;
  setTimeout(() => {
    if (!HESAP.account()) { karsilama(); return; }
    if (HESAP.kayitIzni() === null) karsilama({ adim: "izin" });
    bildirimKurulumu();   // telefon ayarları (bildirim izni, otomatik başlatma): eksikse bir kez
    haberler();
  }, 800);
  tanitim();   // pencereler (takma ad, kurulum) kapanınca, bir kez
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
  const [okunan, setOkunan] = useState(null);       // "Listeyi oku"nun okuduğu
  const [dokunulan, setDokunulan] = useState(null); // dokunulup okunan (okumanın "durdu" haberi bunu silmez)
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
        ), (kapat) => kapat());
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
      durdur(); setOkunan(null); setDokunulan(null); setAra("");
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
    setOkuyor(true);   // başlatılamazsa hata haberi geri alır
    Okuma.oku({ anahtarlar: gorunen, gap: Math.round(bekle * 1000), loop, readTr });
  };
  const bekleDegisti = (v) => {
    kaydirmayiEngelle();   // sürgüyü kaydırmak sayfa değiştirmesin
    setBekle(v); SRS.setOpt("gap", v);
    clearTimeout(bekleZaman.current);
    bekleZaman.current = setTimeout(() => { Okuma.bekleme(Math.round(v * 1000)); OXLOG.add("ayar", { bekleme: Math.round(v * 1000) }); }, 400);
  };

  const oku = useCallback((k) => {
    Keyboard.dismiss();
    Okuma.durdur(); setOkuyor(false); setOkunan(null);   // tek kelime: okuma durur (eskisi gibi)
    setDokunulan(k);
    const i = gorunenRef.current.indexOf(k);
    if (i >= 0 && liste.current) { try { liste.current.scrollToIndex({ index: i, viewPosition: 0.5, animated: true }); } catch (e) {} }
    kelimeyiOku(ANAHTARLA[k].d.w, () => setDokunulan((o) => (o === k ? null : o)), 0.8);
  }, []);

  const kutlama = (!anahtarlar.length && baslik !== "") || kutla === "1";
  return (
    <Kaydir ad="index">
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.bg }]}>
      <View style={[s.ust, { borderBottomColor: t.line }]}>
        <Text style={[s.baslik, { color: t.ink }]} accessibilityRole="header">{baslik}</Text>
        {kutlama ? null : (
        <View style={s.denetim}>
          <Text style={[s.bekleYazi, { color: t.muted }]}>Kelime arası</Text>
          <Slider style={s.surgu} minimumValue={0} maximumValue={3} step={0.25} value={bekle} onValueChange={bekleDegisti} onSlidingStart={kaydirmayiEngelle}
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
          return <KelimeKarti d={e.d} seviye={e.g.level} okunuyor={okunan === k || dokunulan === k} onBas={() => oku(k)} t={t} />;
        }}
        extraData={[okunan, dokunulan]}
        contentContainerStyle={s.liste}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={<Text style={[s.bos, { color: t.muted }]}>Aramaya uyan kelime yok.</Text>}
      />
      )}
    </SafeAreaView>
    </Kaydir>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1 },
  ust: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  baslik: { fontSize: 16, fontWeight: "800", paddingVertical: 4 },
  denetim: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 },
  bekleYazi: { fontSize: 12 },
  surgu: { width: 84, height: 30 },
  bekleDeger: { fontSize: 12, fontWeight: "700", minWidth: 38 },
  okuDugme: { marginLeft: "auto", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13 },
  okuYazi: { fontSize: 13, fontWeight: "700" },
  ara: { marginTop: 9, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  liste: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 24 },
  bos: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
