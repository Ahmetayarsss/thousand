/*
 * 3000 kelimenin hepsi çalışılınca Liste'de havai fişek + OLMİŞDUR — Capacitor'daki liste sayfasındaki gösterinin
 * aynısı (templates/sesli_template.html → celebrate): koyu panelde ~7 sn boyunca roketler yükselip patlar; her
 * karede üstüne yarı saydam koyu bir katman çizilir, eskiler izi solarak kaybolur. Dokununca baştan.
 * Fizik kare başınadır (eskisi gibi her ekran karesinde bir adım).
 */
import { Canvas, createPicture, PaintStyle, Picture, Skia, StrokeCap } from "@shopify/react-native-skia";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

const ZEMIN = "#141B26";

function hsl(h, s, l) {
  "worklet";
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return "rgb(" + f(0) + "," + f(8) + "," + f(4) + ")";
}

// Eskisi her karede tuvale %22 saydam koyu katman çizerdi: k kare önce çizilen şey 0,78^k parlaklıkla kalır.
// Zemin tek renk olduğundan aynı sonuç, son IZ karenin çizimlerini o güçle yeniden çizerek elde edilir.
const IZ = 12, SOLMA = 0.78;

function Gosteri({ W, H }) {
  const kare = useSharedValue(0);
  const d = useSharedValue({ basla: true, bitti: false, t0: 0, son: 0, roket: [], parca: [], gecmis: [] });

  useFrameCallback((bilgi) => {
    "worklet";
    const s = d.value, t = bilgi.timestamp;
    if (s.basla) { s.basla = false; s.t0 = t; s.son = t; s.roket = []; s.parca = []; s.gecmis = []; }
    if (s.bitti) return;
    if (t - s.t0 < 7000 && t - s.son > 420 + Math.random() * 300) {
      const at = () => { const h = Math.random() * 360; s.roket.push({ x: W * (0.15 + Math.random() * 0.7), y: H, vy: -(H * 0.018 + Math.random() * H * 0.006), ty: H * (0.15 + Math.random() * 0.35), h, c: Skia.Color(hsl(h, 90, 75)) }); };
      at(); if (Math.random() < 0.35) at();
      s.son = t;
    }
    const cizim = { r: [], p: [] };   // bu karede çizilenler
    s.roket = s.roket.filter((r) => {
      const y0 = r.y; r.y += r.vy;
      cizim.r.push([r.x, y0, r.y, r.c]);
      if (r.y <= r.ty) {
        const n = 60 + ((Math.random() * 40) | 0);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3.6, h = r.h + Math.random() * 40 - 20;
          s.parca.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: Skia.Color(hsl(h, 95, 62)) });
        }
        return false;
      }
      return true;
    });
    s.parca = s.parca.filter((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.045; p.vx *= 0.985; p.vy *= 0.985; p.l -= 0.012;
      if (p.l <= 0) return false;
      cizim.p.push([p.x, p.y, p.l, p.c]);
      return true;
    });
    s.gecmis.unshift(cizim);
    if (s.gecmis.length > IZ) s.gecmis.length = IZ;
    // Gösteri bitti (7 sn + son kıvılcımlar sönünce): panel boşalır, durulur.
    if (t - s.t0 >= 7000 && !s.roket.length && !s.parca.length) { s.bitti = true; s.gecmis = []; }
    kare.value = kare.value + 1;
  });

  const resim = useDerivedValue(() => {
    kare.value;   // her karede yeniden çiz
    const gecmis = d.value.gecmis;
    return createPicture((cv) => {
      const cizgi = Skia.Paint(); cizgi.setStyle(PaintStyle.Stroke); cizgi.setStrokeWidth(2); cizgi.setStrokeCap(StrokeCap.Round); cizgi.setAntiAlias(true);
      const nokta = Skia.Paint(); nokta.setAntiAlias(true);
      for (let k = gecmis.length - 1; k >= 0; k--) {
        const f = Math.pow(SOLMA, k), c = gecmis[k];
        for (let i = 0; i < c.r.length; i++) { const r = c.r[i]; cizgi.setColor(r[3]); cizgi.setAlphaf(f); cv.drawLine(r[0], r[1], r[0], r[2], cizgi); }
        for (let i = 0; i < c.p.length; i++) { const p = c.p[i]; nokta.setColor(p[3]); nokta.setAlphaf(p[2] * f); cv.drawCircle(p[0], p[1], 1.8, nokta); }
      }
    }, { width: W, height: H });
  });

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={resim} />
    </Canvas>
  );
}

export default function HavaiFisek() {
  const [boy, setBoy] = useState(null);
  const pencere = useWindowDimensions();
  const [tur, setTur] = useState(0);
  return (
    <Pressable onPress={() => setTur((x) => x + 1)} accessibilityRole="button" accessibilityLabel="Bütün kelimeler çalışılıyor. Havai fişek, tekrar için dokun"
      style={[s.pano, { height: Math.max(320, pencere.height * 0.62) }]} onLayout={(e) => setBoy({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {boy ? <Gosteri key={tur} W={boy.w} H={boy.h} /> : null}
      <View pointerEvents="none" style={s.orta}><Text style={s.olm}>OLMİŞDUR</Text></View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pano: { borderRadius: 20, overflow: "hidden", backgroundColor: ZEMIN, marginTop: 6 },
  orta: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  olm: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: 1.76, textShadowColor: "rgba(255,200,80,.55)", textShadowRadius: 18, textShadowOffset: { width: 0, height: 2 } },
});
