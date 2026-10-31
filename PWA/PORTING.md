# Garage · port to PWA

Checklist of the conversion from the Android app (Kotlin, Jetpack Compose, Material 3). Every row: native source → web file → status
(`todo`, `done`, `verified` = checked in the browser at 375×812, light and dark). Native files are under
`app/src/main/java/it/dueffe/garage/`; web files under `PWA/web/src/` unless the path says otherwise.

## Screens and routes

| Screen | Reached from | Native file | Web file | Status |
|---|---|---|---|---|
| Login / registrazione | session check, 401 | — (PWA only) | `screens/Login.tsx` | verified |
| Garage protetto (PIN, Bio) | start, back from background | `HomeScreens.kt` GarageLockScreen | `screens/Lock.tsx` | done |
| Onboarding (5 slide) | first login, Impostazioni → Rivedi | `HomeScreens.kt` Onboarding | `screens/Onboarding.tsx` | verified |
| Garage (home) | tab | `HomeScreens.kt` GarageHome | `screens/Home.tsx` | verified |
| Scadenze | tab, shortcut `/?route=scadenze` | `HomeScreens.kt` ReminderScreen | `screens/Reminders.tsx` | verified |
| Impostazioni | tab | `SettingsScreen.kt` | `screens/Settings.tsx` | verified |
| Dettaglio auto | vehicle card, deadline | `Screens.kt` VehicleDetail | `screens/VehicleDetail.tsx` | verified |
| Diario (Interventi, Scadenze, Documenti, Note) | "Interventi, scadenze…" button | `Screens.kt` VehicleDetail(sectionsPage) | `screens/VehicleDetail.tsx` | verified |
| Dettaglio intervento / scadenza / documento | diary lists | `ItemDetailScreens.kt` | `screens/ItemDetails.tsx` | done |
| Nuova / modifica auto | Aggiungi auto, Modifica | `Screens.kt` VehicleEditor | `screens/VehicleEditor.tsx` | verified |
| Nuovo / modifica intervento | Registra intervento, Modifica | `Screens.kt` MaintenanceEditor | `screens/MaintenanceEditor.tsx` | verified |
| Nuovo / modifica documento | Aggiungi documento, Modifica | `Screens.kt` DocumentEditor | `screens/DocumentEditor.tsx` | done |
| Dialoghi: elimina, stato auto, anno, rinomina, PIN, importa | actions | `MainActivity.kt`, `Screens.kt` | `components/overlays.tsx`, screens | done |
| Account: cambia password, esci, elimina | Impostazioni → Account | — (PWA only) | `screens/Settings.tsx` | done |

## Navigation chrome and transitions

| Element | Spec | Native file | Web file | Status |
|---|---|---|---|---|
| Back stack, back gesture | BackHandler order of GarageApp | `MainActivity.kt` | `lib/nav.ts` (history API) | verified |
| Forward transition | scaleIn from the tap point, 0.12 (recent tap) or 0.94, tween 340 FastOutSlowIn + fadeIn 110; old fadeOut 150 | `MainActivity.kt` transitionSpec | `App.tsx` layerVariants | done |
| Back transition | new fadeIn 180; old scaleOut to the opening point 0.12/0.96, 300 ms + fadeOut 110 after 190 | `MainActivity.kt` | `App.tsx` | done |
| Container transform | garage↔new vehicle, garage↔detail, detail↔diary: bounds 340 ms FastOutSlowIn, fade 260/300 | `GarageDesign.kt` containerTransform | `App.tsx` (clip-path from `data-hero` rect) | done |
| FloatingGarageNavigation | pill spring(0.68, 400); icon scale 1.12 spring(0.4, 1500); lift −1 spring(0.5); tint tween 250; press 0.9 | `HomeScreens.kt` | `App.tsx` | verified |
| Diary segmented tabs | indicator spring(0.7, 400), colors tween 260 | `Screens.kt` | `VehicleDetail.tsx` SectionTabs | verified |

## Theme (light / dark)

| Token | Light | Dark | Native source | Status |
|---|---|---|---|---|
| primary / onPrimary | #8A5A00 / #FFFFFF | #FFD84D / #09080A | `MainActivity.kt` colors | verified |
| background | #F7F3EA | #09080A | idem | verified |
| surface | #FFFFFF | #16141A | idem | verified |
| surfaceContainer / High / Highest | #F8F5ED / #F0EBDF / #E9E2D3 | #16141A / #221F25 / #2C2930 | idem | verified |
| onSurface / onSurfaceVariant | #09080A / #665B46 | #FFF8E9 / #B7A98E | idem | verified |
| outline | #85745A | #6E6252 | idem | verified |
| secondaryContainer / on | #FFE7A3 / #3A2A00 | #3D3214 / #FFD84D | idem | verified |
| error | #B3261E (M3 default) | #FF6B6B | idem | done |
| outlineVariant (OutlinedButton border) | #CAC4D0 (M3 default) | #49454F (M3 default) | Material 3 defaults | done |
| Accent gradient | #E0A100 → #E86A12 | #FFD84D → #FF9F1C | `GarageDesign.kt` accentGradient | verified |
| Backdrop glows | #FFC94D 22 %, #FFB38A 18 % | Gold 10 %, Amber 7 %; drift 9000 ms reverse | `GarageDesign.kt` garageBackdrop | verified |
| Urgency colors | see `urgencyFor` | | `GarageDesign.kt` | `lib/theme.ts` | done |
| Maintenance type colors | see `maintenanceAppearance` | dark: tint at 16 % | `Screens.kt` | `lib/theme.ts` | done |

## Typography

Roboto variable (`web/public/Roboto.woff2`, the Material 3 font on Android). Default text = bodyLarge 16/24, letter spacing 0.5,
inherited like `LocalTextStyle` (line height stays 24 px when only the size changes, as in Compose). Sizes in sp → px 1:1.

| Style | Spec | Where | Status |
|---|---|---|---|
| Section title | 34/37, Black, −0.6 | `ui.tsx` SectionHeading | verified |
| Kicker | 11, Black, spacing 2.4, uppercase | `ui.tsx` Kicker | verified |
| labelLarge (buttons) | 14/20 Bold, 0.2 (GradientButton 15 Bold) | `ui.tsx` | verified |
| Dialog title / text | 24/32 · 14/20 | `overlays.tsx` AlertDialog | done |

## Components

| Component | Behavior | Native file | Web file | Status |
|---|---|---|---|---|
| bouncyClick / pressScale | scale 0.965, spring(0.55, 1500), ripple | `GarageDesign.kt` | `ui.tsx` Pressable | verified |
| GradientButton | 48 dp min, amber shadow, shimmer 2600 ms + 900 ms pause | `GarageDesign.kt` | `ui.tsx` + `styles.css` .shimmer | verified |
| GlassCard, GradientIcon, GradientText | radius 26, hairline border, light shadow | `GarageDesign.kt` | `ui.tsx` | verified |
| AnimatedCount, ProgressRing | tween 1100 / 1200 FastOutSlowIn | `GarageDesign.kt` | `ui.tsx` | verified |
| StaggerIn | delay index×40 (max 10), spring(0.82, 200), y 46, scale 0.96 | `GarageDesign.kt` | `ui.tsx` Stagger | verified |
| M3 OutlinedTextField | floating label with border notch | Material 3 | `fields.tsx` | verified |
| M3 Switch, Slider (1.4 style), DropdownMenu, AlertDialog, DatePicker, Toast | | Material 3 | `ui.tsx`, `overlays.tsx` | done |
| Form fields (VehicleFieldFrame, MaintenanceInput, choices, interval picker) | | `Screens.kt` | `components/editorFields.tsx` | verified |
| Vehicle plate (EU band, two lines for 2 wheels) | | `Screens.kt` VehiclePlate | `VehicleDetail.tsx` | verified |
| Document thumbnail (image / PDF first page) | PdfRenderer → pdf.js (lazy) | `Screens.kt` DocumentThumbnail | `components/thumbnail.tsx` | done |

## Motion (infinite)

| Animation | Spec | Native file | Web file | Status |
|---|---|---|---|---|
| Empty state bob | ±6, 1800 ms reverse | `HomeScreens.kt` | `ui.tsx` EmptyIllustration | verified |
| Overdue border pulse | 0.35→1, 900 ms reverse | `Screens.kt` ReminderListCard | `components/garage.tsx` | done |
| Lock halo, PIN dots, shake | 0.9→1.08 1800 ms; spring(0.35, 1500); keyframes 420 ms | `HomeScreens.kt` | `screens/Lock.tsx` | done |
| Onboarding ring, bob, glow, slides, dots | 14 s linear; ±8 2200 ms; 0.55→1 1600 ms; spring(0.85, 200); spring(0.6) | `HomeScreens.kt` | `screens/Onboarding.tsx` | verified |

## Data model

| Table | Columns | Deletion rules | Status |
|---|---|---|---|
| item (same as `dueffe-garage-native.db`) | kind, id, parent, payload JSON, binary BLOB; PK(kind,id), index (kind,parent) | vehicle → its maintenances, reminders, documents; maintenance → its reminder, documents unlinked; reminder alone; document alone | verified |
| meta | revision, lastChange, lastExport, leadDays, installationId, notified:<reminder> | | done |
| push_subs | endpoint, json, reminders | | done |

One SQLite file per account: `data/users/<id>/garage.db`; photos and documents live in its BLOBs, as on the phone.

## Business logic (shared/)

| Logic | Native file | shared/ file | Status |
|---|---|---|---|
| dueReminders (interval dates, km estimate (km+49)/50, "both" = min) | `GarageRepository.kt` | `shared/model.ts` | verified |
| reminderStatus / subtitle / due date / detail status | `Screens.kt`, `ItemDetailScreens.kt` | `shared/model.ts` | verified |
| LocalDate plusMonths/plusYears clamp, days between | java.time | `shared/model.ts` | verified |
| Italian formats (km, €, dates, MB/KB, HALF_UP) | `MainActivity.kt`, `Screens.kt` | `shared/model.ts` | verified |
| documentCategory, editor validations, interval defaults | `Screens.kt` | `shared/model.ts`, editors | done |
| Backup export / import validation (product "Garage", formatVersion 1, data URLs) | `GarageRepository.kt` | `server/src/db.ts` | verified (round trip) |

## Background work and notifications

| Native | PWA | Status |
|---|---|---|
| ReminderWorker, daily (WorkManager) | `server/src/push.ts` runJobs, every hour and after writes | done |
| Relevant: 0 ≤ days ≤ leadDays or km ≤ 0; once per dueDate:threshold:updatedAt | same rule, key in meta `notified:<id>` | done |
| Title "<auto> · <tipo>", text "Soglia chilometrica raggiunta" / "Scade oggi" / "Tra N giorni" | same texts, Web Push | done |
| Notifications switch (permission) | push subscription of this device | done |
| Preavviso 1–30 days | per account on the server (`/api/settings`) | done |

## Device features

| Native | PWA | Status |
|---|---|---|
| PickVisualMedia (vehicle photo) | file input, compressed to 2048 px JPEG 0.85 | verified |
| TakePicture / gallery / OpenDocument (documents, 10 MB) | file input (`capture` for the camera) | done |
| ACTION_VIEW / ACTION_SEND | blob in a new tab / Web Share with file, else download | done |
| Clipboard (Copia targa) | navigator.clipboard | done |
| PIN (PBKDF2-SHA256, 120 000, salt 32 B) | same algorithm with WebCrypto, per device and account | done |
| BiometricPrompt | WebAuthn platform passkey (HTTPS + host name) | done |
| Lock on ON_STOP | lock when the page is hidden, except while a picker or share sheet is open | done |

## Settings

| Preference | Default | Scope | Status |
|---|---|---|---|
| theme system/light/dark | system | device + account | verified |
| onboarding done | false | device + account | verified |
| protection, PIN, biometric | off | device + account | done |
| notifications | off | device (push subscription) | done |
| leadDays | 7 | account (server) | done |
| lastExport / lastChange | — | account (server) | done |

## Strings changed on purpose

| Native | PWA | Why |
|---|---|---|
| "Archivia i file sul dispositivo…" (onboarding 4) | "Archivia i file sul tuo server di casa…" | files live on the server |
| "Il documento resta sul dispositivo." | "Il documento resta sul tuo server." | idem |
| Aggiornamenti card (APK download) | service worker update + server version | no APK on the web |

## Not portable

| Native | PWA |
|---|---|
| Home screen widget "Scadenze" | not available; manifest shortcut "Scadenze" on Android |
| In-app APK updater | nightly server update + service worker refresh |
| Device credential unlock without PIN | not used: protection always needs a PIN, the passkey is the "Bio" |
