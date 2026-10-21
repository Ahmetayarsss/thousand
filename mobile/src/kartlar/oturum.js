/*
 * Kartlar ekranının mantığı (Test ve Sınav), ekrandan bağımsız. Capacitor uygulamasındaki
 * eski uygulamanın kartlar sayfasıyla aynı kurallar; tests/oturum.test.js denetler.
 *
 * TEST (çalışma): ana sayfadaki yeni kelimeler karışık sırayla. İlerlemeyi değiştirmez. Bilemediğin kart
 *   destenin sonuna döner (yönü aynı kalır); hepsi bilinince test biter.
 * SINAV: önce vadesi gelen tekrarlar, sonra turun yeni kelimeleri (SRS.examQueue). Her cevap anında
 *   kaydedilir (SRS.answer); yanlış bilinen aynı sınavda tekrar gelmez. Kuyruğun rastgele %10'u (yukarı
 *   yuvarlanır, en az 1) yazılı sorulur (altın kart).
 * Yön: tr2en (Türkçesi gösterilir) ya da en2tr; Sınav'da önceki yanlışın yönü (SRS.dirOf), yoksa rastgele.
 * Çok anlamlı kelime (PLAN.md adım 41): her anlam ayrı kart ("anahtar#anlamNo"), hep tr2en. Sınav'da yalnız
 *   bekleyen anlamlar (SRS.pendingMeanings) gelir; karar o turun anlamlarının hepsi cevaplanınca verilir
 *   (SRS.answerMeaning) ve sayılar kelime başına bir. anlamSay(anahtar) → kelimenin anlam sayısı.
 */
const OTURUM_ANAHTARI = "ox3000_sessions_v1";   // sınav oturumları (İlerleme sayfası için)

function rastgeleYon() { return Math.random() < 0.5 ? "tr2en" : "en2tr"; }

// Kart kimliği: tek anlamlıda anahtar, çok anlamlıda "anahtar#anlamNo".
function kartId(k, i) { return i == null ? k : k + "#" + i; }
function kartCoz(id) { const j = id.lastIndexOf("#"); return j < 0 ? { k: id, i: null } : { k: id.slice(0, j), i: +id.slice(j + 1) }; }
// Kelimenin kartları. hepsi: Test (bütün anlamlar); değilse Sınav (bekleyen anlamlar).
function kartlar(SRS, k, anlamSay, hepsi) {
  const n = anlamSay(k);
  if (n < 2) return [k];
  const ii = hepsi ? Array.from({ length: n }, (_, i) => i) : SRS.pendingMeanings(k, n);
  return ii.map((i) => kartId(k, i));
}

function testKur(SRS, anlamSay) {
  const sira = SRS.shuffle([].concat(...SRS.newList(SRS.listSize()).map((k) => kartlar(SRS, k, anlamSay, true))));
  return { mod: "test", cur: sira[0] || null, kuyruk: sira.slice(1), toplam: sira.length, yon: {} };
}

function sinavKur(SRS, anlamSay) {
  const q = SRS.examQueue(), ac = (ks) => [].concat(...ks.map((k) => kartlar(SRS, k, anlamSay, false)));
  const tekrar = ac(q.reviews), liste = tekrar.concat(ac(q.news));
  const nYazili = liste.length ? Math.ceil(liste.length / 10) : 0;
  return {
    mod: "sinav", liste, tekrar: tekrar.length, i: 0, cur: liste[0] || null, yon: {}, anlamSay,
    yazili: new Set(SRS.shuffle(liste.slice()).slice(0, nYazili)),
    ot: { rev: 0, revOk: 0, nw: 0, nwOk: 0, ty: 0, tyOk: 0, yanlis: [] },
  };
}

// Kartın yönü: kart desteye ilk girdiğinde belirlenir, oturum boyunca değişmez. Anlam kartı hep tr2en.
function yon(SRS, o, id) {
  if (!o.yon[id]) o.yon[id] = kartCoz(id).i != null ? "tr2en" : (o.mod === "sinav" && SRS.dirOf(id)) || rastgeleYon();
  return o.yon[id];
}

// Destede derinlikteki kelime: 0 üstteki, 1.. arkadakiler.
function bak(o, d) {
  if (o.mod === "test") return d === 0 ? o.cur : (o.kuyruk[d - 1] || null);
  return o.liste[o.i + d] || null;
}

function yaziliMi(o, k) { return o.mod === "sinav" && !!k && o.yazili.has(k); }

function testCevap(o, bildi) {
  if (!bildi) o.kuyruk.push(o.cur);
  o.cur = o.kuyruk.length ? o.kuyruk.shift() : null;
}

// Dönen: kararın sonucu (SRS.answer / answerMeaning; çok anlamlıda tur bitmediyse null) ve kelime yeni miydi.
// Sayılar (yeni/tekrar, doğru, yanlış listesi) karar başına: kelime bir bütün.
function sinavCevap(SRS, o, dogru) {
  const id = o.cur, { k, i } = kartCoz(id), yeniydi = SRS.isNew(k), ot = o.ot;
  const sonuc = i == null ? SRS.answer(k, dogru, o.yon[id]) : SRS.answerMeaning(k, i, dogru, o.anlamSay(k));
  if (sonuc) {
    const ok = i == null ? dogru : !sonuc.yanlis.length;
    if (yeniydi) { ot.nw++; if (ok) ot.nwOk++; } else { ot.rev++; if (ok) ot.revOk++; }
    if (!ok) ot.yanlis.push(k);
  }
  if (yaziliMi(o, id)) { ot.ty++; if (dogru) ot.tyOk++; }
  o.i++;
  o.cur = o.liste[o.i] || null;
  return { sonuc, yeniydi };
}

// İlerleme çubuğu (0..1) ve sayaç yazısı.
function oran(o) {
  if (o.mod === "test") return o.toplam ? (o.toplam - kalan(o)) / o.toplam : 0;
  return o.liste.length ? Math.min(1, o.i / o.liste.length) : 0;
}
function kalan(o) { return o.kuyruk.length + (o.cur ? 1 : 0); }
function sayac(o) {
  if (o.mod === "test") return kalan(o) + " kaldı";
  return o.i < o.tekrar ? "Tekrar " + (o.i + 1) + "/" + o.tekrar : "Yeni " + (o.i - o.tekrar + 1) + "/" + (o.liste.length - o.tekrar);
}

// Sonuç ekranı.
function testSonu(o) {
  if (!o.toplam) return { buyuk: "🎉", kucuk: "yeni kelime kalmadı", mesaj: "Tüm kelimeler çalışılıyor. Sınav sekmesinden tekrarlara devam et.", yanlis: [], dugme: "Tekrar çalış" };
  return { buyuk: String(o.toplam), kucuk: "kelime çalışıldı", mesaj: "Listeyi baştan sona çalıştın. 👏", yanlis: [], dugme: "Tekrar çalış" };
}

// Sınav bitti ya da bırakıldı: oturum kaydedilir (SRS.yaz: yazılamazsa kullanıcı uyarılır, kayda düşer).
function sinavSonu(SRS, o) {
  const ot = o.ot, n = ot.rev + ot.nw, ok = ot.revOk + ot.nwOk, tumu = o.liste.length > 0 && o.i >= o.liste.length;
  if (n) {
    let L = [];
    try { L = JSON.parse(localStorage.getItem(OTURUM_ANAHTARI) || "[]"); } catch (e) { L = []; }
    if (!Array.isArray(L)) L = [];
    L.push({ t: SRS.now(), n, ok, rev: ot.rev, revOk: ot.revOk, nw: ot.nw, nwOk: ot.nwOk, ty: ot.ty, tyOk: ot.tyOk });
    SRS.yaz(OTURUM_ANAHTARI, JSON.stringify(L.slice(-300)));
  }
  const left = SRS.dueList().length, nd = SRS.nextDue();
  const nxt = left ? "Bugün daha " + left + " tekrar var." : (nd == null ? "" : "Sonraki tekrar " + (nd === 1 ? "yarın" : nd + " gün sonra") + ".");
  const ozet = () => [ot.rev ? "Tekrar: " + ot.revOk + "/" + ot.rev : "", ot.nw ? "Yeni: " + ot.nwOk + "/" + ot.nw : "", ot.ty ? "Yazılı: " + ot.tyOk + "/" + ot.ty : ""].filter(Boolean).join(" · ");
  let mesaj;
  if (tumu) {
    const nl = SRS.newList(1).length;
    mesaj = "Bu listenin bütün kelimeleri bitti. " + (nl ? "Ana sayfada yeni kelimeler seni bekliyor; çalışınca sınava dönebilirsin. " : "") + (nxt || "");
    if (n) mesaj = ozet() + ". " + mesaj;
  } else if (!n) mesaj = ((left || SRS.newList(1).length) ? "Henüz cevap yok." : "Bugün sorulacak kelime yok. 🎉") + (nxt ? " " + nxt : "");
  else mesaj = ozet() + ". " + (ot.nw ? ot.nw + " kelime çalışılanlara eklendi. " : "") + nxt;
  return { buyuk: n ? ok + "/" + n : "0", kucuk: n ? "doğru" : "kelime cevaplandı", mesaj, yanlis: ot.yanlis.slice(), dugme: tumu ? "Yeni liste" : "Sınava devam", n, ok, tumu };
}

// Yazılı Türkçeden İngilizceye kartta aynı Türkçe karşılığa sahip başka bir kelime yazıldıysa ("rota" için
// "route") o kelime döner: yanlış sayılmaz ama kart geçilmez (PLAN.md adım 41). dizin: esAnlamDizini(SRS, gruplar).
function esAnlamDizini(SRS, gruplar) {
  const m = {};
  gruplar.forEach((g) => g.items.forEach((d) => SRS.meanings(d).forEach((a) => SRS.alts(a).forEach((x) => {
    (m[x] || (m[x] = new Set())).add(d.w);
  }))));
  return m;
}
function baskaKarsilik(SRS, dizin, anlam, w, yazilan) {
  const y = SRS.norm(yazilan);
  if (!y) return null;
  for (const a of SRS.alts(anlam)) for (const w2 of dizin[a] || []) if (w2 !== w && SRS.alts(w2).includes(y)) return w2;
  return null;
}

module.exports = { OTURUM_ANAHTARI, kartId, kartCoz, esAnlamDizini, baskaKarsilik, testKur, sinavKur, yon, bak, yaziliMi, testCevap, sinavCevap, oran, kalan, sayac, testSonu, sinavSonu };
