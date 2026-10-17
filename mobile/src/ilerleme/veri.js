/*
 * İlerleme ve İstatistikler ekranlarının hesapları, ekrandan bağımsız. Capacitor'daki
 * templates/stats_template.html ve templates/analiz_template.html ile aynı kurallar; tests/ilerleme.test.js denetler.
 * Hepsi SRS'in kayıtlarından (ox3000_srs_v1), günlük özetten (ox3000_daily_v1) ve sınav oturumlarından
 * (ox3000_sessions_v1) okur; hiçbir şey yazmaz.
 */
const GUN = 86400000;
const p2 = (n) => ("0" + n).slice(-2);
const SEVIYELER = ["A1", "A2", "B1", "B2"];

// ---------- İlerleme ----------
// Seviye başına olgun / toplam (yalnız katalogda olan seviyeler).
function seviyeler(SRS, gruplar) {
  const L = {};
  gruplar.forEach((g, i) => { const c = SRS.groupCounts(i), x = L[g.level] || (L[g.level] = { total: 0, mature: 0 }); x.total += c.total; x.mature += c.mature; });
  return SEVIYELER.filter((l) => L[l]).map((l) => ({ lv: l, ...L[l] }));
}
// Kısım kutucukları: durum "tamam" (hepsi olgun), "acik" (çalışılan var), "" (hepsi yeni).
function kisimlar(SRS, gruplar) {
  return gruplar.map((g, i) => {
    const c = SRS.groupCounts(i);
    return { no: g.no, level: g.level, ...c, durum: c.mature === c.total ? "tamam" : c.fresh < c.total ? "acik" : "" };
  });
}
function tarihSaat(t) {
  const d = new Date(t);
  return p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + d.getFullYear() + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
}
// Son 30 sınav, en yeni üstte.
function sonSinavlar(oturumlar) {
  return (Array.isArray(oturumlar) ? oturumlar : []).slice(-30).reverse().map((e) => {
    const p = e.n ? Math.round((e.ok / e.n) * 100) : 0;
    return {
      ok: e.ok, n: e.n, yuzde: p, sinif: p >= 90 ? "iyi" : p >= 70 ? "orta" : "dusuk",
      ayrinti: tarihSaat(e.t) + " · " + [e.rev ? "Tekrar " + e.revOk + "/" + e.rev : "", e.nw ? "Yeni " + e.nwOk + "/" + e.nw : ""].filter(Boolean).join(" · "),
    };
  });
}

// ---------- İstatistikler ----------
const HAFTA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
// Gün numarası (yerel) → o güne denk gelen an (yalnız gösterim için).
function gunTarihi(SRS, d) { return new Date(SRS.now() + (d - SRS.today()) * GUN); }
function gunAy(SRS, d) { const x = gunTarihi(SRS, d); return p2(x.getDate()) + "." + p2(x.getMonth() + 1); }
function gunAyYil(SRS, d) { const x = gunTarihi(SRS, d); return gunAy(SRS, d) + "." + x.getFullYear(); }
function gunAdi(SRS, i, d) { return i === 0 ? "Bugün" : i === 1 ? "Yarın" : HAFTA[gunTarihi(SRS, d).getDay()]; }
const sayi = (n) => n.toLocaleString("tr-TR");

function son30(SRS) {
  const T = SRS.today(), DL = SRS.daily(), out = [];
  for (let d = T - 29; d <= T; d++) { const e = DL[d] || { n: 0, ok: 0, nw: 0 }; out.push({ d, n: e.n, ok: e.ok, bad: e.n - e.ok, nw: e.nw || 0 }); }
  return out;
}
// Çalışma serisi: art arda en az bir sınav cevabı olan günler. Bugün henüz çalışılmadıysa dünden geriye sayılır.
function seriler(SRS) {
  const T = SRS.today(), DL = SRS.daily();
  const gun = Object.keys(DL).map(Number).filter((d) => DL[d] && DL[d].n > 0 && d <= T).sort((a, b) => a - b);
  let enUzun = 0, run = 0, once = null;
  gun.forEach((d) => { run = once != null && d === once + 1 ? run + 1 : 1; enUzun = Math.max(enUzun, run); once = d; });
  const set = new Set(gun);
  let simdi = 0, d = set.has(T) ? T : T - 1;
  while (set.has(d)) { simdi++; d--; }
  return { simdi, enUzun, bugun: set.has(T) };
}
// Tahmini bitiş: son 14 günün yeni kelime ortalamasıyla kalan yeni kelimeler.
function bitisTahmini(SRS) {
  const yeni = SRS.totals().fresh;
  if (!yeni) return { bitti: true };
  const T = SRS.today(), DL = SRS.daily();
  let nw = 0;
  for (let d = T - 13; d <= T; d++) nw += (DL[d] && DL[d].nw) || 0;
  const gunde = nw / 14;
  if (gunde <= 0) return { yok: true, yeni };
  const gun = Math.ceil(yeni / gunde);
  return { gun, tarih: T + gun, gunde, yeni };
}
// Genel kutucuklar: [başlık, değer, açıklama]
function kutucuklar(SRS) {
  const DL = SRS.daily(), g30 = son30(SRS);
  let n = 0, ok = 0, n30 = 0, ok30 = 0;
  for (const d in DL) { n += DL[d].n; ok += DL[d].ok; }
  g30.forEach((x) => { n30 += x.n; ok30 += x.ok; });
  const st = seriler(SRS), fe = bitisTahmini(SRS), tot = SRS.totals();
  return [
    ["Toplam cevap", sayi(n), "Son 30 gün: " + sayi(n30)],
    ["Doğruluk", n ? "%" + Math.round((ok / n) * 100) : "—", n30 ? "Son 30 gün: %" + Math.round((ok30 / n30) * 100) : "Son 30 gün: —"],
    ["Çalışma serisi", st.simdi + " gün", st.simdi && !st.bugun ? "Bugün çalışırsan seri sürer" : "Art arda sınav yapılan gün"],
    ["En uzun seri", st.enUzun + " gün", ""],
    ["Çalışılan", sayi(tot.mature + tot.learning), "Olgun: " + sayi(tot.mature)],
    ["Tahmini bitiş", fe.bitti ? "Bitti" : fe.yok ? "—" : gunAyYil(SRS, fe.tarih),
      fe.bitti ? "Tüm kelimeler çalışılıyor" : fe.yok ? "Son 14 günde yeni kelime yok" : "≈" + sayi(fe.gun) + " gün · günde ort. " + fe.gunde.toFixed(1).replace(".", ",") + " yeni"],
  ];
}
// Katalogdaki kayıtlar: [{k, b, due, l, …}]
function kayitlar(SRS, anahtarla) {
  const R = SRS.records();
  return Object.keys(R).filter((k) => anahtarla[k]).map((k) => ({ k, ...R[k] }));
}
// Kutu dağılımı: Kutu 1, 2, 3, olgun (4–7).
function kutuDagilimi(kayit) {
  const c = [0, 0, 0, 0];
  kayit.forEach((r) => { c[Math.min(4, Math.max(1, r.b)) - 1]++; });
  return c;
}
// Önümüzdeki 7 gün: her gün vadesi gelecek tekrar (bugün = gecikenler dahil).
function yediGun(SRS, kayit) {
  const T = SRS.today(), out = [];
  for (let i = 0; i < 7; i++) out.push({ d: T + i, n: 0 });
  kayit.forEach((r) => { const i = Math.max(0, r.due - T); if (i < 7) out[i].n++; });
  return out;
}
// En çok yanlış yapılan 10 kelime (eşitse düşük kutu önce).
function enCokYanlis(kayit) {
  return kayit.filter((r) => r.l > 0).sort((a, b) => (b.l - a.l) || (a.b - b.b)).slice(0, 10);
}
// Temiz eksen: adım 1/2/5×10^k, üst sınır adımın katı.
function eksen(v, n) {
  const raw = Math.max(1, v) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const step = Math.max(1, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p);
  return { step, max: Math.ceil(Math.max(1, v) / step) * step };
}
// Veri ucu yuvarlak, taban kare: yukarı sütun / sağa çubuk (SVG yolu).
function sutunYolu(x, y, w, h, r) { r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; }
function cubukYolu(x, y, w, h, r) { r = Math.min(r, h / 2, w); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; }

module.exports = {
  seviyeler, kisimlar, sonSinavlar, tarihSaat,
  gunTarihi, gunAy, gunAyYil, gunAdi, sayi, son30, seriler, bitisTahmini, kutucuklar,
  kayitlar, kutuDagilimi, yediGun, enCokYanlis, eksen, sutunYolu, cubukYolu,
};
