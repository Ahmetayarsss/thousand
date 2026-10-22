#!/usr/bin/env bash
# Emülatörde gezinme denemesi (acilis-denemesi.yml; açılış denemesinden sonra, uygulama açıkken): sayfalar arası
# parmakla kaydırma, telefonun geri tuşu (bir önceki sayfa, geçmiş bitince çıkış) ve pencerenin geri tuşuyla kapanması.
# Ekran yazıları uiautomator'la okunur; beklenen yazı gelmezse kırmızı yanar. Her adımın ekran görüntüsü çıktıda.
set -u
PAKET=io.github.ahmetayarsss.thousand
CIKTI="${1:-gezinme}"
mkdir -p "$CIKTI"
ADIM=0
HATA=0

ekran() { adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb exec-out cat /sdcard/ui.xml; }
# Ekrandaki yazının (ya da erişilebilirlik adının) ortası "x y" (yoksa boş).
yer() {
  ekran | python3 -c '
import re, sys, html
x = sys.stdin.read(); aranan = sys.argv[1]
for n in re.finditer(r"<node ([^>]*)>", x):
    oz = dict((k, html.unescape(v)) for k, v in re.findall(r"([\w-]+)=\"([^\"]*)\"", n.group(1)))
    if aranan in (oz.get("text"), oz.get("content-desc")):
        a, b, c, d = map(int, re.findall(r"\d+", oz["bounds"])); print((a + c) // 2, (b + d) // 2); break
' "$1"
}
var() { [ -n "$(yer "$1")" ]; }
bekle() { for _ in $(seq 1 "${2:-10}"); do var "$1" && return 0; sleep 1; done; return 1; }
dokun() { local p; p=$(yer "$1"); [ -n "$p" ] && adb shell input tap $p; }
foto() { ADIM=$((ADIM + 1)); adb exec-out screencap -p > "$CIKTI/$(printf %02d $ADIM)-$1.png" || true; }
# Beklenen sayfanın yazısı görünmeli.
olmali() {
  if bekle "$2" 6; then echo "✓ $1"; else echo "::error::Gezinme: $1 — \"$2\" görünmedi"; HATA=1; fi
  foto "$(echo "$1" | tr ' →/' '___' | tr -cd '[:alnum:]_')"
}

read -r W H < <(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr x ' ')
sola() { adb shell input swipe $((W * 85 / 100)) $((H / 2)) $((W * 20 / 100)) $((H / 2 + 10)) 250; sleep 1.5; }
saga() { adb shell input swipe $((W * 15 / 100)) $((H / 2)) $((W * 80 / 100)) $((H / 2 + 10)) 250; sleep 1.5; }
asagi() { adb shell input swipe $((W / 2)) $((H * 30 / 100)) $((W / 2)) $((H * 60 / 100)) 250; sleep 1.5; }
geri() { adb shell input keyevent 4; sleep 1.5; }

# İlk açılış pencereleri: takma ad ("Sonra"), sayfa haritası ("Anladım").
bekle "Sonra" 15 && dokun "Sonra"
bekle "Anladım" 12 && { foto harita; dokun "Anladım"; }
sleep 1
olmali "açılış: Liste" "▶ Listeyi oku"

sola;  olmali "Liste sola → Kartlar" "Sınav"
sola;  olmali "Kartlar sola → İlerleme" "SEVİYEYE GÖRE"
geri;  olmali "geri → Kartlar" "Sınav"
geri;  olmali "geri → Liste" "▶ Listeyi oku"
saga;  olmali "Liste sağa → Sözlük" "Sözlükte ara (İngilizce ya da Türkçe)"
asagi; olmali "Sözlük aşağı çek → Ayarlar" "Kullanım kayıtlarını gönder"
geri;  olmali "geri → Sözlük" "Sözlükte ara (İngilizce ya da Türkçe)"

# Sınav sürerken pencere: geri tuşu pencereyi kapatır, sınav sürer.
dokun "Kartlar"; sleep 2
dokun "Sınav"; sleep 2
if bekle "Bitir" 5; then
  dokun "Bitir"; olmali "Bitir → onay penceresi" "Emin misin?"
  geri
  if var "Emin misin?"; then echo "::error::Gezinme: geri tuşu onay penceresini kapatmadı"; HATA=1; else echo "✓ geri → pencere kapandı"; fi
  foto pencere_kapandi
  # Sınavda geri tuşu: önce onay; "Çık" bir önceki sayfaya (Sözlük) döner.
  geri; olmali "sınavda geri → onay" "Emin misin?"
  dokun "Çık"; sleep 1.5; olmali "Çık → önceki sayfa (Sözlük)" "Sözlükte ara (İngilizce ya da Türkçe)"
else
  echo "Sınavda soru yok (Bitir görünmedi); pencere adımı atlandı."
fi

# Geçmiş bitince geri tuşu uygulamadan çıkar.
for _ in 1 2 3 4 5 6 7 8; do geri; done
sleep 1
if adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | grep -q "$PAKET"; then
  echo "::error::Gezinme: geçmiş bitince geri tuşu uygulamadan çıkmadı"; HATA=1
else
  echo "✓ geçmiş bitince uygulamadan çıkıldı"
fi
foto cikis

adb logcat -d > "$CIKTI/logcat.txt"
if grep -q "FATAL EXCEPTION" "$CIKTI/logcat.txt"; then
  echo "::error::Gezinme sırasında uygulama çöktü"; grep -A 40 "FATAL EXCEPTION" "$CIKTI/logcat.txt" | head -n 60; HATA=1
fi
exit $HATA
