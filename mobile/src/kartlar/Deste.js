/*
 * Deste: üst üste duran DERINLIK kart (1 üst + 3 arka). Capacitor'daki kartlar sayfasının aynı hareketleri:
 *   yerleş: arka kartlar küçük (her kademe %3), 10 px aşağı, hafif eğik (-3,5°..3,5°) ve kaymış (-8..8 px);
 *           üst kart düz ve ortada. Kademe değişince 0,38 sn'de kayar.
 *   fırlat: Bildim → sağa / Bilemedim → sola (0,5 sn, kartonun hafif esnemesiyle), Test'te bilemeyince
 *           destenin altına iner (0,46 sn). CSS'teki anahtar kareler aynen: her aralığın kendi eğrisi var.
 * Bakış: destenin perspektifi 1400 px, bakış noktası yüksekliğin %44'ü (CSS perspective-origin).
 */
import { forwardRef, memo, useImperativeHandle } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

export const DERINLIK = 4;
const KAY = { duration: 380, easing: Easing.bezier(0.22, 0.61, 0.36, 1) };
const FIRLAT = Easing.bezier(0.42, 0.03, 0.3, 1);
const IN = Easing.bezier(0.5, 0.04, 0.4, 1);

export function rastgeleEgim() { return Math.random() * 7 - 3.5; }
export function rastgeleKayma() { return Math.random() * 16 - 8; }

function hedef(d, egim, kayma) {
  return { tx: d === 0 ? 0 : kayma, ty: d * 10, sc: 1 - d * 0.03, rot: d === 0 ? 0 : egim };
}

// Tek kart yuvası. ref: yerles(d, egim, kayma, anim), firlat(yon), sifirla(). gizli: çevrilirken (katman çizer).
const Yuva = forwardRef(function Yuva({ derinlik, ucuyor, gizli, boy, onBas, children }, ref) {
  const tx = useSharedValue(0), ty = useSharedValue(0), sc = useSharedValue(1), rot = useSharedValue(0);
  const rx = useSharedValue(0), op = useSharedValue(1);

  useImperativeHandle(ref, () => ({
    yerles(d, egim, kayma, anim = true) {
      const h = hedef(d, egim, kayma), f = (v, x) => { v.value = anim ? withTiming(x, KAY) : x; };
      f(tx, h.tx); f(ty, h.ty); f(sc, h.sc); f(rot, h.rot); rx.value = 0; op.value = 1;
    },
    // yon: "right" | "left" | "sink". Yüzdeler kartın kendi boyuna göre (CSS translate %).
    firlat(yon) {
      const W = boy.w, H = boy.h;
      if (yon === "sink") {
        const a = { duration: 128.8, easing: IN }, b = { duration: 331.2, easing: IN };
        ty.value = withSequence(withTiming(18, a), withTiming(66, b));
        sc.value = withSequence(withTiming(0.985, a), withTiming(0.84, b));
        rx.value = withSequence(withTiming(14, a), withTiming(2, b));
        op.value = withTiming(0, { duration: 460, easing: IN });
        return;
      }
      const k = yon === "right" ? 1 : -1, a = { duration: 100, easing: FIRLAT }, b = { duration: 400, easing: FIRLAT };
      tx.value = withSequence(withTiming(-0.04 * k * W, a), withTiming(1.32 * k * W, b));
      ty.value = withSequence(withTiming(-0.02 * H, a), withTiming(0.16 * H, b));
      rot.value = withSequence(withTiming(-5 * k, a), withTiming(27 * k, b));
      sc.value = withSequence(withTiming(1.025, a), withTiming(0.9, b));
      op.value = withTiming(0, { duration: 500, easing: FIRLAT });
    },
    sifirla() { tx.value = 0; ty.value = 0; sc.value = 1; rot.value = 0; rx.value = 0; op.value = 1; },
  }), [boy]);

  const oy = boy ? -0.06 * boy.h : 0;   // bakış noktası: merkezin %6 yukarısı
  const stil = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [
      { translateY: oy }, { perspective: 1400 }, { translateY: -oy },
      { translateX: tx.value }, { translateY: ty.value }, { rotate: rot.value + "deg" }, { scale: sc.value }, { rotateX: rx.value + "deg" },
    ],
  }));
  return (
    <Animated.View pointerEvents={derinlik === 0 ? "auto" : "none"} style={[StyleSheet.absoluteFill, { zIndex: ucuyor ? 60 : DERINLIK - derinlik }, stil]}>
      <Pressable style={[StyleSheet.absoluteFill, { opacity: gizli ? 0 : 1 }]} onPress={onBas} disabled={derinlik !== 0} accessibilityRole="button">
        {children}
      </Pressable>
    </Animated.View>
  );
});

export default memo(Yuva);
