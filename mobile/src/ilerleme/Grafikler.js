/*
 * İstatistikler sayfasının grafikleri — Capacitor'daki analiz sayfasının (templates/analiz_template.html) SVG
 * çizimlerinin aynısı (ölçüler, eksenler, renkler), react-native-svg ile. Bir işarete dokununca ipucu kutusu
 * açılır (değer önde, etiket arkada), işaretin alanı hafifçe koyulaşır; doğruluk çizgisinde parmak en yakın
 * güne oturur.
 * ipucu: { grafik, x, y, baslik, satirlar } (ekran tutar), goster(grafik, ipucu | null).
 */
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgYazi } from "react-native-svg";
import * as V from "./veri";

// Yazı tipi: telefonda sistemin yazı tipi (varsayılan); webde SVG varsayılanı tırnaklı olduğu için açıkça.
const YAZI_TIPI = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" : undefined;
function Yazi({ x, y, children, t, anchor = "start", renk, kalin, boy = 11 }) {
  return <SvgYazi x={x} y={y} fontSize={boy} fontFamily={YAZI_TIPI} fill={renk || t.muted} textAnchor={anchor} fontWeight={kalin ? "700" : "400"}>{children}</SvgYazi>;
}

// Ipucu kutusu: değer önde, etiket arkada; kutunun içinde kalır.
export function Ipucu({ ip, genislik, t }) {
  const [boy, setBoy] = useState(null);
  const left = boy ? Math.max(0, Math.min(genislik - boy.w, ip.x - boy.w / 2)) : 0;
  const top = boy ? Math.max(-6, ip.y - boy.h - 10) : 0;
  return (
    <View pointerEvents="none" onLayout={(e) => setBoy({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[s.ipucu, { left, top, opacity: boy ? 1 : 0, backgroundColor: t.card, borderColor: t.kartLine }]}>
      <Text style={[s.ipBas, { color: t.ink }]}>{ip.baslik}</Text>
      {(ip.satirlar || []).map((r, i) => (
        <View key={i} style={s.ipSatir}>
          {r.c ? <View style={[s.ipAnahtar, { backgroundColor: r.c }]} /> : null}
          <Text style={{ fontSize: 12, color: t.ink2 }}><Text style={{ fontWeight: "700", color: t.ink }}>{r.v}</Text> {r.l}</Text>
        </View>
      ))}
    </View>
  );
}

// dokun(x, y): grafiğe dokunulan yer (grafik kendi işaretini bulur). SVG öğelerinin kendi dokunma işleyicileri
// webde çalışmadığı için dokunma tek katmanda yakalanır; telefonda ve webde aynı.
function Kap({ id, ip, t, children, onLayout, genislik, dokun }) {
  const yakala = dokun ? {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (e) => dokun(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onResponderMove: (e) => dokun(e.nativeEvent.locationX, e.nativeEvent.locationY),
  } : {};
  return (
    <View style={s.kap} onLayout={onLayout} {...yakala}>
      {children}
      {ip && ip.grafik === id && genislik ? <Ipucu key={ip.anahtar} ip={ip} genislik={genislik} t={t} /> : null}
    </View>
  );
}
function useGenislik() {
  const [W, setW] = useState(0);
  return [W, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}
const vurgu = "rgba(27,36,48,.05)";

// ---------- Günlük cevaplar: yığılmış sütun (doğru altta, yanlış üstte) ----------
export function GunlukCevaplar({ SRS, gunler, ip, goster, t }) {
  const [W, olc] = useGenislik();
  const H = 170, ml = 30, mr = 6, mt = 8, mb = 22, pw = W - ml - mr, ph = H - mt - mb;
  const sc = V.eksen(Math.max(...gunler.map((x) => x.n)), 4), mx = sc.max, y = (v) => mt + ph - (v / mx) * ph;
  const band = pw / gunler.length, bw = Math.max(3, Math.min(24, band - 3)), son = gunler.length - 1;
  const izgara = [];
  for (let v = 0; v <= mx; v += sc.step) izgara.push(v);
  function dokun(px, py) {
    const i = Math.floor((px - ml) / band);
    if (i < 0 || i >= gunler.length || py < mt || py > mt + ph) return;
    const x = gunler[i];
    goster("gunluk", { i, x: ml + band * i + band / 2, y: y(x.n), baslik: V.gunAy(SRS, x.d) + " · " + V.sayi(x.n) + " cevap",
      satirlar: x.n ? [{ c: t.s1, v: V.sayi(x.ok), l: "doğru" }, { c: t.s2, v: V.sayi(x.bad), l: "yanlış" }, { v: "%" + Math.round((x.ok / x.n) * 100), l: "doğruluk" }] : [] });
  }
  return (
    <Kap id="gunluk" ip={ip} t={t} onLayout={olc} genislik={W} dokun={dokun}>
      {W > 0 ? (
        <Svg width={W} height={H} accessibilityLabel="Son 30 gün günlük cevaplar">
          {izgara.map((v) => { const yy = Math.round(y(v)) + 0.5; return [
            <Line key={"l" + v} x1={ml} x2={W - mr} y1={yy} y2={yy} stroke={v ? t.izgara : t.eksen} strokeWidth={1} />,
            <Yazi key={"y" + v} x={ml - 6} y={yy + 4} anchor="end" t={t}>{V.sayi(v)}</Yazi>]; })}
          {gunler.map((x, i) => {
            const cx = ml + band * i + (band - bw) / 2, parca = [];
            if (x.ok) { const top = y(x.ok), h = mt + ph - top; parca.push(<Path key="d" d={x.bad ? `M${cx},${top}H${cx + bw}V${mt + ph}H${cx}Z` : V.sutunYolu(cx, top, bw, h, 4)} fill={t.s1} />); }
            if (x.bad) { const base = x.ok ? y(x.ok) - 2 : mt + ph, top = y(x.n) - (x.ok ? 2 : 0), h = base - top; if (h > 0) parca.push(<Path key="y" d={V.sutunYolu(cx, top, bw, h, 4)} fill={t.s2} />); }
            const secili = ip && ip.grafik === "gunluk" && ip.i === i;
            if (secili) parca.push(<Rect key="h" x={ml + band * i} y={mt} width={band} height={ph} fill={vurgu} />);
            return parca;
          })}
          {gunler.map((x, i) => ((son - i) % 7 === 0 ? (
            <Yazi key={"x" + i} x={ml + band * i + band / 2} y={H - 6} anchor={i === son ? "end" : "middle"} t={t}>{i === son ? "Bugün" : V.gunAy(SRS, x.d)}</Yazi>
          ) : null))}
          {!gunler.some((x) => x.n) ? <Yazi x={ml + pw / 2} y={mt + ph / 2} anchor="middle" boy={12} t={t}>Henüz sınav cevabı yok</Yazi> : null}
        </Svg>
      ) : <View style={{ height: H }} />}
    </Kap>
  );
}

// ---------- Günlük doğruluk: çizgi (cevap olmayan günde kopar) ----------
export function GunlukDogruluk({ SRS, gunler, ip, goster, t }) {
  const [W, olc] = useGenislik();
  const H = 150, ml = 34, mr = 34, mt = 10, mb = 22, pw = W - ml - mr, ph = H - mt - mb, son = gunler.length - 1;
  const x = (i) => ml + (pw * i) / son, y = (v) => mt + ph - (v / 100) * ph;
  const pts = gunler.map((d, i) => (d.n ? { i, v: (d.ok / d.n) * 100, d } : null));
  let yol = "";
  pts.forEach((p, i) => { if (p) yol += (i && pts[i - 1] ? "L" : "M") + x(i) + "," + y(p.v); });
  const sonNokta = [...pts].reverse().find(Boolean);
  const secili = ip && ip.grafik === "dogruluk" ? pts[ip.i] : null;
  function dokun(px) {
    if (!sonNokta) return;
    let en = null;
    pts.forEach((p) => { if (p && (!en || Math.abs(x(p.i) - px) < Math.abs(x(en.i) - px))) en = p; });
    if (en) goster("dogruluk", { i: en.i, x: x(en.i), y: y(en.v), baslik: "%" + Math.round(en.v), satirlar: [{ c: t.s1, v: V.gunAy(SRS, en.d.d), l: "· " + en.d.ok + "/" + en.d.n + " doğru" }] });
  }
  return (
    <Kap id="dogruluk" ip={ip} t={t} onLayout={olc} genislik={W} dokun={sonNokta ? dokun : null}>
      {W > 0 ? (
        <View>
          <Svg width={W} height={H} accessibilityLabel="Son 30 gün günlük doğruluk">
            {[0, 25, 50, 75, 100].map((v) => { const yy = Math.round(y(v)) + 0.5; return [
              <Line key={"l" + v} x1={ml} x2={W - mr} y1={yy} y2={yy} stroke={v ? t.izgara : t.eksen} strokeWidth={1} />,
              <Yazi key={"y" + v} x={ml - 6} y={yy + 4} anchor="end" t={t}>{"%" + v}</Yazi>]; })}
            {yol ? <Path d={yol} fill="none" stroke={t.s1} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
            {pts.map((p) => (p && !(pts[p.i - 1] || pts[p.i + 1]) ? <Circle key={"t" + p.i} cx={x(p.i)} cy={y(p.v)} r={4} fill={t.s1} stroke="#fff" strokeWidth={2} /> : null))}
            {sonNokta ? [
              <Circle key="sn" cx={x(sonNokta.i)} cy={y(sonNokta.v)} r={4} fill={t.s1} stroke="#fff" strokeWidth={2} />,
              <Yazi key="sy" x={x(sonNokta.i) + 7} y={y(sonNokta.v) + 4} renk={t.ink} kalin t={t}>{"%" + Math.round(sonNokta.v)}</Yazi>] : null}
            {gunler.map((g, i) => ((son - i) % 7 === 0 ? (
              <Yazi key={"x" + i} x={x(i)} y={H - 6} anchor={i === son ? "end" : "middle"} t={t}>{i === son ? "Bugün" : V.gunAy(SRS, g.d)}</Yazi>
            ) : null))}
            {!sonNokta ? <Yazi x={ml + pw / 2} y={mt + ph / 2} anchor="middle" boy={12} t={t}>Henüz sınav cevabı yok</Yazi> : null}
            {secili ? [
              <Line key="ci" x1={x(secili.i)} x2={x(secili.i)} y1={mt} y2={mt + ph} stroke={t.eksen} strokeWidth={1} />,
              <Circle key="cn" cx={x(secili.i)} cy={y(secili.v)} r={5} fill={t.s1} stroke="#fff" strokeWidth={2} />] : null}
          </Svg>
        </View>
      ) : <View style={{ height: H }} />}
    </Kap>
  );
}

// ---------- Kutu dağılımı: yatay çubuk, sıralı tek renk tonları ----------
const KUTULAR = ["Kutu 1 · 1 gün", "Kutu 2 · 3 gün", "Kutu 3 · 7 gün", "Olgun · 7–60 gün"];
export function KutuDagilimi({ sayilar, ip, goster, t }) {
  const [W, olc] = useGenislik();
  const tot = sayilar.reduce((a, b) => a + b, 0);
  const rowH = 34, bh = 16, ml = 104, mr = 46, H = rowH * 4 + 4, pw = W - ml - mr, mx = Math.max(1, ...sayilar);
  function dokun(px, py) {
    const i = Math.floor((py - 4) / rowH);
    if (i < 0 || i > 3) return;
    const v = sayilar[i], yy = 4 + i * rowH + (rowH - bh) / 2, w = (v / mx) * pw;
    goster("kutu", { i, x: ml + Math.max(w, 30) / 2, y: yy, baslik: V.sayi(v) + " kelime", satirlar: [{ c: t.o[i], v: tot ? "%" + Math.round((v / tot) * 100) : "%0", l: KUTULAR[i] }] });
  }
  return (
    <Kap id="kutu" ip={ip} t={t} onLayout={olc} genislik={W} dokun={dokun}>
      {W > 0 ? (
        <Svg width={W} height={H} accessibilityLabel="Kutu dağılımı">
          <Line x1={ml + 0.5} x2={ml + 0.5} y1={2} y2={H - 2} stroke={t.eksen} strokeWidth={1} />
          {sayilar.map((v, i) => {
            const yy = 4 + i * rowH + (rowH - bh) / 2, w = (v / mx) * pw, secili = ip && ip.grafik === "kutu" && ip.i === i;
            return [
              secili ? <Rect key={"h" + i} x={0} y={4 + i * rowH} width={W} height={rowH} fill={vurgu} /> : null,
              <Yazi key={"e" + i} x={ml - 8} y={yy + bh / 2 + 4} anchor="end" renk={t.ink2} boy={12} t={t}>{KUTULAR[i]}</Yazi>,
              v ? <Path key={"c" + i} d={V.cubukYolu(ml + 1, yy, w, bh, 4)} fill={t.o[i]} /> : null,
              <Yazi key={"s" + i} x={ml + 1 + w + 6} y={yy + bh / 2 + 4} renk={t.ink} kalin boy={12} t={t}>{V.sayi(v)}</Yazi>,
            ];
          })}
        </Svg>
      ) : <View style={{ height: H }} />}
      {!tot ? <Text style={[s.bos, { color: t.muted }]}>Henüz çalışılan kelime yok</Text> : null}
    </Kap>
  );
}

// ---------- Önümüzdeki 7 gün: tek seri sütun, değer tepede ----------
export function YediGun({ SRS, gunler, ip, goster, t }) {
  const [W, olc] = useGenislik();
  const H = 150, ml = 6, mr = 6, mt = 18, mb = 22, pw = W - ml - mr, ph = H - mt - mb;
  const mx = Math.max(1, ...gunler.map((x) => x.n)), y = (v) => mt + ph - (v / mx) * ph;
  const band = pw / 7, bw = Math.min(24, band - 8);
  function dokun(px) {
    const i = Math.floor((px - ml) / band);
    if (i < 0 || i > 6) return;
    const x = gunler[i], cx = ml + band * i + (band - bw) / 2, top = y(x.n);
    goster("yedi", { i, x: cx + bw / 2, y: top, baslik: V.sayi(x.n) + " tekrar", satirlar: [{ c: t.s1, v: V.gunAyYil(SRS, x.d), l: V.gunAdi(SRS, i, x.d) }] });
  }
  return (
    <Kap id="yedi" ip={ip} t={t} onLayout={olc} genislik={W} dokun={dokun}>
      {W > 0 ? (
        <Svg width={W} height={H} accessibilityLabel="Önümüzdeki 7 günün tekrar yükü">
          <Line x1={ml} x2={W - mr} y1={mt + ph + 0.5} y2={mt + ph + 0.5} stroke={t.eksen} strokeWidth={1} />
          {gunler.map((x, i) => {
            const cx = ml + band * i + (band - bw) / 2, top = y(x.n), secili = ip && ip.grafik === "yedi" && ip.i === i;
            return [
              x.n ? <Path key={"c" + i} d={V.sutunYolu(cx, top, bw, mt + ph - top, 4)} fill={t.s1} /> : null,
              <Yazi key={"v" + i} x={cx + bw / 2} y={top - 5} anchor="middle" renk={t.ink} kalin boy={12} t={t}>{V.sayi(x.n)}</Yazi>,
              <Yazi key={"g" + i} x={cx + bw / 2} y={H - 6} anchor="middle" t={t}>{V.gunAdi(SRS, i, x.d)}</Yazi>,
              secili ? <Rect key={"h" + i} x={ml + band * i} y={0} width={band} height={H} fill={vurgu} /> : null,
            ];
          })}
        </Svg>
      ) : <View style={{ height: H }} />}
    </Kap>
  );
}

// ---------- Tablo ----------
export function Tablo({ basliklar, satirlar, sayiSutun = [], trSutun = [], t }) {
  const hiza = (i) => (sayiSutun.includes(i) ? "right" : "left");
  return (
    <View style={{ marginTop: 6 }}>
      <View style={[s.satir, { borderBottomColor: t.kartLine }]}>
        {basliklar.map((b, i) => <Text key={i} style={[s.th, { color: t.muted, textAlign: hiza(i) }]}>{b}</Text>)}
      </View>
      {satirlar.map((r, j) => (
        <View key={j} style={[s.satir, { borderBottomColor: t.kartLine }]}>
          {r.map((c, i) => <Text key={i} style={[s.td, { color: trSutun.includes(i) ? t.tr : t.ink, textAlign: hiza(i) }]}>{c}</Text>)}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  kap: { position: "relative", width: "100%" },
  ipucu: { position: "absolute", borderWidth: 1, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, zIndex: 5, boxShadow: "0 6px 18px rgba(20,30,50,.14)" },
  ipBas: { fontWeight: "800", fontSize: 13 },
  ipSatir: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  ipAnahtar: { width: 10, height: 2, borderRadius: 1 },
  bos: { fontSize: 13, textAlign: "center", paddingVertical: 12 },
  satir: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 5 },
  th: { flex: 1, fontSize: 11, fontWeight: "700", paddingHorizontal: 4 },
  td: { flex: 1, fontSize: 12.5, paddingHorizontal: 4, fontVariant: ["tabular-nums"] },
});
