/*
 * progress.js — Bölüm (section) sıralı ilerleme durumu.
 * Tüm sayfalar (liste, kartlar, bölümler, istatistik) bunu paylaşır.
 *
 * Model (sıralı/kilitli):
 *   FRO = frontier — üzerinde çalışılan sıradaki bölüm (0-based index).
 *   REV = review hedefi (index) veya null — sarı bölümün "Tekrar"ı.
 *   current() = REV != null ? REV : FRO   → liste/kartlar bunu gösterir.
 *
 * Bölüm sınavı (gün sonu sınavı) %100 geçilirse:
 *   - review ise: o bölüm yeşil, tekrar sayacı (rc) +1, REV temizlenir.
 *   - normal ise: o bölüm yeşil (rc=0), FRO bir ilerler (sıradaki açılır).
 * Geçilemezse:
 *   - o bölümün yeşili silinir (gri), liste yeniden açılır. rc korunur.
 *   - review ise REV o bölümde kalır (tekrar çalışılır); normalde FRO aynı kalır.
 *
 * Renk: gray (kayıt yok) / green (geçildi, <2 gün) / yellow (geçildi, >=2 gün,
 *   "Tekrar" bekliyor) / gold (rc>=GOLD: 4 tekrar döngüsü bitti = tam öğrenme,
 *   artık sarıya dönmez, tekrar istenmez).
 */
window.OX = (function () {
  var DAY = 86400000, TWO = 2 * DAY;
  var K_FRO = "ox3000_frontier", K_SEC = "ox3000_sections_v1", K_REV = "ox3000_review";
  var MAX = 29; // 30 bölüm, 0..29
  var GOLD = 4; // 4 tekrar (sarı→sınav) döngüsünden sonra altın = tam öğrenme

  function gi(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function si(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function frontier() { var f = gi(K_FRO, 0); return Math.max(0, Math.min(MAX, f | 0)); }
  function review() { var r = gi(K_REV, null); return (r == null ? null : (r | 0)); }
  function current() { var r = review(); return r == null ? frontier() : r; }
  function sections() { var s = gi(K_SEC, {}); return (s && typeof s === "object") ? s : {}; }

  function status(no) {
    var s = sections()[no];
    if (!s || s.greenAt == null) return "gray";
    if ((s.rc | 0) >= GOLD) return "gold";                  // tam öğrenme (altın)
    return (Date.now() - s.greenAt >= TWO) ? "yellow" : "green";
  }

  // Sınav sonucu uygula. idx: 0-based bölüm index, no: grup no, pass: %100 mu.
  function examResult(idx, no, pass) {
    var s = sections(), rev = review(), fro = frontier();
    var prev = s[no] || {};
    if (pass) {
      var rc = prev.rc | 0;
      if (rev != null) rc = Math.min(GOLD, rc + 1);         // tekrar başarılı → sayaç +1
      s[no] = { greenAt: Date.now(), rc: rc };
      si(K_SEC, s);
      if (rev != null) { si(K_REV, null); }                 // review bitti → frontier'a dön
      else if (idx === fro && fro < MAX) { si(K_FRO, fro + 1); } // ilerle
      return rc >= GOLD ? "gold" : "green";
    } else {
      if (prev.rc) { s[no] = { rc: prev.rc | 0 }; }         // yeşili sil ama sayacı koru → gri
      else if (s[no]) { delete s[no]; }
      si(K_SEC, s);
      if (rev != null) { si(K_REV, idx); }                  // review başarısız → o bölümde kal
      return "reopen";                                       // liste yeniden açılacak
    }
  }

  function startReview(idx) { si(K_REV, idx); }

  return {
    DAY: DAY, MAX: MAX,
    frontier: frontier, review: review, current: current,
    sections: sections, status: status,
    examResult: examResult, startReview: startReview
  };
})();
