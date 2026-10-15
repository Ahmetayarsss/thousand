#!/usr/bin/env bash
# Sunucu (supabase/kurulum.sql) testleri: geçici bir PostgreSQL açar, Supabase taklidini ve kurulum
# dosyasını (iki kez: tekrar çalıştırılabilir mi) yükler, tests/sunucu/testler.sql'i çalıştırır.
# Çalıştır: bash tests/sunucu.test.sh   (PostgreSQL 14+ kurulu olmalı; GitHub'ın ubuntu makinesinde var)
set -euo pipefail
# PostgreSQL root olarak açılmaz: root isek (ör. bulut oturumu) postgres kullanıcısıyla yeniden başla.
if [ "$(id -u)" = 0 ] && id postgres >/dev/null 2>&1; then exec runuser -u postgres -- bash "$0" "$@"; fi
KOK="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | sort -V | tail -1)")"
GECICI="$(mktemp -d)"
trap '"$BIN/pg_ctl" -D "$GECICI/veri" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$GECICI"' EXIT
"$BIN/initdb" -D "$GECICI/veri" -U postgres -A trust --no-sync >/dev/null
"$BIN/pg_ctl" -D "$GECICI/veri" -o "-k $GECICI -c listen_addresses='' -c fsync=off" -l "$GECICI/log" -w start >/dev/null
P=( "$BIN/psql" -h "$GECICI" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 )
export PGOPTIONS="-c client_min_messages=warning"   # kurulumun "zaten var" notları görünmesin
"${P[@]}" -f "$KOK/tests/sunucu/supabase_taklit.sql"
"${P[@]}" -f "$KOK/supabase/kurulum.sql"
"${P[@]}" -f "$KOK/supabase/kurulum.sql"          # ikinci kez: hatasız çalışmalı (tekrar çalıştırılabilir)
echo "ok - kurulum.sql iki kez hatasız çalıştı"
PGOPTIONS="-c client_min_messages=notice" "${P[@]}" -f "$KOK/tests/sunucu/testler.sql" 2>&1 | sed 's/^.*NOTICE:  //'
