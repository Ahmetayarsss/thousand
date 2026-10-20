/*
 * Karşılama penceresi (eski hesap.js'teki onboard / stepNick / stepCodes / stepRecover / kayitSor):
 * takma ad → kodlar → kullanım kaydı izni; ya da kurtarma kodu → (gerekirse yedek mi telefon mu) → hoş geldin.
 * karsilama({ zorla, adim, bitti }): zorla değilse "Sonra" denmişse bu açılışta bir daha sorulmaz.
 * adim: "ad" (varsayılan), "kurtar" ya da "izin" (yalnız kullanım kaydı izni).
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { pencereAc, Baslik, Dugme, Girdi, Hata, Metin } from "../bilesenler/Pencere";
import { OXLOG, SRS } from "../cekirdek";
import { useTema } from "../tema";
import { HESAP, errText, hesapDegisti } from "./index";

let sonraDendi = false;   // eskisinde sessionStorage: uygulama yeniden açılınca yine sorulur

export function karsilama({ zorla = false, adim = "ad", bitti } = {}) {
  if (adim === "ad" && HESAP.account()) { if (bitti) bitti(HESAP.account()); return; }
  if (!zorla && sonraDendi) return;
  pencereAc((kapat) => <Akis ilk={adim} kapat={kapat} bitti={bitti} />);
}

function Akis({ ilk, kapat, bitti }) {
  const [adim, setAdim] = useState({ ad: ilk });
  const bitir = (a) => { kapat(); hesapDegisti(); if (bitti) bitti(a); };
  const izinSonra = (a) => { if (HESAP.kayitIzni() === null) setAdim({ ad: "izin", a }); else bitir(a); };
  switch (adim.ad) {
    case "kodlar": return <Kodlar a={adim.a} devam={() => izinSonra(adim.a)} />;
    case "kurtar": return <Kurtar yeni={() => setAdim({ ad: "ad" })} sonuc={(r) => setAdim(r)} />;
    case "secim": return <Secim r={adim.r} sec={(yukle) => setAdim({ ad: "hosgeldin", r: adim.r, yuklendi: yukle ? HESAP.restore(adim.r.backup) : null })} />;
    case "hosgeldin": return <Hosgeldin r={adim.r} yuklendi={adim.yuklendi} devam={() => izinSonra(adim.r.account)} />;
    case "izin": return <Izin devam={() => bitir(adim.a || HESAP.account())} />;
    default: return <TakmaAd kapat={kapat} kurtar={() => setAdim({ ad: "kurtar" })} acildi={(a) => { hesapDegisti(); setAdim({ ad: "kodlar", a }); }} />;
  }
}

function Baglanti({ metin, onBas }) {
  const t = useTema();
  return <Pressable onPress={onBas} accessibilityRole="link"><Text style={[s.lnk, { color: t.accent }]}>{metin}</Text></Pressable>;
}

function TakmaAd({ kapat, kurtar, acildi }) {
  const [ad, setAd] = useState(""), [hata, setHata] = useState(""), [bekle, setBekle] = useState(false), [tekrar, setTekrar] = useState(false);
  const gonder = () => {
    const n = ad.trim();
    if (n.length < 3 || n.length > 16) { setHata("Takma ad 3–16 karakter olmalı."); return; }
    setBekle(true); setHata("");
    HESAP.create(n).then(acildi, (e) => {
      setBekle(false); setTekrar(true); setHata(errText(e));
      OXLOG.add("hesap_hata", { f: "olustur", m: String(e.message).slice(0, 120) });
    });
  };
  return (
    <View>
      <Baslik>Hoş geldin! 👋</Baslik>
      <Metin>Arkadaşlarının göreceği bir takma ad seç.</Metin>
      <Girdi value={ad} onChangeText={setAd} maxLength={16} placeholder="Takma ad (3–16 karakter)" autoFocus onSubmitEditing={gonder} />
      <Hata>{hata}</Hata>
      <Dugme metin={bekle ? "Hesap açılıyor…" : tekrar ? "Tekrar dene" : "Başla"} pasif={bekle} onBas={gonder} />
      <Dugme metin="Sonra" tur="bos" onBas={() => { sonraDendi = true; kapat(); }} />
      <Baglanti metin="Hesabım var → kurtarma kodu gir" onBas={kurtar} />
    </View>
  );
}

function Kod({ etiket, deger, kurtarma }) {
  const t = useTema();
  return (
    <View>
      <Text style={[s.lbl, { color: t.muted }]}>{etiket.toLocaleUpperCase("tr-TR")}</Text>
      <Text selectable style={[s.kod, { backgroundColor: kurtarma ? t.kutu : t.kartBg, color: t.ink },
        kurtarma && { fontSize: 21, letterSpacing: 2, borderWidth: 2, borderStyle: "dashed", borderColor: t.kutuCizgi }]}>{deger}</Text>
    </View>
  );
}

function Kodlar({ a, devam }) {
  return (
    <View>
      <Baslik>Hesabın hazır 🎉</Baslik>
      <Kod etiket="Arkadaş kodun" deger={a.code} />
      <Kod etiket="Kurtarma kodun" deger={a.recovery || "—"} kurtarma />
      <Metin>Telefonunu değiştirirsen hesabını, arkadaşlarını ve ilerlemeni bu kodla geri alırsın.{" "}
        <Text style={{ fontWeight: "800" }}>Ekran görüntüsü al</Text> ya da bir yere yaz. Ayarlar'da da görebilirsin.</Metin>
      <Dugme metin="Kaydettim" onBas={devam} />
    </View>
  );
}

function Kurtar({ yeni, sonuc }) {
  const [kod, setKod] = useState(""), [hata, setHata] = useState(""), [bekle, setBekle] = useState(false), [tekrar, setTekrar] = useState(false);
  const gonder = () => {
    const c = kod.replace(/[^A-Za-z0-9]/g, "");
    if (c.length !== 12) { setHata("Kurtarma kodu 12 harf/rakam olmalı."); return; }
    setBekle(true); setHata("");
    HESAP.claim(c).then((r) => {
      setBekle(false);
      if (!r.ok) { setHata("Bu kurtarma koduyla bir hesap bulunamadı."); return; }
      hesapDegisti();
      const yerelVar = Object.keys(SRS.records()).length > 0;
      if (r.backup && yerelVar) sonuc({ ad: "secim", r });
      else sonuc({ ad: "hosgeldin", r, yuklendi: r.backup ? HESAP.restore(r.backup) : null });
    }, (e) => { setBekle(false); setTekrar(true); setHata(errText(e)); });
  };
  return (
    <View>
      <Baslik>Hesabını geri al</Baslik>
      <Metin>Kurtarma kodunu yaz (ör. ABCD-EFGH-JKLM).</Metin>
      <Girdi value={kod} onChangeText={(v) => setKod(v.toUpperCase())} maxLength={16} placeholder="XXXX-XXXX-XXXX"
        autoCapitalize="characters" autoFocus onSubmitEditing={gonder} />
      <Hata>{hata}</Hata>
      <Dugme metin={bekle ? "Aranıyor…" : tekrar ? "Tekrar dene" : "Hesabımı getir"} pasif={bekle} onBas={gonder} />
      <Baglanti metin="← Yeni hesap aç" onBas={yeni} />
    </View>
  );
}

// Telefonda da ilerleme varken: ikisi sayılarla, kullanıcı körlemesine seçmesin (yükleme telefondakini değiştirir).
function Secim({ r, sec }) {
  const k = HESAP.karsilastirma(r.backup);
  return (
    <View>
      <Baslik>Hangisi kalsın?</Baslik>
      <Metin>Bu telefonda da ilerleme var.{"\n\n"}• Yedek ({k.tarih}): {k.yedek}{"\n"}• Bu telefon: {k.telefon}</Metin>
      <Dugme metin="Yedeği yükle (bu telefondaki silinir)" onBas={() => sec(true)} />
      <Dugme metin="Bu telefondakini koru" tur="bos" onBas={() => sec(false)} />
    </View>
  );
}

function Hosgeldin({ r, yuklendi, devam }) {
  return (
    <View>
      <Baslik>Tekrar hoş geldin, {r.account.nick}!</Baslik>
      <Metin>{yuklendi && !yuklendi.ok
        ? "Hesabın geri geldi ama ilerlemenin bir kısmı bu telefona yazılamadı (hafıza dolu olabilir). Biraz yer açıp Ayarlar'dan kurtarma koduyla tekrar dene; yedeğin sunucuda duruyor."
        : yuklendi ? "Hesabın, arkadaşların ve ilerlemen geri geldi." : "Hesabın ve arkadaşların geri geldi."}</Metin>
      <Dugme metin="Devam" onBas={devam} />
    </View>
  );
}

function Izin({ devam }) {
  const sec = (evet) => { HESAP.kayitIzniAyarla(evet); devam(); };
  return (
    <View>
      <Baslik>Uygulamayı geliştirmeye yardım eder misin?</Baslik>
      <Metin>Kullanım kayıtlarını geliştiriciye gönderelim mi: hangi ekranı açtığın, verdiğin cevaplar, karşılaştığın
        hatalar ve telefon modeli. Takma adınla birlikte saklanır, <Text style={{ fontWeight: "800" }}>60 gün sonra silinir</Text>.
        Kurtarma kodun gönderilmez. İstediğin zaman <Text style={{ fontWeight: "800" }}>Ayarlar → Gizlilik</Text>'ten değiştirebilirsin.</Metin>
      <Dugme metin="Evet, gönder" onBas={() => sec(true)} />
      <Dugme metin="Hayır, gönderme" tur="bos" onBas={() => sec(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  lnk: { textAlign: "center", marginTop: 14, fontWeight: "700", fontSize: 14 },
  lbl: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  kod: { fontSize: 30, fontWeight: "900", letterSpacing: 4, textAlign: "center", borderRadius: 12, paddingVertical: 12,
    marginTop: 4, marginBottom: 12, overflow: "hidden" },
});
