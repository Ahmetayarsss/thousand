// Webde Skia (CanvasKit) önce yüklenmeli; katman ondan sonra içeri alınır (src/skiaWeb.web.js).
import { lazy, Suspense } from "react";
import { skiaHazir } from "../skiaWeb";

const Cevirme = lazy(() => skiaHazir().then(() => import("./Cevirme")));

export default function CevirmeKatmani({ ref }) {
  return <Suspense fallback={null}><Cevirme ref={ref} /></Suspense>;
}
