/*
 * Alt sekme çubuğu — eski uygulamadaki çubuğun aynısı (build_all.py → nav_bar): 58 px, aynı çizgi simgeler,
 * etkin sekmede simge mavi (accent), yazı koyu ve kalın. Etkin sekmeye dokunmak bir şey yapmaz. İstatistikler
 * (analiz) çubukta yok; açıkken İlerleme etkin görünür. Geçiş gezinme.js → git ile (sınav sürerken onay).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { git } from "../gezinme";
import { useTema } from "../tema";

const SEKMELER = [   // (ekran, ad, SVG yolu — 24x24, çizgi)
  ["index", "Liste", "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"],
  ["kartlar", "Kartlar", "M7 4h11a2 2 0 0 1 2 2v13M4 8h11a2 2 0 0 1 2 2v10H6a2 2 0 0 1-2-2z"],
  ["ilerleme", "İlerleme", "M4 20V10M10 20V4M16 20v-7M22 20H2"],
  ["sozluk", "Sözlük", "M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h8"],
  ["arkadas", "Arkadaş", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6"],
  ["ayarlar", "Ayarlar", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
];
export const CUBUK_BOY = 58;

export default function SekmeCubugu({ state }) {
  const t = useTema(), alt = useSafeAreaInsets().bottom;
  const su = state.routes[state.index].name, etkin = su === "analiz" ? "ilerleme" : su;
  return (
    <View style={[s.cubuk, { backgroundColor: t.bar, borderTopColor: t.line, paddingBottom: alt }]}>
      <View style={s.ic} accessibilityRole="tablist">
        {SEKMELER.map(([ad, baslik, yol]) => {
          const on = ad === etkin;
          return (
            <Pressable key={ad} style={s.sekme} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={baslik}
              onPress={() => { if (ad !== su) git(ad); }}>
              <Svg width={22} height={22} viewBox="0 0 24 24">
                <Path d={yol} fill="none" stroke={on ? t.accent : t.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[s.yazi, { color: on ? t.ink : t.muted, fontWeight: on ? "800" : "600" }]} numberOfLines={1}>{baslik}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cubuk: { borderTopWidth: 1, alignItems: "center" },
  ic: { flexDirection: "row", width: "100%", maxWidth: 600 },
  sekme: { flex: 1, height: CUBUK_BOY, alignItems: "center", justifyContent: "center", gap: 3 },
  yazi: { fontSize: 10.5, lineHeight: 13 },
});
