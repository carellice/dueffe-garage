import { useEffect, useSyncExternalStore } from 'react'

// The destinations of GarageApp (MainActivity.kt) as a back stack wired to the browser history,
// so the Android back gesture and the browser back button do what BackHandler did.

export type Route =
  | 'garage' | 'scadenze' | 'impostazioni'
  | 'detail' | 'sections'
  | 'maintenance-detail' | 'reminder-detail' | 'document-detail'
  | 'vehicle-editor' | 'maintenance-editor' | 'document-editor'

export type Params = { vehicleId?: string; itemId?: string; isNew?: boolean }

export type Entry = { key: number; route: Route; params: Params }

export const tabs: Route[] = ['garage', 'scadenze', 'impostazioni']

/** The depth map of the transitionSpec: going to a lower depth is "going back". */
export const depth: Record<Route, number> = {
  garage: 0, scadenze: 0, impostazioni: 0, detail: 1, sections: 2,
  'maintenance-detail': 3, 'reminder-detail': 3, 'document-detail': 3,
  'vehicle-editor': 4, 'maintenance-editor': 4, 'document-editor': 4,
}

let nextKey = 1
let stack: Entry[] = [{ key: nextKey++, route: 'garage', params: {} }]
let snapshot = { stack }
const listeners = new Set<() => void>()
const backHandlers: (() => boolean)[] = []
/** Set while the app itself goes back (closing a screen), so dialogs' back handlers don't take it. */
let programmatic = false
/** Steps still to pop with history.go, before a replacement is pushed. */
let pending: (() => void) | null = null

function emit() {
  snapshot = { stack }
  listeners.forEach((l) => l())
}

export function useNav() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}

export const top = () => stack[stack.length - 1]
export const rootTab = () => stack[0].route === 'garage' && stack[1] && tabs.includes(stack[1].route) ? stack[1].route : 'garage'

history.replaceState({ depth: 0 }, '')

window.addEventListener('popstate', (event) => {
  const target = (event.state as { depth?: number } | null)?.depth ?? 0
  const fromApp = programmatic
  programmatic = false
  if (pending) {
    const next = pending
    pending = null
    stack = stack.slice(0, target + 1)
    next()
    return
  }
  if (target >= stack.length - 1) return
  // A dialog or a screen can take the back gesture for itself (BackHandler).
  if (!fromApp) {
    for (let i = backHandlers.length - 1; i >= 0; i--) {
      if (backHandlers[i]()) {
        history.pushState({ depth: stack.length - 1 }, '')
        return
      }
    }
  }
  stack = stack.slice(0, target + 1)
  emit()
})

export function navigate(route: Route, params: Params = {}) {
  stack = [...stack, { key: nextKey++, route, params }]
  history.pushState({ depth: stack.length - 1 }, '')
  emit()
}

export function back() {
  if (stack.length > 1) {
    programmatic = true
    history.back()
  }
}

/** Goes back to [index] in the stack, then runs [then] (to push a replacement). */
function popTo(index: number, then: () => void = emit) {
  const steps = stack.length - 1 - index
  if (steps <= 0) {
    then()
    return
  }
  programmatic = true
  pending = then
  history.go(-steps)
}

/** Replaces the screen on top, like closing an editor that opens the saved vehicle. */
export function replaceTop(route: Route, params: Params = {}) {
  popTo(stack.length - 2, () => navigate(route, params))
}

/** Back to the tab the user is on (after deleting a vehicle). */
export function backToRoot() {
  const index = stack[1] && tabs.includes(stack[1].route) ? 1 : 0
  popTo(index)
}

/** FloatingGarageNavigation: every tab sits right above Garage. */
export function selectTab(target: Route) {
  if (target === 'garage') {
    popTo(0)
    return
  }
  if (stack.length === 2 && stack[1].route === target) return
  if (stack.length === 1) {
    navigate(target)
    return
  }
  popTo(1, () => {
    stack = [stack[0], { key: nextKey++, route: target, params: {} }]
    history.replaceState({ depth: 1 }, '')
    emit()
  })
}

/** BackHandler: [handler] returns true when it consumed the back gesture. */
export function useBackHandler(enabled: boolean, handler: () => void) {
  useEffect(() => {
    if (!enabled) return
    const h = () => {
      handler()
      return true
    }
    backHandlers.push(h)
    return () => {
      const i = backHandlers.indexOf(h)
      if (i >= 0) backHandlers.splice(i, 1)
    }
  }, [enabled, handler])
}

/** Opens a deep link such as "/?route=scadenze" from a notification or a manifest shortcut. */
export function openDeepLink(url: string) {
  const route = new URL(url, location.origin).searchParams.get('route') as Route | null
  if (route && tabs.includes(route)) selectTab(route)
}
