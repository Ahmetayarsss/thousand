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
 */
const OTURUM_ANAHTARI = "ox3000_sessions_v1";   // sınav oturumları (İlerleme sayfası için)

function rastgeleYon() { return Math.random() < 0.5 ? "tr2en" : "en2tr"; }

function testKur(SRS) {
  const sira = SRS.shuffle(SRS.newList(SRS.listSize()));
  return { mod: "test", cur: sira[0] || null, kuyruk: sira.slice(1), toplam: sira.length, yon: {} };
}

function sinavKur(SRS) {
  const q = SRS.examQueue();
  const liste = q.reviews.concat(q.news);
  const nYazili = liste.length ? Math.ceil(liste.length / 10) : 0;
  return {
    mod: "sinav", liste, tekrar: q.reviews.length, i: 0, cur: liste[0] || null, yon: {},
    yazili: new Set(SRS.shuffle(liste.slice()).slice(0, nYazili)),
    ot: { rev: 0, revOk: 0, nw: 0, nwOk: 0, ty: 0, tyOk: 0, yanlis: [] },
  };
}

// Kartın yönü: kart desteye ilk girdiğinde belirlenir, oturum boyunca değişmez.
function yon(SRS, o, k) {
  if (!o.yon[k]) o.yon[k] = (o.mod === "sinav" && SRS.dirOf(k)) || rastgeleYon();
  return o.yon[k];
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

// Dönen: SRS.answer'ın sonucu ve kelime yeni miydi.
function sinavCevap(SRS, o, dogru) {
  const k = o.cur, yeniydi = SRS.isNew(k), ot = o.ot;
  const sonuc = SRS.answer(k, dogru, o.yon[k]);
  if (yeniydi) { ot.nw++; if (dogru) ot.nwOk++; } else { ot.rev++; if (dogru) ot.revOk++; }
  if (yaziliMi(o, k)) { ot.ty++; if (dogru) ot.tyOk++; }
  if (!dogru) ot.yanlis.push(k);
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

module.exports = { OTURUM_ANAHTARI, testKur, sinavKur, yon, bak, yaziliMi, testCevap, sinavCevap, oran, kalan, sayac, testSonu, sinavSonu };
