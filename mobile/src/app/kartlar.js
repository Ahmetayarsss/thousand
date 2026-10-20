/*
 * Kartlar: Test (çalışma, ilerlemeyi değiştirmez) ve Sınav (tekrar sistemi). Capacitor'daki
 * eski uygulamanın kartlar sayfasının aynısı; kurallar src/kartlar/oturum.js'te (tests/oturum.test.js).
 *   - Deste: üstte soru kartı, arkada sıradaki 3 kart (src/kartlar/Deste.js).
 *   - Açma: karta dokununca (dokunulan tarafın karşı kenarı menteşe) ya da "Aç" ile; kart Skia ile kıvrılarak
 *     döner (src/kartlar/Cevirme.js — eski three.js çevirmesiyle birebir), kelime okunur.
 *   - Sınavda kuyruğun %10'u yazılı (altın kart): uygulama içi klavyeyle yazılır, sistem denetler.
 *   - Sınav sürerken çıkışta onay (Test'e geçiş, Bitir, başka sekme, geri tuşu). Cevaplar anında kaydedilir.
 * Ekrana her gelişte yeni Test başlar (?exam=1 ile gelindiyse Sınav) — eski uygulamada sayfa yeniden açılırdı.
 * Cevaptan sonra özet arkadaşlara gider (HESAP.syncSoon). Henüz yok (adım 36): hatırlatmaların yeniden kurulması.
 */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ANAHTARLA, OXLOG, SRS } from "../cekirdek";
import { cikisBekcisi } from "../cikis";
import { HESAP } from "../hesap";
import CevirmeKatmani from "../kartlar/CevirmeKatmani";
import { PAY } from "../kartlar/cevirmeGeometri";
import Yuva, { DERINLIK, rastgeleEgim, rastgeleKayma } from "../kartlar/Deste";
import KartYuzu from "../kartlar/KartYuzu";
import { harfEkle, Klavye, Kutular } from "../kartlar/Klavye";
import * as O from "../kartlar/oturum";
import { durdur, kelimeyiOku } from "../ses";
import { useTema } from "../tema";

function ustBaslik() { const lv = SRS.topLevel(); return SRS.inCycle() + (lv ? " · " + lv : ""); }
function olc(ref) {
  return new Promise((coz) => { if (!ref.current) coz(null); else ref.current.measureInWindow((x, y, w, h) => coz({ x, y, w, h })); });
}

export default function Kartlar() {
  const t = useTema();
  const { exam } = useLocalSearchParams();
  const D = useRef({ mod: "test", o: null, side: 0, busy: false, acik: false, ustYuz: "on", tPrompt: 0, yazili: null }).current;
  const [, setSurum] = useState(0);
  const ciz = useCallback(() => setSurum((v) => v + 1), []);
  const [yuvalar, setYuvalar] = useState(() => [0, 1, 2, 3].map((id) => ({ id, k: null, egim: 0, kayma: 0 })));
  const yuvaRef = useRef({});
  const bekleyen = useRef(null);   // yuvalar değişince yapılacak yerleşim
  const [ucan, setUcan] = useState(null);
  const [gizliUst, setGizliUst] = useState(false);
  const [yakala, setYakala] = useState(null);
  const [sonuc, setSonuc] = useState(null);
  const [baslik, setBaslik] = useState("");
  const [toast, setToast] = useState(null);
  const [ayrilma, setAyrilma] = useState(null);
  const [boy, setBoy] = useState(null);
  const [panelBoy, setPanelBoy] = useState(0);
  const kokRef = useRef(null), desteRef = useRef(null), onYakRef = useRef(null), arkaYakRef = useRef(null), cevirRef = useRef(null);
  const sonucRef = useRef(null); sonucRef.current = sonuc;
  const ayrilmaRef = useRef(null); ayrilmaRef.current = ayrilma;

  const cur = () => D.o && D.o.cur;
  const yaziliMi = () => !!D.o && O.yaziliMi(D.o, D.o.cur);
  const sinavda = () => D.mod === "sinav" && !!cur() && !sonucRef.current;

  // ---- bilgi balonu ----
  const toastZaman = useRef(0);
  const balon = useCallback((metin) => {
    clearTimeout(toastZaman.current);
    setToast(metin);
    toastZaman.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ---- deste ----
  useLayoutEffect(() => {
    const b = bekleyen.current;
    if (!b) return;
    bekleyen.current = null;
    yuvalar.forEach((y, d) => {
      const r = yuvaRef.current[y.id];
      if (!r) return;
      if (b.hepsi) r.yerles(d, y.egim, y.kayma, false);
      else if (y.id === b.yeni) { r.sifirla(); r.yerles(d, y.egim, y.kayma, true); }
    });
  }, [yuvalar]);

  function yaziliKur() {
    const k = cur();
    if (!k || !yaziliMi()) { D.yazili = null; return; }
    const d = ANAHTARLA[k].d, yon = D.o.yon[k], n = SRS.answerSlots(d, yon).length, en = yon === "tr2en";
    D.yazili = {
      degerler: new Array(n).fill(""), etkin: 0, sonuc: null,
      ipuclari: Array.from({ length: n }, (_, i) => (en ? "İngilizcesi" : n > 1 ? i + 1 + ". anlam" : "Türkçesi")),
    };
  }
  function ustHazir() {
    D.side = 0; D.acik = false; D.ustYuz = "on"; D.tPrompt = performance.now();
    yaziliKur();
  }
  function desteKur() {
    const y = [];
    for (let d = 0; d < DERINLIK; d++) {
      const k = O.bak(D.o, d);
      if (k) O.yon(SRS, D.o, k);
      y.push({ id: d, k, egim: rastgeleEgim(), kayma: rastgeleKayma() });
    }
    bekleyen.current = { hepsi: true };
    setYuvalar(y); setUcan(null); setGizliUst(false); setSonuc(null);
    ustHazir(); ciz();
  }

  // ---- başlat / bitir ----
  function testBitti() { setSonuc({ ...O.testSonu(D.o), test: true }); }
  function sinavBitti() {
    const r = O.sinavSonu(SRS, D.o);
    OXLOG.add("sinav_bit", { n: r.n, ok: r.ok, tum: r.tumu ? 1 : 0, yz: D.o.ot.ty, yzOk: D.o.ot.tyOk });
    if (r.n) HESAP.syncSoon(true, true);   // sınav bitince özet hemen, yedek (5 dk'da bir)
    setSonuc(r); setBaslik(ustBaslik());
  }
  function baslat() {
    durdur(); D.busy = false; setAyrilma(null); setBaslik(ustBaslik());
    if (D.mod === "test") {
      D.o = O.testKur(SRS);
      if (!D.o.toplam) { testBitti(); ciz(); return; }
      OXLOG.add("test_bas", { n: D.o.toplam });
    } else {
      D.o = O.sinavKur(SRS);
      OXLOG.add("sinav_bas", { rev: D.o.tekrar, nw: D.o.liste.length - D.o.tekrar, yz: D.o.yazili.size });
      if (!D.o.cur) { sinavBitti(); ciz(); return; }
      if (!D.o.tekrar) balon("Bugün vadesi gelen tekrar yok — yeni kelimelerle başlıyoruz.");
    }
    desteKur();
  }

  // ---- açma (çevirme) ----
  function ac(rx) {
    if (D.side === 1 || D.busy || !cur()) return;
    D.side = 1;
    setYakala({ k: cur(), s: rx >= 0.5 ? -1 : 1 });
  }
  const acildi = useCallback(() => {
    setYakala(null); setGizliUst(false);
    D.ustYuz = "arka"; D.acik = true; ciz();
  }, [D, ciz]);
  // Yakalanacak yüzler çizildikten sonra katman oynar.
  useEffect(() => {
    if (!yakala) return undefined;
    let iptal = false;
    const r = requestAnimationFrame(() => requestAnimationFrame(async () => {
      if (iptal) return;
      const [kok, deste] = await Promise.all([olc(kokRef), olc(desteRef)]);
      if (iptal) return;
      if (!cevirRef.current || !kok || !deste) { acildi(); return; }
      cevirRef.current.oynat({
        onRef: onYakRef, arkaRef: arkaYakRef, s: yakala.s,
        kart: { x: deste.x - kok.x, y: deste.y - kok.y, w: deste.w, h: deste.h },
        yakalandi: () => setYakala(null),
        ilkKare: () => setGizliUst(true),
        bitti: () => acildi(),
      });
    }));
    return () => { iptal = true; cancelAnimationFrame(r); };
  }, [yakala, acildi]);

  // ---- cevap ----
  function ilerle(yon) {
    D.busy = true;
    const ayrilan = yuvalar[0];
    setUcan(ayrilan.id);
    yuvaRef.current[ayrilan.id].firlat(yon);
    for (let d = 1; d < DERINLIK; d++) { const y = yuvalar[d]; yuvaRef.current[y.id].yerles(d - 1, y.egim, y.kayma, true); }
    const yeniK = O.bak(D.o, DERINLIK - 1);
    if (yeniK) O.yon(SRS, D.o, yeniK);
    setTimeout(() => {
      bekleyen.current = { yeni: ayrilan.id };
      setYuvalar((ys) => [...ys.slice(1), { id: ayrilan.id, k: yeniK, egim: rastgeleEgim(), kayma: rastgeleKayma() }]);
      setUcan(null);
      D.busy = false;
      if (cur()) { ustHazir(); ciz(); }
      else if (D.mod === "test") testBitti();
      else sinavBitti();
    }, 470);
  }
  function testCevap(bildi) {
    if (D.busy) return;
    OXLOG.add("test", { k: cur(), ok: bildi ? 1 : 0 });
    O.testCevap(D.o, bildi);
    ilerle(bildi ? (Math.random() < 0.5 ? "left" : "right") : "sink");   // Bilemedim → destenin altına
  }
  function sinavCevap(dogru) {
    if (D.busy || !cur()) return;
    const k = cur(), yz = yaziliMi(), yon = D.o.yon[k], yazilan = D.yazili && D.yazili.sonuc ? D.yazili.sonuc.degerler : undefined;
    const { sonuc: r } = O.sinavCevap(SRS, D.o, dogru);
    OXLOG.add("cevap", { k, y: yon === "tr2en" ? "te" : "et", ok: dogru ? 1 : 0, b: [r.from, r.to],
      ms: Math.round(performance.now() - D.tPrompt), yz: yz ? 1 : 0, g: yz ? yazilan : undefined });
    D.yazili = null;
    HESAP.syncSoon(false);   // arkadaşların görsün (dakikada en çok bir)
    setBaslik(ustBaslik());
    if (D.o.i === D.o.tekrar && D.o.tekrar > 0 && D.o.cur) balon("Tekrarlar bitti — yeni kelimelere geçiliyor.");
    ilerle(dogru ? "right" : "left");   // Bildim → sağa, Bilemedim → sola
  }
  const cevap = (b) => (D.mod === "test" ? testCevap(b) : sinavCevap(b));

  // ---- yazılı kart ----
  const yaziliCanli = () => !D.busy && !!cur() && yaziliMi() && D.side === 0 && D.yazili && !D.yazili.sonuc;
  function harf(ch) { if (!yaziliCanli()) return; const y = D.yazili; y.degerler[y.etkin] = harfEkle(y.degerler[y.etkin] || "", ch); ciz(); }
  function sil() { if (!yaziliCanli()) return; const y = D.yazili, v = y.degerler[y.etkin] || ""; if (!v) return; y.degerler[y.etkin] = v.slice(0, -1); ciz(); }
  function sonraki() { if (!yaziliCanli() || D.yazili.degerler.length < 2) return; D.yazili.etkin = (D.yazili.etkin + 1) % D.yazili.degerler.length; ciz(); }
  function sec(i) { if (!yaziliCanli()) return; D.yazili.etkin = i; ciz(); }
  function kontrol() {
    if (!yaziliCanli()) return;
    const k = cur(), d = ANAHTARLA[k].d, degerler = D.yazili.degerler.slice(), r = SRS.checkTyped(d, D.o.yon[k], degerler);
    D.yazili.sonuc = { ok: r.ok, isaret: r.marks, degerler };
    ciz();
    setTimeout(() => { if (cur() === k && D.side === 0) { ac(0.5); kelimeyiOku(d.w); } }, 120);
  }
  const yaziliRef = useRef({}); yaziliRef.current = { harf, sil, sonraki, kontrol };
  useEffect(() => {   // bilgisayarda deneme için fiziksel klavye (web)
    if (Platform.OS !== "web") return undefined;
    const f = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const Y = yaziliRef.current;
      if (e.key === "Enter") Y.kontrol(); else if (e.key === "Backspace") Y.sil(); else if (e.key === "Tab") { e.preventDefault(); Y.sonraki(); }
      else if (e.key.length === 1 && /[\p{L} ]/u.test(e.key)) Y.harf(e.key.toLocaleLowerCase("tr-TR"));
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, []);

  // ---- karta dokunma ----
  async function kartaBas(e) {
    if (D.busy || !cur()) return;
    const d = ANAHTARLA[cur()].d;
    if (D.side === 0 && yaziliMi()) { if (D.o.yon[cur()] !== "tr2en") kelimeyiOku(d.w); return; }   // yazılı kart dokunuşla açılmaz
    if (D.side === 0) {
      const { pageX } = e.nativeEvent, r = await olc(desteRef);
      ac(r ? (pageX - r.x) / r.w : 0.5);
    }
    kelimeyiOku(d.w);
  }

  // ---- çıkış onayı ----
  function cikisOnayi(metin, eylem, git) {
    if (ayrilmaRef.current) return;
    setAyrilma({ metin, eylem, git });
  }
  function modSec(m) {
    if (m === "sinav" && D.mod === "sinav" && sinavda()) return;   // zaten sınavda: baştan başlatma
    const gec = () => { D.mod = m; baslat(); };
    if (m === "test" && sinavda()) cikisOnayi("Teste geçiyorsun.", "Teste geç", gec); else gec();
  }

  useFocusEffect(useCallback(() => {
    D.mod = exam === "1" ? "sinav" : "test";
    baslat();
    const sok = cikisBekcisi((git) => { if (!sinavda()) return false; cikisOnayi("Sınavdan çıkıyorsun.", "Çık", git); return true; });
    const geri = BackHandler.addEventListener("hardwareBackPress", () => {
      if (ayrilmaRef.current) { setAyrilma(null); return true; }
      if (!sinavda()) return false;
      cikisOnayi("Sınavdan çıkıyorsun.", "Çık", () => router.navigate("/"));
      return true;
    });
    return () => { sok(); geri.remove(); durdur(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam]));

  // ---- çizim ----
  const o = D.o, ust = cur(), yz = !!ust && yaziliMi() && !sonuc, Y = D.yazili;
  const sinavMi = D.mod === "sinav";
  const oran = o ? O.oran(o) : 0;
  const sayacMetni = !o || sonuc ? "" : O.sayac(o);
  const yuzProps = (k, yuz) => {
    const e = ANAHTARLA[k];
    return {
      d: e.d, yuz, yon: D.o.yon[k], seviye: e.g.level, t,
      etiket: sinavMi ? (SRS.isNew(k) ? "Yeni" : "Tekrar") : null, yazili: O.yaziliMi(D.o, k),
    };
  };

  return (
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.kartBg }]}>
      <View ref={kokRef} collapsable={false} style={s.kok}>
        <View style={s.uygulama}>
          <View style={[s.modlar, { backgroundColor: t.soft }]}>
            {[["test", "Test"], ["sinav", "Sınav"]].map(([m, ad]) => (
              <Pressable key={m} onPress={() => modSec(m)} accessibilityRole="tab" accessibilityState={{ selected: D.mod === m }}
                style={[s.mod, D.mod === m && [s.modOn, { backgroundColor: t.card }]]}>
                <Text style={[s.modYazi, { color: D.mod === m ? t.ink : t.muted }]}>{ad}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.baslik, { color: t.ink }]} accessibilityRole="header">{baslik}</Text>
          <View style={s.ilerleme}>
            <View style={[s.cubuk, { backgroundColor: t.kartLine }]}><View style={{ width: oran * 100 + "%", height: "100%", backgroundColor: t.green }} /></View>
            <Text style={[s.sayac, { color: t.ink }]}>{sayacMetni}</Text>
            {sinavMi && !sonuc && ust ? (
              <Pressable onPress={() => { if (!D.busy) cikisOnayi("Sınavı bitiriyorsun.", "Bitir", () => { if (D.mod === "sinav") sinavBitti(); }); }}
                style={[s.bitir, { backgroundColor: t.solid }]} accessibilityRole="button">
                <Text style={[s.bitirYazi, { color: t.onSolid }]}>Bitir</Text>
              </Pressable>
            ) : null}
          </View>

          {sonuc ? (
            <Sonuc sonuc={sonuc} t={t} onTekrar={baslat} onListe={() => router.navigate("/")} />
          ) : (
            <View style={s.sahne}>
              <View ref={desteRef} collapsable={false} style={s.deste} onLayout={(e) => setBoy({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
                {yakala && ANAHTARLA[yakala.k] ? (
                  <>
                    <View ref={onYakRef} collapsable={false} style={s.yakala}><KartYuzu {...yuzProps(yakala.k, "on")} golge={false} /></View>
                    <View ref={arkaYakRef} collapsable={false} style={s.yakala}><KartYuzu {...yuzProps(yakala.k, "arka")} golge={false} /></View>
                  </>
                ) : null}
                {yuvalar.map((y, d) => (
                  <Yuva key={y.id} ref={(r) => { yuvaRef.current[y.id] = r; }} derinlik={d} ucuyor={ucan === y.id}
                    gizli={d === 0 && gizliUst} boy={boy} onBas={kartaBas}>
                    {y.k && ANAHTARLA[y.k] ? <KartYuzu {...yuzProps(y.k, d === 0 ? D.ustYuz : "on")} /> : null}
                  </Yuva>
                ))}
              </View>
              <View style={[s.dugmeler, yz && s.gorunmez]} pointerEvents={yz ? "none" : "auto"}>
                {!D.acik ? (
                  <Dugme metin="Aç" renk={t.accent} onBas={() => { if (D.busy || !ust || D.side === 1) return; ac(0.5); kelimeyiOku(ANAHTARLA[ust].d.w); }} />
                ) : (
                  <>
                    <Dugme metin={sinavMi ? "Bilemedim" : "Tekrar"} renk={t.red} onBas={() => cevap(false)} />
                    <Dugme metin={sinavMi ? "Bildim" : "Biliyorum"} renk={t.green} onBas={() => cevap(true)} />
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        <CevirmeKatmani ref={cevirRef} />

        {yz && Y ? (
          <View style={[s.panel, { backgroundColor: t.klavye }]} onLayout={(e) => setPanelBoy(e.nativeEvent.layout.height)}>
            <Kutular degerler={Y.degerler} etkin={Y.etkin} ipuclari={Y.ipuclari} isaret={Y.sonuc ? Y.sonuc.isaret : null} onSec={sec} t={t} />
            {!Y.sonuc ? (
              <Klavye onHarf={harf} onSil={sil} onSonraki={sonraki} onKontrol={kontrol} sonrakiYok={Y.degerler.length < 2}
                kontrolMetni={Y.degerler.some((v) => v.trim()) ? "Kontrol et" : "Bilmiyorum"} t={t} />
            ) : (
              <Dugme metin={(Y.sonuc.ok ? "Doğru ✓" : "Yanlış ✗") + (D.acik ? "  ·  Devam" : "")} renk={Y.sonuc.ok ? t.green : t.red}
                pasif={!D.acik} onBas={() => { if (D.acik && D.side === 1) sinavCevap(Y.sonuc.ok); }} tam />
            )}
          </View>
        ) : null}

        {toast ? (
          <View pointerEvents="none" style={[s.balon, { bottom: (yz ? panelBoy + 12 : 22) }]}>
            <Text style={s.balonYazi}>{toast}</Text>
          </View>
        ) : null}
      </View>

      <Modal transparent visible={!!ayrilma} animationType="none" onRequestClose={() => setAyrilma(null)}>
        <Pressable style={[s.perde, { backgroundColor: t.scrim }]} onPress={() => setAyrilma(null)}>
          <Pressable style={[s.kutu, { backgroundColor: t.card }]} onPress={() => {}}>
            <Text style={[s.kutuBaslik, { color: t.ink }]}>Emin misin?</Text>
            <Text style={[s.kutuMetin, { color: t.ex }]}>{ayrilma ? ayrilma.metin + " Cevapların kaydedildi; sonra kaldığın yerden devam edersin." : ""}</Text>
            <View style={s.kutuSatir}>
              <Pressable style={[s.kutuDugme, { backgroundColor: t.solid }]} onPress={() => setAyrilma(null)}>
                <Text style={[s.kutuDugmeYazi, { color: t.onSolid }]}>Sınava devam et</Text>
              </Pressable>
              <Pressable style={[s.kutuDugme, { backgroundColor: t.badBg }]}
                onPress={() => { const a = ayrilma; setAyrilma(null); OXLOG.add("sinav_cik", { n: D.o ? D.o.i : 0 }); a.git(); }}>
                <Text style={[s.kutuDugmeYazi, { color: t.redKoyu }]}>{ayrilma ? ayrilma.eylem : ""}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Dugme({ metin, renk, onBas, pasif, tam }) {
  return (
    <Pressable onPress={onBas} disabled={pasif} accessibilityRole="button"
      style={({ pressed }) => [s.dugme, tam && s.tam, { backgroundColor: renk, transform: [{ translateY: pressed ? 1 : 0 }] }]}>
      <Text style={s.dugmeYazi}>{metin}</Text>
    </Pressable>
  );
}

function Sonuc({ sonuc, t, onTekrar, onListe }) {
  return (
    <ScrollView contentContainerStyle={s.sonuc}>
      <Text style={[s.puan, { color: t.ink }]}>{sonuc.buyuk}</Text>
      <Text style={[s.puanAlt, { color: t.muted }]}>{sonuc.kucuk}</Text>
      <Text style={[s.sonucMetin, { color: t.muted }]}>{sonuc.mesaj}</Text>
      <View style={s.yanlislar}>
        {sonuc.yanlis.map((k) => (
          <View key={k} style={[s.yanlis, { backgroundColor: t.card, borderColor: t.kartLine }]}>
            <Text style={{ fontSize: 13.5, color: t.tr }}><Text style={{ fontWeight: "700", color: t.ink }}>{ANAHTARLA[k].d.w}</Text> — {ANAHTARLA[k].d.tr || ""}</Text>
          </View>
        ))}
      </View>
      <View style={s.sonucDugmeler}>
        <Pressable onPress={onTekrar} style={[s.sonucDugme, { backgroundColor: t.solid, borderColor: t.solid }]}>
          <Text style={[s.sonucDugmeYazi, { color: t.onSolid }]}>{sonuc.dugme}</Text>
        </Pressable>
        <Pressable onPress={onListe} style={[s.sonucDugme, { backgroundColor: t.card, borderColor: t.kartLine }]}>
          <Text style={[s.sonucDugmeYazi, { color: t.ink }]}>Listeye dön</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1 },
  kok: { flex: 1 },
  uygulama: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center", paddingTop: 8, paddingHorizontal: 12, paddingBottom: 10 },
  modlar: { flexDirection: "row", gap: 6, borderRadius: 11, padding: 4, marginTop: 2, marginBottom: 8 },
  mod: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  modOn: { boxShadow: "0 1px 3px rgba(0,0,0,.12)" },
  modYazi: { fontSize: 13.5, fontWeight: "800" },
  baslik: { fontSize: 15, fontWeight: "800" },
  ilerleme: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, minHeight: 26 },
  cubuk: { flex: 1, height: 7, borderRadius: 6, overflow: "hidden" },
  sayac: { fontSize: 11.5, fontWeight: "800" },
  bitir: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  bitirYazi: { fontSize: 12, fontWeight: "800" },
  sahne: { flex: 1, paddingTop: 8 },
  deste: { flex: 1 },
  yakala: { position: "absolute", left: -PAY, top: -PAY, right: -PAY, bottom: -PAY, padding: PAY },
  dugmeler: { flexDirection: "row", gap: 10, marginTop: 12, minHeight: 52 },
  gorunmez: { opacity: 0 },
  dugme: { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  tam: { flex: 0, marginHorizontal: 3 },
  dugmeYazi: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 9995, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    boxShadow: "0 -6px 18px rgba(20,30,50,.18)", paddingTop: 10, paddingHorizontal: 5, paddingBottom: 8 },
  balon: { position: "absolute", alignSelf: "center", maxWidth: "90%", backgroundColor: "#1B2430", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
    zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,.3)" },
  balonYazi: { color: "#fff", fontSize: 12, textAlign: "center" },
  perde: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  kutu: { width: "100%", maxWidth: 380, borderRadius: 20, paddingTop: 22, paddingHorizontal: 18, paddingBottom: 16, boxShadow: "0 18px 50px rgba(0,0,0,.3)" },
  kutuBaslik: { fontSize: 21, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  kutuMetin: { fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 16 },
  kutuSatir: { flexDirection: "row", gap: 10 },
  kutuDugme: { flex: 1, borderRadius: 13, paddingVertical: 14, alignItems: "center" },
  kutuDugmeYazi: { fontSize: 15, fontWeight: "800" },
  sonuc: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  puan: { fontSize: 60, fontWeight: "900", letterSpacing: -1.8 },
  puanAlt: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  sonucMetin: { fontSize: 14, marginTop: 10, marginBottom: 4, textAlign: "center" },
  yanlislar: { width: "100%", maxWidth: 420, marginTop: 14 },
  yanlis: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11, marginVertical: 6 },
  sonucDugmeler: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" },
  sonucDugme: { borderWidth: 1, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  sonucDugmeYazi: { fontSize: 13, fontWeight: "800" },
});
