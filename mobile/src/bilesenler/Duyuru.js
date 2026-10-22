// Alttaki kısa bildirim (eski sayfalardaki .toast): duyur(metin, ms). Tek yer, kökte (DuyuruAlani, _layout.js).
// Yenisi öncekinin yerine geçer. Yeri eskisi gibi sekme çubuğunun 22 px üstü (telefonun alt boşluğu dahil).
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTema } from "../tema";
import { CUBUK_BOY } from "./SekmeCubugu";

let dinle = null;
export function duyur(metin, ms = 2200) { if (dinle) dinle({ metin: String(metin), ms }); }

export function DuyuruAlani() {
  const t = useTema(), alt = useSafeAreaInsets().bottom;
  const [m, setM] = useState(null);
  const gor = useRef(new Animated.Value(0)).current;
  const zaman = useRef(null);
  useEffect(() => {
    dinle = (d) => {
      clearTimeout(zaman.current);
      setM(d.metin);
      Animated.timing(gor, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      zaman.current = setTimeout(() => Animated.timing(gor, { toValue: 0, duration: 300, useNativeDriver: true }).start(), d.ms);
    };
    return () => { dinle = null; clearTimeout(zaman.current); };
  }, [gor]);
  if (!m) return null;
  return (
    <Animated.View pointerEvents="none" style={[s.kap, { opacity: gor, bottom: CUBUK_BOY + 22 + alt }]}>
      <Text style={[s.yazi, { backgroundColor: t.solid, color: t.onSolid }]}>{m}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  kap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 99 },
  yazi: { fontSize: 12, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, overflow: "hidden", maxWidth: "92%", textAlign: "center" },
});
