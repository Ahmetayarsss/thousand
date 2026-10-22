/*
 * Ortadaki pencere (eski uygulamadaki .oxacc kutusu): tek yer, uygulamanın kökünde (PencereAlani, _layout.js).
 * pencereAc(ciz, vazgec) → ciz(kapat) pencerenin içini çizer; aynı anda tek pencere, sonra açılan sıraya girer.
 * vazgec(kapat): geri tuşu ya da pencerenin dışına dokunma (eski confirm/prompt pencereleri gibi "Vazgeç");
 * verilmezse pencere yalnız kendi düğmeleriyle kapanır (ör. kurtarma kodunu kaydetme).
 * Hazır olanlar: onayla (Tamam/Vazgeç — Alert webde ve çok düğmede her yerde aynı çalışmadığı için) ve
 * girdiIste (iOS dışında Alert.prompt yok). Dugme ve Girdi pencerelerin ortak parçaları.
 */
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTema } from "../tema";

let sira = [], dinle = null;
function yenile() { if (dinle) dinle(sira[0] || null); }

export function pencereAc(ciz, vazgec) {
  const p = { ciz };
  p.kapat = () => { sira = sira.filter((x) => x !== p); yenile(); };
  p.vazgec = vazgec ? () => vazgec(p.kapat) : null;
  sira.push(p);
  yenile();
  return p.kapat;
}
export function pencereAcikMi() { return sira.length > 0; }

export function PencereAlani() {
  const t = useTema();
  const [p, setP] = useState(sira[0] || null);
  useEffect(() => { dinle = setP; setP(sira[0] || null); return () => { dinle = null; }; }, []);
  return (
    <Modal transparent visible={!!p} animationType="fade" onRequestClose={() => { if (p && p.vazgec) p.vazgec(); }} statusBarTranslucent>
      <View style={[s.perde, { backgroundColor: t.scrim }]}>
        <ScrollView contentContainerStyle={s.kaydir} keyboardShouldPersistTaps="handled">
          <Pressable style={s.dis} onPress={() => { if (p && p.vazgec) p.vazgec(); }} accessible={false}>
            <Pressable style={[s.kutu, { backgroundColor: t.card }]} onPress={() => {}} accessible={false}>{p ? p.ciz(p.kapat) : null}</Pressable>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function Baslik({ children }) {
  const t = useTema();
  return <Text style={[s.baslik, { color: t.ink }]} accessibilityRole="header">{children}</Text>;
}
export function Metin({ children, style }) {
  const t = useTema();
  return <Text style={[s.metin, { color: t.ex }, style]}>{children}</Text>;
}

// tur: "dolu" (koyu), "bos" (açık), "kirmizi", "yesil", "mavi"; kucuk: satır içi düğme. Büyük boş düğme eski
// pencerelerdeki gibi kenarsız, açık zeminli (koyu temada kutudan açık).
export function Dugme({ metin, onBas, tur = "dolu", pasif, kucuk, style, yaziRengi, yaziBoyu }) {
  const t = useTema();
  const bos = kucuk ? t.kartBg : t.koyu ? t.soft : t.kartBg;
  const zemin = { dolu: t.solid, bos, kirmizi: t.red, yesil: t.green, mavi: t.accent }[tur];
  const yazi = tur === "bos" ? t.ink : tur === "dolu" ? t.onSolid : "#fff";
  return (
    <Pressable onPress={onBas} disabled={pasif} accessibilityRole="button" accessibilityState={{ disabled: !!pasif }}
      style={({ pressed }) => [kucuk ? s.kucuk : s.dugme, { backgroundColor: zemin, opacity: pasif ? 0.55 : pressed ? 0.85 : 1 },
        tur === "bos" && kucuk && { borderWidth: 1, borderColor: t.kartLine }, style]}>
      <Text style={[kucuk ? s.kucukYazi : s.dugmeYazi, { color: yaziRengi || yazi }, yaziBoyu && { fontSize: yaziBoyu }]}>{metin}</Text>
    </Pressable>
  );
}

// Odaklanınca kenarı mavi (eskisi gibi).
export function Girdi(p) {
  const t = useTema();
  const [odak, setOdak] = useState(false);
  return (
    <TextInput autoCorrect={false} autoComplete="off" placeholderTextColor={t.muted} {...p}
      onFocus={(e) => { setOdak(true); if (p.onFocus) p.onFocus(e); }} onBlur={(e) => { setOdak(false); if (p.onBlur) p.onBlur(e); }}
      style={[s.girdi, { borderColor: odak ? t.accent : t.kartLine, color: t.ink, backgroundColor: t.field }, p.style]} />
  );
}
export function Hata({ children }) {
  const t = useTema();
  return <Text style={[s.hata, { color: t.red }]}>{children || ""}</Text>;
}

export function onayla(baslik, metin, evet = "Tamam", tehlikeli = false) {
  return new Promise((coz) => {
    pencereAc((kapat) => (
      <View>
        <Baslik>{baslik}</Baslik>
        {metin ? <Metin>{metin}</Metin> : null}
        <Dugme metin={evet} tur={tehlikeli ? "kirmizi" : "dolu"} onBas={() => { kapat(); coz(true); }} />
        <Dugme metin="Vazgeç" tur="bos" onBas={() => { kapat(); coz(false); }} />
      </View>
    ), (kapat) => { kapat(); coz(false); });
  });
}

function GirdiPenceresi({ baslik, ilk, enCok, bitir }) {
  const [v, setV] = useState(ilk || "");
  return (
    <View>
      <Baslik>{baslik}</Baslik>
      <Girdi value={v} onChangeText={setV} maxLength={enCok} autoFocus onSubmitEditing={() => bitir(v)} />
      <View style={{ height: 10 }} />
      <Dugme metin="Tamam" onBas={() => bitir(v)} />
      <Dugme metin="Vazgeç" tur="bos" onBas={() => bitir(null)} />
    </View>
  );
}
export function girdiIste(baslik, ilk, enCok) {
  return new Promise((coz) => {
    pencereAc((kapat) => <GirdiPenceresi baslik={baslik} ilk={ilk} enCok={enCok} bitir={(v) => { kapat(); coz(v); }} />,
      (kapat) => { kapat(); coz(null); });
  });
}

const s = StyleSheet.create({
  perde: { flex: 1 },
  kaydir: { flexGrow: 1 },
  dis: { flexGrow: 1, justifyContent: "center", padding: 18 },
  kutu: { width: "100%", maxWidth: 400, alignSelf: "center", borderRadius: 20, paddingVertical: 22, paddingHorizontal: 20,
    boxShadow: "0 18px 50px rgba(0,0,0,.3)" },
  baslik: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  metin: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  dugme: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  dugmeYazi: { fontSize: 16, fontWeight: "800" },
  kucuk: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: "center" },
  kucukYazi: { fontSize: 13, fontWeight: "800" },
  girdi: { borderWidth: 2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 17, fontWeight: "700" },
  hata: { fontSize: 13, fontWeight: "700", minHeight: 18, marginTop: 8, marginBottom: 2 },
});
