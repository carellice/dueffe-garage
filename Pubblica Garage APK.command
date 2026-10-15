#!/bin/zsh
set -euo pipefail
umask 077

ROOT="${0:A:h}"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$ROOT"
fail() { print -u2 "Errore: $1"; read '?Premi Invio per chiudere...' || true; exit 1; }
command -v gh >/dev/null || fail "Installa GitHub CLI (gh)"
[[ -x ./gradlew ]] || fail "Gradle wrapper non trovato"
gh auth status >/dev/null 2>&1 || fail "Accedi a GitHub con: gh auth login"

OWNER="$(gh api user --jq .login)" || fail "Impossibile leggere l'account GitHub"
REPO="${GARAGE_RELEASE_REPO:-${DUEFFE_RELEASE_REPO:-$OWNER/android-app-releases}}"
[[ "$(gh repo view "$REPO" --json visibility --jq .visibility)" == "PUBLIC" ]] || fail "La repo $REPO non è pubblica o non è accessibile"
gh release list --repo "$REPO" --limit 1 >/dev/null || fail "Non posso leggere le release di $REPO"

SECRETS="$ROOT/.release-secrets"
mkdir -p "$SECRETS"
if [[ ! -f "$SECRETS/signing.env" ]]; then
  print "Genero una chiave di firma privata per Garage..."
  PASSWORD="$(/usr/bin/openssl rand -hex 24)"
  "$JAVA_HOME/bin/keytool" -genkeypair -v -keystore "$SECRETS/dueffe-garage.jks" -alias dueffe-garage -keyalg RSA -keysize 4096 -validity 10000 -storepass "$PASSWORD" -keypass "$PASSWORD" -dname 'CN=Garage' >/dev/null 2>&1 || fail "Creazione chiave non riuscita"
  print -r -- "DUEFFE_STORE_PASSWORD='$PASSWORD'" >"$SECRETS/signing.env"
  print -r -- "DUEFFE_KEY_PASSWORD='$PASSWORD'" >>"$SECRETS/signing.env"
  print "Conserva una copia sicura di $SECRETS: serve per gli aggiornamenti futuri."
fi
[[ -f "$SECRETS/dueffe-garage.jks" ]] || fail "Chiave di firma mancante"
source "$SECRETS/signing.env"
export DUEFFE_STORE_PASSWORD DUEFFE_KEY_PASSWORD
export DUEFFE_KEYSTORE="$SECRETS/dueffe-garage.jks"
export DUEFFE_KEY_ALIAS="dueffe-garage"

VERSION_FILE="$ROOT/version.properties"
ORIGINAL_VERSION="$(cat "$VERSION_FILE")"
CODE="$(/usr/bin/awk -F= '/^VERSION_CODE=/ {print $2}' "$VERSION_FILE")"
NAME="$(/usr/bin/awk -F= '/^VERSION_NAME=/ {print $2}' "$VERSION_FILE")"
[[ "$CODE" == <-> && "$NAME" == <->.<->.<-> ]] || fail "Versione non valida in version.properties"
MAJOR="${NAME%%.*}"; REST="${NAME#*.}"; MINOR="${REST%%.*}"; PATCH="${REST##*.}"
NEW_CODE=$((CODE + 1)); NEW_PATCH=$((PATCH + 1)); NEW_NAME="$MAJOR.$MINOR.$NEW_PATCH"
TAG="garage-v$NEW_NAME"
while gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; do
  NEW_CODE=$((NEW_CODE + 1)); NEW_PATCH=$((NEW_PATCH + 1)); NEW_NAME="$MAJOR.$MINOR.$NEW_PATCH"; TAG="garage-v$NEW_NAME"
done
print "VERSION_CODE=$NEW_CODE\nVERSION_NAME=$NEW_NAME" >"$VERSION_FILE"
PUBLISHED=0
restore_on_error() { if (( PUBLISHED == 0 )); then print -r -- "$ORIGINAL_VERSION" >"$VERSION_FILE"; fi }
trap restore_on_error EXIT

print "Compilo la versione firmata $NEW_NAME..."
./gradlew :app:assembleRelease "-PupdateRepository=$REPO" || fail "Compilazione release non riuscita"
APK="$ROOT/app/build/outputs/apk/release/app-release.apk"
[[ -s "$APK" ]] || fail "APK release non trovato"
"$ANDROID_HOME/build-tools/36.1.0/apksigner" verify --verbose "$APK" >/dev/null || fail "Firma APK non valida"
ASSET="$ROOT/app/build/outputs/apk/release/garage-v$NEW_NAME.apk"
cp "$APK" "$ASSET"

python3 write-update-metadata.py "$ASSET" "$NEW_CODE" "$NEW_NAME" it.dueffe.garage
print "Pubblico $TAG in $REPO..."
gh release create "$TAG" "$ASSET#Garage-$NEW_NAME.apk" "${ASSET:h}/latest.json" --repo "$REPO" --title "Garage $NEW_NAME" --notes "APK Android nativo di Garage. Versione $NEW_NAME (code $NEW_CODE)." || fail "Pubblicazione fallita"
PUBLISHED=1
trap - EXIT

print "Rimuovo le vecchie release di Garage..."
OLD_TAGS="$(gh api --paginate "repos/$REPO/releases?per_page=100" --jq '.[].tag_name')" || fail "Release pubblicata, ma elenco delle vecchie versioni non disponibile"
for old in ${(f)OLD_TAGS}; do
  if [[ "$old" != "$TAG" && ( "$old" == garage-v<->.<->.<-> || "$old" == dueffe-garage-v<->.<->.<-> ) ]]; then
    gh release delete "$old" --repo "$REPO" --cleanup-tag --yes || fail "Release $TAG pubblicata, ma eliminazione di $old non riuscita"
  fi
done
print "Pubblicata: https://github.com/$REPO/releases/tag/$TAG"
read '?Premi Invio per chiudere...' || true
