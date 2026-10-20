/*
 * Kart çevirmenin geometrisi — eski (Capacitor) uygulamadaki three.js çevirmesinin (kartlar sayfasındaki
 * glFlip) aynı hesabı, three.js'siz. tests/cevirme.test.js bu dosyayı three.js'in kendisiyle karşılaştırır.
 *
 * Kart W×H bir düzlem; basılan yerin karşı kenarı menteşe (sağa basınca sol kenar). 650 ms'de 180° döner,
 * dönerken serbest kenar kavislenir (bombe), sona doğru kart ilk yerine oturur, 90°'yi geçince arka yüz görünür.
 * Kamera: dikey görüş açısı 40°, kart düzlemi tuvale piksel piksel denk gelecek uzaklıkta; tuval kartın
 * çevresine PAD kadar taşar (three.js'deki gibi — uzaklık bu paya bağlı).
 *
 * Fark: three.js tek satırlık bir düzlemi perspektife göre doğru dokuyla çizer. Skia her üçgenin dokusunu
 * düz (afin) yayar, bu yüzden düzlem dikeyde de NY satıra bölünür; köşe noktaları birebir aynı yerdedir.
 * Kenar yumuşasın diye doku kartın çevresinde M piksel saydam pay taşır; pay da aynı eğriyi izler.
 * Derinlik: three.js derinlik tamponu kullanır; burada sütunlar uzaktan yakına sıralanıp çizilir.
 *
 * Fonksiyonlar Reanimated worklet'idir (UI iş parçacığında her karede çalışır) ama düz JS: Node'da da çalışır.
 */
const T = 650, PHI = 0.75, PAD = 64, NX = 64;
const NY = 24;    // dikey bölme (Skia için; bkz. yukarı)
const PAY = 4;    // yakalanan yüzün çevresindeki saydam pay (px)

function yumusak(x) {
  "worklet";
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}

// G: { W, H, M, NY, s (-1: sol kenar menteşe, 1: sağ), ox, oy (kartın sol üst köşesi, katman koordinatı) }
// p: 0..1 (doğrusal zaman). Dönen: { noktalar: [{x, y}], sira: üçgen köşe sırası, arka: arka yüz mü }.
function cevirmeKaresi(G, p) {
  "worklet";
  const W = G.W, H = G.H, M = G.M, NY = G.NY, s = G.s;
  const ang = yumusak(p) * Math.PI;
  const rec = yumusak((p - 0.5) / 0.5);
  const gx = s * W * (0.5 - rec);                 // grubun konumu (menteşe kenarı)
  const phi = Math.sin(p * Math.PI) * PHI;        // kavis
  const R = phi < 1e-4 ? 0 : W / phi;
  const a = s * ang, ca = Math.cos(a), sa = Math.sin(a);
  const CH = H + 2 * PAD, D = (CH / 2) / Math.tan((20 * Math.PI) / 180);
  const cx = G.ox + W / 2, cy = G.oy + H / 2;     // kart düzleminin merkezi (tuvalin ortası)
  const noktalar = new Array((NX + 1) * (NY + 1));
  const sutunZ = new Array(NX).fill(0);
  for (let j = 0; j <= NY; j++) {
    const y0 = H / 2 + M - ((H + 2 * M) * j) / NY;
    for (let i = 0; i <= NX; i++) {
      const x0 = -W / 2 - M + ((W + 2 * M) * i) / NX;
      let x1 = x0, z1 = 0;
      if (R) { const th = (x0 / W) * phi; x1 = R * Math.sin(th); z1 = R * Math.cos(th) - R; }
      const xm = x1 - (s * W) / 2;                // menteşe kenarı grubun orijininde
      const xw = xm * ca + z1 * sa + gx, zw = -xm * sa + z1 * ca;
      const f = D / (D - zw);
      noktalar[j * (NX + 1) + i] = { x: cx + xw * f, y: cy - y0 * f };
      if (i < NX) sutunZ[i] += zw;
      if (i > 0) sutunZ[i - 1] += zw;
    }
  }
  // Uzaktaki sütun önce çizilir (yakındaki üstte kalsın).
  const sutunlar = new Array(NX);
  for (let i = 0; i < NX; i++) sutunlar[i] = i;
  sutunlar.sort((u, v) => sutunZ[u] - sutunZ[v]);
  const sira = new Array(NX * NY * 6);
  let n = 0;
  for (let c = 0; c < NX; c++) {
    const i = sutunlar[c];
    for (let j = 0; j < NY; j++) {
      const a0 = j * (NX + 1) + i, b0 = a0 + 1, a1 = a0 + NX + 1, b1 = a1 + 1;
      sira[n++] = a0; sira[n++] = b0; sira[n++] = a1;
      sira[n++] = b0; sira[n++] = b1; sira[n++] = a1;
    }
  }
  return { noktalar, sira, arka: ang >= Math.PI / 2 };
}

// Doku koordinatları (resmin pikselinde). Arka yüz yatayda aynalanır (three.js: repeat.x = -1), yoksa
// 180° dönünce yazı ters görünürdü.
function dokuNoktalari(NY, genislik, yukseklik, arka) {
  const out = new Array((NX + 1) * (NY + 1));
  for (let j = 0; j <= NY; j++)
    for (let i = 0; i <= NX; i++) {
      const u = i / NX;
      out[j * (NX + 1) + i] = { x: (arka ? 1 - u : u) * genislik, y: (j / NY) * yukseklik };
    }
  return out;
}

module.exports = { T, PAD, NX, NY, PAY, yumusak, cevirmeKaresi, dokuNoktalari };
