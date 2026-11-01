// java.time.LocalDate and the Locale.ITALY formatters used by the Android app, on yyyy-MM-dd strings.
// Days are counted as epoch days, never with Date timestamps, so time zones cannot shift them.

export type YMD = { y: number; m: number; d: number }

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const monthLength = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]

/** LocalDate.parse: strict yyyy-MM-dd, null when not a real date. */
export function parseDate(value: string): YMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > monthLength(y, m)) return null
  return { y, m, d }
}

export const formatYMD = ({ y, m, d }: YMD) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** LocalDate.plusMonths: the day is clamped to the end of the month, like java.time. */
export function plusMonths(date: YMD, months: number): YMD {
  const total = date.y * 12 + (date.m - 1) + months
  const y = Math.floor(total / 12), m = (total % 12 + 12) % 12 + 1
  return { y, m, d: Math.min(date.d, monthLength(y, m)) }
}

export const plusYears = (date: YMD, years: number) => plusMonths(date, years * 12)

export function epochDay({ y, m, d }: YMD): number {
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** LocalDate.now() in the device (or server) time zone. */
export function today(): YMD {
  const n = new Date()
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() }
}

export const todayString = () => formatYMD(today())

/** ChronoUnit.DAYS.between(from, to). */
export const daysBetween = (from: YMD, to: YMD) => epochDay(to) - epochDay(from)

export const isBefore = (a: YMD, b: YMD) => epochDay(a) < epochDay(b)

/** An ISO instant shown as the local date it falls on. */
export function instantToLocalDate(value: string): string | null {
  const time = Date.parse(value)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value ?? '') || Number.isNaN(time)) return null
  const n = new Date(time)
  return formatYMD({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() })
}

// --- Locale.ITALY names (java.time short/long forms) ------------------------------------------

const monthsShort = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const monthsLong = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const weekdays = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

/** dateLabel(): "dd MMM yyyy", the value itself when it is not a date, "—" when empty. */
export function dateLabel(value: string): string {
  const date = parseDate(value)
  if (!date) return value ? value : '—'
  return `${String(date.d).padStart(2, '0')} ${monthsShort[date.m - 1]} ${date.y}`
}

/** "EEEE d MMMM" of today, used by the home header. */
export function longToday(): string {
  const n = new Date()
  return `${weekdays[n.getDay()]} ${n.getDate()} ${monthsLong[n.getMonth()]}`
}

// --- numbers (String.format with Locale.ITALY) ----------------------------------------------

const grouped0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions)
const grouped2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)
const plain1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })

/** "%,d": 12.345 */
export const groupedInt = (value: number) => grouped0.format(Math.trunc(value))

/** Int.formatKm(): "12.345 km" */
export const formatKm = (value: number) => `${groupedInt(value)} km`

/** "€ %,.2f": "€ 1.234,50" */
export const euro = (value: number) => `€ ${grouped2.format(value)}`

/** "€%,.0f": "€1.235" (stat tile) */
export const euroRounded = (value: number) => `€${grouped0.format(Math.round(value))}`

/** "%.2f" for the cost field: "0,00" */
export const decimal2 = (value: number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(value)

/** documentSize(): "1,5 MB" from 1 000 000 bytes, otherwise rounded up KB. */
export function documentSize(size: number): string {
  if (size >= 1_000_000) return `${plain1.format(size / 1_000_000)} MB`
  return `${Math.floor((size + 999) / 1000)} KB`
}
