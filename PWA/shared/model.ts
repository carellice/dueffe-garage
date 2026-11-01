// The data of Garage, field by field as in the Android app (GarageRepository.kt). The JSON shape is
// the same as the native database payload and backup, so data moves between the two unchanged.

export type Vehicle = {
  id: string
  name: string
  make: string
  model: string
  year: number
  plate: string
  mileage: number
  /** yyyy-MM-dd or "" */
  registrationDate: string
  fuel: string
  /** car, motorcycle, scooter, van, truck, camper, other */
  vehicleType: string
  notes: string
  /** ISO instant or "" */
  notesUpdatedAt: string
  /** active, sold, scrapped */
  status: string
  statusDate: string
  statusNote: string
  addedAt: string
  createdAt: string
  updatedAt: string
}

export type Maintenance = {
  id: string
  vehicleId: string
  /** service, inspection, tax, insurance, tires, custom */
  type: string
  customName: string
  /** yyyy-MM-dd */
  date: string
  mileage: number
  cost: number
  notes: string
  createdAt: string
  updatedAt: string
}

export type Reminder = {
  id: string
  maintenanceId: string
  /** date, interval, mileage, both */
  type: string
  dueDate: string
  mileageThreshold: number | null
  intervalValue: number | null
  /** months, years or "" */
  intervalUnit: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type GarageDocument = {
  id: string
  vehicleId: string
  name: string
  mimeType: string
  /** image, pdf, document */
  category: string
  size: number
  addedAt: string
  updatedAt: string
  maintenanceId: string | null
}

/** A vehicle as the server sends it: the photo is a separate file. */
export type VehicleRow = Vehicle & { hasPhoto: boolean; photoSize?: number }

/** Everything the screens show (GET /api/state), sorted like GarageRepository.snapshot(). */
export type GarageState = {
  vehicles: VehicleRow[]
  maintenances: Maintenance[]
  reminders: Reminder[]
  documents: GarageDocument[]
  /** Account settings kept on the server. */
  lastChange: string
  lastExport: string
  leadDays: number
}

export type DueReminder = {
  reminder: Reminder
  maintenance: Maintenance
  vehicle: VehicleRow
  /** Days left (negative = overdue); for km reminders an estimate at 50 km a day. */
  days: number | null
  kmLeft: number | null
}

export const now = () => new Date().toISOString()

/** UUID v4; crypto.randomUUID is missing on plain HTTP pages, getRandomValues is not. */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// --- JSON readers, tolerant like org.json optString/optInt in the native app -----------------

type Json = Record<string, unknown>

const str = (j: Json, key: string, fallback = '') => {
  const v = j[key]
  return v == null ? fallback : String(v)
}
const int = (j: Json, key: string, fallback = 0) => {
  const v = Number(j[key])
  return Number.isFinite(v) ? Math.trunc(v) : fallback
}
const nullableInt = (j: Json, key: string) => (j[key] == null || j[key] === '' ? null : int(j, key))

export function vehicleFrom(j: Json): Vehicle {
  return {
    id: str(j, 'id'), name: str(j, 'name'), make: str(j, 'make'), model: str(j, 'model'), year: int(j, 'year'),
    plate: str(j, 'plate'), mileage: int(j, 'mileage'), registrationDate: str(j, 'registrationDate'),
    fuel: str(j, 'fuel'), vehicleType: str(j, 'vehicleType', 'car') || 'car', notes: str(j, 'notes'),
    notesUpdatedAt: str(j, 'notesUpdatedAt'), status: str(j, 'status', 'active'), statusDate: str(j, 'statusDate'),
    statusNote: str(j, 'statusNote'), addedAt: str(j, 'addedAt'), createdAt: str(j, 'createdAt'), updatedAt: str(j, 'updatedAt'),
  }
}

export function maintenanceFrom(j: Json): Maintenance {
  const cost = Number(j.cost)
  return {
    id: str(j, 'id'), vehicleId: str(j, 'vehicleId'), type: str(j, 'type'), customName: str(j, 'customName'),
    date: str(j, 'date'), mileage: int(j, 'mileage'), cost: Number.isFinite(cost) ? cost : 0, notes: str(j, 'notes'),
    createdAt: str(j, 'createdAt'), updatedAt: str(j, 'updatedAt'),
  }
}

export function reminderFrom(j: Json): Reminder {
  return {
    id: str(j, 'id'), maintenanceId: str(j, 'maintenanceId'), type: str(j, 'type'), dueDate: str(j, 'dueDate'),
    mileageThreshold: nullableInt(j, 'mileageThreshold'), intervalValue: nullableInt(j, 'intervalValue'),
    intervalUnit: str(j, 'intervalUnit'), active: j.active == null ? true : j.active === true || j.active === 1 || j.active === 'true',
    createdAt: str(j, 'createdAt'), updatedAt: str(j, 'updatedAt'),
  }
}

export function documentFrom(j: Json, size = 0): GarageDocument {
  const linked = str(j, 'maintenanceId')
  return {
    id: str(j, 'id'), vehicleId: str(j, 'vehicleId'), name: str(j, 'name'), mimeType: str(j, 'mimeType'),
    category: str(j, 'category'), size: int(j, 'size', size), addedAt: str(j, 'addedAt'), updatedAt: str(j, 'updatedAt'),
    maintenanceId: linked && linked !== 'null' ? linked : null,
  }
}

/** The payload stored for each kind, with exactly the native keys and order. */
export const vehicleJson = (v: Vehicle) => ({
  id: v.id, name: v.name, make: v.make, model: v.model, year: v.year, plate: v.plate, mileage: v.mileage,
  registrationDate: v.registrationDate, fuel: v.fuel, vehicleType: v.vehicleType, notes: v.notes,
  notesUpdatedAt: v.notesUpdatedAt, status: v.status, statusDate: v.statusDate, statusNote: v.statusNote,
  addedAt: v.addedAt, createdAt: v.createdAt, updatedAt: v.updatedAt,
})

export const maintenanceJson = (m: Maintenance) => ({
  id: m.id, vehicleId: m.vehicleId, type: m.type, customName: m.customName, date: m.date, mileage: m.mileage,
  cost: m.cost, notes: m.notes, createdAt: m.createdAt, updatedAt: m.updatedAt,
})

export const reminderJson = (r: Reminder) => ({
  id: r.id, maintenanceId: r.maintenanceId, type: r.type, dueDate: r.dueDate, mileageThreshold: r.mileageThreshold,
  intervalValue: r.intervalValue, intervalUnit: r.intervalUnit, active: r.active, createdAt: r.createdAt, updatedAt: r.updatedAt,
})

export const documentJson = (d: GarageDocument) => ({
  id: d.id, vehicleId: d.vehicleId, name: d.name, mimeType: d.mimeType, category: d.category, size: d.size,
  addedAt: d.addedAt, updatedAt: d.updatedAt, maintenanceId: d.maintenanceId,
})
