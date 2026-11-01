<p align="center">
  <img src="docs/logo.png" alt="Garage" width="128" height="128">
</p>

<h1 align="center">Garage per Android</h1>

<p align="center">Auto, interventi, scadenze e documenti in un unico posto. App nativa della famiglia Dueffe.</p>

---

L'app nativa è direttamente in questa repository. È scritta in Kotlin con Jetpack Compose e si apre come progetto Android Studio.

## Cosa contiene

- Schede auto con foto, targa, chilometri, carburante facoltativo, note e archivio delle auto vendute o rottamate. Il carburante si può scegliere da un elenco o specificare con «Altro».
- Interventi con costi e promemoria per data, intervallo, chilometri o prima condizione raggiunta.
- Documenti locali: importazione, fotocamera, galleria, apertura, condivisione, rinomina ed eliminazione.
- Scadenze nell'app e notifiche opzionali tramite un controllo giornaliero di WorkManager. L'orario delle notifiche dipende da Android.
- Tema chiaro, scuro o automatico; blocco all'apertura con le credenziali del dispositivo.
- Importazione dei vecchi backup JSON della PWA e dei backup dell'app. I nuovi file sono identificati come **Garage**; includono foto e documenti. L'importazione valida il file prima della sostituzione e usa una transazione SQLite.

I dati sono conservati sul dispositivo. La protezione all'apertura non cifra il database né i backup JSON.

## Garage web e server di casa

[`PWA/`](PWA/README.md) contiene la stessa app per il browser, da installare su un server CasaOS con un solo comando: account per ogni persona, promemoria come notifiche, aggiornamenti notturni. Dall'app Android, Impostazioni → **Server Garage** collega il telefono allo stesso account: i dati restano sul server e il telefono ne tiene una copia consultabile anche offline. Spento (predefinito), tutto resta sul telefono come prima.

## Avvio con doppio clic

Apri [`Avvia Garage su Pixel.command`](Avvia%20Garage%20su%20Pixel.command). Lo script compila l'APK debug, avvia il primo emulatore Pixel configurato in Android Studio se necessario, installa e apre l'app. Per scegliere un altro emulatore: `GARAGE_AVD=Nome_AVD` nell'ambiente dello script. Su Windows usa [`Avvia Garage su Pixel.bat`](Avvia%20Garage%20su%20Pixel.bat).

## Release GitHub con doppio clic

Apri [`Pubblica Garage APK.command`](Pubblica%20Garage%20APK.command) su macOS oppure [`Pubblica Garage APK.bat`](Pubblica%20Garage%20APK.bat) su Windows. I due script condividono `.release-secrets/`. Servono Android Studio, SDK, `gh` autenticato e accesso in scrittura alla repository pubblica `android-app-releases` dell'account GitHub attivo. Per usare un'altra repository pubblica, imposta `GARAGE_RELEASE_REPO=proprietario/android-app-releases`.

Lo script:

1. verifica la repository e crea, al primo uso, una chiave privata di firma in `.release-secrets/`;
2. incrementa `VERSION_CODE` e la versione patch in `version.properties`;
3. compila e verifica la firma dell'APK release;
4. pubblica l'asset nella release con tag `garage-v<versione>`;
5. **solo dopo la pubblicazione**, elimina le vecchie release Garage, incluse quelle con il prefisso usato prima del cambio di nome.

Le release di altre app restano intatte. Conserva **fuori da questa cartella** una copia sicura di `.release-secrets/`: senza la stessa chiave gli aggiornamenti non possono essere installati sopra le versioni precedenti. La cartella è esclusa da Git. Se la pubblicazione fallisce prima della creazione della release, lo script ripristina il file della versione.

## Trasferire i dati dalla PWA

Nella PWA esporta il backup JSON da Impostazioni. Nell'app Android apri **Impostazioni → Importa backup PWA / Android** e seleziona quel file. L'app mostra il riepilogo prima di sostituire i dati locali.

## Verifiche e note

`./gradlew :app:assembleDebug :app:connectedDebugAndroidTest` compila l'app ed esegue il test di export/import sul Pixel. `./gradlew :app:assembleRelease` genera un APK release firmato solo quando sono configurate le variabili `DUEFFE_KEYSTORE`, `DUEFFE_STORE_PASSWORD`, `DUEFFE_KEY_ALIAS` e `DUEFFE_KEY_PASSWORD`.

Il progetto usa `targetSdk 36`. La modalità di accesso protetto è un blocco dell'interfaccia all'apertura; il backup JSON resta leggibile da chi ne possiede il file. Le notifiche sono promemoria giornalieri differibili, non allarmi a un'ora garantita.
