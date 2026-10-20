// İlerleme sekmesi: İlerleme sayfası ve ondan açılan İstatistikler (geri ile döner; sekme İlerleme'de kalır).
import { Stack } from "expo-router";
import { useTema } from "../../tema";

export default function IlerlemeDuzeni() {
  const t = useTema();
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: t.kartBg }, headerTintColor: t.ink, headerShadowVisible: false,
      headerTitleStyle: { fontWeight: "800" }, contentStyle: { backgroundColor: t.kartBg },
    }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="analiz" options={{ title: "İstatistikler", headerBackTitle: "İlerleme" }} />
    </Stack>
  );
}
