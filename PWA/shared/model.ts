// The data and the rules of Garage, ported line by line from the Android app
// (GarageRepository.kt, Screens.kt, MainActivity.kt). Used by the server and by the web app.

export type Vehicle = {
  id: string; name: string; make: string; model: string; year: number; plate: string
  mileage: number; registrationDate: string; notes: string; notesUpdatedAt: string
  status: string; statusDate: string; statusNote: string; addedAt: string
  createdAt: string; updatedAt: string; fuel: string; vehicleType: string
  /** The photo lives next to the row (BLOB on the phone); the client loads it from /files/vehicle/<id>. */
  hasPhoto: boolean
}

export type Maintenance = {
  id: string; vehicleId: string; type: string; customName: string; date: string
  mileage: number; cost: number; notes: string; createdAt: string; updatedAt: string
}

export type Reminder = {
  id: string; maintenanceId: string; type: string; dueDate: string
  mileageThreshold: number | null; intervalValue: number | null; intervalUnit: string
  active: boolean; createdAt: string; updatedAt: string
}

export type GarageDocument = {
  id: string; vehicleId: string; name: string; mimeType: string; category: string
  size: number; addedAt: string; updatedAt: string; maintenanceId: string | null
}

export type GarageMeta = { lastChange: string; lastExport: string; leadDays: number }

export type GarageState = {
  vehicles: Vehicle[]; maintenances: Maintenance[]; reminders: Reminder[]; documents: GarageDocument[]
  meta: GarageMeta
}

export type DueReminder = { reminder: Reminder; maintenance: Maintenance; vehicle: Vehicle; days: number | null; kmLeft: number | null }

export const now = () => new Date().toISOString()

export function uuid(): string {
  const c = globalThis.crypto as Crypto
  if (c?.randomUUID) return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// --- LocalDate ----------------------------------------------------------------------------------
// Dates are "YYYY-MM-DD" strings like java.time.LocalDate.toString(). Day math goes through UTC
// epoch days so time zones never shift a day.

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** LocalDate.now() in the device (or server) time zone. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** LocalDate.parse: null when the text is not a valid ISO date. */
export function parseDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

const isoOf = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`

export function epochDay(value: string): number | null {
  const p = parseDate(value)
  return p ? Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000) : null
}

export function fromEpochDay(day: number): string {
  const d = new Date(day * 86_400_000)
  return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** LocalDate.plusMonths: the day is clamped to the end of the target month. */
export function plusMonths(value: string, months: number): string | null {
  const p = parseDate(value)
  if (!p) return null
  const total = p.y * 12 + (p.m - 1) + months
  const y = Math.floor(total / 12), m = (total % 12) + 1
  return isoOf(y, m, Math.min(p.d, daysInMonth(y, m)))
}

export const plusYears = (value: string, years: number) => plusMonths(value, years * 12)

/** ChronoUnit.DAYS.between(a, b). */
export function daysBetween(a: string, b: string): number | null {
  const x = epochDay(a), y = epochDay(b)
  return x == null || y == null ? null : y - x
}

/** The local date of an Instant string ("2024-05-01T10:00:00Z"), like atZone(systemDefault()).toLocalDate(). */
export function instantDate(value: string): string | null {
  const t = Date.parse(value)
  if (Number.isNaN(t) || !/T/.test(value)) return null
  const d = new Date(t)
  return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

// --- Locale.ITALY formatting --------------------------------------------------------------------

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

/** java.util.Formatter %,.<n>f with Locale.ITALY: "." groups, "," decimals, HALF_UP rounding. */
export function formatNumber(value: number, decimals = 0, grouping = true): string {
  const negative = value < 0
  const scale = 10 ** decimals
  const rounded = Math.round(Math.abs(value) * scale + 1e-9) / scale
  const [int, frac] = rounded.toFixed(decimals).split('.')
  const grouped = grouping ? int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : int
  return (negative && rounded !== 0 ? '-' : '') + grouped + (frac ? ',' + frac : '')
}

/** Int.formatKm(): "%,d km". */
export const formatKm = (km: number) => `${formatNumber(km)} km`

/** "€ %,.2f". */
export const formatEuro = (value: number) => `€ ${formatNumber(value, 2)}`

/** dd MMM yyyy, or the raw value (— when empty) if it is not a date. */
export function dateLabel(value: string): string {
  const p = parseDate(value)
  if (!p) return value.trim() === '' ? '—' : value
  return `${pad(p.d)} ${MONTHS_SHORT[p.m - 1]} ${p.y}`
}

/** EEEE d MMMM. */
export function longDate(value: string): string {
  const p = parseDate(value)
  if (!p) return value
  const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
  return `${WEEKDAYS[weekday]} ${p.d} ${MONTHS[p.m - 1]}`
}

export const monthName = (m: number) => MONTHS[m - 1]

// --- labels -------------------------------------------------------------------------------------

export const fuelOptions = ['Benzina', 'Diesel', 'GPL', 'Benzina/GPL', 'Metano', 'Benzina/Metano', 'Ibrida', 'Ibrida plug-in', 'Elettrica', 'Idrogeno']
export const vehicleTypes: [string, string][] = [
  ['car', 'Auto'], ['motorcycle', 'Moto'], ['scooter', 'Motorino'], ['van', 'Furgone'], ['truck', 'Camion'], ['camper', 'Camper'], ['other', 'Altro'],
]
export const vehicleTypeLabel = (type: string) => vehicleTypes.find(([k]) => k === type)?.[1] ?? 'Altro'

const maintenanceNames: Record<string, string> = {
  service: 'Tagliando', inspection: 'Revisione', tax: 'Bollo', insurance: 'Assicurazione', tires: 'Cambio gomme',
}
export const maintenanceLabel = (m: Maintenance) => m.type === 'custom' ? m.customName : maintenanceNames[m.type] ?? m.type

export const statusLabel = (status: string) => status === 'sold' ? 'Venduta' : status === 'scrapped' ? 'Rottamata' : 'Attiva'

export function greeting(hour = new Date().getHours()): string {
  if (hour >= 5 && hour <= 12) return 'Buongiorno'
  if (hour >= 13 && hour <= 17) return 'Buon pomeriggio'
  return 'Buonasera'
}

// --- deadlines ----------------------------------------------------------------------------------

export function dueReminders(state: Pick<GarageState, 'vehicles' | 'maintenances' | 'reminders'>, todayValue = today()): DueReminder[] {
  const result: DueReminder[] = []
  for (const r of state.reminders) {
    const m = state.maintenances.find((it) => it.id === r.maintenanceId)
    if (!m) continue
    const v = state.vehicles.find((it) => it.id === m.vehicleId && it.status === 'active')
    if (!v) continue
    if (!r.active) continue
    const dueDate = r.type === 'interval' && r.intervalValue != null
      ? (r.intervalUnit === 'months' ? plusMonths(m.date, r.intervalValue) : plusYears(m.date, r.intervalValue))
      : (r.dueDate.trim() !== '' ? r.dueDate : null)
    const dateDays = dueDate != null ? daysBetween(todayValue, dueDate) : null
    const kmLeft = r.mileageThreshold != null ? r.mileageThreshold - v.mileage : null
    const mileageEstimate = kmLeft != null ? (kmLeft <= 0 ? -1 : Math.floor((kmLeft + 49) / 50)) : null
    const days = r.type === 'mileage' ? mileageEstimate
      : r.type === 'both' ? minOrNull([dateDays, mileageEstimate])
      : dateDays
    result.push({ reminder: r, maintenance: m, vehicle: v, days, kmLeft })
  }
  return result.sort((a, b) => (a.days ?? Number.MAX_SAFE_INTEGER) - (b.days ?? Number.MAX_SAFE_INTEGER))
}

function minOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  return present.length ? Math.min(...present) : null
}

export function reminderDueDate(item: DueReminder): string {
  const r = item.reminder
  if (r.type === 'interval' && r.intervalValue != null) {
    return (r.intervalUnit === 'months' ? plusMonths(item.maintenance.date, r.intervalValue) : plusYears(item.maintenance.date, r.intervalValue)) ?? r.dueDate
  }
  return r.dueDate
}

export function intervalUnitLabel(value: number, unit: string): string {
  if (unit === 'months') return value === 1 ? 'mese' : 'mesi'
  return value === 1 ? 'anno' : 'anni'
}

export function reminderSubtitle(item: DueReminder): string {
  if (item.maintenance.notes.trim() !== '') return item.maintenance.notes.split(/\r\n|\r|\n/)[0]
  const r = item.reminder
  if (r.type === 'interval' && r.intervalValue != null) return `Ogni ${r.intervalValue} ${intervalUnitLabel(r.intervalValue, r.intervalUnit)}`
  switch (item.maintenance.type) {
    case 'service': return 'Manutenzione programmata'
    case 'inspection': return 'Scadenza revisione'
    case 'tax': return 'Pagamento bollo'
    case 'insurance': return 'Rinnovo polizza'
    case 'tires': return 'Controllo pneumatici'
    default: return 'Promemoria per la tua auto'
  }
}

export function reminderStatus(item: DueReminder): string {
  const remaining = item.days
  if (item.reminder.type === 'mileage' && item.kmLeft != null && item.kmLeft <= 0) return 'Da effettuare'
  if (item.reminder.type === 'mileage' && item.kmLeft != null) return `Tra ${formatKm(item.kmLeft)}`
  if (remaining == null) return 'Da verificare'
  if (remaining < 0) return 'Scaduta'
  if (remaining === 0) return 'Oggi'
  if (remaining === 1) return 'Tra 1 giorno'
  return `Tra ${remaining} giorni`
}

/** The longer status of the deadline detail page. */
export function reminderDetailStatus(due: DueReminder): string {
  if (due.reminder.type === 'mileage' && due.kmLeft != null && due.kmLeft <= 0) return 'Da effettuare'
  if (due.reminder.type === 'mileage' && due.kmLeft != null) return `Mancano ${formatKm(due.kmLeft)}`
  if (due.days == null) return 'Da verificare'
  if (due.days < 0) return `Scaduta da ${-due.days} giorni`
  if (due.days === 0) return 'Oggi'
  if (due.days === 1) return 'Tra 1 giorno'
  return `Tra ${due.days} giorni`
}

/** Notification text of the daily check (ReminderWorker). */
export function notificationText(item: DueReminder): string {
  if (item.kmLeft != null && item.kmLeft <= 0) return 'Soglia chilometrica raggiunta'
  if (item.days === 0) return 'Scade oggi'
  return `Tra ${item.days} giorni`
}

/** ReminderWorker: due within the lead days, or past the mileage threshold. */
export function notificationRelevant(item: DueReminder, leadDays: number): boolean {
  return (item.days != null && item.days >= 0 && item.days <= leadDays) || (item.kmLeft != null && item.kmLeft <= 0)
}

export const notificationKey = (r: Reminder) => `${r.dueDate}:${r.mileageThreshold}:${r.updatedAt}`

// --- documents ----------------------------------------------------------------------------------

export function documentCategory(document: GarageDocument, maintenances: Maintenance[]): string {
  const linked = maintenances.find((m) => m.id === document.maintenanceId)
  if (linked) return ['insurance', 'inspection', 'tax', 'service'].includes(linked.type) ? linked.type : 'other'
  const name = document.name.toLocaleLowerCase('it-IT')
  if (name.includes('assicur') || name.includes('polizza')) return 'insurance'
  if (name.includes('revision')) return 'inspection'
  if (name.includes('bollo') || name.includes('tassa')) return 'tax'
  if (name.includes('tagliando') || name.includes('manutenz')) return 'service'
  return 'other'
}

export function documentCategoryForMime(mime: string): string {
  return mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'document'
}

export function documentSize(size: number): string {
  return size >= 1_000_000 ? `${formatNumber(size / 1_000_000, 1, false)} MB` : `${Math.floor((size + 999) / 1000)} KB`
}

export function documentDate(timestamp: string): string {
  const d = instantDate(timestamp)
  return d ? dateLabel(d) : timestamp.slice(0, 10)
}

export function formatLabel(mime: string): string | null {
  return mime === 'application/pdf' ? 'PDF' : mime === 'image/jpeg' ? 'JPG' : mime === 'image/png' ? 'PNG' : null
}

/** The last time the notes changed, "Mai" when never. */
export function notesUpdatedLabel(value: string): string {
  if (value.trim() === '') return 'Mai'
  const d = instantDate(value)
  return d ? dateLabel(d) : value
}

/** Settings → I tuoi dati. */
export function backupStatus(lastChange: string, lastExport: string): string {
  if (lastExport.trim() === '') return 'Nessun backup esportato'
  return lastChange > lastExport ? 'Un nuovo backup è consigliato' : 'Backup aggiornato'
}

// --- backup (same file as the Android app: product "Garage", formatVersion 1) -------------------

export const backupDefaults = {
  vehicle: (j: Record<string, unknown>) => ({
    id: str(j.id), name: str(j.name), make: str(j.make), model: str(j.model), year: int(j.year), plate: str(j.plate),
    mileage: int(j.mileage), registrationDate: str(j.registrationDate), notes: str(j.notes), notesUpdatedAt: str(j.notesUpdatedAt),
    status: j.status == null ? 'active' : str(j.status), statusDate: str(j.statusDate), statusNote: str(j.statusNote),
    addedAt: str(j.addedAt), createdAt: str(j.createdAt), updatedAt: str(j.updatedAt), fuel: str(j.fuel),
    vehicleType: str(j.vehicleType).trim() === '' ? 'car' : str(j.vehicleType),
  }),
  maintenance: (j: Record<string, unknown>): Maintenance => ({
    id: str(j.id), vehicleId: str(j.vehicleId), type: str(j.type), customName: str(j.customName), date: str(j.date),
    mileage: int(j.mileage), cost: num(j.cost), notes: str(j.notes), createdAt: str(j.createdAt), updatedAt: str(j.updatedAt),
  }),
  reminder: (j: Record<string, unknown>): Reminder => ({
    id: str(j.id), maintenanceId: str(j.maintenanceId), type: str(j.type), dueDate: str(j.dueDate),
    mileageThreshold: j.mileageThreshold == null ? null : int(j.mileageThreshold),
    intervalValue: j.intervalValue == null ? null : int(j.intervalValue), intervalUnit: str(j.intervalUnit),
    active: j.active == null ? true : j.active === true || j.active === 'true', createdAt: str(j.createdAt), updatedAt: str(j.updatedAt),
  }),
  document: (j: Record<string, unknown>, size: number): GarageDocument => {
    const linked = str(j.maintenanceId)
    return {
      id: str(j.id), vehicleId: str(j.vehicleId), name: str(j.name), mimeType: str(j.mimeType), category: str(j.category),
      size: j.size == null ? size : int(j.size), addedAt: str(j.addedAt), updatedAt: str(j.updatedAt),
      maintenanceId: linked.trim() !== '' && linked !== 'null' ? linked : null,
    }
  },
}

/** org.json optString: absent or null gives "", other values their text. */
function str(v: unknown): string {
  return v == null ? '' : String(v)
}

/** org.json optInt: numbers and numeric strings, anything else 0. */
function int(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/** org.json optDouble. A missing cost becomes 0 instead of NaN, which JSON can't hold. */
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}
