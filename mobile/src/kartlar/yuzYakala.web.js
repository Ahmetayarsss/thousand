/*
 * Webde (yalnız geliştirme ve ekran görüntüsüyle deneme): Skia'nın telefondaki görünüm yakalaması webde yok.
 * Eski uygulamanın yöntemi: öğe hesaplanmış stilleriyle kopyalanır, SVG foreignObject içinde resme çizilir.
 */
import { Skia } from "@shopify/react-native-skia";

function stilliKopya(kaynak) {
  const kopya = kaynak.cloneNode(false);
  if (kaynak.nodeType === 1) {
    const cs = getComputedStyle(kaynak);
    let css = "";
    for (let i = 0; i < cs.length; i++) css += cs[i] + ":" + cs.getPropertyValue(cs[i]) + ";";
    kopya.setAttribute("style", css);
    kaynak.childNodes.forEach((c) => kopya.appendChild(stilliKopya(c)));
  }
  return kopya;
}

export function yuzYakala(ref) {
  return new Promise((coz, reddet) => {
    const el = ref.current, r = el.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const kopya = stilliKopya(el);
    kopya.style.position = "absolute"; kopya.style.left = "0"; kopya.style.top = "0"; kopya.style.transform = "none";
    const kap = document.createElement("div");
    kap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    kap.setAttribute("style", "position:relative;width:" + W + "px;height:" + H + "px");
    kap.appendChild(kopya);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject x="0" y="0" width="' + W
      + '" height="' + H + '">' + new XMLSerializer().serializeToString(kap) + "</foreignObject></svg>";
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        const veri = Skia.Data.fromBase64(cv.toDataURL("image/png").split(",")[1]);
        coz(Skia.Image.MakeImageFromEncoded(veri));
      } catch (e) { reddet(e); }
    };
    img.onerror = () => reddet(new Error("yakalama"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
