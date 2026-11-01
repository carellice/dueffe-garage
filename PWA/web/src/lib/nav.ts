import { useEffect, useSyncExternalStore } from 'react'

// The destinations of MainActivity.kt (GarageDestination) as a small back stack wired to the
// browser history, so the Android back gesture and the browser back button go back like in the app.

export type Route =
  | 'garage' | 'scadenze' | 'impostazioni'
  | 'detail' | 'sections'
  | 'maintenance-detail' | 'reminder-detail' | 'document-detail'
  | 'vehicle-editor' | 'maintenance-editor' | 'document-editor'

export type Params = { vehicleId?: string; id?: string; from?: string }

export type Entry = { key: number; route: Route; params: Params }

/** The bottom bar tabs: Garage is the root, every other tab sits right above it. */
export const topLevel: Route[] = ['garage', 'scadenze', 'impostazioni']

/** Depth used by the native transitionSpec to tell "forward" from "back". */
export const depth: Record<Route, number> = {
  garage: 0, scadenze: 0, impostazioni: 0, detail: 1, sections: 2,
  'maintenance-detail': 3, 'reminder-detail': 3, 'document-detail': 3,
  'vehicle-editor': 4, 'maintenance-editor': 4, 'document-editor': 4,
}

/** Screens without the floating bottom bar (MainActivity showNavigation). */
export const noBottomBar: Route[] = ['vehicle-editor', 'maintenance-editor', 'document-editor', 'maintenance-detail', 'reminder-detail', 'document-detail']

let nextKey = 1
let stack: Entry[] = [{ key: nextKey++, route: 'garage', params: {} }]
let snapshot = { stack, popping: false }
const listeners = new Set<() => void>()
const backHandlers: (() => boolean)[] = []
/** Set while the app itself goes back (closing a screen), so BackHandlers don't take it. */
let programmatic = false

function emit(popping: boolean) {
  snapshot = { stack, popping }
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
export const currentStack = () => stack

history.replaceState({ depth: 0 }, '')

window.addEventListener('popstate', (event) => {
  const depthState = (event.state as { depth?: number } | null)?.depth ?? 0
  if (depthState >= stack.length - 1) return
  const fromApp = programmatic
  programmatic = false
  if (afterPop) {
    const run = afterPop
    afterPop = null
    stack = stack.slice(0, depthState + 1)
    run()
    return
  }
  // A dialog or menu can take the back gesture for itself (BackHandler).
  for (let i = fromApp ? -1 : backHandlers.length - 1; i >= 0; i--) {
    if (backHandlers[i]()) {
      history.pushState({ depth: stack.length - 1 }, '')
      return
    }
  }
  stack = stack.slice(0, depthState + 1)
  emit(true)
})

export function navigate(route: Route, params: Params = {}) {
  stack = [...stack, { key: nextKey++, route, params }]
  history.pushState({ depth: stack.length - 1 }, '')
  emit(false)
}

/** Replaces the screen on top (the new vehicle editor becomes the vehicle it saved). */
export function replace(route: Route, params: Params = {}) {
  stack = [...stack.slice(0, -1), { key: nextKey++, route, params }]
  emit(false)
}

export function back(steps = 1) {
  const n = Math.min(steps, stack.length - 1)
  if (n > 0) {
    programmatic = true
    history.go(-n)
  }
}

/** Goes back to the tab under every open screen (after deleting a vehicle). */
export function backToTab() {
  back(stack.length - (stack[1] && topLevel.includes(stack[1].route) ? 2 : 1))
}

/** Pops while [route] is still on top, so double close requests are harmless. */
export function close(route: Route) {
  if (top().route === route) back()
}

/** Runs after the history went back for a tab switch from deep inside a vehicle. */
let afterPop: (() => void) | null = null

/** The bottom bar: like `selectedId = null; sectionsOpen = false; page = key`. */
export function switchTab(target: Route) {
  const tab = () => {
    stack = [stack[0], { key: nextKey++, route: target, params: {} }]
    history.replaceState({ depth: 1 }, '')
    emit(false)
  }
  if (target === 'garage') {
    if (stack.length > 1) back(stack.length - 1)
    return
  }
  if (stack.length === 1) navigate(target)
  else if (stack.length === 2) {
    if (top().route !== target) tab()
  } else if (stack[1].route === target) back(stack.length - 2)
  else {
    afterPop = tab
    back(stack.length - 2)
  }
}
/** BackHandler: while [enabled], the back gesture calls [handler] instead of leaving the screen. */
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
  if (route && topLevel.includes(route)) switchTab(route)
}
