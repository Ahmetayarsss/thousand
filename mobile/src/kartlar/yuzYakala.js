// Telefonda: görünümün o anki görüntüsü (Skia, cihaz pikseli çözünürlüğünde).
import { makeImageFromView } from "@shopify/react-native-skia";

export function yuzYakala(ref) {
  return makeImageFromView(ref);
}
