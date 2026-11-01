import { useSyncExternalStore } from 'react'
import { api } from './api.ts'
import type { GarageDocument, GarageState, Maintenance, Reminder, Vehicle } from '../../../shared/model.ts'
import { documentJson, maintenanceJson, reminderJson, vehicleJson } from '../../../shared/model.ts'

// One store for the whole app, read with useStore(selector). Data comes from the server
// (GET /api/state) and is cached per account on the device, so the app opens instantly and
// works offline with the last data seen.

export type AppState = GarageState

// --- device settings: per phone and per account, like the native DataStore / UserDefaults ----

export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK'

export type Settings = {
  theme: ThemeMode
  /** WebAuthn credential used as the fingerprint lock ("Biometria"), null when off. */
  lockCredential: string | null
  remindersEnabled: boolean
  onboarded: boolean
  /** "Proteggi Garage": ask the PIN when the app opens. */
  protection: boolean
  /** PBKDF2-SHA256 of the PIN, base64, with its salt, like GarageRepository.setPin. */
  pinHash: string | null
  pinSalt: string | null
  pinLength: number
}

// Every account keeps its own settings and data cache, so a shared tablet can switch between them.
const LAST_USER_KEY = 'garage.user'
const settingsKey = (user: string) => `garage.settings.${user.toLowerCase()}`
const cacheKey = (user: string) => `garage.cache.${user.toLowerCase()}`

function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function write(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch { /* too big or private mode */ }
}

let currentUser = read(LAST_USER_KEY) ?? ''

function loadSettings(user: string): Settings {
  const defaults: Settings = { theme: 'SYSTEM', lockCredential: null, remindersEnabled: false, onboarded: false, protection: false, pinHash: null, pinSalt: null, pinLength: 0 }
  try {
    return { ...defaults, ...JSON.parse(read(settingsKey(user)) ?? '{}') }
  } catch {
    return defaults
  }
}

// --- store -----------------------------------------------------------------------------------

type Store = {
  data: AppState | null
  revision: number
  settings: Settings
  loadError: string | null
}

function cachedData(user: string): { data: AppState; revision: number } | null {
  try {
    const raw = read(cacheKey(user))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

let store: Store = {
  data: currentUser ? cachedData(currentUser)?.data ?? null : null,
  revision: -1,
  settings: loadSettings(currentUser),
  loadError: null,
}
const listeners = new Set<() => void>()

function set(patch: Partial<Store>) {
  store = { ...store, ...patch }
  listeners.forEach((l) => l())
}

export function useStore<T>(selector: (s: Store) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(store),
  )
}

export const getStore = () => store

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...store.settings, ...patch }
  write(settingsKey(currentUser), JSON.stringify(settings))
  set({ settings })
}

/** Switches to the settings and data of [user], after logging in or when the app opens. */
export function setUser(user: string) {
  if (user.toLowerCase() === currentUser.toLowerCase() && store.data) {
    currentUser = user
    write(LAST_USER_KEY, user)
    return
  }
  currentUser = user
  write(LAST_USER_KEY, user)
  set({ data: cachedData(user)?.data ?? null, revision: -1, settings: loadSettings(user), loadError: null })
}

/** Forgets the data of the account that just left this device (deleted account). */
export function forgetUser(user: string) {
  write(settingsKey(user), null)
  write(cacheKey(user), null)
}

export const loggedUser = () => currentUser

// --- data ------------------------------------------------------------------------------------

type StateResponse = ({ unchanged: true } | AppState) & { revision: number }

let loading: Promise<void> | null = null

/** Reloads the data when it changed on the server (another phone, a background job...). */
export function refresh(force = false): Promise<void> {
  if (loading) return loading
  loading = (async () => {
    try {
      const since = force || !store.data ? '' : `?since=${store.revision}`
      const result = await api<StateResponse>(`/api/state${since}`)
      if ('unchanged' in result) return
      const { revision, ...data } = result
      set({ data: data as AppState, revision, loadError: null })
      write(cacheKey(currentUser), JSON.stringify({ data, revision }))
    } catch (e) {
      set({ loadError: (e as Error).message })
    } finally {
      loading = null
    }
  })()
  return loading
}

/** Every write goes to the server, then the data is reloaded. */
export async function mutate<T>(work: () => Promise<T>): Promise<T> {
  const result = await work()
  await refresh(true)
  return result
}

const without = <T extends { id: string }>(list: T[], id: string) => list.filter((x) => x.id !== id)

/** Optimistic local change while the server confirms, like the instant refresh() of the phone. */
function local(change: (data: AppState) => AppState) {
  if (store.data) set({ data: change(store.data) })
}

/** One action per GarageRepository write. */
export const actions = {
  /** photo: a data URL for a new photo, undefined to keep the current one. */
  saveVehicle: (vehicle: Vehicle, photo?: string) =>
    mutate(() => api<Vehicle>('/api/vehicles', { method: 'POST', json: { vehicle: vehicleJson(vehicle), photo } })),
  saveMaintenance: (maintenance: Maintenance, reminder: Reminder | null) =>
    mutate(() => api<Maintenance>('/api/maintenances', { method: 'POST', json: { maintenance: maintenanceJson(maintenance), reminder: reminder && reminderJson(reminder) } })),
  /** data: a data URL for a new file, undefined to keep the current one. */
  saveDocument: (document: GarageDocument, data?: string) =>
    mutate(() => api<GarageDocument>('/api/documents', { method: 'POST', json: { document: documentJson(document), data } })),
  deleteVehicle: (id: string) => {
    local((d) => {
      const gone = new Set(d.maintenances.filter((m) => m.vehicleId === id).map((m) => m.id))
      return { ...d, vehicles: without(d.vehicles, id), maintenances: d.maintenances.filter((m) => m.vehicleId !== id),
        reminders: d.reminders.filter((r) => !gone.has(r.maintenanceId)), documents: d.documents.filter((x) => x.vehicleId !== id) }
    })
    return mutate(() => api('/api/vehicles/' + encodeURIComponent(id), { method: 'DELETE' }))
  },
  deleteMaintenance: (id: string) => {
    local((d) => ({ ...d, maintenances: without(d.maintenances, id), reminders: d.reminders.filter((r) => r.maintenanceId !== id),
      documents: d.documents.map((x) => (x.maintenanceId === id ? { ...x, maintenanceId: null } : x)) }))
    return mutate(() => api('/api/maintenances/' + encodeURIComponent(id), { method: 'DELETE' }))
  },
  deleteReminder: (id: string) => {
    local((d) => ({ ...d, reminders: without(d.reminders, id) }))
    return mutate(() => api('/api/reminders/' + encodeURIComponent(id), { method: 'DELETE' }))
  },
  deleteDocument: (id: string) => {
    local((d) => ({ ...d, documents: without(d.documents, id) }))
    return mutate(() => api('/api/documents/' + encodeURIComponent(id), { method: 'DELETE' }))
  },
  clear: () => {
    local((d) => ({ ...d, vehicles: [], maintenances: [], reminders: [], documents: [] }))
    return mutate(() => api('/api/clear', { method: 'POST' }))
  },
  setLeadDays: (leadDays: number) => {
    local((d) => ({ ...d, leadDays }))
    return mutate(() => api('/api/settings', { method: 'POST', json: { leadDays } }))
  },
  importBackup: (text: string) => mutate(() => api<{ vehicles: number }>('/api/backup', { method: 'POST', body: text, headers: { 'Content-Type': 'application/json' } })),
}

/** The address of a vehicle photo or a document file; updatedAt makes a changed file a new URL. */
export const fileUrl = (kind: 'vehicle' | 'document', id: string, updatedAt: string) =>
  `/api/files/${kind}/${encodeURIComponent(id)}?v=${encodeURIComponent(updatedAt || '0')}`
// Keep in step with the other devices.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh() })
  setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 30_000)
}
