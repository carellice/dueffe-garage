import { AsyncLocalStorage } from 'node:async_hooks'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  backupDefaults, now, uuid,
  type GarageDocument, type GarageState, type Maintenance, type Reminder, type Vehicle,
} from '../../shared/model.ts'

// Data of one account. Every account has its own SQLite file under data/users/<id>/, picked per
// request with withUser(): the functions below never take a user id, they just read and write
// "the current account".

export const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

// The same table as the Android app (GarageRepository): one row per entity, its JSON in payload
// and the photo or the document file in binary.
const schema = `
CREATE TABLE IF NOT EXISTS item (kind TEXT NOT NULL, id TEXT NOT NULL, parent TEXT, payload TEXT NOT NULL, binary BLOB, PRIMARY KEY(kind,id));
CREATE INDEX IF NOT EXISTS item_parent ON item(kind,parent);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, reminders INTEGER NOT NULL);
`

// --- accounts: every account has its own database, picked per request -------------------------

type UserData = { id: number; db: DatabaseSync }

const opened = new Map<number, UserData>()
const current = new AsyncLocalStorage<UserData>()

export const userDir = (userId: number) => join(dataDir, 'users', String(userId))

function open(userId: number): UserData {
  const known = opened.get(userId)
  if (known) return known
  const dir = userDir(userId)
  mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(join(dir, 'garage.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;')
  db.exec(schema)
  const data = { id: userId, db }
  opened.set(userId, data)
  return data
}

/** Runs [work] on the data of [userId]: every function of this module then reads and writes there. */
export function withUser<T>(userId: number, work: () => T): T {
  return current.run(open(userId), work)
}

export function closeUser(userId: number) {
  opened.get(userId)?.db.close()
  opened.delete(userId)
}

function user(): UserData {
  const data = current.getStore()
  if (!data) throw new Error('Nessun account attivo')
  return data
}

/** The database of the current account. */
export const db = {
  prepare: (sql: string) => user().db.prepare(sql),
  exec: (sql: string) => user().db.exec(sql),
}

// --- meta ------------------------------------------------------------------------------------

export function getMeta(key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setMeta(key: string, value: string | null) {
  if (value == null) db.prepare('DELETE FROM meta WHERE key = ?').run(key)
  else db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

/** Bumped on every change, so clients can tell when to reload (GET /api/state?since=<revision>). */
export function revision(): number {
  return Number(getMeta('revision') ?? '0')
}

/** GarageRepository.changed(): remembers when the data last changed, for the backup hint. */
function changed() {
  setMeta('revision', String(revision() + 1))
  setMeta('lastChange', now())
}

export function transaction<T>(work: () => T): T {
  db.exec('BEGIN')
  try {
    const result = work()
    changed()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function leadDays(): number {
  const value = Number(getMeta('leadDays') ?? '7')
  return Number.isFinite(value) ? Math.min(30, Math.max(1, Math.trunc(value))) : 7
}

export function setLeadDays(value: number) {
  setMeta('leadDays', String(Math.min(30, Math.max(1, Math.trunc(value)))))
  setMeta('revision', String(revision() + 1))
}

export function markExported() {
  setMeta('lastExport', now())
  setMeta('revision', String(revision() + 1))
}

// --- rows ------------------------------------------------------------------------------------

type Row = { payload: string; binary: Uint8Array | null }

function put(kind: string, id: string, parent: string | null, json: object, bytes: Uint8Array | null = null) {
  db.prepare('INSERT OR REPLACE INTO item (kind, id, parent, payload, binary) VALUES (?, ?, ?, ?, ?)')
    .run(kind, id, parent, JSON.stringify(json), bytes)
}

function rows(kind: string): Row[] {
  return db.prepare('SELECT payload, binary FROM item WHERE kind = ? ORDER BY rowid').all(kind) as Row[]
}

function payloads(kind: string): Record<string, unknown>[] {
  return (db.prepare('SELECT payload FROM item WHERE kind = ? ORDER BY rowid').all(kind) as { payload: string }[])
    .map((r) => JSON.parse(r.payload) as Record<string, unknown>)
}

/** The stored file of a vehicle (photo) or of a document. */
export function binary(kind: 'vehicle' | 'document', id: string): Uint8Array | null {
  const row = db.prepare('SELECT binary FROM item WHERE kind = ? AND id = ?').get(kind, id) as { binary: Uint8Array | null } | undefined
  return row?.binary && row.binary.length > 0 ? row.binary : null
}

// JSON written exactly like vehicleJson(), maintenanceJson()... on the phone.
const vehicleJson = (v: Omit<Vehicle, 'hasPhoto'>) => ({
  id: v.id, name: v.name, make: v.make, model: v.model, year: v.year, plate: v.plate, mileage: v.mileage,
  registrationDate: v.registrationDate, fuel: v.fuel, vehicleType: v.vehicleType, notes: v.notes, notesUpdatedAt: v.notesUpdatedAt,
  status: v.status, statusDate: v.statusDate, statusNote: v.statusNote, addedAt: v.addedAt, createdAt: v.createdAt, updatedAt: v.updatedAt,
})
const maintenanceJson = (m: Maintenance) => ({
  id: m.id, vehicleId: m.vehicleId, type: m.type, customName: m.customName, date: m.date, mileage: m.mileage, cost: m.cost,
  notes: m.notes, createdAt: m.createdAt, updatedAt: m.updatedAt,
})
const reminderJson = (r: Reminder) => ({
  id: r.id, maintenanceId: r.maintenanceId, type: r.type, dueDate: r.dueDate, mileageThreshold: r.mileageThreshold,
  intervalValue: r.intervalValue, intervalUnit: r.intervalUnit, active: r.active, createdAt: r.createdAt, updatedAt: r.updatedAt,
})
const documentJson = (d: GarageDocument) => ({
  id: d.id, vehicleId: d.vehicleId, name: d.name, mimeType: d.mimeType, category: d.category, size: d.size,
  addedAt: d.addedAt, updatedAt: d.updatedAt, maintenanceId: d.maintenanceId,
})

function vehicles(): Vehicle[] {
  return rows('vehicle')
    .map((r) => ({ ...backupDefaults.vehicle(JSON.parse(r.payload)), hasPhoto: r.binary != null && r.binary.length > 0 }))
    .sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()))
}
const maintenances = () => payloads('maintenance').map(backupDefaults.maintenance).sort((a, b) => compare(b.date, a.date))
const reminders = () => payloads('reminder').map(backupDefaults.reminder)
const documents = () => (db.prepare('SELECT payload, length(binary) AS size FROM item WHERE kind = ? ORDER BY rowid').all('document') as { payload: string; size: number | null }[])
  .map((r) => backupDefaults.document(JSON.parse(r.payload), Number(r.size ?? 0)))
  .sort((a, b) => compare(b.addedAt, a.addedAt))

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** GarageRepository.snapshot(), without the files: those load on demand. */
export function state(): GarageState {
  return {
    vehicles: vehicles(), maintenances: maintenances(), reminders: reminders(), documents: documents(),
    meta: { lastChange: getMeta('lastChange') ?? '', lastExport: getMeta('lastExport') ?? '', leadDays: leadDays() },
  }
}

// --- writes (GarageRepository.save / delete) ----------------------------------------------------

/** photo: new bytes, null to remove it, undefined to keep the current one. */
export function saveVehicle(vehicle: Omit<Vehicle, 'hasPhoto'>, photo: Uint8Array | null | undefined) {
  transaction(() => {
    const bytes = photo === undefined ? binary('vehicle', vehicle.id) : photo
    put('vehicle', vehicle.id, null, vehicleJson(vehicle), bytes)
  })
}

export function saveMaintenance(maintenance: Maintenance, reminder: Reminder | null) {
  transaction(() => {
    put('maintenance', maintenance.id, maintenance.vehicleId, maintenanceJson(maintenance))
    db.prepare("DELETE FROM item WHERE kind = 'reminder' AND parent = ?").run(maintenance.id)
    if (reminder) put('reminder', reminder.id, maintenance.id, reminderJson(reminder))
    const vehicle = vehicles().find((v) => v.id === maintenance.vehicleId)
    if (vehicle && maintenance.mileage > vehicle.mileage) {
      put('vehicle', vehicle.id, null, vehicleJson({ ...vehicle, mileage: maintenance.mileage, updatedAt: now() }), binary('vehicle', vehicle.id))
    }
  })
}

/** bytes: the new file, undefined to keep the current one (rename, new link). */
export function saveDocument(document: GarageDocument, bytes: Uint8Array | undefined) {
  transaction(() => {
    const data = bytes ?? binary('document', document.id)
    if (!data) throw new Error('File vuoto')
    put('document', document.id, document.vehicleId, documentJson(document), data)
  })
}

export function deleteVehicle(id: string) {
  transaction(() => {
    for (const m of maintenances().filter((it) => it.vehicleId === id)) {
      db.prepare("DELETE FROM item WHERE kind = 'reminder' AND parent = ?").run(m.id)
    }
    for (const kind of ['maintenance', 'document']) db.prepare('DELETE FROM item WHERE kind = ? AND parent = ?').run(kind, id)
    db.prepare("DELETE FROM item WHERE kind = 'vehicle' AND id = ?").run(id)
  })
}

export function deleteMaintenance(id: string) {
  transaction(() => {
    for (const document of documents().filter((d) => d.maintenanceId === id)) {
      const unlinked = { ...document, maintenanceId: null, updatedAt: now() }
      put('document', unlinked.id, unlinked.vehicleId, documentJson(unlinked), binary('document', unlinked.id))
    }
    db.prepare("DELETE FROM item WHERE kind = 'reminder' AND parent = ?").run(id)
    db.prepare("DELETE FROM item WHERE kind = 'maintenance' AND id = ?").run(id)
  })
}

export function deleteReminder(id: string) {
  transaction(() => { db.prepare("DELETE FROM item WHERE kind = 'reminder' AND id = ?").run(id) })
}

export function deleteDocument(id: string) {
  transaction(() => { db.prepare("DELETE FROM item WHERE kind = 'document' AND id = ?").run(id) })
}

export function clear() {
  transaction(() => { db.prepare('DELETE FROM item').run() })
}

// --- backup --------------------------------------------------------------------------------------

export class BackupError extends Error {}

const dataUrl = (mime: string, bytes: Uint8Array) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`

function decodeDataUrl(value: string): Uint8Array {
  if (!value.startsWith('data:') || !value.includes(',')) throw new BackupError('File nel backup non valido')
  return Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
}

/** GarageRepository.exportBackup(): the same file, with photos and documents inside. */
export function exportBackup(): string {
  let installationId = getMeta('installationId')
  if (!installationId) {
    installationId = uuid()
    setMeta('installationId', installationId)
  }
  const vehicleRows = rows('vehicle').map((r) => ({ json: backupDefaults.vehicle(JSON.parse(r.payload)), photo: r.binary }))
    .sort((a, b) => compare(a.json.name.toLowerCase(), b.json.name.toLowerCase()))
  const documentRows = rows('document').map((r) => ({ json: backupDefaults.document(JSON.parse(r.payload), r.binary?.length ?? 0), data: r.binary ?? new Uint8Array() }))
    .sort((a, b) => compare(b.json.addedAt, a.json.addedAt))
  const data = {
    vehicles: vehicleRows.map(({ json, photo }) => ({ ...vehicleJson(json), ...(photo && photo.length ? { photo: dataUrl('image/jpeg', photo) } : {}) })),
    maintenances: maintenances().map(maintenanceJson),
    reminders: reminders().map(reminderJson),
    documents: documentRows.map(({ json, data: bytes }) => ({ ...documentJson(json), data: dataUrl(json.mimeType, bytes) })),
  }
  return JSON.stringify({ product: 'Garage', formatVersion: 1, exportedAt: now(), installationId, data }, null, 2)
}

/** GarageRepository.importBackup(): validates everything first, then replaces all the data in one transaction. */
export function importBackup(text: string) {
  let root: Record<string, unknown>
  try {
    root = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new BackupError('File non leggibile')
  }
  if (!['Garage', 'Dueffe Garage'].includes(String(root.product ?? '')) || Number(root.formatVersion) !== 1) {
    throw new BackupError('Formato backup non supportato')
  }
  const data = root.data as Record<string, unknown> | undefined
  const array = (key: string) => {
    const value = data?.[key]
    if (!Array.isArray(value)) throw new BackupError(`Sezione ${key} mancante`)
    return value as Record<string, unknown>[]
  }
  const vehicleList = array('vehicles').map((j) => ({
    vehicle: backupDefaults.vehicle(j),
    photo: typeof j.photo === 'string' && j.photo !== '' ? decodeDataUrl(j.photo) : null,
  }))
  const maintenanceList = array('maintenances').map(backupDefaults.maintenance)
  const reminderList = array('reminders').map(backupDefaults.reminder)
  const documentList = array('documents').map((j) => {
    if (typeof j.data !== 'string') throw new BackupError('File nel backup non valido')
    const bytes = decodeDataUrl(j.data)
    return { document: backupDefaults.document(j, bytes.length), bytes }
  })
  const distinct = (ids: string[]) => new Set(ids).size === ids.length
  const vehicleIds = new Set(vehicleList.map((v) => v.vehicle.id))
  if (!vehicleList.every(({ vehicle: v }) => v.id.trim() && v.name.trim() && v.make.trim() && v.plate.trim()) || !distinct(vehicleList.map((v) => v.vehicle.id))) {
    throw new BackupError('Auto non valide o duplicate')
  }
  if (!maintenanceList.every((m) => m.id.trim() && vehicleIds.has(m.vehicleId)) || !distinct(maintenanceList.map((m) => m.id))) {
    throw new BackupError('Manutenzioni non valide')
  }
  const maintenanceIds = new Set(maintenanceList.map((m) => m.id))
  if (!reminderList.every((r) => r.id.trim() && maintenanceIds.has(r.maintenanceId)) || !distinct(reminderList.map((r) => r.id))) {
    throw new BackupError('Promemoria non validi')
  }
  const maintenanceVehicles = new Map(maintenanceList.map((m) => [m.id, m.vehicleId]))
  if (!documentList.every(({ document: d, bytes }) => d.id.trim() && d.name.trim() && vehicleIds.has(d.vehicleId) && bytes.length > 0 &&
    (d.maintenanceId == null || maintenanceVehicles.get(d.maintenanceId) === d.vehicleId)) || !distinct(documentList.map((d) => d.document.id))) {
    throw new BackupError('Documenti non validi')
  }
  transaction(() => {
    db.prepare('DELETE FROM item').run()
    for (const { vehicle, photo } of vehicleList) put('vehicle', vehicle.id, null, vehicleJson(vehicle), photo)
    for (const m of maintenanceList) put('maintenance', m.id, m.vehicleId, maintenanceJson(m))
    for (const r of reminderList) put('reminder', r.id, r.maintenanceId, reminderJson(r))
    for (const { document, bytes } of documentList) put('document', document.id, document.vehicleId, documentJson(document), bytes)
  })
}
