// Webde Skia (CanvasKit) önce yüklenmeli; katman ondan sonra içeri alınır. canvaskit.wasm public/'tedir
// (repoda değil: `npm run web-hazirla` kopyalar).
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { lazy, Suspense } from "react";

const Cevirme = lazy(() => LoadSkiaWeb({ locateFile: (f) => "/" + f }).then(() => import("./Cevirme")));

export default function CevirmeKatmani({ ref }) {
  return <Suspense fallback={null}><Cevirme ref={ref} /></Suspense>;
}
