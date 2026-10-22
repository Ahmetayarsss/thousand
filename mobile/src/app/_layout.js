// Alt sekmeler: Capacitor uygulamasındaki sırayla (Liste · Kartlar · İlerleme · Sözlük · Arkadaş · Ayarlar) ve
// çubukta görünmeyen İstatistikler (analiz). Çubuk eskisinin aynısı (SekmeCubugu). Geri tuşu bir önceki sayfaya
// döner (fullHistory: gezilen sayfaların sırası); sayfalar arası kaydırma ekranlarda (Kaydir, gezinme.js).
// Kökte bir kez: ortadaki pencere (karşılama, onaylar), alttaki kısa bildirimler, ilk açılışta sayfa haritası.
import "../cekirdek";
import "../hesap";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { DuyuruAlani } from "../bilesenler/Duyuru";
import { PencereAlani } from "../bilesenler/Pencere";
import SekmeCubugu from "../bilesenler/SekmeCubugu";
import { OXLOG } from "../cekirdek";
import { git } from "../gezinme";
import { bildirimHedefi } from "../hesap";
import { useTema } from "../tema";

const EKRANLAR = ["index", "kartlar", "ilerleme", "sozluk", "arkadas", "ayarlar", "analiz"];

// Bildirime dokununca: hedef ekrana geç (uygulama kapalıyken açıldıysa da, açıkken öne geldiyse de).
// Sınav sürerken onay sorulur; hedef zaten süren sınavsa hiçbir şey olmaz (eski oxCikisSor).
function hedefeGit() {
  const h = bildirimHedefi();
  if (!h) return;
  OXLOG.add("bildirim", { a: "ac", p: h.ad + (h.mod ? "?" + h.mod : "") });
  git(h.ad, h.mod);
}

export default function Duzen() {
  const t = useTema();
  useEffect(() => {
    const z = setTimeout(hedefeGit, 500);
    const a = AppState.addEventListener("change", (d) => { if (d === "active") setTimeout(hedefeGit, 300); });
    return () => { clearTimeout(z); a.remove(); };
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.koyu ? "light" : "dark"} />
      <Tabs backBehavior="fullHistory" tabBar={(p) => <SekmeCubugu {...p} />} screenOptions={{ headerShown: false }}>
        {EKRANLAR.map((ad) => <Tabs.Screen key={ad} name={ad} />)}
      </Tabs>
      <DuyuruAlani />
      <PencereAlani />
    </GestureHandlerRootView>
  );
}
