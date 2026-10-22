/*
 * "Sayfalar nerede? 🗺️" — ilk açılışta bir kez (eski Liste sayfasındaki tanıtımın aynısı): sayfalar arası parmakla
 * geçiş (Kaydir.js, gezinme.js → KOMSU) haritada gösterilir. Takma ad / bildirim kurulumu pencereleri önce açılır;
 * art arda 1 sn hiç pencere yoksa çıkar. Görüldüğü ox3000_tanitim_v1'de (eskisiyle aynı anahtar).
 */
import { StyleSheet, Text, View } from "react-native";
import { OXLOG } from "../cekirdek";
import { useTema } from "../tema";
import { Baslik, Dugme, pencereAc, pencereAcikMi } from "./Pencere";

const TANK = "ox3000_tanitim_v1";

export function tanitim() {
  let gor = false;
  try { gor = !!localStorage.getItem(TANK); } catch (e) { gor = true; }
  if (gor) return;
  setTimeout(() => {
    let bos = 0;
    const z = setInterval(() => {
      if (pencereAcikMi()) { bos = 0; return; }
      if (++bos < 2) return;
      clearInterval(z);
      const tamam = (kapat) => {
        kapat();
        try { localStorage.setItem(TANK, "1"); } catch (e) { /* bir dahaki açılışta yine gösterilir */ }
        OXLOG.add("tanitim", { a: "tamam" });
      };
      pencereAc((kapat) => <Harita tamam={() => tamam(kapat)} />, tamam);
      OXLOG.add("tanitim", { a: "goster" });
    }, 500);
  }, 1500);
}

function Harita({ tamam }) {
  const t = useTema();
  const Sayfa = ({ i, ad, burada }) => (
    <View style={[s.pg, { borderColor: burada ? t.solid : t.ayrac, backgroundColor: burada ? t.solid : t.bg }]}>
      <Text style={s.ikon}>{i}</Text>
      <Text style={[s.ad, { color: burada ? t.onSolid : t.ink }]} numberOfLines={2}>{ad}</Text>
      {burada ? <Text style={s.burada}>Buradasın</Text> : null}
    </View>
  );
  const Yatay = () => <View style={s.araY}><View style={[s.cizgiY, { backgroundColor: t.ayrac }]} /></View>;
  const Bos = ({ dar }) => <View style={dar ? s.araY : s.bos} />;
  const Dikey = () => (
    <View style={s.dikeySatir}>
      <View style={s.bos}><View style={[s.cizgiD, { backgroundColor: t.ayrac }]} /></View>
      <Bos dar /><Bos /><Bos dar /><Bos /><Bos dar /><Bos />
    </View>
  );
  const Madde = ({ ok, b, m }) => (
    <View style={s.madde}>
      <Text style={[s.ok, { color: t.ink }]}>{ok}</Text>
      <Text style={[s.maddeYazi, { color: t.en }]}><Text style={{ fontWeight: "800", color: t.ink }}>{b}</Text> {m}</Text>
    </View>
  );
  return (
    <View>
      <Baslik>Sayfalar nerede? 🗺️</Baslik>
      <Text style={[s.alt, { color: t.ex }]}>Sayfalar arasında parmağını kaydırarak geçersin. Hepsi bu haritadaki gibi yan yana ve üst üste durur.</Text>
      <View style={s.harita}>
        <View style={s.satir}><Sayfa i="⚙️" ad="Ayarlar" /><Yatay /><Sayfa i="📊" ad="İstatistikler" /><Bos dar /><Bos /><Bos dar /><Bos /></View>
        <Dikey />
        <View style={s.satir}><Sayfa i="📖" ad="Sözlük" /><Yatay /><Sayfa i="🏠" ad="Ana sayfa" burada /><Yatay /><Sayfa i="🃏" ad="Test / Sınav" /><Yatay /><Sayfa i="📈" ad="İlerleme" /></View>
        <Dikey />
        <View style={s.satir}><Sayfa i="👥" ad="Arkadaşlar" /><Bos dar /><Bos /><Bos dar /><Bos /><Bos dar /><Bos /></View>
      </View>
      <Madde ok="↔" b="Yandaki sayfa:" m="parmağını sağa ya da sola kaydır." />
      <Madde ok="⬇" b="Üstteki sayfa:" m="sayfanın en üstündeyken aşağı çek." />
      <Madde ok="⬆" b="Alttaki sayfa:" m="sayfanın en altındayken yukarı it." />
      <View style={{ height: 8 }} />
      <Dugme metin="Anladım" onBas={tamam} />
    </View>
  );
}

const s = StyleSheet.create({
  alt: { fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  harita: { marginBottom: 14 },
  satir: { flexDirection: "row", height: 56 },
  dikeySatir: { flexDirection: "row", height: 10 },
  pg: { flex: 1, borderWidth: 1.5, borderRadius: 10, alignItems: "center", justifyContent: "center", padding: 2, minWidth: 0 },
  ikon: { fontSize: 17, lineHeight: 19, marginBottom: 3 },
  ad: { fontSize: 10.5, fontWeight: "800", lineHeight: 12, textAlign: "center" },
  burada: { fontSize: 9, fontWeight: "700", color: "#F3D77E", marginTop: 1 },
  bos: { flex: 1, alignItems: "center" },
  araY: { width: 8, justifyContent: "center" },
  cizgiY: { height: 2 },
  cizgiD: { width: 2, flex: 1 },
  madde: { flexDirection: "row", paddingVertical: 4 },
  ok: { width: 22, fontSize: 14 },
  maddeYazi: { flex: 1, fontSize: 13, lineHeight: 18 },
});
