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
 *   döngüdeki:   doğru → bir üst (en çok olgun), yanlış → bir alt (en az 1)
 *   Yanlışta o anki yön (en2tr/tr2en) kilitlenir; doğruda kilit kalkar.
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
  var CAT = [], IDX = {}, st = null;

  function load() {
    if (st) return st;
    try { st = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { st = {}; }
    if (!st || typeof st !== "object") st = {};
    return st;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function today(now) {
    var d = new Date(now == null ? Date.now() : now);
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
    else { to = ok ? Math.min(4, r.b + 1) : Math.max(1, r.b - 1); r.b = to; }
    if (ok) { r.n++; delete r.d; } else { r.l++; if (dir) r.d = dir; }
    r.due = t + IV[to]; r.a = t;
    s[k] = r; save();
    return { from: from, to: to, due: r.due };
  }

  // Vadesi gelen döngü kelimeleri: yüksek seviye önce, eşitse en çok geciken,
  // o da eşitse katalog sırası.
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
  function examQueue(now) { return { reviews: dueList(now), news: newList() }; }

  function inCycle() { var s = load(), c = 0; for (var k in s) if (IDX[k] != null) c++; return c; }

  // Ana sayfadaki 100'lük listede bulunan en yüksek seviye etiketi.
  function topLevel(n) {
    var l = newList(n == null ? 100 : n), best = -1;
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

  function reset() { st = {}; try { localStorage.removeItem(KEY); } catch (e) {} }
  function _reload() { st = null; }   // testler için

  return {
    IV: IV, today: today, key: key,
    setCatalog: setCatalog, catalogFromGroups: catalogFromGroups,
    level: level, isNew: isNew, isDue: isDue, dirOf: dirOf, answer: answer,
    dueList: dueList, newList: newList, examQueue: examQueue,
    inCycle: inCycle, topLevel: topLevel, groupCounts: groupCounts, totals: totals,
    nextDue: nextDue, reset: reset, _reload: _reload
  };
})();
