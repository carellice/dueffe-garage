import { useSyncExternalStore } from 'react'
import { getStore } from './store.ts'

// "Proteggi Garage": the native app locks on ON_STOP. On the web, the photo and file pickers also
// hide the page, so it locks only after 30 seconds away.

const AWAY_MS = 30_000
let locked = false
let hiddenAt = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const useLocked = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => locked)

export function lockNow() {
  locked = true
  emit()
}

export function unlock() {
  locked = false
  emit()
}

/** When the app opens with protection on. */
export function lockIfProtected() {
  if (getStore().settings.protection && getStore().settings.pinHash) lockNow()
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now()
  else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) lockIfProtected()
})
