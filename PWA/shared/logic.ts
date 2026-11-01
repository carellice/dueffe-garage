import type { DueReminder, GarageDocument, GarageState, Maintenance, VehicleRow } from './model.ts'
import { daysBetween, formatKm, formatYMD, instantToLocalDate, parseDate, plusMonths, plusYears, today, dateLabel } from './format.ts'

// Business rules of the Android app (GarageRepository.kt, Screens.kt, MainActivity.kt).

export const maintenanceNames: Record<string, string> = {
  service: 'Tagliando', inspection: 'Revisione', tax: 'Bollo', insurance: 'Assicurazione', tires: 'Cambio gomme',
}

/** maintenanceLabel() */
export const maintenanceLabel = (m: Maintenance) => (m.type === 'custom' ? m.customName : maintenanceNames[m.type] ?? m.type)

export const fuelOptions = ['Benzina', 'Diesel', 'GPL', 'Benzina/GPL', 'Metano', 'Benzina/Metano', 'Ibrida', 'Ibrida plug-in', 'Elettrica', 'Idrogeno']

export const vehicleTypes: [string, string][] = [
  ['car', 'Auto'], ['motorcycle', 'Moto'], ['scooter', 'Motorino'], ['van', 'Furgone'], ['truck', 'Camion'], ['camper', 'Camper'], ['other', 'Altro'],
]
export const vehicleTypeLabel = (type: string) => vehicleTypes.find(([k]) => k === type)?.[1] ?? 'Altro'

export const statusLabel = (status: string) => (status === 'sold' ? 'Venduta' : status === 'scrapped' ? 'Rottamata' : 'Attiva')

function plusInterval(date: string, value: number, unit: string): string | null {
  const parsed = parseDate(date)
  if (!parsed) return null
  return formatYMD(unit === 'months' ? plusMonths(parsed, value) : plusYears(parsed, value))
}

/** dueReminders(): active reminders of active vehicles, soonest first. */
export function dueReminders(state: Pick<GarageState, 'vehicles' | 'maintenances' | 'reminders'>): DueReminder[] {
  const now = today()
  const list: DueReminder[] = []
  for (const r of state.reminders) {
    const m = state.maintenances.find((x) => x.id === r.maintenanceId)
    if (!m) continue
    const v = state.vehicles.find((x) => x.id === m.vehicleId && x.status === 'active')
    if (!v) continue
    if (!r.active) continue
    const dueDate = r.type === 'interval' && r.intervalValue != null ? plusInterval(m.date, r.intervalValue, r.intervalUnit) : r.dueDate || null
    const parsedDue = dueDate ? parseDate(dueDate) : null
    const dateDays = parsedDue ? daysBetween(now, parsedDue) : null
    const kmLeft = r.mileageThreshold != null ? r.mileageThreshold - v.mileage : null
    const mileageEstimate = kmLeft == null ? null : kmLeft <= 0 ? -1 : Math.floor((kmLeft + 49) / 50)
    let days: number | null
    if (r.type === 'mileage') days = mileageEstimate
    else if (r.type === 'both') {
      const both = [dateDays, mileageEstimate].filter((x): x is number => x != null)
      days = both.length ? Math.min(...both) : null
    } else days = dateDays
    list.push({ reminder: r, maintenance: m, vehicle: v, days, kmLeft })
  }
  // sortedBy is stable, like Array.sort.
  return list.sort((a, b) => (a.days ?? Number.MAX_SAFE_INTEGER) - (b.days ?? Number.MAX_SAFE_INTEGER))
}

/** reminderDueDate() */
export function reminderDueDate(item: DueReminder): string {
  const r = item.reminder
  if (r.type === 'interval' && r.intervalValue != null) return plusInterval(item.maintenance.date, r.intervalValue, r.intervalUnit) ?? r.dueDate
  return r.dueDate
}

export function intervalText(value: number, unit: string): string {
  const word = unit === 'months' && value === 1 ? 'mese' : unit === 'months' ? 'mesi' : value === 1 ? 'anno' : 'anni'
  return `Ogni ${value} ${word}`
}

/** reminderSubtitle() */
export function reminderSubtitle(item: DueReminder): string {
  if (item.maintenance.notes.trim()) return item.maintenance.notes.split(/\r\n|\r|\n/)[0]
  const r = item.reminder
  if (r.type === 'interval' && r.intervalValue != null) return intervalText(r.intervalValue, r.intervalUnit)
  return ({
    service: 'Manutenzione programmata', inspection: 'Scadenza revisione', tax: 'Pagamento bollo',
    insurance: 'Rinnovo polizza', tires: 'Controllo pneumatici',
  } as Record<string, string>)[item.maintenance.type] ?? 'Promemoria per la tua auto'
}

/** reminderStatus() */
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

/** The longer status of the reminder detail screen. */
export function reminderDetailStatus(due: DueReminder): string {
  if (due.reminder.type === 'mileage' && due.kmLeft != null && due.kmLeft <= 0) return 'Da effettuare'
  if (due.reminder.type === 'mileage' && due.kmLeft != null) return `Mancano ${formatKm(due.kmLeft)}`
  if (due.days == null) return 'Da verificare'
  if (due.days < 0) return `Scaduta da ${-due.days} giorni`
  if (due.days === 0) return 'Oggi'
  if (due.days === 1) return 'Tra 1 giorno'
  return `Tra ${due.days} giorni`
}

/** documentCategory(): from the linked maintenance, else guessed from the name. */
export function documentCategory(document: GarageDocument, maintenances: Maintenance[]): string {
  const type = maintenances.find((m) => m.id === document.maintenanceId)?.type
  if (type) return ['insurance', 'inspection', 'tax', 'service'].includes(type) ? type : 'other'
  const name = document.name.toLocaleLowerCase('it-IT')
  if (name.includes('assicur') || name.includes('polizza')) return 'insurance'
  if (name.includes('revision')) return 'inspection'
  if (name.includes('bollo') || name.includes('tassa')) return 'tax'
  if (name.includes('tagliando') || name.includes('manutenz')) return 'service'
  return 'other'
}

/** documentDate() */
export const documentDate = (timestamp: string) => {
  const local = instantToLocalDate(timestamp)
  return local ? dateLabel(local) : timestamp.slice(0, 10)
}

/** notesUpdatedLabel() */
export const notesUpdatedLabel = (value: string) => {
  if (!value.trim()) return 'Mai'
  const local = instantToLocalDate(value)
  return local ? dateLabel(local) : value
}

export function documentFormat(document: GarageDocument): string {
  if (document.mimeType === 'application/pdf') return 'PDF'
  if (document.mimeType === 'image/jpeg') return 'JPG'
  if (document.mimeType === 'image/png') return 'PNG'
  const dot = document.name.lastIndexOf('.')
  return (dot >= 0 ? document.name.slice(dot + 1) : 'FILE').toLocaleUpperCase('it-IT')
}

export const vehicleSubtitle = (v: VehicleRow) =>
  [`${v.make} ${v.model}`.trim(), String(v.year)].filter((x) => x.trim()).join(' · ')
