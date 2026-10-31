import { useSyncExternalStore } from 'react'
import { api } from './api.ts'
import type { GarageDocument, GarageState, Maintenance, Reminder, Vehicle } from '../../../shared/model.ts'

// One store for the whole app, read with useStore(selector). Data comes from the server
// (GET /api/state) and is cached per account on the device, so the app opens instantly and
// works offline with the last data seen.

export type AppState = GarageState

// --- device settings: per phone and per account, like garage_preferences on Android -------------

export type ThemeMode = 'system' | 'light' | 'dark'

export type Settings = {
  theme: ThemeMode
  onboarded: boolean
  /** "Proteggi Garage": PIN asked when the app opens. */
  protection: boolean
  pinSalt: string | null
  pinHash: string | null
  pinLength: number
  /** WebAuthn credential used as "Biometria", null when off. */
  lockCredential: string | null
  remindersEnabled: boolean
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

const defaults: Settings = {
  theme: 'system', onboarded: false, protection: false, pinSalt: null, pinHash: null, pinLength: 0,
  lockCredential: null, remindersEnabled: false,
}

function loadSettings(user: string): Settings {
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
  /** The selected section of the vehicle diary (hoisted like `tab` in GarageApp). */
  tab: string
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
  tab: 'Interventi',
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

export const setTab = (tab: string) => set({ tab })

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
let current: object | null = null

/** Reloads the data when it changed on the server (another phone, a background job...). */
export function refresh(force = false): Promise<void> {
  if (loading && !force) return loading
  const token = {}
  current = token
  const run = (async () => {
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
      if (current === token) loading = null
    }
  })()
  loading = run
  return run
}

/** Every write goes to the server, then the data is reloaded. */
export async function mutate<T>(work: () => Promise<T>): Promise<T> {
  const result = await work()
  await refresh(true)
  return result
}

function optimistic(patch: (data: AppState) => AppState) {
  if (store.data) set({ data: patch(store.data) })
}

/** GarageRepository writes, one per method. */
export const actions = {
  saveVehicle: (vehicle: Omit<Vehicle, 'hasPhoto'>, photo?: string | null) =>
    mutate(() => api('/api/vehicles', { method: 'POST', json: { vehicle, photo } })),
  saveMaintenance: (maintenance: Maintenance, reminder: Reminder | null) =>
    mutate(() => api('/api/maintenances', { method: 'POST', json: { maintenance, reminder } })),
  saveDocument: (document: GarageDocument, data?: string) =>
    mutate(() => api('/api/documents', { method: 'POST', json: { document, data } })),
  deleteVehicle: (id: string) => {
    optimistic((d) => {
      const gone = new Set(d.maintenances.filter((m) => m.vehicleId === id).map((m) => m.id))
      return {
        ...d, vehicles: d.vehicles.filter((v) => v.id !== id), maintenances: d.maintenances.filter((m) => m.vehicleId !== id),
        reminders: d.reminders.filter((r) => !gone.has(r.maintenanceId)), documents: d.documents.filter((doc) => doc.vehicleId !== id),
      }
    })
    return mutate(() => api(`/api/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  },
  deleteMaintenance: (id: string) => {
    optimistic((d) => ({
      ...d, maintenances: d.maintenances.filter((m) => m.id !== id), reminders: d.reminders.filter((r) => r.maintenanceId !== id),
      documents: d.documents.map((doc) => (doc.maintenanceId === id ? { ...doc, maintenanceId: null } : doc)),
    }))
    return mutate(() => api(`/api/maintenances/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  },
  deleteReminder: (id: string) => {
    optimistic((d) => ({ ...d, reminders: d.reminders.filter((r) => r.id !== id) }))
    return mutate(() => api(`/api/reminders/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  },
  deleteDocument: (id: string) => {
    optimistic((d) => ({ ...d, documents: d.documents.filter((doc) => doc.id !== id) }))
    return mutate(() => api(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  },
  clear: () => {
    optimistic((d) => ({ ...d, vehicles: [], maintenances: [], reminders: [], documents: [] }))
    return mutate(() => api('/api/clear', { method: 'POST' }))
  },
  setLeadDays: (leadDays: number) => {
    optimistic((d) => ({ ...d, meta: { ...d.meta, leadDays } }))
    return mutate(() => api('/api/settings', { method: 'POST', json: { leadDays } }))
  },
}

// Keep in step with the other devices.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && currentUser) refresh() })
  setInterval(() => { if (document.visibilityState === 'visible' && currentUser) refresh() }, 30_000)
}
