# Oxford 3000 — Türkçe Çalışma Araçları

Oxford 3000 kelime listesi (A1–B2) üzerinden, Türkçe konuşanlar için İngilizce
kelime çalışma araçları.

## Yapı

- 3000 kelime, her CEFR seviyesi kendi içinde karıştırılıp 100'erlik 30 gruba bölündü.
- **A1 = Grup 1–9, A2 = Grup 10–17, B1 = Grup 18–24, B2 = Grup 25–30.**
- Her grupta bölümler: İsimler / Fiiller / Sıfatlar / Zarflar / Diğer.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `Oxford3000_30grup_sesli.html` | 30 grup, grup seçici, cihaz sesi (🔊) + Cambridge linki |
| `Oxford3000_kartlar.html` | Flashcard: dokun-çevir, UK/US TTS, Test modu (Leitner SRS 1/3/7/16 gün) + Gün sonu sınavı; ilerleme `localStorage`'da |
| `data/all_groups.json` | Tek doğruluk kaynağı — 30 grup, kelime başına `w, pos, sec, tr, ok, en, ex, cam` |
| `data/sources/ipa_ref.json` | Okunuş yazarken referans IPA (Oxford Learner's, [tyypgzl/Oxford-5000-words](https://github.com/tyypgzl/Oxford-5000-words)) |
| `templates/` | HTML şablonları (`__GROUPS_JSON__` yer tutucusu build'de doldurulur) |
| `scripts/build_all.py` | Enrichment'ı uygular + iki HTML'i üretir |
| `scripts/validate.py` | Veri tutarlılık kontrolleri |
| `scripts/enrich/gN.py` | Grup N'nin okunuş/açıklama/örnek içeriği |

> HTML'lerin sesi ve ilerleme kaydı için dosyaları **tarayıcıda** açın
> (uygulama içi önizlemede değil).

## Alanlar

- `tr`: Türkçe anlam — tüm 3000 kelimede dolu.
- `cam`: Cambridge linki — `dictionary.cambridge.org/dictionary/english-turkish/SLUG`
  (küçük harf, boşluk/özel karakter → tire, `o'clock → o-clock`). Hepsinde dolu.
- `ok` (okunuş), `en` (İngilizce açıklama), `ex` (örnek cümle): grup grup elle
  yazılıyor. **Şu an dolu olan gruplar: 1, 10.**

### Okunuş kuralı

Heceler tireli, vurgulu hece BÜYÜK harf, yalnız Türkçe harfler
(w→u/v, th→t/d yaklaşık). Örnek: `apartment → ı-PART-mınt`,
`language → LENG-güiç`, `winter → UİN-tır`.

## Yeni grup ekleme

1. `scripts/enrich/gN.py` oluştur (örnek olarak `g2.py`'ye bak):
   `GRUP_NO = N` ve `DATA = {"kelime": ("okunuş", "açıklama", "örnek <b>kelime</b> cümlesi"), ...}`
2. `scripts/build_all.py` içindeki `ENRICH_MODS` listesine `"gN"` ekle.
3. `python3 scripts/build_all.py && python3 scripts/validate.py`

## Notlar

- CEFR seviyeleri Oxford'a göredir; Cambridge bazı kelimeleri bir seviye farklı
  gösterebilir (ör. apartment: Oxford A1, Cambridge A2) — ikisi de geçerli.
- Önceki sohbette üretilen Grup 4, 5 içerikleri kaydedilmediği için kayıptır;
  eldeki en son sürüm bu depodaki veridir.
