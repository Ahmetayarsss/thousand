/*
 * Arkadaşlar (eski arkadaslar sayfası): kodun (kopyala / paylaş), arkadaş ekle, gelen istekler, arkadaşların
 * (bugün / toplam, seri, dürt, arkadaşlıktan çıkar), gönderilen istekler. Ekrana dönünce ve açıkken dakikada bir
 * yenilenir; bağlantı yoksa son görülen pano gösterilir. Hesap yoksa önce takma ad. "Dürtüldü ✓" sunucudan gelir
 * (gün değişince yeniden "Dürt"); dürttükten sonra yenilemeye kadar yerelde tutulur.
 */
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { duyur } from "../bilesenler/Duyuru";
import Kaydir, { useKenar } from "../bilesenler/Kaydir";
import Pano from "../bilesenler/Pano";
import { Dugme, onayla } from "../bilesenler/Pencere";
import { OXLOG } from "../cekirdek";
import { errText, HESAP, useHesap } from "../hesap";
import { karsilama } from "../hesap/Karsilama";
import { useTema } from "../tema";

function once(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "az önce";
  if (s < 3600) return Math.round(s / 60) + " dk önce";
  if (s < 86400) return Math.round(s / 3600) + " sa önce";
  return Math.round(s / 86400) + " gün önce";
}
const n = (x) => (x | 0).toLocaleString("tr-TR");

export default function Arkadaslar() {
  const t = useTema();
  const a = useHesap();
  const [d, setD] = useState(() => HESAP.cachedDashboard());
  const [cevrimdisi, setCevrimdisi] = useState(false);
  const [hata, setHata] = useState("");
  const [kod, setKod] = useState("");
  const [ekle, setEkle] = useState({ m: "", ok: false });
  const [gonderiyor, setGonderiyor] = useState(false);
  const [mesgul, setMesgul] = useState({});   // düğme anahtarı → işlem sürüyor
  const [durtuldu, setDurtuldu] = useState({});
  const [odak, setOdak] = useState(false);
  const yenileniyor = useRef(false);
  const [kenar, kenarProps] = useKenar();
  // Hesap değişti (açıldı, silindi, kurtarma koduyla geldi): eski hesabın panosu görünmesin.
  const hesapKodu = a ? a.code : null;
  useEffect(() => {
    const c = HESAP.cachedDashboard();
    setD(c && c.me && c.me.code === hesapKodu ? c : null); setDurtuldu({}); setHata("");
  }, [hesapKodu]);

  const yenile = useCallback(async () => {
    if (!HESAP.account() || yenileniyor.current) return;
    yenileniyor.current = true;
    try {
      await HESAP.pushStats(false).catch(() => {});
      setD(await HESAP.dashboard()); setCevrimdisi(false); setHata(""); setDurtuldu({});
    } catch (e) {
      const c = HESAP.cachedDashboard();
      setD(c); setCevrimdisi(true);
      if (!c) setHata(errText(e));
    } finally { yenileniyor.current = false; }
  }, []);

  useFocusEffect(useCallback(() => {
    OXLOG.add("sayfa", { p: "arkadaslar" });
    if (!HESAP.account()) karsilama({ zorla: true, bitti: () => yenile() });
    yenile();
    const z = setInterval(() => { if (AppState.currentState === "active") yenile(); }, 60000);
    const dinle = AppState.addEventListener("change", (s) => { if (s === "active") yenile(); });
    return () => { clearInterval(z); dinle.remove(); };
  }, [yenile]));

  const yap = async (anahtar, fn, tamam) => {
    setMesgul((m) => ({ ...m, [anahtar]: true }));
    try { await fn(); if (tamam) duyur(tamam); await yenile(); }
    catch (e) { duyur(errText(e)); }
    finally { setMesgul((m) => ({ ...m, [anahtar]: false })); }
  };

  const gonder = async () => {
    const c = kod.trim();
    if (c.replace(/[^A-Za-z0-9]/g, "").length < 4) { setEkle({ m: "Kodu eksiksiz yaz.", ok: false }); return; }
    setGonderiyor(true); setEkle({ m: "Gönderiliyor…", ok: null });
    try {
      const r = await HESAP.sendRequest(c);
      if (r && r.ok) {
        setEkle({ m: r.msg === "arkadas_oldunuz" ? "Artık " + r.nick + " ile arkadaşsınız 🎉" : "İstek gönderildi: " + r.nick, ok: true });
        setKod(""); await yenile();
      } else setEkle({ m: errText({ message: r && r.msg }), ok: false });
    } catch (e) { setEkle({ m: errText(e), ok: false }); }
    finally { setGonderiyor(false); }
  };

  const durt = async (f) => {
    setMesgul((m) => ({ ...m, ["d" + f.id]: true }));
    try {
      const r = await HESAP.durt(f.id), m = r && r.msg;
      if (m === "gonderildi" || m === "bugun_durttun") {
        setDurtuldu((x) => ({ ...x, [f.id]: true }));
        duyur(m === "gonderildi" ? "👉 " + f.nick + " dürtüldü" : "Bugün " + f.nick + " zaten dürtüldü");
        OXLOG.add("durt", { s: m });
      } else { duyur(m === "arkadas_degil" ? "Artık arkadaş değilsiniz." : errText({ message: m })); yenile(); }
    } catch (e) { duyur(errText(e)); }
    finally { setMesgul((x) => ({ ...x, ["d" + f.id]: false })); }
  };

  const kopyala = async (c) => {
    try { await Clipboard.setStringAsync(c); duyur("Kod kopyalandı: " + c); } catch (e) { duyur(c); }
  };
  const paylas = async (c) => {
    const metin = "Thousand'da arkadaşım ol! Kodum: " + c;
    try { await Share.share({ message: metin }); } catch (e) {
      try { await Clipboard.setStringAsync(metin); duyur("Davet metni kopyalandı, istediğin yere yapıştır.", 4000); } catch (x) { duyur(metin, 4000); }
    }
  };

  if (!a) {
    return (
      <Kaydir ad="arkadas" kenar={kenar}>
      <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.kartBg }]}>
        <ScrollView contentContainerStyle={s.icerik} {...kenarProps}>
          <Text style={[s.h1, { color: t.ink }]} accessibilityRole="header">Arkadaşlar</Text>
          <Pano t={t}>
            <Text style={[s.bos, { color: t.muted }]}>Arkadaşlarını eklemek için önce bir takma ad seç.</Text>
            <Dugme kucuk metin="Hesap oluştur" style={s.hesapDugme} onBas={() => karsilama({ zorla: true, bitti: () => yenile() })} />
          </Pano>
        </ScrollView>
      </SafeAreaView>
      </Kaydir>
    );
  }

  const me = (d && d.me) || a, bugun = HESAP.todayStr();
  const gelen = (d && d.incoming) || [], arkadas = (d && d.friends) || [], giden = (d && d.outgoing) || [];
  const dm = {};   // son 24 saatte beni dürtenler (arkadaş başına en yenisi)
  ((d && d.durtmeler) || []).forEach((x) => { if (!dm[x.from]) dm[x.from] = x; });

  return (
    <Kaydir ad="arkadas" kenar={kenar}>
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.kartBg }]}>
      <ScrollView contentContainerStyle={s.icerik} keyboardShouldPersistTaps="handled" {...kenarProps}>
        <Text style={[s.h1, { color: t.ink }]} accessibilityRole="header">Arkadaşlar</Text>

        <Pano t={t}>
          <View style={s.satir}>
            <View style={{ flex: 1 }}>
              <Text style={[s.nick, { color: t.ink }]}>{me.nick || a.nick}</Text>
              <Text style={[s.lbl, { color: t.muted }]}>Arkadaş kodun</Text>
              <Text selectable style={[s.kod, { color: t.ink }]}>{me.code || a.code}</Text>
            </View>
            <View style={s.dugmeler}>
              <Dugme kucuk tur="bos" metin="Kopyala" onBas={() => kopyala(me.code || a.code)} />
              <Dugme kucuk metin="Paylaş" onBas={() => paylas(me.code || a.code)} />
            </View>
          </View>
        </Pano>

        <Pano t={t} baslik="Arkadaş ekle">
          <View style={s.ekle}>
            <TextInput value={kod} onChangeText={(v) => setKod(v.toUpperCase())} maxLength={8} placeholder="Arkadaşının kodu"
              placeholderTextColor={t.muted} autoCapitalize="characters" autoCorrect={false} onSubmitEditing={gonder}
              onFocus={() => setOdak(true)} onBlur={() => setOdak(false)}
              style={[s.girdi, { borderColor: odak ? t.accent : t.kartLine, color: t.ink, backgroundColor: t.field }, !kod && s.girdiBos]} />
            <Dugme kucuk metin="İstek gönder" pasif={gonderiyor} onBas={gonder} style={s.gonder} />
          </View>
          {ekle.m ? <Text style={[s.msg, { color: ekle.ok === true ? t.green : ekle.ok === false ? t.red : t.ink }]}>{ekle.m}</Text> : null}
        </Pano>

        {gelen.length ? (
          <Pano t={t} baslik="Gelen istekler" ek={<Text style={[s.rozet, { backgroundColor: t.red }]}>{gelen.length}</Text>}>
            {gelen.map((r, i) => (
              <View key={r.id} style={[s.satir, s.sira, i ? { borderTopWidth: 1, borderTopColor: t.kartLine } : { paddingTop: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.n, { color: t.ink }]}>{r.nick}</Text>
                  <Text style={[s.alt, { color: t.muted }]}>{r.code} · {once(r.at)}</Text>
                </View>
                <View style={s.dugmeler}>
                  <Dugme kucuk tur="yesil" metin="Kabul" pasif={mesgul["k" + r.id]} onBas={() => yap("k" + r.id, () => HESAP.respond(r.id, true), "Artık arkadaşsınız 🎉")} />
                  <Dugme kucuk tur="bos" metin="Reddet" pasif={mesgul["r" + r.id]} onBas={() => yap("r" + r.id, () => HESAP.respond(r.id, false), "İstek reddedildi")} />
                </View>
              </View>
            ))}
          </Pano>
        ) : null}

        <Pano t={t} baslik="Arkadaşlarım" ek={arkadas.length ? <Text style={[s.sayac, { color: t.muted }]}>({arkadas.length})</Text> : null}>
          {!d ? <Text style={[s.bos, { color: t.muted }]}>{hata || "Yükleniyor…"}</Text>
            : !arkadas.length ? <Text style={[s.bos, { color: t.muted }]}>Henüz arkadaşın yok.{"\n"}Kodunu paylaş ya da arkadaşının kodunu yukarıya yaz.</Text>
            : arkadas.map((f, i) => {
              const st = f.stats || {}, td = st.gun === bugun, dz = dm[f.id], dt = f.durtuldu || durtuldu[f.id];
              return (
                <View key={f.id} style={[s.fr, i ? { borderTopWidth: 1, borderTopColor: t.kartLine } : { paddingTop: 0 }]}>
                  <View style={s.satir}>
                    <Text style={[s.frAd, { color: t.ink }]}>{f.nick}</Text>
                    <Text style={[s.gorulme, { color: t.muted }]}>{once(f.last_seen)}</Text>
                    <Dugme kucuk tur={dt ? "bos" : "dolu"} metin={dt ? "Dürtüldü ✓" : "👉 Dürt"} pasif={dt || mesgul["d" + f.id]}
                      onBas={() => durt(f)} style={[s.durt, dt && { opacity: 1 }]} yaziRengi={dt ? t.green : null} yaziBoyu={12} />
                    <Pressable accessibilityRole="button" accessibilityLabel="Seçenekler" hitSlop={10}
                      onPress={async () => { if (await onayla(f.nick + " arkadaşlıktan çıkarılsın mı?", "", "Çıkar", true)) yap("x" + f.id, () => HESAP.removeFriend(f.id), "Arkadaşlıktan çıkarıldı"); }}>
                      <Text style={[s.daha, { color: t.muted }]}>⋯</Text>
                    </Pressable>
                  </View>
                  {dz ? <Text style={[s.cizgi, { color: t.amber, fontWeight: "700" }]}>👉 Seni dürttü · {once(dz.at)}</Text> : null}
                  <Text style={[s.cizgi, { color: t.ink }]}>
                    <Text style={[s.k, { color: t.muted }]}>Bugün  </Text>
                    {td && st.cevap
                      ? <><B>{n(st.cevap)}</B> cevap · <B>{n(st.dogru)}</B> doğru · <B>{n(st.yeni)}</B> yeni</>
                      : <Text style={{ color: t.muted }}>henüz çalışmadı</Text>}
                  </Text>
                  <Text style={[s.cizgi, { color: t.ink }]}>
                    <Text style={[s.k, { color: t.muted }]}>Toplam  </Text>
                    <B>{n(st.dongu)}</B> çalışılan · <B>{n(st.olgun)}</B> olgun{st.seri ? <> · 🔥 <B>{n(st.seri)}</B> gün</> : null}
                  </Text>
                </View>
              );
            })}
        </Pano>

        {giden.length ? (
          <Pano t={t} baslik="Gönderilen istekler">
            {giden.map((r, i) => (
              <View key={r.id} style={[s.satir, s.sira, i ? { borderTopWidth: 1, borderTopColor: t.kartLine } : { paddingTop: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.n, { color: t.ink }]}>{r.nick}</Text>
                  <Text style={[s.alt, { color: t.muted }]}>{r.code} · {once(r.at)} · cevap bekleniyor</Text>
                </View>
                <Dugme kucuk tur="bos" metin="Geri çek" pasif={mesgul["g" + r.id]} onBas={() => yap("g" + r.id, () => HESAP.cancel(r.id), "İstek geri çekildi")} />
              </View>
            ))}
          </Pano>
        ) : null}

        {cevrimdisi && !hata ? <Text style={[s.ayak, { color: t.muted }]}>Bağlantı yok</Text> : null}
      </ScrollView>
    </SafeAreaView>
    </Kaydir>
  );
}

const B = ({ children }) => <Text style={{ fontWeight: "800" }}>{children}</Text>;

const s = StyleSheet.create({
  ekran: { flex: 1 },
  icerik: { width: "100%", maxWidth: 600, alignSelf: "center", paddingTop: 4, paddingHorizontal: 14, paddingBottom: 24 },
  h1: { fontSize: 20, fontWeight: "800", marginTop: 4, marginBottom: 12 },
  satir: { flexDirection: "row", alignItems: "center", gap: 8 },
  sira: { paddingVertical: 10 },
  dugmeler: { flexDirection: "row", gap: 6, marginLeft: "auto" },
  nick: { fontSize: 18, fontWeight: "800" },
  lbl: { fontSize: 12, fontWeight: "700" },
  kod: { fontSize: 24, fontWeight: "900", letterSpacing: 3 },
  ekle: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  gonder: { justifyContent: "center" },
  hesapDugme: { alignSelf: "center", marginTop: 4 },
  girdi: { flex: 1, minWidth: 0, borderWidth: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, fontSize: 17,
    fontWeight: "800", letterSpacing: 2 },
  girdiBos: { letterSpacing: 0, fontWeight: "600", fontSize: 15 },
  msg: { fontSize: 13, fontWeight: "700", marginTop: 8 },
  rozet: { color: "#fff", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, fontSize: 11, fontWeight: "800", overflow: "hidden" },
  sayac: { fontSize: 13, fontWeight: "800" },
  n: { fontSize: 15, fontWeight: "800" },
  alt: { fontSize: 12, marginTop: 2 },
  fr: { paddingVertical: 12 },
  frAd: { fontSize: 16, fontWeight: "800" },
  gorulme: { fontSize: 11.5, marginLeft: "auto" },
  durt: { paddingVertical: 6, paddingHorizontal: 10 },
  daha: { fontSize: 18, paddingLeft: 6, paddingRight: 2 },
  cizgi: { fontSize: 13, marginTop: 5 },
  k: { fontWeight: "700" },
  bos: { fontSize: 13, textAlign: "center", paddingVertical: 8, lineHeight: 20 },
  ayak: { textAlign: "center", fontSize: 11.5, marginTop: 4 },
});
