#!/bin/zsh
set -euo pipefail

ROOT="${0:A:h}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_HOME="$SDK"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
ADB="$SDK/platform-tools/adb"
EMULATOR="$SDK/emulator/emulator"

fail() { print -u2 "Errore: $1"; read '?Premi Invio per chiudere...' || true; exit 1; }
[[ -x "$ADB" && -x "$EMULATOR" ]] || fail "SDK Android non trovato in $SDK"
[[ -x "$ROOT/gradlew" ]] || fail "Progetto Android non trovato"

print "Compilo Garage..."
cd "$ROOT"
./gradlew :app:assembleDebug || fail "Compilazione non riuscita"

AVD="${GARAGE_AVD:-${DUEFFE_AVD:-$($EMULATOR -list-avds 2>/dev/null | /usr/bin/grep -i '^Pixel' | /usr/bin/head -1)}}"
[[ -n "$AVD" ]] || fail "Nessun emulatore Pixel configurato in Android Studio"

find_pixel() {
  local serial name
  for serial in ${(f)"$($ADB devices | /usr/bin/awk '/^emulator-[0-9]+[[:space:]]+device/ {print $1}')"}; do
    name="$($ADB -s "$serial" emu avd name 2>/dev/null | /usr/bin/head -1 | /usr/bin/tr -d '\r')"
    [[ "$name" == "$AVD" ]] && { print "$serial"; return 0; }
  done
  return 1
}

SERIAL="$(find_pixel || true)"
if [[ -z "$SERIAL" ]]; then
  print "Avvio l'emulatore $AVD..."
  nohup "$EMULATOR" -avd "$AVD" >"${TMPDIR:-/tmp}/garage-emulator.log" 2>&1 &
  disown
fi

for ((i=0; i<180; i++)); do
  SERIAL="$(find_pixel || true)"
  if [[ -n "$SERIAL" && "$($ADB -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | /usr/bin/tr -d '\r')" == "1" ]]; then break; fi
  sleep 2
done
[[ -n "$SERIAL" ]] || fail "L'emulatore Pixel non si è avviato"
[[ "$($ADB -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | /usr/bin/tr -d '\r')" == "1" ]] || fail "L'emulatore Pixel non ha completato l'avvio"

print "Installo e apro Garage su $AVD..."
$ADB -s "$SERIAL" install -r "$ROOT/app/build/outputs/apk/debug/app-debug.apk" || fail "Installazione fallita"
$ADB -s "$SERIAL" shell am start -n it.dueffe.garage/.MainActivity || fail "Avvio dell'app fallito"
print "App avviata. Puoi chiudere questa finestra."
read '?Premi Invio per chiudere...' || true
