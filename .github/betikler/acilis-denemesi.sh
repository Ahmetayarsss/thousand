#!/usr/bin/env bash
# Emülatörde uygulamayı kurar, açar, 30 sn bekler: çöktü mü (FATAL EXCEPTION) ya da kapandı mı? (acilis-denemesi.yml)
set -u
PAKET=io.github.ahmetayarsss.thousand
APK="$1"
CIKTI="${2:-acilis}"
mkdir -p "$CIKTI"
adb install -r "$APK" || { echo "::error::APK emülatöre kurulamadı"; exit 1; }
adb logcat -c
adb shell monkey -p "$PAKET" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep 30
adb exec-out screencap -p > "$CIKTI/ekran.png" || true
adb logcat -d > "$CIKTI/logcat.txt"
if grep -q "FATAL EXCEPTION" "$CIKTI/logcat.txt"; then
  echo "::error::Uygulama açılışta çöktü"
  grep -A 40 "FATAL EXCEPTION" "$CIKTI/logcat.txt" | head -n 60
  exit 1
fi
if [ -z "$(adb shell pidof "$PAKET" | tr -d '\r')" ]; then
  echo "::error::Uygulama açıldıktan sonra kapandı"
  grep -E "AndroidRuntime|ReactNativeJS|$PAKET" "$CIKTI/logcat.txt" | tail -n 60
  exit 1
fi
grep -E "ReactNativeJS" "$CIKTI/logcat.txt" | grep -iE "error|hata" | head -n 20 || true
echo "Uygulama açıldı ve 30 sn sonra hâlâ çalışıyor."
