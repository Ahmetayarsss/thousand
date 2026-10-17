/*
 * Kart çevirme katmanı (Skia). Eski uygulamadaki three.js çevirmesinin karşılığı: kartın iki yüzü resim olarak
 * yakalanır (yuzYakala), 64 sütunlu bir ağa doku olarak kaplanır, ağ her karede cevirmeGeometri'deki hesapla
 * (three.js ile birebir; tests/cevirme.test.js) eğilir ve döner. 90°'yi geçince arka yüz görünür.
 * Katman bütün ekranın üstünde çizer (dönerken kart üst/alt çubukların üstüne taşabilsin); dokunuşları geçirir.
 *
 * ref.oynat({ onRef, arkaRef, kart: {x, y, w, h}, s, yakalandi, ilkKare, bitti }):
 *   onRef/arkaRef: yakalanacak yüzler (çevresinde PAY kadar saydam pay), kart: katmandaki yeri,
 *   s: -1 sol kenar menteşe (sağa basıldı), 1 sağ kenar. yakalandi(): yüzler alındı (yakalama kopyaları kaldırılabilir),
 *   ilkKare(): katman ilk kez çizdi (asıl kart gizlenebilir).
 *   bitti(ok): ok=false → yakalanamadı (eski uygulamadaki gibi cevap hemen gösterilir).
 */
import { Canvas, FilterMode, Group, ImageShader, MipmapMode, Vertices } from "@shopify/react-native-skia";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { StyleSheet } from "react-native";
import { Easing, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { cevirmeKaresi, dokuNoktalari, NY, PAY, T } from "./cevirmeGeometri";
import { yuzYakala } from "./yuzYakala";

const ORNEKLEME = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };   // kıvrılan kenarda doku net kalsın

export default forwardRef(function Cevirme(_, ref) {
  const [is, setIs] = useState(null);
  const g = useSharedValue(null), p = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    async oynat({ onRef, arkaRef, kart, s, yakalandi, ilkKare, bitti }) {
      let on = null, arka = null;
      try { [on, arka] = await Promise.all([yuzYakala(onRef), yuzYakala(arkaRef)]); }
      catch (e) { on = null; }
      yakalandi();
      if (!on || !arka) { bitti(false); return; }
      const G = { W: kart.w, H: kart.h, M: PAY, NY, s, ox: kart.x, oy: kart.y };
      p.value = 0; g.value = G;
      setIs({
        on, arka, ilkKare, bitti, ilk: cevirmeKaresi(G, 0),
        dokuOn: dokuNoktalari(NY, on.width(), on.height(), false),
        dokuArka: dokuNoktalari(NY, arka.width(), arka.height(), true),
      });
    },
  }), [g, p]);

  useEffect(() => {
    if (!is) return undefined;
    const r = requestAnimationFrame(() => is.ilkKare());
    const son = () => { setIs(null); is.bitti(true); };
    p.value = withTiming(1, { duration: T, easing: Easing.linear }, (tamam) => { "worklet"; if (tamam) scheduleOnRN(son); });
    return () => cancelAnimationFrame(r);
  }, [is, p]);

  const ilk = is ? is.ilk : null;
  const kare = useDerivedValue(() => (g.value ? cevirmeKaresi(g.value, p.value) : ilk), [ilk]);
  const noktalar = useDerivedValue(() => (kare.value ? kare.value.noktalar : []));
  const sira = useDerivedValue(() => (kare.value ? kare.value.sira : []));
  const onGor = useDerivedValue(() => (kare.value && !kare.value.arka ? 1 : 0));
  const arkaGor = useDerivedValue(() => (kare.value && kare.value.arka ? 1 : 0));

  if (!is) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={onGor}>
        <Vertices vertices={noktalar} textures={is.dokuOn} indices={sira} mode="triangles">
          <ImageShader image={is.on} sampling={ORNEKLEME} />
        </Vertices>
      </Group>
      <Group opacity={arkaGor}>
        <Vertices vertices={noktalar} textures={is.dokuArka} indices={sira} mode="triangles">
          <ImageShader image={is.arka} sampling={ORNEKLEME} />
        </Vertices>
      </Group>
    </Canvas>
  );
});
