/*
 * Kartın bir yüzü — Capacitor'daki kartın (.face) aynısı: beyaz yüz, iç içe kalın çerçeve, üstte seviye ve
 * (sınavda) Yeni/Tekrar etiketi; yazılı kartta altın zemin. Düzen her kartta ve her yönde aynı: ana yazı hep
 * aynı yükseklikte (üstten %22), altında okunuş, ayraç, Türkçe anlam, örnekler.
 *   ön yüz: soru (tr2en → Türkçe anlam, en2tr → İngilizce kelime); ek anlamlarında ("-ecek") altında ipucu
 *   (d.ipucu, all_groups.json → ipucu)
 *   arka yüz: yön ne olursa olsun İngilizce kelime, okunuş, ayraç, Türkçe anlam, örnekler
 * golge=false: çevirme için yakalanan kopya (eski uygulamada da yakalanan yüzde gölge yoktu).
 */
import { LinearGradient } from "expo-linear-gradient";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

// CSS'teki linear-gradient(150deg, …) kutunun gerçek boyutuyla: çizgi merkezden geçer, boyu
// W·|sin a| + H·|cos a|. expo-linear-gradient başı ve sonu kutuya oranla ister.
function aci150(W, H) {
  const a = (150 * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
  const L = W * Math.abs(dx) + H * Math.abs(dy);
  return {
    start: { x: 0.5 - (dx * L) / 2 / W, y: 0.5 - (dy * L) / 2 / H },
    end: { x: 0.5 + (dx * L) / 2 / W, y: 0.5 + (dy * L) / 2 / H },
  };
}

function Altin({ t }) {
  const [boy, setBoy] = useState(null);
  const yon = boy ? aci150(boy.w, boy.h) : null;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setBoy({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {yon ? <LinearGradient colors={t.altin} locations={[0, 0.42, 0.68, 1]} start={yon.start} end={yon.end} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}

function KartYuzu({ d, yuz, yon, seviye, etiket, yazili, golge = true, t }) {
  const soruTr = yuz === "on" && yon === "tr2en";
  const ana = yuz === "on" ? (soruTr ? d.tr || "—" : d.w) : d.w;
  return (
    <View style={[s.yuz, golge && s.golge, { backgroundColor: t.card, borderColor: t.yuzCizgi }]}>
      <View style={s.kirp}>
        {yazili ? <Altin t={t} /> : null}
        <View style={[s.cerceve, { borderColor: t.ink }]} />
        <View style={s.icerik}>
          {etiket ? <Text style={[s.etiket, s.sol, { backgroundColor: etiket === "Yeni" ? "#2E9E5B" : "#E5892B" }]}>{etiket}</Text> : null}
          <Text style={[s.etiket, s.sag, { backgroundColor: t.accent }]}>{seviye}</Text>
          <View style={s.bosluk} />
          <Text style={[s.soru, ana.length > 16 && s.kucuk, { color: soruTr ? t.tr : t.ink }]}>{ana}</Text>
          {soruTr && d.ipucu ? <Text style={[s.anlamIpucu, { color: t.ex }]}>{d.ipucu}</Text> : null}
          {yuz === "on" ? (
            yazili ? <Text style={[s.ipucu, { color: t.yaziIpucu }]}>✎ Cevabı aşağıya yaz</Text> : null
          ) : (
            <>
              {d.ok ? <Text style={[s.okunus, { color: t.ok }]}>Okunuş: {d.ok}</Text> : null}
              <View style={[s.ayrac, { backgroundColor: t.ayrac }]} />
              <Text style={[s.anlam, { color: t.tr }]}>{d.tr || "—"}</Text>
              {(d.ex || []).map((x, i) => (
                <Text key={i} style={[s.ornek, { color: t.ex }]}>{String(x).replace(/<\/?b>/g, "")}</Text>
              ))}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default memo(KartYuzu);

const s = StyleSheet.create({
  yuz: { flex: 1, borderWidth: 1, borderRadius: 20 },
  golge: { boxShadow: "0 8px 22px rgba(20,30,50,.14), 0 1px 2px rgba(20,30,50,.09)" },
  kirp: { flex: 1, borderRadius: 19, overflow: "hidden" },
  cerceve: { position: "absolute", top: 14, left: 14, right: 14, bottom: 14, borderWidth: 5, borderRadius: 16 },
  icerik: { position: "absolute", top: 26, left: 26, right: 26, bottom: 26, alignItems: "center", overflow: "hidden" },
  bosluk: { height: "22%" },
  etiket: { position: "absolute", top: 2, fontSize: 11, fontWeight: "800", color: "#fff", borderRadius: 6, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 2 },
  sol: { left: 2 },
  sag: { right: 2 },
  soru: { fontSize: 34, fontWeight: "800", letterSpacing: -0.34, lineHeight: 38, textAlign: "center" },
  kucuk: { fontSize: 27, lineHeight: 30 },
  ipucu: { marginTop: 16, fontSize: 12.5, fontWeight: "800", letterSpacing: 0.25 },
  anlamIpucu: { fontSize: 15, fontStyle: "italic", marginTop: 10, textAlign: "center" },
  okunus: { fontSize: 15, fontWeight: "700", marginTop: 8, textAlign: "center" },
  ayrac: { width: 44, height: 3, borderRadius: 2, marginTop: 16, marginBottom: 14 },
  anlam: { fontSize: 22, fontWeight: "800", lineHeight: 27.5, textAlign: "center" },
  ornek: { fontSize: 14, fontStyle: "italic", marginTop: 12, textAlign: "center" },
});
