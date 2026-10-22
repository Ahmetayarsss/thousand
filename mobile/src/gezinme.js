/*
 * Sayfalar arası geçiş — eski uygulamadaki gibi alt çubukla, parmakla kaydırarak (Kaydir.js) ve bildirimle.
 * Telefonun geri tuşu bir önceki sayfaya döner (sekmelerin geçmişi, _layout.js: backBehavior "fullHistory");
 * geçmiş bitince uygulamadan çıkar.
 *   git(ad, mod): ekrana geç. Sınav sürerken önce Kartlar ekranı onay sorar (cikisBekcisi). Kartlar'a mod
 *     verilmezse Test açılır (eskide alt çubuk hep kartlar.html'i açardı); bildirimden gelişte "sinav".
 *   KOMSU: kaydırma haritası (eskisiyle aynı): sol = sola kaydırınca, sag = sağa kaydırınca,
 *     ust = sayfanın en üstündeyken aşağı çekince, alt = en altındayken yukarı itince.
 */
import { router } from "expo-router";
import { BackHandler } from "react-native";

export const YOL = {
  index: "/", kartlar: "/kartlar", ilerleme: "/ilerleme", analiz: "/analiz",
  sozluk: "/sozluk", arkadas: "/arkadas", ayarlar: "/ayarlar",
};

export const KOMSU = {
  index: { sol: "kartlar", sag: "sozluk" },
  kartlar: { sol: "ilerleme", sag: "index" },
  ilerleme: { sag: "kartlar" },
  sozluk: { sol: "index", ust: "ayarlar", alt: "arkadas" },
  arkadas: { ust: "sozluk" },
  ayarlar: { sol: "analiz", alt: "sozluk" },
  analiz: { sag: "ayarlar" },
};

// Sınav sürerken çıkış onayı (eski window.oxCikisSor). Kartlar ekranı bir bekçi kaydeder; bekçi geçişi üstlenirse
// (onay sorar, "Çık" denince git() çağırır ya da hedef zaten süren sınavsa hiçbir şey yapmaz) true döner.
let bekci = null;
export function cikisBekcisi(f) {
  bekci = f;
  return () => { if (bekci === f) bekci = null; };
}
export function cikisSor(gec, hedef) {
  return bekci ? bekci(gec, hedef || {}) : false;
}

// Kartlar'ın açılacağı mod: ekrana gelince bir kez okunur (kartlarModu). Kartlar zaten açıksa dinleyicisi çağrılır.
let istenen = null, modDinle = null;
export function kartlarModu() { const m = istenen; istenen = null; return m; }
export function kartlarDinle(f) { modDinle = f; return () => { if (modDinle === f) modDinle = null; }; }

export function git(ad, mod) {
  const gec = () => {
    if (ad === "kartlar") istenen = mod || "test";
    router.navigate(YOL[ad]);
    if (ad === "kartlar" && modDinle) modDinle();
  };
  if (!cikisSor(gec, { ad, mod })) gec();
}

// Bir önceki sayfa; geçmiş yoksa uygulamadan çık (telefonun geri tuşuyla aynı).
export function geriGit() {
  if (router.canGoBack()) router.back(); else BackHandler.exitApp();
}
