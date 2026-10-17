// Alt sekmeler: Capacitor uygulamasındaki sırayla (Liste · Kartlar · İlerleme · Sözlük · Arkadaş · Ayarlar).
import "../cekirdek";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTema } from "../tema";

const SEKMELER = [
  ["index", "Liste", "list"],
  ["kartlar", "Kartlar", "albums-outline"],
  ["ilerleme", "İlerleme", "bar-chart-outline"],
  ["sozluk", "Sözlük", "book-outline"],
  ["arkadas", "Arkadaş", "people-outline"],
  ["ayarlar", "Ayarlar", "settings-outline"],
];

export default function Duzen() {
  const t = useTema();
  return (
    <>
      <StatusBar style={t.koyu ? "light" : "dark"} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.ink,
          tabBarInactiveTintColor: t.muted,
          tabBarStyle: { backgroundColor: t.bar, borderTopColor: t.line },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        }}
      >
        {SEKMELER.map(([ad, baslik, simge]) => (
          <Tabs.Screen
            key={ad}
            name={ad}
            options={{ title: baslik, tabBarIcon: ({ color, size }) => <Ionicons name={simge} color={color} size={size - 2} /> }}
          />
        ))}
      </Tabs>
    </>
  );
}
