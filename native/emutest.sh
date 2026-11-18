#!/usr/bin/env bash
# Самоперевірка збірки на емуляторі: встановити, запустити, дочекатись результату розпізнавання демо-запису.
set -u
APK="$1"
adb install -r -g "$APK" || { echo "::error::Емулятор: APK не встановився"; exit 0; }
adb shell dumpsys package com.google.android.webview 2>/dev/null | grep -m1 versionName | sed 's/^ */::notice::WebView /'
adb logcat -c
adb shell am start -n ua.efirai.app/.MainActivity
for i in $(seq 1 90); do
  sleep 5
  if adb logcat -d | grep -q "EFIR_DIAG"; then break; fi
done
adb logcat -d > logcat.txt
grep -o "EFIR_MIC.*" logcat.txt | head -1 | cut -c1-300 | sed 's/^/::notice::/'
grep -o "EFIR_RESULT.*" logcat.txt | head -1 | cut -c1-600 | sed 's/^/::notice::/'
grep -o "EFIR_DIAG.*" logcat.txt | head -1 | cut -c1-1500 | sed 's/^/::notice::/'
if ! grep -q "EFIR_RESULT" logcat.txt; then
  echo "::error::Емулятор: результату немає за 450 с"
  grep -o "EFIR .*" logcat.txt | tail -6 | cut -c1-300 | sed 's/^/::warning::/'
  grep -i -E "Capacitor/Console.*(error|fail)|chromium.*(ERROR|Uncaught)" logcat.txt | tail -4 | cut -c1-400 | sed 's/^/::warning::/'
fi
exit 0
