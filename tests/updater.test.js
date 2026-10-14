// Güncelleyici (templates/updater.js) davranış testi: sahte Capacitor ortamında release'ten
// indirme ve bozuk pakette gömülü sürüme dönüş.
// Çalıştır: node tests/updater.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "templates", "updater.js"), "utf8");
const REL = "https://github.com/Ahmetayarsss/thousand/releases/download/apk-latest/";
const GOMULU = "http://localhost/index.html";
const PAKET = "http://localhost/_capacitor_file_/data/webupd/v200/";

// Bir sayfa açılışını taklit eder. ls: paylaşılan localStorage (açılışlar arası kalır).
async function ac({ ver = 100, href = GOMULU, remote = {}, ls = {}, yuklen = true }) {
  const written = {}, urls = [], dinle = {};
  let replaced = null;
  const resp = (u) => remote[u.split("/").pop()];
  const ctx = {
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => (ls[k] = String(v)), removeItem: (k) => delete ls[k] },
    location: { href, pathname: new URL(href).pathname, search: "", hash: "", replace: (u) => (replaced = u) },
    document: { readyState: "loading", createElement: () => ({ style: {} }), body: { appendChild() {} } },
    fetch: async (u) => { urls.push(u); const r = resp(u); return r == null ? { ok: false, status: 404, text: async () => "Not Found" } : { ok: true, status: 200, text: async () => r }; },
    addEventListener: (t, f) => (dinle[t] = dinle[t] || []).push(f),
    setTimeout: (f) => Promise.resolve().then(f), console, JSON, Promise, Object, String, parseInt, URL,
  };
  ctx.window = ctx;
  ctx.Capacitor = {
    isNativePlatform: () => true,
    convertFileSrc: (u) => u.replace("file://", "http://localhost/_capacitor_file_"),
    Plugins: {
      Filesystem: { readdir: async () => ({ files: [] }), rmdir: async () => {}, writeFile: async (o) => { written[o.path] = o.data; }, getUri: async (o) => ({ uri: "file:///data/" + o.path }) },
      CapacitorHttp: { request: async ({ url }) => { urls.push(url); const r = resp(url); return r == null ? { status: 404, data: "Not Found" } : { status: 200, data: r }; } },
    },
  };
  vm.runInNewContext(SRC.replace("__WEBVER__", String(ver)), ctx);
  if (!replaced) {
    (dinle.DOMContentLoaded || []).forEach((f) => f());
    if (yuklen) (dinle.load || []).forEach((f) => f());
  }
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  return { ls, replaced, files: Object.keys(written).length, onlyRelease: urls.every((u) => u.startsWith(REL)) };
}

let hata = 0;
function bak(ad, kosul, bilgi) {
  console.log((kosul ? "ok" : "HATA") + " - " + ad + (kosul ? "" : "  " + JSON.stringify(bilgi)));
  if (!kosul) hata++;
}
const uyg = (ls) => (ls.ox_webupd ? JSON.parse(ls.ox_webupd).ver : 0);

(async () => {
  const pkt = JSON.stringify({ "index.html": "<html>yeni</html>", "updater.js": "var VER = 200;" });
  const yeni = { "web-version.txt": "200", "web.json": pkt };

  // --- İndirme ---
  let r = await ac({ remote: yeni });
  bak("yeni sürüm release'te → indirilir, uygulanır", uyg(r.ls) === 200 && r.files === 2 && r.replaced && r.onlyRelease, r);
  r = await ac({ remote: { "web-version.txt": "100", "web.json": pkt } });
  bak("aynı sürüm → hiçbir şey yapılmaz", !uyg(r.ls) && !r.files && !r.replaced, r);
  r = await ac({ remote: {} });
  bak("release yok (404) → hiçbir şey yapılmaz", !uyg(r.ls) && !r.files && !r.replaced && r.onlyRelease, r);
  r = await ac({ remote: { "web-version.txt": "200" } });
  bak("paket 404 → uygulanmaz", !uyg(r.ls) && !r.files && !r.replaced, r);
  r = await ac({ remote: { "web-version.txt": "200", "web.json": '{"a":1}' } });
  bak("paket bozuk (index.html yok) → uygulanmaz", !uyg(r.ls) && !r.files && !r.replaced, r);
  r = await ac({ remote: { "web-version.txt": "300", "web.json": pkt } });
  bak("paketin sürümü farklı (yükleme yarışı) → uygulanmaz", !uyg(r.ls) && !r.files && !r.replaced, r);
  r = await ac({ remote: { "web-version.txt": "<html>404</html>", "web.json": pkt } });
  bak("sürüm dosyası çöp → uygulanmaz", !uyg(r.ls) && !r.files && !r.replaced, r);

  // --- Bozuk pakette geri dönüş ---
  const kurulu = () => ({ ox_webupd: JSON.stringify({ ver: 200, base: PAKET }) });

  // Sağlıklı paket: gömülü sayfa yönlendirir, paketin sayfası açılınca sayaç sıfırlanır.
  let ls = kurulu();
  r = await ac({ ls });
  bak("kurulu pakete yönlendirilir, sayaç 1", r.replaced === PAKET + "index.html" && ls.ox_webupd_deneme === "1", r);
  await ac({ ver: 200, href: PAKET + "index.html", ls });
  bak("paketin sayfası açılınca sayaç sıfırlanır", !("ox_webupd_deneme" in ls), ls);
  for (let i = 0; i < 5; i++) { await ac({ ls }); await ac({ ver: 200, href: PAKET + "index.html", ls }); }
  bak("sağlıklı paket 5 açılış sonra hâlâ kullanılıyor", uyg(ls) === 200 && !ls.ox_webupd_kotu, ls);

  // Bozuk paket: sayfası hiç açılmıyor (load yok) → 3 denemeden sonra gömülüye dönülür.
  ls = kurulu();
  for (let i = 0; i < 3; i++) {
    r = await ac({ ls });
    await ac({ ver: 200, href: PAKET + "index.html", ls, yuklen: false });
  }
  bak("bozuk paket 3 kez denendi (sayaç 3)", ls.ox_webupd_deneme === "3" && uyg(ls) === 200, ls);
  r = await ac({ ls, remote: yeni });
  bak("4. açılışta gömülü sürüme dönülür, sürüm kötü işaretlenir", !r.replaced && !uyg(ls) && ls.ox_webupd_kotu === "200", { r, ls });
  bak("kötü sürüm bir daha indirilmez", !r.files, r);
  bak("kullanıcıya söylenir ve kayda yazılır (geri dönüş işareti okundu)", !("ox_webupd_geri" in ls), ls);
  r = await ac({ ls, remote: { "web-version.txt": "201", "web.json": pkt.replace("200", "201") } });
  bak("daha yeni sürüm çıkınca o denenir", uyg(ls) === 201 && r.replaced && !("ox_webupd_deneme" in ls), { r, ls });

  if (hata) { console.log(hata + " test BAŞARISIZ"); process.exitCode = 1; }
})();
