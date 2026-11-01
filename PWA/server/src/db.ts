import { AsyncLocalStorage } from 'node:async_hooks'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  documentFrom, documentJson, maintenanceFrom, maintenanceJson, now, reminderFrom, reminderJson, vehicleFrom, vehicleJson,
  type GarageDocument, type GarageState, type Maintenance, type Reminder, type Vehicle,
} from '../../shared/model.ts'

// Data of one account. Every account has its own SQLite file under data/users/<id>/, picked per
// request with withUser(): the functions below never take a user id, they just read and write
// "the current account".

export const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

export class DataError extends Error {}

// The same table as the Android app (GarageRepository.onCreate): one row per vehicle, maintenance,
// reminder and document, the fields as JSON in payload, the photo or file in binary.
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

function touch() {
  setMeta('revision', String(revision() + 1))
}

export function transaction<T>(work: () => T): T {
  db.exec('BEGIN')
  try {
    const result = work()
    db.exec('COMMIT')
    touch()
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/** GarageRepository.changed(): the "last change" the backup reminder compares with the last export. */
function changed() {
  setMeta('lastChange', now())
}

export function leadDays(): number {
  const value = Number(getMeta('leadDays') ?? '7')
  return Number.isFinite(value) ? Math.min(30, Math.max(1, Math.trunc(value))) : 7
}

export function setLeadDays(value: number) {
  setMeta('leadDays', String(Math.min(30, Math.max(1, Math.trunc(value)))))
  touch()
}

// --- rows ------------------------------------------------------------------------------------

type Row = { payload: string; binary: Uint8Array | null; size: number | null }

function put(kind: string, id: string, parent: string | null, json: object, bytes?: Uint8Array | null) {
  db.prepare('INSERT OR REPLACE INTO item (kind, id, parent, payload, binary) VALUES (?, ?, ?, ?, ?)')
    .run(kind, id, parent, JSON.stringify(json), bytes ?? null)
}

function rows(kind: string): { json: Record<string, unknown>; size: number; hasBinary: boolean }[] {
  return (db.prepare('SELECT payload, NULL AS binary, length(binary) AS size FROM item WHERE kind = ?').all(kind) as Row[])
    .map((r) => ({ json: JSON.parse(r.payload), size: r.size ?? 0, hasBinary: r.size != null && r.size > 0 }))
}

function binaryOf(kind: string, id: string): Uint8Array | null {
  const row = db.prepare('SELECT binary FROM item WHERE kind = ? AND id = ?').get(kind, id) as { binary: Uint8Array | null } | undefined
  return row?.binary ?? null
}

const byName = (a: Vehicle, b: Vehicle) => {
  const x = a.name.toLowerCase(), y = b.name.toLowerCase()
  return x < y ? -1 : x > y ? 1 : 0
}
const descending = <T>(key: (t: T) => string) => (a: T, b: T) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0)

/** GarageRepository.snapshot(), without the files: those come from /api/files. */
export function state(): GarageState {
  return {
    vehicles: rows('vehicle').map((r) => ({ ...vehicleFrom(r.json), hasPhoto: r.hasBinary, photoSize: r.size })).sort(byName),
    maintenances: rows('maintenance').map((r) => maintenanceFrom(r.json)).sort(descending((m) => m.date)),
    reminders: rows('reminder').map((r) => reminderFrom(r.json)),
    documents: rows('document').map((r) => documentFrom(r.json, r.size)).sort(descending((d) => d.addedAt)),
    lastChange: getMeta('lastChange') ?? '',
    lastExport: getMeta('lastExport') ?? '',
    leadDays: leadDays(),
  }
}

/** The photo of a vehicle or the file of a document. */
export function file(kind: 'vehicle' | 'document', id: string): { bytes: Uint8Array; mime: string; name: string } | null {
  const bytes = binaryOf(kind, id)
  if (!bytes || bytes.length === 0) return null
  if (kind === 'vehicle') return { bytes, mime: sniffImage(bytes) ?? 'image/jpeg', name: `${id}.jpg` }
  const row = rows('document').map((r) => documentFrom(r.json)).find((d) => d.id === id)
  return { bytes, mime: row?.mimeType || 'application/octet-stream', name: row?.name ?? id }
}

function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png'
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return 'image/webp'
  return null
}

const exists = (kind: string, id: string) => db.prepare('SELECT 1 FROM item WHERE kind = ? AND id = ?').get(kind, id) != null

function required(value: string, message: string) {
  if (!value.trim()) throw new DataError(message)
}

/**
 * save(vehicle). [photo]: new bytes, null to remove it, undefined to keep the current one
 * (the native editor always sends the existing photo back; the web sends only what changed).
 */
export function saveVehicle(input: Record<string, unknown>, photo: Uint8Array | null | undefined): Vehicle {
  const v = vehicleFrom(input)
  required(v.id, 'Auto non valida')
  if (!v.name.trim() || !v.make.trim() || !v.plate.trim() || v.mileage < 0) throw new DataError('Controlla nome, marca, targa, anno e chilometri')
  transaction(() => {
    const bytes = photo === undefined ? binaryOf('vehicle', v.id) : photo
    put('vehicle', v.id, null, vehicleJson(v), bytes)
    changed()
  })
  return v
}

/** save(maintenance, reminder): replaces the reminder and raises the vehicle mileage. */
export function saveMaintenance(input: Record<string, unknown>, reminderInput: Record<string, unknown> | null): Maintenance {
  const m = maintenanceFrom(input)
  required(m.id, 'Intervento non valido')
  if (!exists('vehicle', m.vehicleId)) throw new DataError('Auto non trovata')
  const reminder = reminderInput ? { ...reminderFrom(reminderInput), maintenanceId: m.id } : null
  if (reminder) required(reminder.id, 'Promemoria non valido')
  transaction(() => {
    put('maintenance', m.id, m.vehicleId, maintenanceJson(m))
    db.prepare("DELETE FROM item WHERE kind = 'reminder' AND parent = ?").run(m.id)
    if (reminder) put('reminder', reminder.id, m.id, reminderJson(reminder))
    const row = rows('vehicle').map((r) => vehicleFrom(r.json)).find((x) => x.id === m.vehicleId)
    if (row && m.mileage > row.mileage) put('vehicle', row.id, null, vehicleJson({ ...row, mileage: m.mileage, updatedAt: now() }), binaryOf('vehicle', row.id))
    changed()
  })
  return m
}

/** save(document). [bytes] undefined keeps the current file (rename, relink). */
export function saveDocument(input: Record<string, unknown>, bytes: Uint8Array | undefined): GarageDocument {
  const current = binaryOf('document', String(input.id ?? ''))
  const data = bytes ?? current
  if (!data || data.length === 0) throw new DataError('Scegli un file e inserisci il nome')
  const d = documentFrom(input, data.length)
  required(d.id, 'Documento non valido')
  required(d.name, 'Scegli un file e inserisci il nome')
  if (!exists('vehicle', d.vehicleId)) throw new DataError('Auto non trovata')
  if (d.maintenanceId != null) {
    const linked = rows('maintenance').map((r) => maintenanceFrom(r.json)).find((m) => m.id === d.maintenanceId)
    if (!linked || linked.vehicleId !== d.vehicleId) throw new DataError('Intervento non disponibile')
  }
  const saved = { ...d, size: data.length }
  transaction(() => {
    put('document', saved.id, saved.vehicleId, documentJson(saved), data)
    changed()
  })
  return saved
}

/** deleteVehicle(): with its maintenances, reminders and documents. */
export function deleteVehicle(id: string) {
  transaction(() => {
    const maintenanceIds = rows('maintenance').map((r) => maintenanceFrom(r.json)).filter((m) => m.vehicleId === id).map((m) => m.id)
    for (const m of maintenanceIds) db.prepare("DELETE FROM item WHERE kind = 'reminder' AND parent = ?").run(m)
    for (const kind of ['maintenance', 'document']) db.prepare('DELETE FROM item WHERE kind = ? AND parent = ?').run(kind, id)
    db.prepare("DELETE FROM item WHERE kind = 'vehicle' AND id = ?").run(id)
    changed()
  })
}

/** deleteMaintenance(): its reminder goes, its documents stay unlinked. */
export function deleteMaintenance(id: string) {
  transaction(() => {
    const linked = (db.prepare("SELECT payload, binary FROM item WHERE kind = 'document'").all() as Row[])
      .map((r) => ({ doc: documentFrom(JSON.parse(r.payload)), binary: r.binary }))
      .filter((x) => x.doc.maintenanceId === id)
    for (const { doc, binary } of linked) {
      const unlinked = { ...doc, maintenanceId: null, updatedAt: now() }
      put('document', unlinked.id, unlinked.vehicleId, documentJson(unlinked), binary)
    }
    db.prepare("DELETE FROM item WHERE kind = 'reminder' AND parent = ?").run(id)
    db.prepare("DELETE FROM item WHERE kind = 'maintenance' AND id = ?").run(id)
    changed()
  })
}

export function deleteReminder(id: string) {
  transaction(() => {
    db.prepare("DELETE FROM item WHERE kind = 'reminder' AND id = ?").run(id)
    changed()
  })
}

export function deleteDocument(id: string) {
  transaction(() => {
    db.prepare("DELETE FROM item WHERE kind = 'document' AND id = ?").run(id)
    changed()
  })
}

/** clear(): "Elimina tutti i dati". */
export function clear() {
  transaction(() => {
    db.prepare('DELETE FROM item').run()
    changed()
  })
}

// --- backup: the same JSON file as the Android app ------------------------------------------

const dataUrl = (mime: string, bytes: Uint8Array) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`

export function decodeDataUrl(value: string): Uint8Array {
  if (!value.startsWith('data:') || !value.includes(',')) throw new DataError('File nel backup non valido')
  return new Uint8Array(Buffer.from(value.slice(value.indexOf(',') + 1), 'base64'))
}

/** exportBackup() */
export function exportBackup(): string {
  const all = (kind: string) => db.prepare('SELECT payload, binary FROM item WHERE kind = ?').all(kind) as Row[]
  const vehicles = all('vehicle').map((r) => ({ v: vehicleFrom(JSON.parse(r.payload)), binary: r.binary })).sort((a, b) => byName(a.v, b.v))
  const maintenances = all('maintenance').map((r) => maintenanceFrom(JSON.parse(r.payload))).sort(descending((m) => m.date))
  const reminders = all('reminder').map((r) => reminderFrom(JSON.parse(r.payload)))
  const documents = all('document').map((r) => ({ d: documentFrom(JSON.parse(r.payload), r.binary?.length ?? 0), binary: r.binary ?? new Uint8Array() }))
    .sort((a, b) => descending((x: GarageDocument) => x.addedAt)(a.d, b.d))
  let installationId = getMeta('installationId')
  if (!installationId) {
    installationId = randomUUID()
    setMeta('installationId', installationId)
  }
  const data = {
    vehicles: vehicles.map(({ v, binary }) => ({ ...vehicleJson(v), ...(binary && binary.length ? { photo: dataUrl('image/jpeg', binary) } : {}) })),
    maintenances: maintenances.map(maintenanceJson),
    reminders: reminders.map(reminderJson),
    documents: documents.map(({ d, binary }) => ({ ...documentJson(d), data: dataUrl(d.mimeType, binary) })),
  }
  setMeta('lastExport', now())
  touch()
  return JSON.stringify({ product: 'Garage', formatVersion: 1, exportedAt: now(), installationId, data }, null, 2)
}

/** importBackup(): the same checks as the Android app, then everything is replaced at once. */
export function importBackup(text: string) {
  let root: Record<string, unknown>
  try { root = JSON.parse(text) } catch { throw new DataError('Backup non leggibile') }
  if (!['Garage', 'Dueffe Garage'].includes(String(root.product ?? '')) || Number(root.formatVersion) !== 1) throw new DataError('Formato backup non supportato')
  const data = root.data as Record<string, unknown> | undefined
  const array = (key: string) => {
    const value = data?.[key]
    if (!Array.isArray(value)) throw new DataError('Backup non leggibile')
    return value as Record<string, unknown>[]
  }
  const vehicles = array('vehicles').map((j) => ({ v: vehicleFrom(j), photo: typeof j.photo === 'string' && j.photo ? decodeDataUrl(j.photo) : null }))
  const maintenances = array('maintenances').map(maintenanceFrom)
  const reminders: Reminder[] = array('reminders').map(reminderFrom)
  const documents = array('documents').map((j) => {
    const bytes = decodeDataUrl(String(j.data ?? ''))
    return { d: documentFrom(j, bytes.length), bytes }
  })
  const unique = (ids: string[]) => new Set(ids).size === ids.length
  if (!vehicles.every(({ v }) => v.id.trim() && v.name.trim() && v.make.trim() && v.plate.trim()) || !unique(vehicles.map(({ v }) => v.id))) throw new DataError('Auto non valide o duplicate')
  const vehicleIds = new Set(vehicles.map(({ v }) => v.id))
  if (!maintenances.every((m) => m.id.trim() && vehicleIds.has(m.vehicleId)) || !unique(maintenances.map((m) => m.id))) throw new DataError('Manutenzioni non valide')
  const maintenanceIds = new Set(maintenances.map((m) => m.id))
  if (!reminders.every((r) => r.id.trim() && maintenanceIds.has(r.maintenanceId)) || !unique(reminders.map((r) => r.id))) throw new DataError('Promemoria non validi')
  const maintenanceVehicles = new Map(maintenances.map((m) => [m.id, m.vehicleId]))
  if (!documents.every(({ d, bytes }) => d.id.trim() && d.name.trim() && vehicleIds.has(d.vehicleId) && bytes.length > 0 &&
    (d.maintenanceId == null || maintenanceVehicles.get(d.maintenanceId) === d.vehicleId)) || !unique(documents.map(({ d }) => d.id))) throw new DataError('Documenti non validi')
  transaction(() => {
    db.prepare('DELETE FROM item').run()
    for (const { v, photo } of vehicles) put('vehicle', v.id, null, vehicleJson(v), photo)
    for (const m of maintenances) put('maintenance', m.id, m.vehicleId, maintenanceJson(m))
    for (const r of reminders) put('reminder', r.id, r.maintenanceId, reminderJson(r))
    for (const { d, bytes } of documents) put('document', d.id, d.vehicleId, documentJson(d), bytes)
    changed()
  })
  return { vehicles: vehicles.length, maintenances: maintenances.length, documents: documents.length }
}
