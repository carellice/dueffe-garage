import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Backdrop } from './components/garage.tsx'
import { ToastHost } from './components/overlays.tsx'
import { TextButton } from './components/ui.tsx'
import { applyTheme, useDark } from './lib/theme.ts'
import { getStore, refresh, setUser, updateSettings, useStore } from './lib/store.ts'
import { api, authEvents } from './lib/api.ts'
import { depth, openDeepLink, useNav, type Entry, type Route } from './lib/nav.ts'
import { heroBox } from './lib/hero.ts'
import { lockIfProtected, useLocked } from './lib/lock.ts'
import { Home } from './screens/Home.tsx'
import { Deadlines } from './screens/Deadlines.tsx'
import { Settings } from './screens/Settings.tsx'
import { VehicleDetail } from './screens/VehicleDetail.tsx'
import { DocumentDetail, MaintenanceDetail, ReminderDetail } from './screens/ItemDetails.tsx'
import { VehicleEditor } from './screens/VehicleEditor.tsx'
import { MaintenanceEditor } from './screens/MaintenanceEditor.tsx'
import { DocumentEditor } from './screens/DocumentEditor.tsx'
import { Onboarding } from './screens/Onboarding.tsx'
import { Lock } from './screens/Lock.tsx'
import { Login } from './screens/Login.tsx'

type Gate = 'checking' | 'login' | 'ready'

export function App() {
  const dark = useDark()
  useLayoutEffect(() => applyTheme(dark), [dark])
  const hasCache = useStore((s) => s.data != null)
  const [gate, setGate] = useState<Gate>(hasCache ? 'ready' : 'checking')
  const [version, setVersion] = useState('')
  const [introAgain, setIntroAgain] = useState(false)
  const onboarded = useStore((s) => s.settings.onboarded)
  const locked = useLocked()

  const enter = (username: string) => {
    setUser(username)
    lockIfProtected()
    setGate('ready')
    refresh(true)
  }

  useEffect(() => {
    api<{ loggedIn: boolean; username: string | null; version: string }>('/api/session')
      .then((s) => {
        setVersion(s.version)
        if (s.loggedIn && s.username) enter(s.username)
        else setGate('login')
      })
      .catch(() => {
        // Offline: open with the data of the last account seen on this device.
        if (getStore().data) { lockIfProtected(); setGate('ready') } else setGate('login')
      })
    const logout = () => setGate('login')
    authEvents.addEventListener('logout', logout)
    openDeepLink(location.href)
    const message = (event: MessageEvent) => { if (event.data?.type === 'open') openDeepLink(event.data.url) }
    navigator.serviceWorker?.addEventListener('message', message)
    return () => {
      authEvents.removeEventListener('logout', logout)
      navigator.serviceWorker?.removeEventListener('message', message)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  let content: ReactNode
  if (gate === 'checking') content = <div className="layer"><Backdrop /></div>
  else if (gate === 'login') content = <Login onLoggedIn={enter} />
  else if (locked) content = <Lock />
  else if (!onboarded || introAgain) content = <Onboarding done={() => { updateSettings({ onboarded: true }); setIntroAgain(false) }} />
  else content = <Main version={version} onOnboarding={() => setIntroAgain(true)} />
  return (
    <div className="app">
      {content}
      <ToastHost />
    </div>
  )
}

function Main({ version, onOnboarding }: { version: string; onOnboarding: () => void }) {
  const data = useStore((s) => s.data)
  const loadError = useStore((s) => s.loadError)
  const { stack } = useNav()
  const top = stack[stack.length - 1]
  if (!data) {
    return (
      <div className="layer">
        <Backdrop />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center', color: 'var(--onSurfaceVariant)' }}>
          {loadError ? <>{loadError}<TextButton onClick={() => refresh(true)}>Riprova</TextButton></> : null}
        </div>
      </div>
    )
  }
  return (
    <Navigator top={top} render={(entry) => <Screen entry={entry} version={version} onOnboarding={onOnboarding} />} />
  )
}

function Screen({ entry, version, onOnboarding }: { entry: Entry; version: string; onOnboarding: () => void }) {
  const p = entry.params
  switch (entry.route) {
    case 'garage': return <Home />
    case 'scadenze': return <Deadlines />
    case 'impostazioni': return <Settings version={version} onOnboarding={onOnboarding} />
    case 'detail': return <VehicleDetail vehicleId={p.vehicleId!} backLabel={p.from} />
    case 'maintenance-detail': return <MaintenanceDetail id={p.id!} />
    case 'reminder-detail': return <ReminderDetail id={p.id!} />
    case 'document-detail': return <DocumentDetail id={p.id!} />
    case 'vehicle-editor': return <VehicleEditor id={p.id} />
    case 'maintenance-editor': return <MaintenanceEditor vehicleId={p.vehicleId!} id={p.id} />
    case 'document-editor': return <DocumentEditor vehicleId={p.vehicleId!} id={p.id} />
  }
}

// --- the AnimatedContent of GarageApp: pages push in from the right, editors rise from the bottom and
// the car page grows out of its photo on the home.

/** The pairs that use the container transform: home <-> car page. */
function heroKey(from: Entry, to: Entry): string | null {
  const pair = (a: Route, b: Route) => (from.route === a && to.route === b) || (from.route === b && to.route === a)
  const deeper = depth[to.route] > depth[from.route] ? to : from
  if (pair('garage', 'detail')) return `vehicle-page-${deeper.params.vehicleId}`
  return null
}

const ease = 'cubic-bezier(0.4, 0, 0.2, 1)'

type Layer = { entry: Entry; leaving: boolean; z: number }

function Navigator({ top, render }: { top: Entry; render: (entry: Entry) => ReactNode }) {
  const container = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<number, HTMLDivElement>())
  const [layers, setLayers] = useState<Layer[]>([{ entry: top, leaving: false, z: 1 }])
  const pending = useRef<{ from: Entry; to: Entry } | null>(null)
  const shown = layers.find((l) => !l.leaving)!.entry

  if (shown.key !== top.key && pending.current?.to.key !== top.key) {
    const goingBack = depth[top.route] < depth[shown.route]
    pending.current = { from: shown, to: top }
    // Only the newest move animates: older leaving screens are dropped at once.
    setLayers([{ entry: shown, leaving: true, z: goingBack ? 2 : 1 }, { entry: top, leaving: false, z: goingBack ? 1 : 2 }])
  }

  useLayoutEffect(() => {
    const move = pending.current
    if (!move) return
    pending.current = null
    const enter = nodes.current.get(move.to.key)
    const exit = nodes.current.get(move.from.key)
    const box = container.current?.getBoundingClientRect()
    if (!enter || !exit || !box) return
    const goingBack = depth[move.to.route] < depth[move.from.route]
    const key = heroKey(move.from, move.to)
    const done = () => setLayers((all) => all.filter((l) => !l.leaving || l.entry.key !== move.from.key))
    const run = (el: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = el.animate(frames, { fill: 'both', easing: ease, ...options })
      // The screen that stays ends as it is drawn normally: drop the finished effect.
      if (el === enter) animation.finished.then(() => animation.cancel(), () => {})
      return animation
    }

    const hero = key ? heroBox(key, container.current) : null
    if (hero) {
      const clip = `inset(${hero.y}px ${box.width - hero.x - hero.width}px ${box.height - hero.y - hero.height}px ${hero.x}px round ${hero.radius}px)`
      const full = 'inset(0px 0px 0px 0px round 0px)'
      if (!goingBack) {
        run(enter, [{ clipPath: clip }, { clipPath: full }], { duration: 420 })
        run(enter, [{ opacity: 0.4 }, { opacity: 1 }], { duration: 200 })
        run(exit, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 80 }).finished.then(done, done)
      } else {
        run(enter, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 })
        run(exit, [{ clipPath: full }, { clipPath: clip }], { duration: 380 })
        run(exit, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: 260 }).finished.then(done, done)
      }
      return
    }

    const editor = (goingBack ? move.from : move.to).route.endsWith('editor')
    if (editor && !goingBack) {
      run(enter, [{ transform: 'translateY(14%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 380 })
      run(exit, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(done, done)
    } else if (editor) {
      run(enter, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 })
      run(exit, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(14%)', opacity: 0 }], { duration: 300 }).finished.then(done, done)
    } else if (!goingBack) {
      run(enter, [{ transform: 'translateX(25%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 380 })
      run(exit, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-10%)', opacity: 0 }], { duration: 380 }).finished.then(done, done)
    } else {
      run(enter, [{ transform: 'translateX(-10%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 380 })
      run(exit, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(25%)', opacity: 0 }], { duration: 340 }).finished.then(done, done)
    }
  })

  return (
    <div ref={container} style={{ position: 'absolute', inset: 0 }}>
      {layers.map((layer) => (
        <div key={layer.entry.key} className="layer"
          ref={(el) => { if (el) nodes.current.set(layer.entry.key, el); else nodes.current.delete(layer.entry.key) }}
          style={{ zIndex: layer.z, pointerEvents: layer.leaving ? 'none' : undefined, background: 'transparent' }}>
          <Backdrop />
          {render(layer.entry)}
        </div>
      ))}
    </div>
  )
}
