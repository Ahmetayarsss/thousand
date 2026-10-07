/*
 * srs.js — Kelime bazlı aralıklı tekrar (kutu sistemi). Tüm sayfalar paylaşır.
 *
 * Her kelimenin seviyesi:
 *   0 = yeni (hiç sınavda cevaplanmadı, kayıt yok)
 *   1, 2, 3 = öğreniliyor (kutular)
 *   4 = olgun (3. kutuyu geçti, 7 günde bir sorulmaya devam eder)
 * Kutu aralıkları (gün): 1 → 1, 2 → 3, 3 → 7, olgun → 7.
 *
 * Sınavda cevap:
 *   yeni kelime: doğru → 2, yanlış → 1 (artık döngüde, yeni sayılmaz)
 *   döngüdeki:   doğru → bir üst (en çok olgun), yanlış → bir alt (en az 1;
 *                olgun → 2, çünkü olgun da Kutu 3 gibi 7 günlük)
 *   Yanlışta o anki yön (en2tr/tr2en) kilitlenir; doğruda kilit kalkar.
 *
 * Sınav kuyruğu: önce vadesi gelen tekrarlar (yüksek kutu önce, aynı kutudakiler
 * karışık), sonra "tur" (batch) yeni kelimeleri karışık. Tur, başladığı anda ana
 * sayfadaki listenin (ayarlardaki kelime sayısı kadar) kopyasıdır; sınav bırakılıp
 * yeniden açılınca kalan tur kelimeleriyle devam eder, hepsi cevaplanınca bir
 * sonraki sınavda yeni tur (listenin o anki hali) başlar.
 *
 * Günler yerel saatle gece 00:00'da değişir. Anahtar: "grupNo|kelime"
 * (aynı kelime birden fazla grupta geçebildiği için).
 *
 * Sayfalar önce setCatalog() ile tüm kelimeleri sırasıyla (grup 1 → 30,
 * grup içi sırayla) tanıtır; liste, sınav sırası ve sayaçlar buna göre çıkar.
 */
(typeof window !== "undefined" ? window : globalThis).SRS = (function () {
  var KEY = "ox3000_srs_v1", DAYMS = 86400000;
  var IV = [0, 1, 3, 7, 7];              // seviye → aralık (gün)
  var LV = ["A1", "A2", "B1", "B2", "C1"];
  var SETK = "ox3000_settings_v1", DEVK = "ox3000_dev_v1";
  var BKEY = "ox3000_exam_batch_v1", DAYK = "ox3000_daily_v1";
  var LMIN = 5, LMAX = 300, LDEF = 100;
  var CAT = [], IDX = {}, st = null;

  function getJ(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function setJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  // Geliştirici modu (geçici): off = gün kaydırma (test için "1 gün ileri sar"),
  // noCheat = hile tespiti kapalı.
  function dev() { var d = getJ(DEVK, {}) || {}; return { off: d.off | 0, noCheat: !!d.noCheat }; }
  function setDev(p) { var d = dev(); for (var k in p) d[k] = p[k]; setJ(DEVK, d); }
  function nowMs() { return Date.now() + dev().off * DAYMS; }

  // Ana sayfadaki yeni kelime sayısı (= bir sınav turundaki yeni kelime sayısı).
  function listSize() { var n = (getJ(SETK, {}) || {}).listN | 0; return n >= LMIN && n <= LMAX ? n : LDEF; }
  function setListSize(n) {
    n = Math.max(LMIN, Math.min(LMAX, n | 0));
    var s = getJ(SETK, {}) || {}; s.listN = n; setJ(SETK, s);
    try { localStorage.removeItem(BKEY); } catch (e) {}   // yarım tur yeni sayıyla yeniden kurulsun
    return n;
  }

  function load() {
    if (st) return st;
    try { st = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { st = {}; }
    if (!st || typeof st !== "object") st = {};
    return st;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function today(now) {
    var d = new Date(now == null ? nowMs() : now);
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAYMS);
  }
  function key(no, w) { return no + "|" + w; }

  // list: [{k, lv, g}] — k anahtar, lv seviye ("A1"…), g grup index (0..29)
  function setCatalog(list) {
    CAT = list; IDX = {};
    for (var i = 0; i < list.length; i++) IDX[list[i].k] = i;
  }
  // GROUPS dizisinden katalog üret (sayfalardaki gömülü veri biçimi).
  // Aynı grupta aynı kelime ikinci kez geçerse ("set" isim+fiil) anahtara "|2"
  // eklenir. Kelime nesnelerine anahtar it._k olarak iliştirilir; sayfalar hep
  // bunu kullanır, böylece her yerde aynı anahtar çıkar.
  function catalogFromGroups(groups) {
    var out = [];
    for (var g = 0; g < groups.length; g++) {
      var G = groups[g], ws = G.items || G.ws || [], seen = {};
      for (var i = 0; i < ws.length; i++) {
        var w = typeof ws[i] === "string" ? ws[i] : ws[i].w, k = key(G.no, w);
        if (seen[k]) { seen[k]++; k = k + "|" + seen[k]; } else seen[k] = 1;
        if (typeof ws[i] === "object") ws[i]._k = k;
        out.push({ k: k, lv: G.level, g: g });
      }
    }
    return out;
  }

  function rec(k) { return load()[k] || null; }
  function level(k) { var r = rec(k); return r ? r.b : 0; }
  function isNew(k) { return !rec(k); }
  function isDue(k, now) { var r = rec(k); return !!r && r.due <= today(now); }
  function dirOf(k) { var r = rec(k); return (r && r.d) || null; }

  // Sınav cevabı. dir: o an sorulan yön (yanlışsa kilitlenir).
  function answer(k, ok, dir, now) {
    var s = load(), r = s[k], t = today(now), from = r ? r.b : 0, to;
    if (!r) { to = ok ? 2 : 1; r = { b: to, n: 0, l: 0, f: t }; }
    else { to = ok ? Math.min(4, r.b + 1) : Math.max(1, Math.min(r.b, 3) - 1); r.b = to; }
    if (ok) { r.n++; delete r.d; } else { r.l++; if (dir) r.d = dir; }
    r.due = t + IV[to]; r.a = t;
    s[k] = r; save();
    var dl = getJ(DAYK, {}) || {}, e = dl[t] || (dl[t] = { n: 0, ok: 0, nw: 0 });   // günlük özet (istatistik)
    e.n++; if (ok) e.ok++; if (!from) e.nw++; setJ(DAYK, dl);
    return { from: from, to: to, due: r.due };
  }

  // Vadesi gelen döngü kelimeleri: yüksek seviye önce, eşitse en çok geciken,
  // o da eşitse katalog sırası (sayım/özet için; sınav sırası examQueue'da).
  function dueList(now) {
    var s = load(), t = today(now), out = [];
    for (var k in s) if (IDX[k] != null && s[k].due <= t) out.push(k);
    out.sort(function (a, b) {
      return (s[b].b - s[a].b) || (s[a].due - s[b].due) || (IDX[a] - IDX[b]);
    });
    return out;
  }
  // Sıradaki yeni kelimeler (katalog sırasıyla). n verilmezse hepsi.
  function newList(n) {
    var s = load(), out = [];
    for (var i = 0; i < CAT.length && (n == null || out.length < n); i++)
      if (!s[CAT[i].k]) out.push(CAT[i].k);
    return out;
  }
  // Sınav kuyruğu: tekrarlar (kutu yüksekten düşüğe, aynı kutu içinde karışık) +
  // turun cevaplanmamış yeni kelimeleri (karışık). Tur bittiyse listeden yenisi kurulur.
  function examQueue(now) {
    var s = load(), t = today(now), by = {}, reviews = [];
    for (var k in s) if (IDX[k] != null && s[k].due <= t) (by[s[k].b] || (by[s[k].b] = [])).push(k);
    for (var b = 4; b >= 1; b--) if (by[b]) reviews = reviews.concat(shuffle(by[b]));
    var bt = getJ(BKEY, []);
    bt = (Array.isArray(bt) ? bt : []).filter(function (k) { return IDX[k] != null && !s[k]; });
    if (!bt.length) { bt = newList(listSize()); setJ(BKEY, bt); }
    return { reviews: reviews, news: shuffle(bt.slice()) };
  }

  function inCycle() { var s = load(), c = 0; for (var k in s) if (IDX[k] != null) c++; return c; }

  // Ana sayfadaki 100'lük listede bulunan en yüksek seviye etiketi.
  function topLevel(n) {
    var l = newList(n == null ? listSize() : n), best = -1;
    for (var i = 0; i < l.length; i++) {
      var j = LV.indexOf(CAT[IDX[l[i]]].lv); if (j > best) best = j;
    }
    return best < 0 ? null : LV[best];
  }

  // Grup (kısım) sayaçları: olgun · öğreniliyor · yeni.
  function groupCounts(g) {
    var s = load(), c = { mature: 0, learning: 0, fresh: 0, total: 0 };
    for (var i = 0; i < CAT.length; i++) {
      if (CAT[i].g !== g) continue;
      var r = s[CAT[i].k]; c.total++;
      if (!r) c.fresh++; else if (r.b >= 4) c.mature++; else c.learning++;
    }
    return c;
  }
  function totals() {
    var s = load(), c = { mature: 0, learning: 0, fresh: 0, total: CAT.length };
    for (var i = 0; i < CAT.length; i++) {
      var r = s[CAT[i].k];
      if (!r) c.fresh++; else if (r.b >= 4) c.mature++; else c.learning++;
    }
    return c;
  }
  // En yakın gelecek vade (bugün vadesi yoksa "sonraki tekrar X gün sonra").
  function nextDue(now) {
    var s = load(), t = today(now), best = null;
    for (var k in s) if (IDX[k] != null && s[k].due > t && (best == null || s[k].due < best)) best = s[k].due;
    return best == null ? null : best - t;
  }

  // İstatistik için ham veriler.
  function records() { return load(); }
  function daily() { return getJ(DAYK, {}) || {}; }
  function catalogKey(i) { return CAT[i] && CAT[i].k; }

  function reset() {
    st = {};
    try { localStorage.removeItem(KEY); localStorage.removeItem(BKEY); localStorage.removeItem(DAYK); } catch (e) {}
  }
  function _reload() { st = null; }   // testler için

  return {
    IV: IV, today: today, now: nowMs, key: key, shuffle: shuffle,
    dev: dev, setDev: setDev, listSize: listSize, setListSize: setListSize,
    LMIN: LMIN, LMAX: LMAX, records: records, daily: daily, catalogKey: catalogKey,
    setCatalog: setCatalog, catalogFromGroups: catalogFromGroups,
    level: level, isNew: isNew, isDue: isDue, dirOf: dirOf, answer: answer,
    dueList: dueList, newList: newList, examQueue: examQueue,
    inCycle: inCycle, topLevel: topLevel, groupCounts: groupCounts, totals: totals,
    nextDue: nextDue, reset: reset, _reload: _reload
  };
})();
