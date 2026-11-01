# Garage web (PWA su CasaOS)

La stessa app Garage di Android, nel browser: stesse schermate, colori, animazioni e testi, con i
dati sul tuo server di casa. Si installa sul telefono come un'app (Android e iPhone), manda i
promemoria delle scadenze come notifiche e si aggiorna da sola ogni notte.

- **Account separati**: ogni persona della famiglia crea il proprio account; auto, interventi e
  documenti di ognuno restano privati.
- **Stesso backup dell'app Android**: il file JSON esportato dall'app si importa qui e viceversa
  (foto e documenti inclusi).
- **App Android collegabile**: dall'app, Impostazioni → Server Garage, il telefono usa gli stessi
  dati della versione web (vedi sotto).

## Installazione

Sul server CasaOS, da SSH o dal terminale di CasaOS:

```bash
curl -fsSL https://raw.githubusercontent.com/carellice/dueffe-garage/main/PWA/casaos/installa.sh | sudo bash
```

L'installazione guidata chiede cartella dei dati, porta (predefinita 8097) e fuso orario, prepara
l'immagine Docker sul server (la prima volta servono alcuni minuti, di più su un Raspberry Pi),
avvia Garage, la aggiunge alla dashboard di CasaOS e offre l'aggiornamento automatico notturno.

### HTTPS con Tailscale

Per installare Garage come app e ricevere i promemoria il telefono deve aprirla in HTTPS. Garage
usa Tailscale:

1. Installa Tailscale sul server (App Store di CasaOS o tailscale.com) e sul telefono, con lo
   stesso account.
2. Nel pannello di Tailscale attiva **MagicDNS** e **HTTPS Certificates** (DNS → HTTPS Certificates).
3. Lancia (o rilancia) l'installazione: Garage viene collegata con `tailscale serve` e lo script
   stampa l'indirizzo, per esempio `https://casaos.tail1234.ts.net` (con `:8443` o un'altra porta
   se la 443 è già usata da un'altra app).

Senza Tailscale Garage funziona lo stesso come sito web nella rete di casa
(`http://IP-del-server:8097`), ma senza installazione come app, senza notifiche e senza sblocco
biometrico.

### Installala come app

- Android (Chrome): menu ⋮ → **Installa app**.
- iPhone (Safari): Condividi → **Aggiungi alla schermata Home** (le notifiche arrivano solo
  all'app installata, iOS 16.4 o successivo).

Poi apri Garage, tocca **Creane uno** e crea il tuo account. Per portare i dati dall'app Android:
nell'app Impostazioni → Esporta backup, poi in Garage web Impostazioni → Importa backup.

## Account

Chiunque raggiunga il server può creare un account: con Tailscale sono solo i tuoi dispositivi.
Non esporre Garage su Internet senza un accesso protetto. In Impostazioni → Account: cambia
password, esci, elimina l'account (con tutti i suoi dati).

## App Android collegata al server

Nell'app Android (dalla versione successiva alla 1.0.46), Impostazioni → **Server Garage** →
**Usa il server Garage**: inserisci l'indirizzo di Tailscale, nome utente e password (o crea un
account). Se il telefono ha già dei dati, l'app chiede quali usare: quelli del telefono (vanno sul
server) o quelli del server. Una copia dei dati del telefono resta salvata, così scollegando il
server puoi tornare a quelli di prima.

Con il server attivo le modifiche vanno subito al server e l'app si aggiorna ogni 30 secondi
mentre è aperta. Senza connessione i dati restano consultabili ma non modificabili: il
salvataggio mostra un errore e il modulo resta aperto. Le notifiche nell'app Android restano
quelle del telefono (calcolate sui dati del server).

## Aggiornamenti

Se li hai attivati, ogni notte verso le 4 il server controlla se su GitHub c'è una versione nuova
e la installa: prima salva una copia dei database in `<cartella dati>/backup/` (le ultime 5), e se
la nuova versione non parte torna da sola a quella di prima.

```bash
sudo garage-aggiorna              # aggiorna adesso, se c'è una versione nuova
sudo garage-aggiorna --controlla  # dice soltanto se c'è una versione nuova
sudo garage-aggiorna --forza      # ricostruisce anche se la versione è la stessa
```

Registro: `journalctl -u garage-aggiorna`. Per spegnerli:
`sudo systemctl disable --now garage-aggiorna.timer`. I telefoni prendono la nuova versione alla
prossima apertura (o da Impostazioni → Controlla aggiornamenti).

**Per pubblicare una versione**: aumenta `version` in `PWA/server/package.json` (e in
`package-lock.json`) e fai push su `main`. Senza cambio di versione i server non si aggiornano.

## Dove sono i dati

| Cosa | Dove |
|---|---|
| Account e sessioni | `<cartella dati>/accounts.db` |
| Dati di ogni account (auto, interventi, promemoria, foto, documenti) | `<cartella dati>/users/<id>/garage.db` |
| Copie prima degli aggiornamenti | `<cartella dati>/backup/` |
| Configurazione | `/var/lib/casaos/apps/garage/` (fuori da CasaOS: `/opt/garage/`) |
| Log | `docker logs garage` |

La cartella dati predefinita è `/DATA/AppData/garage`.

## Differenze rispetto all'app Android

| App Android | Garage web |
|---|---|
| Dati nel telefono | Dati sul server, copia nel browser per aprire subito l'app anche offline (offline si consulta, non si modifica) |
| Notifiche con WorkManager, una volta al giorno | Web Push dal server, controllo ogni ora |
| Preavviso notifiche per telefono | Preavviso per account (vale per tutti i dispositivi dell'account) |
| Blocco con PIN e biometria | PIN uguale; biometria con passkey del telefono (serve HTTPS con nome, quindi Tailscale) |
| Blocco appena l'app va in secondo piano | Blocco dopo 30 secondi fuori dall'app (così fotocamera e scelta file non la bloccano) |
| Senza PIN, sblocco con il blocco schermo del telefono | Non disponibile nel browser: si usa il PIN |
| Anteprima della prima pagina dei PDF | Icona del documento (le immagini hanno l'anteprima) |
| Foto auto salvata come scelta | Foto ridotta a 1600 px JPEG prima del caricamento |
| Apri/condividi documento con le app del telefono | Apertura nel browser; condivisione con il menu del telefono dove il browser lo permette, altrimenti download |
| Widget "Scadenze" nella schermata Home | Non disponibile sul web; c'è la scorciatoia "Scadenze" tenendo premuta l'icona (Android) |
| Aggiornamento dell'APK dalle impostazioni | Si aggiorna da sola (server ogni notte, app all'apertura) |
| Nessun account | Account per persona |

## Sviluppo

Servono Node.js 24 o successivo.

```bash
cd PWA/server && npm install && npm run dev        # API su :8080, dati in PWA/server/data
cd PWA/web && npm install && npm run dev           # Vite su :5173, inoltra /api al server
cd PWA/web && npm run build                        # controllo dei tipi e build in PWA/server/public
```

Con il server su un'altra porta: `API_PORT=8197 npm run dev`. Struttura:

- `shared/`: modello dei dati, date e formati italiani, regole delle scadenze (usati da server e web).
- `server/`: Node senza framework, `node:sqlite`, Web Push. Una tabella `item` per account, la
  stessa dell'app Android.
- `web/`: React + framer-motion, ogni componente rifatto sulle misure del codice Compose.
- `casaos/`: installazione, aggiornamento, entrypoint Docker.
- `PORTING.md`: l'elenco di schermate, colori, animazioni e regole portate dall'app Android.
