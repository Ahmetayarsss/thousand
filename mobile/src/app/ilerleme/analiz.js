/*
 * İstatistikler — Capacitor'daki analiz.html (templates/analiz_template.html) ile aynı: genel kutucuklar, son 30
 * günün cevapları ve doğruluğu, kutu dağılımı, önümüzdeki 7 günün tekrar yükü, en çok yanlış yapılanlar.
 * Hesaplar src/ilerleme/veri.js'te, grafikler src/ilerleme/Grafikler.js'te. Grafiğin dışına dokununca ipucu kapanır.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Pano from "../../bilesenler/Pano";
import { ANAHTARLA, OXLOG, SRS } from "../../cekirdek";
import { GunlukCevaplar, GunlukDogruluk, KutuDagilimi, Tablo, YediGun } from "../../ilerleme/Grafikler";
import * as V from "../../ilerleme/veri";
import { useTema } from "../../tema";

function TabloDugmesi({ acik, onBas, t }) {
  return (
    <Pressable onPress={onBas} accessibilityRole="button" hitSlop={8}>
      <Text style={[s.tbtn, { color: t.s1 }]}>{acik ? "Tabloyu gizle" : "Tabloyu göster"}</Text>
    </Pressable>
  );
}

export default function Analiz() {
  const t = useTema();
  const [v, setV] = useState(null);
  const [ip, setIp] = useState(null);
  const [acik, setAcik] = useState({});
  const sayac = useRef(0);
  useFocusEffect(useCallback(() => {
    const kay = V.kayitlar(SRS, ANAHTARLA), lv = SRS.topLevel();
    setV({
      baslik: SRS.inCycle() + (lv ? " · " + lv : ""), kutucuk: V.kutucuklar(SRS), gun: V.son30(SRS),
      kutu: V.kutuDagilimi(kay), yedi: V.yediGun(SRS, kay), yanlis: V.enCokYanlis(kay),
    });
    setIp(null);
    OXLOG.add("sayfa", { p: "analiz" });
  }, []));
  const goster = useCallback((grafik, x) => { sayac.current++; setIp(x ? { ...x, grafik, anahtar: sayac.current } : null); }, []);
  const ac = (id) => setAcik((a) => ({ ...a, [id]: !a[id] }));
  if (!v) return <View style={{ flex: 1, backgroundColor: t.kartBg }} />;

  const cevapli = v.gun.filter((x) => x.n).reverse();
  const bos = <Text style={[s.bos, { color: t.muted }]}>Kayıt yok</Text>;
  return (
    <ScrollView style={{ backgroundColor: t.kartBg }} contentContainerStyle={s.icerik} onScrollBeginDrag={() => setIp(null)}>
      {/* Grafiğin ya da düğmenin almadığı dokunuş ipucunu kapatır (grafikler ve düğmeler dokunuşu önce alır). */}
      <View onStartShouldSetResponder={() => true} onResponderRelease={() => setIp(null)}>
        <Text style={[s.alt, { color: t.muted }]}>{v.baslik}</Text>

        <Pano baslik="Genel" t={t}>
          <View style={s.kutucuklar}>
            {v.kutucuk.map(([l, deger, d]) => (
              <View key={l} style={[s.kutucuk, { backgroundColor: t.kartBg }]}>
                <Text style={[s.kl, { color: t.muted }]}>{l}</Text>
                <Text style={[s.kv, { color: t.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{deger}</Text>
                {d ? <Text style={[s.kd, { color: t.muted }]}>{d}</Text> : null}
              </View>
            ))}
          </View>
        </Pano>

        <Pano baslik="Günlük cevaplar" aciklama="Son 30 gün, sınavda verilen cevaplar" t={t}>
          <View style={s.lejant}>
            {[["Doğru", t.s1], ["Yanlış", t.s2]].map(([ad, renk]) => (
              <View key={ad} style={s.lejantOge}><View style={[s.lejantKare, { backgroundColor: renk }]} /><Text style={[s.lejantYazi, { color: t.ink2 }]}>{ad}</Text></View>
            ))}
          </View>
          <GunlukCevaplar SRS={SRS} gunler={v.gun} ip={ip} goster={goster} t={t} />
          <TabloDugmesi acik={acik.gunluk} onBas={() => ac("gunluk")} t={t} />
          {acik.gunluk ? (cevapli.length ? <Tablo t={t} basliklar={["Gün", "Cevap", "Doğru", "Yanlış", "Doğruluk"]} sayiSutun={[1, 2, 3, 4]}
            satirlar={cevapli.map((x) => [V.gunAyYil(SRS, x.d), V.sayi(x.n), V.sayi(x.ok), V.sayi(x.bad), "%" + Math.round((x.ok / x.n) * 100)])} /> : bos) : null}
        </Pano>

        <Pano baslik="Günlük doğruluk" aciklama="Son 30 gün, cevap verilen günler (%)" t={t}>
          <GunlukDogruluk SRS={SRS} gunler={v.gun} ip={ip} goster={goster} t={t} />
          <TabloDugmesi acik={acik.dogruluk} onBas={() => ac("dogruluk")} t={t} />
          {acik.dogruluk ? (cevapli.length ? <Tablo t={t} basliklar={["Gün", "Doğru / Cevap", "Doğruluk"]} sayiSutun={[1, 2]}
            satirlar={cevapli.map((x) => [V.gunAyYil(SRS, x.d), V.sayi(x.ok) + " / " + V.sayi(x.n), "%" + Math.round((x.ok / x.n) * 100)])} /> : bos) : null}
        </Pano>

        <Pano baslik="Kutu dağılımı" aciklama="Çalışılan kelimelerin bulunduğu kutular" t={t}>
          <KutuDagilimi sayilar={v.kutu} ip={ip} goster={goster} t={t} />
        </Pano>

        <Pano baslik="Önümüzdeki 7 gün" aciklama="Her gün vadesi gelecek tekrar sayısı (bugün = gecikenler dahil)" t={t}>
          <YediGun SRS={SRS} gunler={v.yedi} ip={ip} goster={goster} t={t} />
          <TabloDugmesi acik={acik.yedi} onBas={() => ac("yedi")} t={t} />
          {acik.yedi ? <Tablo t={t} basliklar={["Gün", "Tarih", "Tekrar"]} sayiSutun={[2]}
            satirlar={v.yedi.map((x, i) => [V.gunAdi(SRS, i, x.d), V.gunAyYil(SRS, x.d), V.sayi(x.n)])} /> : null}
        </Pano>

        <Pano baslik="En çok yanlış yapılanlar" t={t}>
          {v.yanlis.length ? <Tablo t={t} basliklar={["Kelime", "Türkçe", "Yanlış", "Kutu"]} sayiSutun={[2]} trSutun={[1]}
            satirlar={v.yanlis.map((r) => [ANAHTARLA[r.k].d.w, ANAHTARLA[r.k].d.tr || "", V.sayi(r.l), r.b >= 4 ? "Olgun" : String(r.b)])} />
            : <Text style={[s.bos, { color: t.muted }]}>Henüz yanlış cevap yok</Text>}
        </Pano>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  icerik: { width: "100%", maxWidth: 600, alignSelf: "center", paddingTop: 4, paddingHorizontal: 14, paddingBottom: 24 },
  alt: { fontSize: 14, fontWeight: "800", marginBottom: 12 },
  kutucuklar: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kutucuk: { width: "45%", flexGrow: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12 },
  kl: { fontSize: 11.5, fontWeight: "700" },
  kv: { fontSize: 24, fontWeight: "800", lineHeight: 28, marginTop: 3 },
  kd: { fontSize: 11, marginTop: 2 },
  lejant: { flexDirection: "row", gap: 14, marginBottom: 6 },
  lejantOge: { flexDirection: "row", alignItems: "center" },
  lejantKare: { width: 10, height: 10, borderRadius: 2, marginRight: 5 },
  lejantYazi: { fontSize: 12, fontWeight: "700" },
  tbtn: { fontWeight: "800", fontSize: 12, paddingTop: 8 },
  bos: { fontSize: 13, textAlign: "center", paddingVertical: 12 },
});
