// log.js testleri: olaylar toplu ve ertelenmiş yazılır, sayfa kapanırken kaybolmaz.
// Çalıştır: node tests/log.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "www", "log.js"), "utf8");

// Bir sayfa açılışı: ls paylaşılan localStorage (sayfalar arası kalır), zamanlayıcı elle ilerletilir.
function sayfa(ls, ad = "index.html") {
  const yazim = { n: 0 }, dinle = {}, bekleyen = [];
  const ctx = {
    localStorage: {
      getItem: (k) => (k in ls ? ls[k] : null),
      setItem: (k, v) => { if (k === "ox3000_log_v1") yazim.n++; ls[k] = String(v); },
      removeItem: (k) => delete ls[k],
    },
    location: { pathname: "/" + ad },
    navigator: { userAgent: "test" },
    document: { hidden: false, addEventListener: (t, f) => (dinle["doc:" + t] = dinle["doc:" + t] || []).push(f) },
    addEventListener: (t, f) => (dinle[t] = dinle[t] || []).push(f),
    setTimeout: (f) => { bekleyen.push(f); return bekleyen.length; },
    clearTimeout: (i) => { bekleyen[i - 1] = null; },
    JSON, Math, Date, String, Array, parseInt, console,
  };
  ctx.window = ctx;
  vm.runInNewContext(SRC, ctx);
  return {
    L: ctx.OXLOG, yazim,
    zamanGecsin: () => { const b = bekleyen.splice(0); b.forEach((f) => f && f()); },
    ayril: () => (dinle.pagehide || []).forEach((f) => f({})),
    arkaPlan: () => { ctx.document.hidden = true; (dinle["doc:visibilitychange"] || []).forEach((f) => f()); },
  };
}
const kayit = (ls) => JSON.parse(ls.ox3000_log_v1 || "[]");

let hata = 0;
function bak(ad, kosul, bilgi) {
  console.log((kosul ? "ok" : "HATA") + " - " + ad + (kosul ? "" : "  " + JSON.stringify(bilgi)));
  if (!kosul) hata++;
}

let ls = {}, s = sayfa(ls);
for (let i = 0; i < 50; i++) s.L.add("cevap", { i });
bak("olaylar hemen yazılmaz (her olayda tüm kayıt yeniden yazılmıyor)", s.yazim.n === 0 && !ls.ox3000_log_v1, s.yazim);
bak("bellekte görünür (sayaç, olaylar, sıra numarası)", s.L.count() === 51 && s.L.events().length === 51 && s.L.sira() === 51, s.L.count());
s.zamanGecsin();
bak("bekleme bitince 51 olay tek seferde yazılır", s.yazim.n === 1 && kayit(ls).length === 51 && ls.ox3000_log_sira === "51", s.yazim);
s.zamanGecsin();
bak("yeni olay yoksa tekrar yazılmaz", s.yazim.n === 1, s.yazim);

s.L.add("cevap", { i: "son" });
s.ayril();
bak("sayfadan çıkarken bekleyen olay hemen yazılır", kayit(ls).length === 52 && kayit(ls)[51][2].i === "son", kayit(ls).length);
const s2 = sayfa(ls, "kartlar.html");
bak("sonraki sayfa önceki olayların hepsini görür, sıra numarası sürer", s2.L.count() === 53 && s2.L.sira() === 53, s2.L.count());

s2.L.add("cevap", { i: "arka" });
s2.arkaPlan();
bak("uygulama arka plana geçince bekleyen olay yazılır", kayit(ls).some((e) => e[2] && e[2].i === "arka"), kayit(ls).length);

ls = {}; s = sayfa(ls);
s.L.add("cevap", {});
bak("size() bekleyenleri önce yazar (Ayarlar'daki KB doğru)", s.L.size() > 0 && kayit(ls).length === 2, s.L.size());

ls = {}; s = sayfa(ls);
for (let i = 0; i < 9; i++) s.L.add("cevap", { i });
s.L.yerAc();
bak("yerAc en eski yarıyı siler ve hemen yazar", kayit(ls).length === 5 && s.L.count() === 5, kayit(ls).length);
s.zamanGecsin();
bak("yerAc sonrası bekleyen yazım eski hali geri yazmaz", kayit(ls).length === 5, kayit(ls).length);

ls = {}; s = sayfa(ls);
for (let i = 0; i < 5100; i++) s.L.add("cevap", { i });
s.zamanGecsin();
bak("en fazla 5000 olay tutulur, sıra numarası saymaya devam eder", kayit(ls).length === 5000 && s.L.sira() === 5101, [kayit(ls).length, s.L.sira()]);

if (hata) { console.log(hata + " test BAŞARISIZ"); process.exitCode = 1; }
