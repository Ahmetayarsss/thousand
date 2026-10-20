/*
 * Yazılı kart (altın) için cevap kutuları + uygulama içi Türkçe Q klavye. Telefon klavyesi hiç açılmaz →
 * kart boyutu değişmez, otomatik düzeltme/öneri yok. Harfe basılır basılmaz yazar; ⌫ basılı tutulunca
 * art arda siler (0,42 sn sonra, 70 ms'de bir). Kutu başına en çok 40 harf; başta ve art arda boşluk yok.
 * Kontrolden sonra klavye iner, kutular doğru/yanlış renginde kalır, altta sonuç düğmesi.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const SATIRLAR = ["qwertyuıopğü", "asdfghjklşi", "zxcvbnmöç"];

export function harfEkle(v, ch) {
  if (v.length >= 40 || (ch === " " && (!v || v.endsWith(" ")))) return v;
  return v + ch;
}

function Imlec({ renk }) {
  const [gor, setGor] = useState(true);
  useEffect(() => { const i = setInterval(() => setGor((g) => !g), 500); return () => clearInterval(i); }, []);
  return <View style={[s.imlec, { backgroundColor: renk, opacity: gor ? 1 : 0 }]} />;
}

export function Kutular({ degerler, etkin, ipuclari, isaret, onSec, t }) {
  return (
    <View style={s.kutular}>
      {degerler.map((v, i) => {
        const on = !isaret && i === etkin, m = isaret ? isaret[i] : null;
        const cizgi = m == null ? (on ? t.kutuEtkin : t.kutuCizgi) : m ? t.green : t.red;
        const zemin = m == null ? t.kutu : m ? t.goodBg : t.badBg;
        return (
          <Pressable key={i} onPressIn={() => onSec(i)} accessibilityLabel={ipuclari[i]}
            style={[s.kutu, { borderColor: cizgi, backgroundColor: zemin }, on && { boxShadow: "0 0 0 3px rgba(201,162,39,.25)" }]}>
            {v ? (
              <Text numberOfLines={1} ellipsizeMode={on ? "head" : "tail"} style={[s.kutuYazi, { color: t.ink }]}>{v}</Text>
            ) : null}
            {on ? <Imlec renk={t.imlec} /> : null}
            {!v ? <Text numberOfLines={1} style={[s.kutuIpucu, { color: t.kutuIpucu }]}>{ipuclari[i]}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Tus({ etiket, onBas, onBirak, esnek = 1, tur, gizli, t, erisim }) {
  const [basili, setBasili] = useState(false);
  const zemin = tur === "go" ? (basili ? "#977522" : "#B8902C") : tur === "fn" ? (basili ? t.tusIslevBasili : t.tusIslev) : (basili ? t.tusBasili : t.tus);
  return (
    <Pressable
      onPressIn={() => { setBasili(true); onBas(); }}
      onPressOut={() => { setBasili(false); if (onBirak) onBirak(); }}
      disabled={gizli}
      accessibilityRole="button"
      accessibilityLabel={erisim || etiket}
      style={[s.tus, { flex: esnek, backgroundColor: zemin, opacity: gizli ? 0 : 1 }]}
    >
      <Text style={[tur === "go" ? s.tusGo : tur === "fn" ? [s.tusFn, { color: t.ink }] : tur === "sp" ? [s.tusSp, { color: t.muted }] : [s.tusYazi, { color: t.ink }]]}>{etiket}</Text>
    </Pressable>
  );
}

export function Klavye({ onHarf, onSil, onSonraki, onKontrol, kontrolMetni, sonrakiYok, t }) {
  const silZaman = useRef({ t: 0, i: 0 });
  const silBirak = () => { clearTimeout(silZaman.current.t); clearInterval(silZaman.current.i); };
  useEffect(() => silBirak, []);
  const sil = () => { onSil(); silBirak(); silZaman.current.t = setTimeout(() => { silZaman.current.i = setInterval(onSil, 70); }, 420); };
  const harfler = (dizi) => [...dizi].map((c) => <Tus key={c} etiket={c} onBas={() => onHarf(c)} t={t} />);
  return (
    <View style={s.klavye}>
      <View style={s.satir}>{harfler(SATIRLAR[0])}</View>
      <View style={s.satir}><View style={{ flex: 0.5 }} />{harfler(SATIRLAR[1])}<View style={{ flex: 0.5 }} /></View>
      <View style={s.satir}>
        <View style={{ flex: 1.5 }} />{harfler(SATIRLAR[2])}
        <Tus etiket="⌫" erisim="Sil" tur="fn" esnek={1.5} onBas={sil} onBirak={silBirak} t={t} />
      </View>
      <View style={s.satir}>
        <Tus etiket="Sonraki ›" tur="fn" esnek={2.5} onBas={onSonraki} gizli={sonrakiYok} t={t} />
        <Tus etiket="boşluk" tur="sp" esnek={5} onBas={() => onHarf(" ")} t={t} />
        <Tus etiket={kontrolMetni} tur="go" esnek={3.5} onBas={onKontrol} t={t} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kutular: { flexDirection: "row", gap: 6, paddingHorizontal: 3, paddingBottom: 9 },
  kutu: { flex: 1, minWidth: 0, height: 46, borderWidth: 2, borderRadius: 12, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  kutuYazi: { fontSize: 17, fontWeight: "700", flexShrink: 1 },
  kutuIpucu: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  imlec: { width: 2, height: 22, marginLeft: 1 },
  klavye: { gap: 7 },
  satir: { flexDirection: "row", gap: 4 },
  tus: { minWidth: 0, height: 44, borderRadius: 7, alignItems: "center", justifyContent: "center", boxShadow: "0 1px 0 rgba(0,0,0,.2)" },
  tusYazi: { fontSize: 19, fontWeight: "600" },
  tusFn: { fontSize: 15, fontWeight: "800" },
  tusSp: { fontSize: 13, fontWeight: "700" },
  tusGo: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
