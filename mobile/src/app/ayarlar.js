/*
 * Ayarlar (eski ayarlar sayfası): Hesap (takma ad, arkadaş kodu, kurtarma kodu, başka hesaba geç, sil), Gizlilik
 * (kullanım kaydı izni), Çalışma (listedeki kelime sayısı), Listeyi oku (döngü, Türkçesi; süren okumaya da hemen
 * uygulanır). Başlığa 3 sn içinde 7 kez dokununca geliştirici modu (tarih kaydırma, kutlama, kayıtlar, sıfırlama).
 * Henüz yok: Bildirimler (adım 36).
 */
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { duyur } from "../bilesenler/Duyuru";
import Pano from "../bilesenler/Pano";
import { Dugme, girdiIste, onayla } from "../bilesenler/Pencere";
import { OXLOG, SRS } from "../cekirdek";
import { errText, HESAP, hesapDegisti, useHesap } from "../hesap";
import { karsilama } from "../hesap/Karsilama";
import * as Okuma from "../okuma";
import { useTema } from "../tema";

const HAZIR = [10, 20, 30, 50, 100];
const p2 = (n) => ("0" + n).slice(-2);
function tarih(ms) { const d = new Date(ms); return p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + d.getFullYear(); }
function ne(ms) {
  const d = new Date(ms), hm = p2(d.getHours()) + ":" + p2(d.getMinutes());
  return d.toDateString() === new Date().toDateString() ? hm : p2(d.getDate()) + "." + p2(d.getMonth() + 1) + " " + hm;
}

export default function Ayarlar() {
  const t = useTema();
  const a = useHesap();
  const [, setSurum] = useState(0);
  const ciz = useCallback(() => setSurum((v) => v + 1), []);
  const [kodGoster, setKodGoster] = useState(false);
  const [mesgul, setMesgul] = useState("");
  const dokunuslar = useRef([]);

  useFocusEffect(useCallback(() => { OXLOG.add("sayfa", { p: "ayarlar" }); ciz(); }, [ciz]));

  const hesapIsi = async (ad, fn, tamam) => {
    setMesgul(ad);
    try { const r = await fn(); if (tamam) duyur(typeof tamam === "function" ? tamam(r) : tamam, 3000); }
    catch (e) { duyur(errText(e), 3500); }
    finally { setMesgul(""); hesapDegisti(); }
  };
  const sayiAyarla = (v) => { const n = SRS.setListSize(v); OXLOG.add("ayar", { liste: n }); ciz(); duyur("Ana sayfada " + n + " kelime", 1800); };
  const baslikDokun = () => {   // geliştirici modu kullanıcılardan gizli
    const z = Date.now();
    dokunuslar.current = dokunuslar.current.filter((x) => z - x < 3000).concat(z);
    if (dokunuslar.current.length < 7) return;
    dokunuslar.current = [];
    const ac = !SRS.dev().on;
    SRS.setDev({ on: ac }); OXLOG.add("dev", { a: ac ? "ac" : "kapat" }); ciz();
    duyur(ac ? "Geliştirici modu açıldı 🛠" : "Geliştirici modu kapandı", 1800);
  };

  const okumaAyari = (ad, k, varsayilan) => {
    const v = SRS.setOpt(k, !SRS.opt(k, varsayilan));
    const loop = !!SRS.opt("loop", true), readTr = !!SRS.opt("readTr", false);
    Okuma.secenekler(loop, readTr);
    OXLOG.add("ayar", { dongu: loop ? 1 : 0, tr: readTr ? 1 : 0 });
    ciz(); duyur(ad + " " + (v ? "açık" : "kapalı"), 1800);
  };

  const iz = HESAP.kayitIzni(), dev = SRS.dev(), n = SRS.listSize(), ld = HESAP.logDurum();
  const kb = Math.max(1, Math.round(OXLOG.size() / 1024));

  return (
    <SafeAreaView edges={["top"]} style={[s.ekran, { backgroundColor: t.kartBg }]}>
      <ScrollView contentContainerStyle={s.icerik}>
        <Pressable onPress={baslikDokun}><Text style={[s.h1, { color: t.ink }]} accessibilityRole="header">Ayarlar</Text></Pressable>

        <Pano t={t} baslik="Hesap">
          {!a ? (
            <>
              <Satir t={t} ilk baslik="Henüz hesabın yok" alt="Arkadaş eklemek ve ilerlemeni yedeklemek için bir takma ad seç.">
                <Dugme kucuk metin="Hesap oluştur" onBas={() => karsilama({ zorla: true })} />
              </Satir>
              <Satir t={t} baslik="Hesabın var mı?" alt="Eski telefonundaki hesabı kurtarma koduyla getir.">
                <Dugme kucuk tur="bos" metin="Kodu gir" onBas={() => karsilama({ zorla: true, adim: "kurtar" })} />
              </Satir>
            </>
          ) : (
            <>
              <Satir t={t} ilk baslik="Takma ad" deger={a.nick}>
                <Dugme kucuk tur="bos" metin="Değiştir" pasif={mesgul === "ad"} onBas={async () => {
                  const v = await girdiIste("Yeni takma ad (3–16 karakter)", a.nick, 16);
                  if (v != null) hesapIsi("ad", () => HESAP.setNick(v), (r) => "Takma ad: " + r);
                }} />
              </Satir>
              <Satir t={t} baslik="Arkadaş kodun" deger={a.code} aralik={2}>
                <Dugme kucuk tur="bos" metin="Kopyala" onBas={async () => {
                  try { await Clipboard.setStringAsync(a.code); duyur("Kod kopyalandı: " + a.code); } catch (e) { duyur(a.code); }
                }} />
              </Satir>
              <Satir t={t} baslik="Kurtarma kodu" alt="Telefon değişince hesabını bununla geri alırsın. Kimseyle paylaşma."
                deger={kodGoster ? (a.recovery || "— (Yenile ile yenisini al)") : "••••-••••-••••"} aralik={1.5} mono>
                <Dugme kucuk tur="bos" metin={kodGoster ? "Gizle" : "Göster"} onBas={() => setKodGoster(!kodGoster)} />
                <Dugme kucuk tur="bos" metin="Yenile" pasif={mesgul === "kod"} onBas={async () => {
                  if (!(await onayla("Yeni kurtarma kodu üretilsin mi?", "Eski kod artık çalışmaz.", "Üret"))) return;
                  setKodGoster(true);
                  hesapIsi("kod", () => HESAP.newRecovery(), (r) => "Yeni kurtarma kodun: " + r + " — kaydetmeyi unutma");
                }} />
              </Satir>
              <Satir t={t} baslik="Başka hesaba geç" alt="Kurtarma koduyla eski hesabını bu telefona getir.">
                <Dugme kucuk tur="bos" metin="Kodu gir" onBas={async () => {
                  if (await onayla("Başka hesaba geçilsin mi?", "Bu telefondaki hesap (arkadaşlarıyla) silinip kurtarma kodundaki hesaba geçilecek.", "Devam"))
                    karsilama({ zorla: true, adim: "kurtar" });
                }} />
              </Satir>
              <Satir t={t} baslik="Hesabı sil" tehlike alt="Takma ad, arkadaşlıklar, yedek ve kullanım kayıtları sunucudan silinir. Telefondaki ilerleme kalır.">
                <Dugme kucuk tur="kirmizi" metin="Sil" pasif={mesgul === "sil"} onBas={async () => {
                  if (!(await onayla("Hesabın silinsin mi?", "Arkadaşlıkların ve yedeğin silinir; bu geri alınamaz.", "Sil", true))) return;
                  if (!(await onayla("Emin misin?", "", "Evet, sil", true))) return;
                  hesapIsi("sil", () => HESAP.deleteAccount(), "Hesap silindi");
                }} />
              </Satir>
            </>
          )}
        </Pano>

        <Pano t={t} baslik="Gizlilik">
          <Satir t={t} ilk baslik="Kullanım kayıtlarını gönder"
            alt="Uygulamayı geliştirmek için: açtığın ekranlar, verdiğin cevaplar, hatalar, telefon modeli. Takma adınla saklanır, 60 gün sonra silinir."
            alt2={!a ? "Hesabın yok: gönderilmiyor." : iz === "evet" ? "Açık: gönderiliyor." : iz === "hayir" ? "Kapalı: gönderilmiyor." : "Henüz seçilmedi: gönderilmiyor."}>
            <Anahtar t={t} acik={iz === "evet"} etiket="Kullanım kayıtlarını gönder" onBas={() => {
              const ac = HESAP.kayitIzni() !== "evet";
              HESAP.kayitIzniAyarla(ac); ciz();
              duyur(ac ? "Kullanım kayıtları gönderilecek. Teşekkürler!" : "Kullanım kayıtları artık gönderilmiyor", 1800);
            }} />
          </Satir>
          <Text style={[s.not, { color: t.muted }]}>Sunucuda tutulanlar (yalnız hesabın varsa): takma adın ve arkadaş kodun; arkadaşlarının
            gördüğü günlük özet (bugün kaç cevap, seri); ilerleme yedeğin; izin verdiysen kullanım kayıtları. Hesabı silersen
            sunucudakilerin hepsi silinir. Hesabın yoksa hiçbir şey gönderilmez.</Text>
        </Pano>

        <Pano t={t} baslik="Çalışma">
          <Text style={[s.lbl, { color: t.ink }]}>Ana sayfadaki kelime sayısı</Text>
          <Text style={[s.not, { color: t.muted }]}>Bir seferde ezberleyeceğin yeni kelime sayısı. Sınavdaki yeni kelimeler de bu kadar olur.</Text>
          <View style={s.adimlayici}>
            <Pressable accessibilityRole="button" accessibilityLabel="Azalt" onPress={() => sayiAyarla(n - 5)} style={[s.artiEksi, { backgroundColor: t.solid }]}>
              <Text style={[s.artiEksiYazi, { color: t.onSolid }]}>−</Text>
            </Pressable>
            <Text style={[s.deger, { color: t.ink }]}>{n}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Artır" onPress={() => sayiAyarla(n + 5)} style={[s.artiEksi, { backgroundColor: t.solid }]}>
              <Text style={[s.artiEksiYazi, { color: t.onSolid }]}>+</Text>
            </Pressable>
          </View>
          <View style={s.cipler}>
            {HAZIR.map((v) => (
              <Pressable key={v} onPress={() => sayiAyarla(v)} accessibilityRole="button" accessibilityState={{ selected: v === n }}
                style={[s.cip, { borderColor: v === n ? t.accent : t.kartLine, backgroundColor: v === n ? t.accent : t.kartBg }]}>
                <Text style={[s.cipYazi, { color: v === n ? "#fff" : t.ink }]}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </Pano>

        <Pano t={t} baslik="Listeyi oku">
          <Satir t={t} ilk baslik="Başa dön" alt="Liste bitince baştan başlasın.">
            <Anahtar t={t} acik={!!SRS.opt("loop", true)} etiket="Başa dön" onBas={() => okumaAyari("Başa dön", "loop", true)} />
          </Satir>
          <Satir t={t} baslik="Türkçesini de oku" alt="Her kelimeden sonra Türkçe anlamı okunur (telefonda Türkçe ses paketi gerekir).">
            <Anahtar t={t} acik={!!SRS.opt("readTr", false)} etiket="Türkçesini de oku" onBas={() => okumaAyari("Türkçe okuma", "readTr", false)} />
          </Satir>
        </Pano>

        {dev.on ? (
          <Pano t={t} baslik="Geliştirici modu" style={{ borderStyle: "dashed", borderWidth: 1.5, borderColor: "#8E44AD" }}>
            <Satir t={t} ilk baslik="Uygulama tarihi" alt={tarih(SRS.now()) + (dev.off ? " (+" + dev.off + " gün)" : " (gerçek)")}>
              <Dugme kucuk metin="+1 gün" onBas={() => { SRS.setDev({ off: SRS.dev().off + 1 }); OXLOG.add("dev", { a: "gun+1", off: SRS.dev().off }); ciz(); duyur("1 gün ileri sarıldı", 1800); }} />
              <Dugme kucuk tur="bos" metin="Bugün" onBas={() => { SRS.setDev({ off: 0 }); OXLOG.add("dev", { a: "bugun" }); ciz(); duyur("Gerçek tarihe dönüldü", 1800); }} />
            </Satir>
            <Satir t={t} baslik="Kutlama" alt="3000 kelime bitince çıkan gösteri.">
              <Dugme kucuk metin="Göster" onBas={() => router.navigate({ pathname: "/", params: { kutla: "1" } })} />
            </Satir>
            <Satir t={t} baslik="Kayıtlar" alt="Telefondaki kayıtlar (izin verildiyse sunucuya da gider)."
              alt2={OXLOG.count().toLocaleString("tr-TR") + " olay · " + kb + " KB · " + (!ld ? "yalnız telefonda" : ld.at ? "sunucuya gönderildi " + ne(ld.at) : "sunucuya gönderilecek")}>
              <Dugme kucuk tur="bos" metin="Kopyala" onBas={async () => {
                try { await Clipboard.setStringAsync(JSON.stringify(OXLOG.snapshot())); duyur("Kayıtlar panoya kopyalandı", 1800); }
                catch (e) { duyur("Kopyalanamadı", 1800); }
              }} />
            </Satir>
            <Satir t={t} baslik="İlerlemeyi sıfırla" alt={'Tüm kelimeler yeniden "yeni" olur.'}>
              <Dugme kucuk tur="kirmizi" metin="Sıfırla" onBas={async () => {
                if (!(await onayla("Tüm ilerleme silinsin mi?", "Kutular, sınav kayıtları, istatistikler.", "Sıfırla", true))) return;
                OXLOG.add("dev", { a: "sifirla" });
                SRS.reset(); SRS.setDev({ off: 0 });
                try { localStorage.removeItem("ox3000_sessions_v1"); } catch (e) {}
                ciz(); duyur("İlerleme sıfırlandı", 1800);
              }} />
            </Satir>
          </Pano>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Satir({ t, ilk, baslik, alt, alt2, deger, aralik, mono, tehlike, children }) {
  return (
    <View style={[s.satir, !ilk && { borderTopWidth: 1, borderTopColor: t.kartLine }, ilk && { paddingTop: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.t, { color: tehlike ? t.red : t.ink }]}>{baslik}</Text>
        {alt ? <Text style={[s.alt, { color: t.muted }]}>{alt}</Text> : null}
        {alt2 ? <Text style={[s.alt, { color: t.muted }]}>{alt2}</Text> : null}
        {deger != null ? <Text selectable style={[s.v, { color: t.ink, letterSpacing: aralik || 0 }, mono && s.mono]}>{deger}</Text> : null}
      </View>
      <View style={s.dugmeler}>{children}</View>
    </View>
  );
}

function Anahtar({ t, acik, etiket, onBas }) {
  return (
    <Pressable onPress={onBas} accessibilityRole="switch" accessibilityLabel={etiket} accessibilityState={{ checked: acik }}
      style={[s.sw, { backgroundColor: acik ? t.green : t.neu }]}>
      <View style={[s.swTop, { left: acik ? 23 : 3 }]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  ekran: { flex: 1 },
  icerik: { width: "100%", maxWidth: 600, alignSelf: "center", paddingTop: 8, paddingHorizontal: 14, paddingBottom: 24 },
  h1: { fontSize: 20, fontWeight: "800", marginTop: 6, marginBottom: 14 },
  satir: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  dugmeler: { flexDirection: "row", gap: 6 },
  t: { fontSize: 14, fontWeight: "700" },
  alt: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  v: { fontSize: 15, fontWeight: "800", marginTop: 2 },
  mono: { fontFamily: "monospace" },
  not: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  lbl: { fontSize: 15, fontWeight: "800" },
  adimlayici: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  artiEksi: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  artiEksiYazi: { fontSize: 22, fontWeight: "800" },
  deger: { flex: 1, textAlign: "center", fontSize: 30, fontWeight: "900" },
  cipler: { flexDirection: "row", gap: 6, marginTop: 10 },
  cip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  cipYazi: { fontSize: 13, fontWeight: "800" },
  sw: { width: 50, height: 30, borderRadius: 15 },
  swTop: { position: "absolute", top: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" },
});
