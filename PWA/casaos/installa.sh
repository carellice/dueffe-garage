#!/usr/bin/env bash
# Installazione guidata di Garage (PWA) su CasaOS.
#
# Sul server CasaOS (via SSH o dal terminale web di CasaOS):
#   curl -fsSL https://raw.githubusercontent.com/carellice/dueffe-garage/main/PWA/casaos/installa.sh | sudo bash
# oppure, dalla cartella del repository:
#   sudo bash PWA/casaos/installa.sh
#
# Rilanciandolo si aggiorna Garage all'ultima versione: i dati restano dove sono.
# Installa anche il comando "garage-aggiorna" e, se vuoi, un timer che aggiorna Garage ogni notte.

set -euo pipefail

REPO="carellice/dueffe-garage"
BRANCH="${APP_BRANCH:-main}"
APP="garage"
IMAGE="garage-pwa:latest"
CASAOS_APPS="/var/lib/casaos/apps"

# --- aspetto -----------------------------------------------------------------------------------

if [ -t 1 ]; then
  B=$'\e[1m'; D=$'\e[2m'; R=$'\e[0m'; V=$'\e[35m'; G=$'\e[32m'; Y=$'\e[33m'; E=$'\e[31m'
else
  B=""; D=""; R=""; V=""; G=""; Y=""; E=""
fi
step() { printf "\n${V}${B}==> %s${R}\n" "$1"; }
info() { printf "    %s\n" "$1"; }
ok() { printf "    ${G}✓${R} %s\n" "$1"; }
warn() { printf "    ${Y}!${R} %s\n" "$1"; }
fail() { printf "\n${E}${B}ERRORE:${R} %s\n" "$1" >&2; exit 1; }

# Le domande leggono sempre dal terminale, anche quando lo script arriva da "curl | bash".
TTY=/dev/tty
[ -r "$TTY" ] || fail "Serve un terminale interattivo: lancia lo script da SSH o dal terminale di CasaOS."

ask() { # ask "domanda" "predefinito" -> REPLY
  local question="$1" default="${2:-}"
  if [ -n "$default" ]; then printf "    %s ${D}[%s]${R}: " "$question" "$default" >"$TTY"; else printf "    %s: " "$question" >"$TTY"; fi
  IFS= read -r REPLY <"$TTY" || true
  REPLY="${REPLY:-$default}"
}

ask_yes() { # ask_yes "domanda" s|n
  local default="${2:-s}" hint="S/n"
  [ "$default" = "n" ] && hint="s/N"
  printf "    %s ${D}[%s]${R}: " "$1" "$hint" >"$TTY"
  IFS= read -r REPLY <"$TTY" || true
  REPLY="${REPLY:-$default}"
  [[ "$REPLY" =~ ^[sSyY] ]]
}

printf "${V}${B}"
cat <<'EOF'

    ____   ___   ____      _      ____
   / ___| / _ \ / ___|    / \    / ___|
  | |    | | | |\___ \   / _ \  | |
  | |___ | |_| | ___) | / ___ \ | |___
   \____| \___/ |____/ /_/   \_\ \____|

  CasaOS App Converter · installazione di Garage
EOF
printf "${R}\n"
info "Ti guido passo passo. Premi Invio per accettare il valore tra parentesi."

# --- controlli ---------------------------------------------------------------------------------

step "Controlli"
[ "$(id -u)" -eq 0 ] || fail "Lancia lo script come amministratore: sudo bash installa.sh"
command -v docker >/dev/null || fail "Docker non trovato. CasaOS lo installa da sé: sei sul server giusto?"
docker info >/dev/null 2>&1 || fail "Docker non risponde. Prova: systemctl start docker"
if docker compose version >/dev/null 2>&1; then COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null; then COMPOSE=(docker-compose)
else fail "Docker Compose non trovato."
fi
ok "Docker pronto ($(docker --version | sed 's/Docker version //; s/,.*//'))"
if [ -d "$CASAOS_APPS" ] || systemctl list-units --type=service 2>/dev/null | grep -q casaos; then
  CASAOS=1
  ok "CasaOS trovato: Garage comparirà tra le app della dashboard"
else
  CASAOS=0
  warn "CasaOS non trovato: installo Garage come normale container Docker"
fi

ARCH=$(uname -m)
case "$ARCH" in
  x86_64|aarch64|arm64) ok "Processore $ARCH supportato" ;;
  armv7l) warn "Processore a 32 bit ($ARCH): la build potrebbe richiedere parecchi minuti" ;;
  *) warn "Processore $ARCH non testato: provo comunque" ;;
esac

# --- configurazione esistente ------------------------------------------------------------------

if [ "$CASAOS" = 1 ]; then APP_DIR="$CASAOS_APPS/$APP"; else APP_DIR="/opt/$APP"; fi
ENV_FILE="$APP_DIR/.env"
UPDATE=0
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  # La porta di prima: serve a ritrovare il collegamento Tailscale anche se ora la porta cambia.
  PREV_PORT="${PORT:-}"
  step "Garage è già installata"
  info "Dati in: ${DATA_DIR:-?}"
  if ask_yes "Aggiorno all'ultima versione mantenendo dati e impostazioni?" s; then
    UPDATE=1
  else
    info "Rifacciamo la configurazione (i dati restano dove sono)."
  fi
fi

# --- codice sorgente ---------------------------------------------------------------------------

step "Scarico Garage"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/../Dockerfile" ] && [ -d "$SCRIPT_DIR/../web" ]; then
  SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
  ok "Uso il codice di questa cartella: $SRC"
else
  command -v curl >/dev/null || fail "Serve curl per scaricare Garage."
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$WORK" \
    || fail "Download da GitHub non riuscito. Controlla la connessione."
  SRC="$(find "$WORK" -maxdepth 4 -type d -path "*/PWA" | head -n1)"
  [ -n "$SRC" ] || fail "Cartella PWA non trovata nel download."
  ok "Scaricato da github.com/$REPO ($BRANCH)"
fi

# --- domande -----------------------------------------------------------------------------------

# Tailscale può essere installato sul sistema o come app di CasaOS (un container).
TS=()
find_tailscale() {
  if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then TS=(tailscale); return 0; fi
  local name
  name=$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /tailscale/ {print $1; exit}')
  if [ -n "$name" ] && docker exec "$name" tailscale status >/dev/null 2>&1; then TS=(docker exec "$name" tailscale); return 0; fi
  return 1
}

# Le app già collegate a Tailscale sul server, una riga "porta destinazione" per ciascuna,
# lette da "tailscale serve status" (https://nome.ts.net[:porta] seguito da "|-- / proxy <destinazione>").
ts_served() {
  "${TS[@]}" serve status 2>/dev/null | awk '
    /^https:\/\// { n = split($1, a, ":"); port = (n > 2) ? a[3] : 443; sub(/\/.*/, "", port); next }
    index($0, "|--") == 1 && port != "" { print port, $NF; port = "" }'
}

# Sceglie la porta HTTPS di Tailscale per questa app: quella che la serve già, poi quella salvata
# nell'installazione precedente se è libera, poi la prima libera. Stampa niente se sono tutte occupate.
ts_port_for() {
  local saved="$1" served port target own
  served=$(ts_served)
  while read -r port target; do
    for own in $OWN_TARGETS; do
      [ -n "$port" ] && [ "$target" = "$own" ] && { echo "$port"; return; }
    done
  done <<< "$served"
  for port in $saved 443 8443 10000 10001 10002 10003 10004 10005 10006 10007 10008 10009; do
    echo "$served" | awk '{print $1}' | grep -qx "$port" || { echo "$port"; return; }
  done
}

LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
LAN_IP=${LAN_IP:-127.0.0.1}

port_free() {
  ! (ss -ltnH 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}' | grep -Eq "[:.]$1\$"
}

if [ "$UPDATE" = 0 ]; then
  step "Configurazione"

  default_data="/DATA/AppData/$APP"
  [ -d /DATA ] || default_data="/opt/$APP/data"
  ask "Cartella dove salvare i dati" "${DATA_DIR:-$default_data}"
  DATA_DIR="$REPLY"

  default_port="${PORT:-8097}"
  while true; do
    ask "Porta per aprire Garage nel browser" "$default_port"
    PORT="$REPLY"
    [[ "$PORT" =~ ^[0-9]+$ ]] && [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || { warn "Scrivi un numero tra 1 e 65535."; continue; }
    if docker ps --format '{{.Names}}' | grep -qx "$APP"; then break; fi
    port_free "$PORT" && break
    warn "La porta $PORT è già usata da un altro servizio, scegline un'altra."
  done

  host_tz=$(cat /etc/timezone 2>/dev/null || timedatectl show -p Timezone --value 2>/dev/null || echo "")
  ask "Fuso orario (per orari e promemoria)" "${TZ:-${host_tz:-Europe/Rome}}"
  TZ="$REPLY"
fi

# --- HTTPS con Tailscale ----------------------------------------------------------------------

# Il telefono deve usare HTTPS per installare Garage come app e ricevere i promemoria: lo dà Tailscale.
step "Accesso dal telefono"
if find_tailscale; then
  MODE=tailscale
  ok "Tailscale trovato: Garage avrà un indirizzo HTTPS che funziona anche fuori casa"
else
  MODE=lan
  warn "Tailscale non è attivo su questo server."
  info "Garage funziona già come sito web nella rete di casa, ma per installarla come app"
  info "e ricevere i promemoria serve Tailscale: installalo dall'App Store di CasaOS"
  info "(o da tailscale.com), attiva MagicDNS e i certificati HTTPS, poi rilancia questo script."
fi

# --- build -------------------------------------------------------------------------------------

step "Preparo Garage (la prima volta servono alcuni minuti)"
BUILD_LOG="$(mktemp)"
docker build --pull -t "$IMAGE" "$SRC" >"$BUILD_LOG" 2>&1 &
build_pid=$!
printf "    "
while kill -0 "$build_pid" 2>/dev/null; do printf "."; sleep 5; done
printf "\n"
if ! wait "$build_pid"; then
  tail -n 25 "$BUILD_LOG" | sed 's/^/    /'
  fail "Build non riuscita (log completo: $BUILD_LOG)"
fi
rm -f "$BUILD_LOG"
ok "Immagine $IMAGE pronta"

# --- avvio -------------------------------------------------------------------------------------

step "Avvio Garage"
mkdir -p "$APP_DIR" "$DATA_DIR"
umask 077
cat > "$ENV_FILE" <<EOF
# Configurazione di Garage, scritta da installa.sh
DATA_DIR=$DATA_DIR
PORT=$PORT
MODE=$MODE
TZ=$TZ
EOF
umask 022

cat > "$APP_DIR/docker-compose.yml" <<EOF
name: $APP
services:
  $APP:
    image: $IMAGE
    container_name: $APP
    pull_policy: never
    restart: unless-stopped
    ports:
      - "\${PORT}:8080"
    volumes:
      - type: bind
        source: \${DATA_DIR}
        target: /data
    environment:
      TZ: \${TZ}
    x-casaos:
      ports:
        - container: "8080"
          description:
            en_us: Web app
            it_it: App web
      volumes:
        - container: /data
          description:
            en_us: "Database, photos and documents"
            it_it: "Database, foto e documenti"
x-casaos:
  architectures:
    - amd64
    - arm64
  main: $APP
  author: "carellice"
  developer: "carellice"
  category: "Utilities"
  icon: https://raw.githubusercontent.com/$REPO/$BRANCH/PWA/web/public/icon-512.png
  # Text values stay in double quotes: a ": " or a leading "-", "[", "*"... in an app's description
  # would otherwise break the YAML ("mapping values are not allowed in this context").
  title:
    en_us: "Garage"
    it_it: "Garage"
  tagline:
    en_us: "Cars, maintenance, documents and deadlines"
    it_it: "Auto, manutenzioni, documenti e scadenze"
  description:
    en_us: "Garage keeps your cars, maintenance, documents and deadlines in one private space, with reminders on your phone."
    it_it: "Garage tiene in un unico spazio privato le tue auto, gli interventi, i documenti e le scadenze, con promemoria sul telefono."
  port_map: "$PORT"
  scheme: http
  index: /
EOF

(cd "$APP_DIR" && "${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --force-recreate --remove-orphans) 2>&1 | sed 's/^/    /'
# Fa comparire subito l'app nella dashboard di CasaOS.
[ "$CASAOS" = 1 ] && systemctl restart casaos-app-management.service >/dev/null 2>&1 || true

printf "    Attendo che Garage risponda"
for _ in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:$PORT/api/session" >/dev/null 2>&1; then printf "\n"; ok "Garage è in funzione"; break; fi
  printf "."
  sleep 2
done
curl -fs "http://127.0.0.1:$PORT/api/session" >/dev/null 2>&1 || { printf "\n"; fail "Garage non risponde. Guarda i log con: docker logs $APP"; }

# --- HTTPS -------------------------------------------------------------------------------------

URL_PHONE="http://$LAN_IP:$PORT"
TARGET="http://127.0.0.1:$PORT"
OWN_TARGETS="$TARGET"
[ -n "${PREV_PORT:-}" ] && OWN_TARGETS="$OWN_TARGETS http://127.0.0.1:$PREV_PORT"
sed -i '/^TS_HTTPS_PORT=/d' "$ENV_FILE"
if [ "$MODE" = tailscale ]; then
  step "Collego Tailscale"
  find_tailscale || true
  TS_PORT=""
  if [ ${#TS[@]} -gt 0 ]; then
    # Il nome Tailscale del server è uno solo: ogni app ha la sua porta HTTPS.
    TS_PORT=$(ts_port_for "${TS_HTTPS_PORT:-}")
  fi
  if [ -n "$TS_PORT" ] && "${TS[@]}" serve --bg --https="$TS_PORT" "$TARGET" >/dev/null 2>&1; then
    echo "TS_HTTPS_PORT=$TS_PORT" >> "$ENV_FILE"
    TS_NAME=$("${TS[@]}" status --json 2>/dev/null | grep -o '"DNSName": *"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/; s/\.$//')
    if [ -n "$TS_NAME" ]; then
      URL_PHONE="https://$TS_NAME"
      [ "$TS_PORT" = 443 ] || URL_PHONE="$URL_PHONE:$TS_PORT"
      ok "Garage è su $URL_PHONE (solo per i dispositivi del tuo Tailscale)"
      [ "$TS_PORT" = 443 ] || info "La porta 443 è già usata da un'altra app: Garage usa la $TS_PORT."
    else
      warn "Collegato sulla porta $TS_PORT, ma non trovo il nome del server: guarda con  ${TS[*]} serve status"
    fi
  elif [ ${#TS[@]} -gt 0 ] && [ -z "$TS_PORT" ]; then
    warn "Tutte le porte HTTPS di Tailscale previste sono già usate da altre app."
    info "  Liberane una con  ${TS[*]} serve --https=<porta> off  e rilancia questo script."
  else
    warn "tailscale serve non riuscito. Abilita HTTPS nel pannello Tailscale (DNS → HTTPS Certificates) e rilancia:"
    info "  tailscale serve --bg --https=${TS_PORT:-443} $TARGET"
  fi
fi

# --- aggiornamenti -----------------------------------------------------------------------------

step "Aggiornamenti"
install -m 755 "$SRC/casaos/aggiorna.sh" /usr/local/bin/garage-aggiorna
ok "Comando installato: sudo garage-aggiorna"
AUTO_UPDATE=0
if command -v systemctl >/dev/null 2>&1 && [ -d /etc/systemd/system ]; then
  if systemctl is-enabled garage-aggiorna.timer >/dev/null 2>&1; then
    AUTO_UPDATE=1
    ok "Aggiornamenti automatici già attivi"
  elif ask_yes "Controllo ogni notte se c'è una versione nuova e la installo da solo?" s; then
    cat > /etc/systemd/system/garage-aggiorna.service <<'EOF'
[Unit]
Description=Aggiorna Garage all'ultima versione
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/garage-aggiorna
TimeoutStartSec=1h
Nice=10
EOF
    cat > /etc/systemd/system/garage-aggiorna.timer <<'EOF'
[Unit]
Description=Controlla ogni notte se c'è una nuova versione di Garage

[Timer]
OnCalendar=*-*-* 04:00
RandomizedDelaySec=30min
Persistent=true

[Install]
WantedBy=timers.target
EOF
    systemctl daemon-reload
    systemctl enable --now garage-aggiorna.timer >/dev/null 2>&1 && AUTO_UPDATE=1
    [ "$AUTO_UPDATE" = 1 ] && ok "Ogni notte verso le 4 Garage si aggiorna da sola" || warn "Timer non attivato: aggiorna a mano con sudo garage-aggiorna"
  fi
else
  warn "systemd non trovato: aggiorna a mano con sudo garage-aggiorna"
fi

# --- fine --------------------------------------------------------------------------------------

step "Fatto!"
echo
info "${B}Apri Garage:${R}"
info "  dal computer di casa:  http://$LAN_IP:$PORT"
info "  dal telefono:          ${B}$URL_PHONE${R}"
echo
if [ "$MODE" = lan ]; then
  warn "Senza Tailscale Garage si apre solo come sito web in casa (niente app installata, niente promemoria)."
  echo
fi
info "${B}Crea il tuo account:${R} apri Garage e tocca \"Creane uno\"."
info "Ogni persona della famiglia può crearne uno: i dati di ognuno restano separati."
echo
info "${B}Installala come app:${R}"
info "  Android (Chrome): menu ⋮ → Installa app"
info "  iPhone (Safari):  Condividi → Aggiungi alla schermata Home"
echo
info "Hai già l'app Android? Esporta il backup da lì (Impostazioni → Esporta backup)"
info "e importalo in Garage web da Impostazioni → Importa backup, oppure collega l'app al server:"
info "  nell'app Android, Impostazioni → Usa il server Garage, con l'indirizzo qui sopra."
echo
if [ "$AUTO_UPDATE" = 1 ]; then
  info "Garage si aggiorna da sola ogni notte. Per farlo subito: sudo garage-aggiorna"
  info "${D}Ultimi aggiornamenti: journalctl -u garage-aggiorna · Per spegnerli: systemctl disable --now garage-aggiorna.timer${R}"
else
  info "Per aggiornare in futuro: sudo garage-aggiorna"
fi
info "${D}Configurazione: $APP_DIR · Dati: $DATA_DIR · Log: docker logs $APP${R}"
echo
