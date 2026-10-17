// Webde (yalnız geliştirme) Skia'nın CanvasKit'i önce yüklenmeli. canvaskit.wasm public/'tedir (repoda değil:
// `npm run web-hazirla` kopyalar). Skia kullanan bileşenler webde bununla tembel yüklenir (…Katmani.web.js).
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export function skiaHazir() {
  return LoadSkiaWeb({ locateFile: (f) => "/" + f });
}
