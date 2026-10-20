// Webde Skia (CanvasKit) önce yüklenmeli (src/skiaWeb.web.js).
import { lazy, Suspense } from "react";
import { skiaHazir } from "../skiaWeb";

const HavaiFisek = lazy(() => skiaHazir().then(() => import("./HavaiFisek")));

export default function HavaiFisekKatmani() {
  return <Suspense fallback={null}><HavaiFisek /></Suspense>;
}
