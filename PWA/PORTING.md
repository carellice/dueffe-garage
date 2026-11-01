# Garage · port to PWA

Status `verified` = walked in a 375×812 browser (light and dark) and, for the home, onboarding, settings and vehicle
detail, compared with the app on a Pixel emulator. Checklist of the conversion from the Android app (`app/src/main/java/it/dueffe/garage`). Every row:
native source → web file → status (`todo`, `done`, `verified` = compared with the native app).
Values come from the Kotlin code, never from screenshots.

## Screens and routes

Native navigation is a single `AnimatedContent` keyed by `GarageDestination` in `MainActivity.kt:280`,
driven by state flags; back is a `BackHandler` with the priority order of `MainActivity.kt:220`.
The web keeps the same destinations as a history-backed stack (`web/src/lib/nav.ts`).

| Screen | Reached from | Native file | Web file | Status |
|---|---|---|---|---|
| Garage (home) | tab, root | `HomeScreens.kt:144` GarageHome | `screens/Home.tsx` | verified |
| Scadenze | tab | `HomeScreens.kt:330` ReminderScreen | `screens/Deadlines.tsx` | verified |
| Impostazioni | tab | `SettingsScreen.kt:22` | `screens/Settings.tsx` | verified |
| Dettaglio auto | vehicle card, deadline card | `Screens.kt:128` VehicleDetail (sectionsPage=false) | `screens/VehicleDetail.tsx` | verified |
| Diario (Interventi/Scadenze/Documenti/Note) | "Interventi, scadenze, documenti e note" | `Screens.kt:128` (sectionsPage=true) | `screens/VehicleDetail.tsx` (`sections`) | verified |
| Dettaglio intervento | maintenance card | `ItemDetailScreens.kt:73` | `screens/ItemDetails.tsx` | done |
| Dettaglio scadenza | reminder card in Diario | `ItemDetailScreens.kt:103` | `screens/ItemDetails.tsx` | done |
| Dettaglio documento | document card in Diario | `ItemDetailScreens.kt:151` | `screens/ItemDetails.tsx` | verified |
| Nuova / Modifica auto | "Aggiungi auto", Modifica | `Screens.kt:769` VehicleEditor | `screens/VehicleEditor.tsx` | verified |
| Nuovo / Modifica intervento | "Registra intervento", Modifica | `Screens.kt:976` MaintenanceEditor | `screens/MaintenanceEditor.tsx` | verified |
| Nuovo / Modifica documento | "Aggiungi documento", Modifica | `Screens.kt:717` DocumentEditor | `screens/DocumentEditor.tsx` | done |
| Onboarding (5 slide) | first start, "Rivedi l'introduzione" | `HomeScreens.kt:377` | `screens/Onboarding.tsx` | verified |
| Blocco PIN | protection on, app back from background | `HomeScreens.kt:456` | `screens/Lock.tsx` | verified |
| Accesso / registrazione | PWA only | — | `screens/Login.tsx` | verified |
| Dialog: stato auto | "Stato" | `Screens.kt:1269` StatusEditor | `components/dialogs.tsx` | done |
| Dialog: conferma eliminazione | every delete | `Screens.kt:1278` | `components/dialogs.tsx` | done |
| Dialog: rinomina documento | document ⋮ menu | `MainActivity.kt:435` | `components/dialogs.tsx` | done |
| Dialog: importa backup | Importa backup | `MainActivity.kt:436` | `screens/Settings.tsx` | done |
| Dialog: imposta / cambia PIN | protection, Cambia PIN | `MainActivity.kt:448` | `components/dialogs.tsx` | verified |
| Dialog: anno | year field | `Screens.kt:929` | `screens/VehicleEditor.tsx` | verified |
| Date picker | date fields | M3 DatePickerDialog | `components/DatePicker.tsx` | verified |
| Dropdown menu | selects, ⋮ | M3 ExposedDropdownMenu / DropdownMenu | `components/Menu.tsx` | verified |
| Account (password, esci, elimina) | PWA only | — | `screens/Settings.tsx` | done |

Back order (`MainActivity.kt:222`): editors → item details → Diario → Dettaglio auto → tab Garage.

## Navigation chrome and transitions

| Element | Spec | Native file | Web file | Status |
|---|---|---|---|---|
| Floating bottom bar | 3 items, pill indicator spring(0.68, 400), tint tween 250, icon scale 1.12 spring(0.4, 1500), lift −1dp spring(0.5), press .9 | `HomeScreens.kt:63` | `components/BottomBar.tsx` | verified |
| Bar visibility | hidden on editors and item details | `MainActivity.kt:267` | `App.tsx` | done |
| Screen enter (forward) | scaleIn from tap point (0.12 if tap < 1200 ms else 0.94), tween 340 FastOutSlowIn + fadeIn 110 | `MainActivity.kt:313` | `App.tsx` layers | done |
| Screen exit (forward) | fadeOut 150 | `MainActivity.kt:318` | `App.tsx` | done |
| Back enter | fadeIn 180 | `MainActivity.kt:313` | `App.tsx` | done |
| Back exit | scaleOut to opening origin (0.12) tween 300 + fadeOut 110 delay 190 | `MainActivity.kt:318` | `App.tsx` | done |
| Container transform | garage↔add vehicle, garage↔detail, detail↔sections: fade in 260 / out 300 + bounds tween 340 | `GarageDesign.kt:213` | `App.tsx` (grow from source rect) | done |

## Theme (light / dark)

| Token | Light | Dark | Native source | Status |
|---|---|---|---|---|
| primary | #8A5A00 | #FFD84D (Gold) | `MainActivity.kt:241` | done |
| onPrimary | #FFFFFF | #09080A | same | done |
| background | #F7F3EA | #09080A | same | done |
| surface | #FFFFFF | #16141A | same | done |
| surfaceContainer | #F8F5ED | #16141A | same | done |
| surfaceContainerHigh | #F0EBDF | #221F25 | same | done |
| surfaceContainerHighest / surfaceVariant | #E9E2D3 | #2C2930 / #27242B | same | done |
| onSurface / onBackground | #09080A | #FFF8E9 (Cream) | same | done |
| onSurfaceVariant / secondary | #665B46 | #B7A98E (Muted) | same | done |
| outline | #85745A | #6E6252 | same | done |
| secondaryContainer | #FFE7A3 | #3D3214 | same | done |
| onSecondaryContainer | #3A2A00 | #FFD84D | same | done |
| error | M3 default #B3261E | #FF6B6B | same | done |
| accent gradient | #E0A100 → #E86A12 | #FFD84D → #FF9F1C | `GarageDesign.kt:55` | done |
| backdrop glows | #FFC94D a.22, #FFB38A a.18 | Gold a.10, Amber a.07, drift 9000 ms reverse | `GarageDesign.kt:59` | done |
| urgency | see `urgencyFor` | | `GarageDesign.kt:190` | done |
| maintenance types | tint/background per type | | `Screens.kt:357` | done |

## Typography

Font: Roboto (Compose default on Android), shipped as `web/public/roboto-latin.woff2` and `roboto-latin-ext.woff2` (variable, wght 100–900, OFL).
Sizes in sp map 1:1 to px; every size is written inline in the native composables, the web uses the
same numbers in each component.

| Style | Spec | CSS | Status |
|---|---|---|---|
| headlineLarge/Medium | weight 900, spacing −0.5/−0.4 | `t-headline` | done |
| titleLarge | 22/28, 700, −0.2 | `t-title` | done |
| labelLarge (buttons) | 14 → 15 bold, +0.2 | `.btn` | done |
| bodyLarge (inputs) | 16/24, 400, +0.5 | `.field input` | done |
| Kicker | 11, 900, spacing 2–2.4, uppercase | `.kicker` | done |

## Components

| Component | Behavior | Native file | Web file | Status |
|---|---|---|---|---|
| pressScale / bouncyClick | scale .965 while pressed, spring(0.55, 1500) | `GarageDesign.kt:77` | `components/ui.tsx` Bouncy | done |
| GradientButton | min height 48, radius 28, shadow 10 amber, shimmer sweep 2600 ms delay 900, disabled alpha .45 | `GarageDesign.kt:118` | `ui.tsx` GradientButton | done |
| GlassCard | radius 26, padding 18, shadow 8 in light, 1px hairline | `GarageDesign.kt:142` | `ui.tsx` GlassCard | done |
| GradientIcon | circle with gradient, icon on accent | `GarageDesign.kt:154` | `ui.tsx` | done |
| AnimatedCount | 0 → value, tween 1100 FastOutSlowIn | `GarageDesign.kt:163` | `ui.tsx` | done |
| ProgressRing | arc from −90°, tween 1200, round cap | `GarageDesign.kt:171` | `ui.tsx` | done |
| SectionHeading | gradient dash 18×3, kicker, title 34/37 900 −0.6 | `HomeScreens.kt:98` | `ui.tsx` | done |
| VehiclePlate | Italian plate, two-line for two-wheelers | `Screens.kt:91` | `components/Plate.tsx` | done |
| Filter pills | height 43, radius 13/14, secondaryContainer when selected | `Screens.kt:369,485,521` | `ui.tsx` Pill | done |
| Outlined / text / tonal buttons | M3 defaults | M3 | `ui.tsx` | done |
| Switch, Slider | M3 | M3 | `ui.tsx` | done |
| Text fields | outlined M3, custom frame for vehicle form | `Screens.kt:864,1136` | `components/fields.tsx` | done |
| Toast | `Toast.LENGTH_SHORT` | Android | `components/Toast.tsx` | done |

## Motion

| Animation | What animates | Spec | Native file | Web file | Status |
|---|---|---|---|---|---|
| staggerIn | alpha, y 46→0, scale .96→1 | delay min(i,10)·40 ms, spring(0.82, 200) | `GarageDesign.kt:90` | `ui.tsx` Stagger | done |
| Home intro | stagger only on the first home view of the session | `homeIntroPlayed` | `HomeScreens.kt:139` | `Home.tsx` | done |
| Empty illustration bob | y ±6 | tween 1800 reverse | `HomeScreens.kt:120` | `ui.tsx` | done |
| Urgent reminder border | alpha .35→1 | tween 900 reverse | `Screens.kt:437` | `ReminderCard` | done |
| Archive chevron | rotate 0→180 | spring(0.6) | `HomeScreens.kt:196` | `Home.tsx` | done |
| Diario tab indicator | x | spring(0.7, 400), colors tween 260 | `Screens.kt:214` | `VehicleDetail.tsx` | done |
| List items | animateItem (fade + placement) | default | `Screens.kt:233` | `AnimatePresence` + layout | done |
| Item header icon pop | scale .4→1 | spring(0.45, 200) | `ItemDetailScreens.kt:32` | `ItemDetails.tsx` | done |
| Onboarding ring | rotate 360 | 14000 linear | `HomeScreens.kt:388` | `Onboarding.tsx` | done |
| Onboarding bob / glow | y ±8 / glow .55→1 | 2200 / 1600 reverse | same | same | done |
| Onboarding icon | scale .3→1 spring(0.5, 200) + fade 220; out fade 120 | | same | same | done |
| Onboarding text | x ±1/3 spring(0.85, 200) + fade 260; out x ∓1/4 tween 200 + fade 160 | | same | same | done |
| Onboarding dots | width 8↔28 spring(0.6) | | same | same | done |
| Lock halo | scale .9↔1.08 | 1800 reverse | `HomeScreens.kt:483` | `Lock.tsx` | done |
| PIN dot | scale 1↔1.25 | spring(0.35, 1500) | `HomeScreens.kt:500` | `Lock.tsx` | done |
| PIN shake | x keyframes −18,16,−12,8,−4,0 at 50,120,190,260,330,420 ms | | `HomeScreens.kt:467` | `Lock.tsx` | done |

## Custom drawing and randomness

| Drawing | Seed / RNG | Native file | Web file | Status |
|---|---|---|---|---|
| Backdrop radial glows | none | `GarageDesign.kt:59` | `components/Backdrop.tsx` | done |
| Next deadline card glow | none | `HomeScreens.kt:239` | `Home.tsx` | done |
| Vehicle card placeholder (gradient, glow, rotated car) | none | `HomeScreens.kt:282` | `Home.tsx` | done |
| Dashed photo frame | dash 8/6 | `Screens.kt:836` | `VehicleEditor.tsx` (SVG rect) | done |
| Onboarding sweep ring | sweepGradient Gold→Amber→Ember→transparent | `HomeScreens.kt:404` | conic-gradient mask | done |

## Data model

The native database is one generic table; the server keeps exactly the same table per account
(`server/src/db.ts`), with the files in `binary`.

| Table | Columns | Deletion rules | Status |
|---|---|---|---|
| item | kind (vehicle, maintenance, reminder, document), id (UUID), parent, payload (JSON), binary (photo / file) | vehicle → its maintenances, reminders, documents; maintenance → its reminder, documents unlinked (`maintenanceId = null`); saving a maintenance replaces its reminder and raises the vehicle mileage | verified |
| meta | key, value | revision, lastChange, lastExport, leadDays, notified reminders | done |
| push_subs | endpoint, json, reminders | per account | done |

## Business logic (shared/)

| Logic | Native file | shared/ file | Status |
|---|---|---|---|
| Entities and JSON shape | `GarageRepository.kt:15,218` | `shared/model.ts` | done |
| dueReminders (days, km left, 50 km/day estimate) | `GarageRepository.kt:227` | `shared/logic.ts` | done |
| reminderDueDate, reminderStatus, reminderSubtitle | `Screens.kt:387` | `shared/logic.ts` | done |
| maintenanceLabel, dateLabel, formatKm, money | `MainActivity.kt:491` | `shared/format.ts` | done |
| documentCategory, documentSize, documentDate | `Screens.kt:502` | `shared/logic.ts` | done |
| Vehicle / maintenance / reminder validation | `Screens.kt:815,1085` | editors | done |
| Backup validation | `GarageRepository.kt:176` | `server/src/db.ts` importBackup | done |

## Background work and notifications

| Job / notification | Schedule, text, deep link | Server function | Status |
|---|---|---|---|
| ReminderWorker | native: daily; server: hourly. Relevant = days in 0..leadDays or kmLeft ≤ 0; once per `dueDate:threshold:updatedAt`. Title `<auto> · <intervento>`, body "Soglia chilometrica raggiunta" / "Scade oggi" / "Tra N giorni". Tap opens Scadenze | `push.ts` runJobs | verified |

## Device features

| Feature | Web equivalent | Status |
|---|---|---|
| Photo picker (vehicle) | `<input type=file accept=image/*>`, JPEG max 1600 px q .85 | done |
| Camera (document) | `<input capture=environment>` | done |
| File picker (document, ≤ 10 MB) | `<input type=file>` | done |
| Open document (ACTION_VIEW) | blob URL in a new tab | done |
| Share document | `navigator.share({files})`, fallback download | done |
| Copy plate | `navigator.clipboard.writeText` | done |
| PIN lock (PBKDF2-SHA256 120 000, 32-byte salt) | WebCrypto, per device and account | done |
| Biometric | WebAuthn platform authenticator (needs HTTPS + host name) | done |
| Lock on ON_STOP | lock when back after 30 s hidden (pickers don't relock) | done |
| Notification permission | Web Push permission | done |
| Status bar color | theme-color meta | done |

## Settings

| Preference | Default | Scope | Status |
|---|---|---|---|
| theme (system/light/dark) | system | device | done |
| onboarding done | false | device + account | done |
| notifications | false | device (push subscription) | done |
| leadDays (1–30) | 7 | account (server job) | done |
| protection, PIN, biometric | off | device + account | done |
| lastExport, lastChange | "" | account (server meta) | done |

## Integrations and secrets

| Service | Where the token lives | Status |
|---|---|---|
| In-app APK updater (`it.dueffe.updates`) | not ported: the PWA updates itself (service worker + nightly server update) | done |

## Backup format

Same file as the native app (`GarageRepository.kt:166`), so it moves both ways.

| Key | Type | Notes |
|---|---|---|
| product | "Garage" (also accepts "Dueffe Garage") | |
| formatVersion | 1 | |
| exportedAt | ISO instant | |
| installationId | UUID | per account on the server |
| data.vehicles[] | vehicle JSON + `photo` data URL (image/jpeg) | |
| data.maintenances[] | maintenance JSON | |
| data.reminders[] | reminder JSON | |
| data.documents[] | document JSON + `data` data URL | max 250 MB file |

## Not portable

| Native feature | Why | Alternative |
|---|---|---|
| Home screen widget "Scadenze" | the web has no widgets | manifest shortcut "Scadenze" (Android Chrome) |
| In-app APK update card | not an APK | Settings → "Controlla aggiornamenti" |
| PDF first-page thumbnail | needs a PDF renderer (pdf.js, ~1 MB) | document icon (same as the native fallback) |
| Lock with the device screen lock when no PIN exists | no web API | PIN, plus passkey for biometrics |

## Native server mode (Android)

| Piece | Native file | Status |
|---|---|---|
| HTTP client, session token in the Android Keystore | `ServerClient.kt` | verified (emulator) |
| Pull with photo/file reuse, writes then pull | `ServerSync.kt` | verified (emulator) |
| Repository wrappers, errors as Toast, form stays open on failure | `GarageRepository.kt`, `MainActivity.kt` | verified (emulator, server stopped) |
| 30 s refresh while the app is visible | `MainActivity.kt` | verified (emulator) |
| Settings → Server Garage, choose phone/server data, disconnect and restore | `ServerScreen.kt`, `SettingsScreen.kt` | connect verified; data choice and restore not run |
| Reminder worker pulls first | `ReminderWorker.kt` | done |
| Cleartext/user CA allowed | `res/xml/network_security_config.xml` | done |
