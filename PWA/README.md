<p align="center">
  <img src="web/public/icon-192.png" alt="Garage" width="96" height="96">
</p>

<h1 align="center">Garage web</h1>

<p align="center">La stessa app Garage per Android, nel browser e installabile sul telefono. Gira sul tuo server di casa (CasaOS, Raspberry Pi, qualsiasi Docker) e ogni persona ha il proprio garage privato.</p>

---

## Installazione su CasaOS

Sul server, da terminale:

```bash
curl -fsSL https://raw.githubusercontent.com/carellice/dueffe-garage/main/PWA/casaos/installa.sh | sudo bash
```

Lo script fa qualche domanda (cartella dei dati, porta, fuso orario, modo HTTPS), costruisce l'immagine Docker sul server, avvia l'app e la aggiunge al pannello di CasaOS. Funziona anche fuori da CasaOS, su qualsiasi Linux con Docker e Docker Compose.

Rilanciato su un server dove Garage c'è già, propone l'aggiornamento mantenendo dati e impostazioni.

### HTTPS: serve per installarla come app

Senza HTTPS Garage funziona come sito, ma il telefono non la installa come app, non arrivano le notifiche e non si può usare l'impronta. L'installer propone:

1. **Tailscale** (consigliato): HTTPS vero, funziona anche fuori casa, solo i tuoi dispositivi la raggiungono. Nel pannello di Tailscale attiva MagicDNS e *HTTPS Certificates*. L'installer sceglie da solo la porta HTTPS di Tailscale: la 443 se è libera, altrimenti un'altra, così più app possono stare sullo stesso server.
2. **HTTPS in casa**: un certificato locale da installare una volta per telefono, dalla pagina `/certificato`.
3. **HTTP dietro un tuo proxy** (Nginx Proxy Manager, Caddy, Cloudflare Tunnel).

### Sul telefono

- Android (Chrome): apri l'indirizzo, menu ⋮ → **Installa app**.
- iPhone (Safari): Condividi → **Aggiungi alla schermata Home**. Le notifiche arrivano solo all'app installata (iOS 16.4 o successivo).

## Account

Al primo accesso tocca **Nuovo qui? Crea un account**. Ogni account ha il suo garage: auto, interventi, documenti e impostazioni sono separati, in un database a parte sul server. Chiunque raggiunga il server può creare un account: con Tailscale o con la sola rete di casa va bene; se esponi Garage su Internet tienilo presente.

In **Impostazioni → Account**: cambia password, esci, elimina l'account con tutti i suoi dati.

## Portare i dati dall'app Android (e viceversa)

Il backup è lo stesso file JSON dell'app Android, con foto e documenti dentro.

- Da Android a web: nell'app **Impostazioni → Esporta backup**, poi in Garage web **Impostazioni → Importa backup**.
- Da web ad Android: **Esporta backup** qui, poi **Importa backup PWA / Android** nell'app.

L'importazione mostra il riepilogo e sostituisce tutti i dati dell'account. Il file non è cifrato.

## Aggiornamenti

Ogni notte (alle 4, con qualche minuto di variazione) il server controlla se su GitHub c'è una versione più nuova. Se c'è: costruisce la nuova immagine, fa una copia dei database in `<cartella dati>/backup/`, avvia la nuova versione e, se non parte, torna alla precedente.

```bash
sudo garage-aggiorna              # aggiorna adesso se c'è una nuova versione
sudo garage-aggiorna --controlla  # dice solo se c'è
sudo garage-aggiorna --forza      # ricostruisce anche se la versione è la stessa
journalctl -u garage-aggiorna     # cosa è successo
```

Per pubblicare una versione: aumenta `version` in `server/package.json` (e in `server/package-lock.json`) e fai push su `main`. Senza aumento di versione i server non si aggiornano. Sul telefono la nuova versione arriva alla riapertura dell'app; **Impostazioni → Aggiornamenti** la controlla subito.

## Differenze dall'app Android

| Android | Garage web |
|---|---|
| Dati sul telefono | Dati sul tuo server, uno per account; l'ultima copia resta sul telefono per aprire l'app anche offline (solo lettura) |
| Notifiche giornaliere di WorkManager | Notifiche push dal server, controllate ogni ora; servono HTTPS e l'app installata |
| Preavviso delle notifiche per telefono | Per account (le manda il server) |
| PIN all'apertura | Uguale, salvato su ogni telefono per ogni account |
| Biometria | Passkey del telefono (impronta o volto); serve HTTPS con un nome, non un indirizzo IP |
| Blocco quando l'app va in background | Uguale, tranne mentre è aperta la fotocamera, la galleria o la condivisione |
| Foto dell'auto originale | Ridotta a 2048 px (JPEG) prima dell'invio |
| Apri file con un'altra app | Il browser mostra PDF e immagini, gli altri file si scaricano |
| Widget "Scadenze" | Non disponibile: tieni premuta l'icona su Android per la scorciatoia **Scadenze** |
| Aggiornamento con APK | Aggiornamento automatico del server |

## Dove sono le cose sul server

- Configurazione: `/var/lib/casaos/apps/garage/` su CasaOS, altrimenti `/opt/garage/` (`docker-compose.yml` e `.env`).
- Dati: la cartella scelta all'installazione (predefinita `/DATA/AppData/garage` su CasaOS): `accounts.db`, `users/<id>/garage.db`, `backup/`, `certs/`.
- Log dell'app: `docker logs garage`.

## Sviluppo

Serve Node 24 o successivo.

```bash
cd PWA/server && npm install && npm run dev   # API su :8080, dati in server/data
cd PWA/web && npm install && npm run dev      # Vite su :5173, inoltra /api e /files a :8080
cd PWA/web && npm run build                   # controllo dei tipi e build in server/public
```

Struttura:

- `shared/model.ts`: modello, date, formati e regole delle scadenze, usati da server e app.
- `server/`: Node senza framework, `node:sqlite`, account, backup, notifiche push. Unica dipendenza: `web-push`.
- `web/`: React 18 e framer-motion; ogni schermata riproduce quella Compose (vedi `PORTING.md`).
- `casaos/`: installer, aggiornamento notturno, certificati HTTPS locali.
