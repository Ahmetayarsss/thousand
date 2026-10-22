/*
 * Parmakla sayfa değiştirme (eski sayfalardaki kaydırma betiğinin karşılığı): ekranın içeriğini sarar; nereye
 * gidileceği gezinme.js → KOMSU'da. Kurallar eskisiyle aynı: parmak 800 ms içinde kalkmalı; yatayda en az 70 px ve
 * dikeyin 1,8 katı; dikeyde en az 90 px ve yatayın 1,8 katı, yalnız sayfa en üstteyken aşağı çekince / en alttayken
 * yukarı itince (kenar: useKenar). Yatay kaydırma başlayınca karta dokunma sayılmaz (dokunma iptal olur).
 * Dikey kaydırma sayfa kenardayken çabuk (6 px) devralınır, yoksa listenin kendi kaydırması alır.
 * kapali: kaydırma yok (ör. yazılı kartın klavyesi açıkken — eskide tuşların üstünde kaydırma sayılmazdı).
 * kaydirmayiEngelle(): sürgü gibi kendi kaydırması olan parça kullanılırken çağrılır; o sırada sayfa değişmez.
 */
import { useCallback, useRef, useState } from "react";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { git, KOMSU } from "../gezinme";

let engel = 0;
export function kaydirmayiEngelle() { engel = Date.now(); }

export default function Kaydir({ ad, kenar, kapali, children }) {
  const k = KOMSU[ad] || {}, bas = useRef(null);
  const ust = !!(k.ust && kenar && kenar.ust), alt = !!(k.alt && kenar && kenar.alt);
  const pan = usePanGesture({
    runOnJS: true,
    enabled: !kapali,
    activeOffsetX: [-25, 25],
    activeOffsetY: ust && alt ? [-6, 6] : ust ? 6 : alt ? -6 : undefined,
    onBegin: () => { bas.current = { t: Date.now(), ust, alt }; },
    onDeactivate: (e) => {
      const b = bas.current;
      bas.current = null;
      if (!b || e.canceled || Date.now() - b.t > 800 || Date.now() - engel < 1000) return;
      const dx = e.translationX, dy = e.translationY;
      if (Math.abs(dy) >= 90 && Math.abs(dy) > Math.abs(dx) * 1.8) {
        if (dy > 0 && b.ust) git(k.ust); else if (dy < 0 && b.alt) git(k.alt);
        return;
      }
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      if (dx < 0 && k.sol) git(k.sol); else if (dx > 0 && k.sag) git(k.sag);
    },
  });
  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}

// Kaydırılan listenin kenarda olup olmadığı (dikey sayfa geçişi için). Dönen props ScrollView/FlatList'e verilir.
export function useKenar() {
  const [kenar, setKenar] = useState({ ust: true, alt: true });
  const o = useRef({ y: 0, h: 0, c: 0 });
  const guncelle = useCallback(() => {
    const { y, h, c } = o.current, u = y <= 0, a = y + h >= c - 2;
    setKenar((x) => (x.ust === u && x.alt === a ? x : { ust: u, alt: a }));
  }, []);
  const props = {
    scrollEventThrottle: 32,
    onScroll: (e) => {
      const n = e.nativeEvent;
      o.current = { y: n.contentOffset.y, h: n.layoutMeasurement.height, c: n.contentSize.height };
      guncelle();
    },
    onLayout: (e) => { o.current.h = e.nativeEvent.layout.height; guncelle(); },
    onContentSizeChange: (w, h) => { o.current.c = h; guncelle(); },
  };
  return [kenar, props];
}
