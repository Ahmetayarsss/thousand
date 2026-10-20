// Kart çevirme geometrisi (mobile/src/kartlar/cevirmeGeometri.js) eski uygulamadaki three.js çevirmesiyle
// (eski kartlar sayfasındaki glFlip; uygulama kaldırıldı, three.js bu test için tests/cevirme/'de) birebir mi: aynı
// sahne three.js'in kendisiyle kurulur, her
// köşe noktasının ekrandaki yeri karşılaştırılır. Çalıştır: node tests/cevirme.test.js
const assert = require("assert");
const path = require("path");
const THREE = require(path.join(__dirname, "cevirme", "three.min.js"));   // yalnız bu test için: eski uygulamanın three.js'i
const G = require(path.join(__dirname, "../mobile/src/kartlar/cevirmeGeometri.js"));

let gecen = 0;
function test(ad, f) { f(); gecen++; console.log("ok - " + ad); }

// glFlip'in sahnesi; p anındaki köşe noktalarının tuvaldeki yeri (+ kartın sayfadaki yeri).
function ucBoyut(W, H, rx, p, ox, oy) {
  const PAD = 64, CW = W + 2 * PAD, CH = H + 2 * PAD;
  const geo = new THREE.PlaneGeometry(W, H, 64, 1), base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  const s = rx >= 0.5 ? -1 : 1;
  mesh.position.x = -s * W / 2;
  const grp = new THREE.Group(); grp.add(mesh);
  const sc = new THREE.Scene(); sc.add(grp);
  const cam = new THREE.PerspectiveCamera(40, CW / CH, 1, 8000);
  const D = (CH / 2) / Math.tan(20 * Math.PI / 180);
  cam.position.set(0, 0, D); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  // glFlip'teki kare (aynen)
  const ease = smooth(p), ang = ease * Math.PI;
  grp.rotation.y = s * ang;
  const rec = smooth((p - 0.5) / 0.5);
  grp.position.x = s * W * (0.5 - rec);
  const phi = Math.sin(p * Math.PI) * 0.75, pos = geo.attributes.position.array, N = geo.attributes.position.count;
  if (phi < 1e-4) { for (let i = 0; i < N * 3; i++) pos[i] = base[i]; }
  else { const R = W / phi; for (let v = 0; v < N; v++) { const x0 = base[v * 3], th = (x0 / W) * phi; pos[v * 3] = R * Math.sin(th); pos[v * 3 + 2] = R * Math.cos(th) - R; } }
  sc.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  const out = [];
  for (let v = 0; v < N; v++) {
    const q = new THREE.Vector3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    mesh.localToWorld(q); q.project(cam);
    out.push({ x: ox - PAD + (q.x + 1) / 2 * CW, y: oy - PAD + (1 - q.y) / 2 * CH });
  }
  return { out, arka: ang >= Math.PI / 2 };
}

const ORNEKLER = [[366, 600], [342, 520], [410, 700]];
const ANLAR = [0, 0.05, 0.2, 0.33, 0.5, 0.61, 0.75, 0.9, 0.97, 1];

test("köşe noktaları three.js ile aynı yerde (her boyut, iki menteşe, bütün anlar)", () => {
  let enCok = 0;
  for (const [W, H] of ORNEKLER) for (const rx of [0.2, 0.8]) for (const p of ANLAR) {
    const u = ucBoyut(W, H, rx, p, 12, 140);
    // NY=1, M=0: three.js'deki düzlemin aynısı (64 sütun, 1 satır).
    const k = G.cevirmeKaresi({ W, H, M: 0, NY: 1, s: rx >= 0.5 ? -1 : 1, ox: 12, oy: 140 }, p);
    assert.strictEqual(k.noktalar.length, u.out.length);
    for (let v = 0; v < u.out.length; v++) {
      enCok = Math.max(enCok, Math.abs(k.noktalar[v].x - u.out[v].x), Math.abs(k.noktalar[v].y - u.out[v].y));
    }
    assert.strictEqual(k.arka, u.arka, `arka yüze geçiş anı (p=${p})`);
  }
  // three.js köşeleri 32 bitlik sayıyla tutar (Float32Array); fark ondan, pikselin binde birinden az.
  assert.ok(enCok < 1e-3, "en büyük fark " + enCok + " px");
});

test("ince bölme (NY satır) ve saydam pay eğrinin üstünde kalır", () => {
  const W = 366, H = 600;
  for (const p of ANLAR) {
    const kaba = G.cevirmeKaresi({ W, H, M: 0, NY: 1, s: -1, ox: 0, oy: 0 }, p);
    const ince = G.cevirmeKaresi({ W, H, M: 0, NY: 24, s: -1, ox: 0, oy: 0 }, p);
    for (let i = 0; i <= 64; i++) {   // üst ve alt sıra aynı
      assert.ok(Math.abs(kaba.noktalar[i].x - ince.noktalar[i].x) < 1e-9);
      assert.ok(Math.abs(kaba.noktalar[65 + i].y - ince.noktalar[24 * 65 + i].y) < 1e-9);
    }
  }
});

test("başta ve sonda kart yerinde, düz", () => {
  for (const s of [-1, 1]) for (const p of [0, 1]) {
    const k = G.cevirmeKaresi({ W: 300, H: 500, M: 0, NY: 1, s, ox: 10, oy: 20 }, p);
    const sol = Math.min(...k.noktalar.map((n) => n.x)), sag = Math.max(...k.noktalar.map((n) => n.x));
    assert.ok(Math.abs(sol - 10) < 1e-6 && Math.abs(sag - 310) < 1e-6, `s=${s} p=${p}: ${sol}..${sag}`);
  }
});

test("üçgen sırası her sütunu bir kez çizer", () => {
  const k = G.cevirmeKaresi({ W: 300, H: 500, M: 4, NY: 24, s: 1, ox: 0, oy: 0 }, 0.45);
  assert.strictEqual(k.sira.length, 64 * 24 * 6);
  const gorulen = new Set(k.sira);
  assert.strictEqual(gorulen.size, 65 * 25);
});

test("arka yüz dokusu aynalı", () => {
  const on = G.dokuNoktalari(2, 100, 50, false), arka = G.dokuNoktalari(2, 100, 50, true);
  assert.deepStrictEqual(on[0], { x: 0, y: 0 });
  assert.deepStrictEqual(arka[0], { x: 100, y: 0 });
  assert.deepStrictEqual(arka[64], { x: 0, y: 0 });
});

console.log("\n" + gecen + " test geçti");
