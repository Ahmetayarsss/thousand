/*
 * Arkadaş haberleri (eski ana sayfadaki gibi alttaki kısa bildirimle): görülmemiş arkadaşlık istekleri ve son 24 saatteki
 * dürtmeler; görülenler eskisiyle aynı anahtarlarda (ox3000_istek_gor, ox3000_durt_gor). Açılışta (Liste) ve kurtarma
 * koduyla hesap geri gelince (Karsilama).
 */
import { duyur } from "../bilesenler/Duyuru";
import { HESAP } from "./index";

export function haberler() {
  HESAP.dashboard().then(goster, () => {});
}

function goster(d) {
  const oku = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } };
  const yaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const gelen = (d && d.incoming) || [], m = [];
  const gorulen = oku("ox3000_istek_gor"), yeni = gelen.filter((r) => !gorulen.includes(r.id));
  if (yeni.length) m.push("👥 " + (yeni.length === 1 ? yeni[0].nick + " sana arkadaşlık isteği gönderdi" : yeni.length + " yeni arkadaşlık isteği") + " — Arkadaş sekmesinde.");
  yaz("ox3000_istek_gor", gelen.map((r) => r.id));
  const dz = (d && d.durtmeler) || [], dg = oku("ox3000_durt_gor"), kim = [];
  dz.filter((x) => !dg.includes(x.id)).forEach((x) => { if (!kim.some((y) => y.from === x.from)) kim.push(x); });
  if (kim.length) m.push("👉 " + kim[0].nick + (kim.length > 1 ? " ve " + (kim.length - 1) + " kişi daha" : "") + " seni dürttü: Hadi çalış!");
  yaz("ox3000_durt_gor", dz.map((x) => x.id));
  m.forEach((x, i) => setTimeout(() => duyur(x, 4000), i * 4300));
}

