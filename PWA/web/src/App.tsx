import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, authEvents } from './lib/api.ts'
import { back, depth, top, type Entry, openDeepLink, rootTab, type Route, selectTab, useNav } from './lib/nav.ts'
import { forgetUser, getStore, loggedUser, refresh, setUser, useStore } from './lib/store.ts'
import { applyTheme, useIsDark } from './lib/theme.ts'
import { externalActivity } from './lib/files.ts'
import { Icon, Pressable } from './components/ui.tsx'
import { DialogHost, ToastHost } from './components/overlays.tsx'
import { fastOutSlowIn, spring, tween } from './components/motion.ts'
import { LoginScreen } from './screens/Login.tsx'
import { LockScreen } from './screens/Lock.tsx'
import { Onboarding } from './screens/Onboarding.tsx'
import { GarageHome } from './screens/Home.tsx'
import { ReminderScreen } from './screens/Reminders.tsx'
import { SettingsScreen } from './screens/Settings.tsx'
import { VehicleDetail } from './screens/VehicleDetail.tsx'
import { DocumentDetailScreen, MaintenanceDetailScreen, ReminderDetailScreen } from './screens/ItemDetails.tsx'
import { VehicleEditor } from './screens/VehicleEditor.tsx'
import { MaintenanceEditor } from './screens/MaintenanceEditor.tsx'
import { DocumentEditor } from './screens/DocumentEditor.tsx'

type Session = { loggedIn: boolean; username: string | null; version: string }

export let serverVersion = ''

/** Session → login, lock, onboarding, then the garage. */
export function App() {
  const isDark = useIsDark()
  useLayoutEffect(() => applyTheme(isDark), [isDark])
  const [session, setSession] = useState<'checking' | 'out' | 'in'>(loggedUser() ? 'in' : 'checking')
  const [locked, setLocked] = useState(getStore().settings.protection)
  const [onboarding, setOnboarding] = useState(false)

  useEffect(() => {
    api<Session>('/api/session').then((s) => {
      serverVersion = s.version
      if (s.loggedIn && s.username) {
        setUser(s.username)
        setSession('in')
        refresh(true)
      } else {
        setSession('out')
      }
    }).catch(() => {
      // Offline: open with the cached data of the last account.
      setSession(loggedUser() ? 'in' : 'out')
    })
    const onLogout = () => setSession('out')
    authEvents.addEventListener('logout', onLogout)
    return () => authEvents.removeEventListener('logout', onLogout)
  }, [])

  // Like ON_STOP: Garage locks as soon as it goes to the background, but not for its own pickers.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && !externalActivity && getStore().settings.protection) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (session === 'in') {
      const s = getStore().settings
      setOnboarding(!s.onboarded)
      setLocked(s.protection)
    }
  }, [session])

  // Notification taps and manifest shortcuts.
  useEffect(() => {
    if (location.search) {
      openDeepLink(location.href)
      history.replaceState(history.state, '', '/')
    }
    const onMessage = (e: MessageEvent) => { if (e.data?.type === 'open') openDeepLink(e.data.url) }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [])

  let screen: ReactNode
  if (session === 'checking') screen = <div className="backdrop" />
  else if (session === 'out') screen = <LoginScreen onLoggedIn={(username) => { setUser(username); setSession('in'); refresh(true) }} />
  else if (locked) screen = <LockScreen onUnlocked={() => setLocked(false)} />
  else if (onboarding) screen = <Onboarding done={() => setOnboarding(false)} />
  else screen = <Main onLock={() => setLocked(true)} onOnboarding={() => setOnboarding(true)} onLoggedOut={(user, deleted) => {
    if (deleted) forgetUser(user)
    location.replace('/')
  }} />

  return (
    <div className="app">
      {screen}
      <DialogHost />
      <ToastHost />
    </div>
  )
}

// --- the garage: AnimatedContent over the destinations ---------------------------------------

/** The last touch, to scale the next screen out of it (lastTap / lastTapAt). */
const lastTap = { x: 0, y: 0, at: 0 }
/** The shared element touched last (containerTransform keys). */
const lastHero = { key: '', rect: null as DOMRect | null, radius: 28, at: 0 }

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => {
    lastTap.x = e.clientX
    lastTap.y = e.clientY
    lastTap.at = performance.now()
    const hero = (e.target as Element | null)?.closest?.('[data-hero]') as HTMLElement | null
    if (hero) {
      lastHero.key = hero.dataset.hero ?? ''
      lastHero.rect = hero.getBoundingClientRect()
      lastHero.radius = Number(hero.dataset.radius ?? 28)
      lastHero.at = performance.now()
    } else lastHero.key = ''
  }, { capture: true })
}

type Transition = {
  hero: boolean; back: boolean; recent: boolean; origin: string; target: number
  inset: string | null; radius: number
}

const heroPairs = [['garage', 'vehicle-editor'], ['garage', 'detail'], ['detail', 'sections']]
/** Where every screen was opened from, to close it back into the same point. */
const openingOrigins = new Map<number, { origin: string; inset: string | null; radius: number }>()

function transitionFor(from: Entry, to: Entry, bounds: DOMRect | null): Transition {
  const goingBack = depth[to.route] < depth[from.route]
  const now = performance.now()
  const recent = now - lastTap.at < 1200
  const pairHero = heroPairs.some(([a, b]) => (from.route === a && to.route === b) || (from.route === b && to.route === a))
  // The editor grows out of "Aggiungi auto" only for a new vehicle; the detail out of its card only from the Garage tab.
  const heroKey = to.route === 'vehicle-editor' ? (to.params.isNew ? 'add-vehicle-page' : null)
    : to.route === 'detail' ? `vehicle-page-${to.params.vehicleId}`
    : to.route === 'sections' ? `sections-page-${to.params.vehicleId}` : null
  let origin = '50% 50%'
  if (recent && bounds && bounds.width > 0) {
    const x = Math.min(1, Math.max(0, (lastTap.x - bounds.left) / bounds.width))
    const y = Math.min(1, Math.max(0, (lastTap.y - bounds.top) / bounds.height))
    origin = `${x * 100}% ${y * 100}%`
  }
  if (!goingBack) {
    const fresh = heroKey != null && lastHero.key === heroKey && now - lastHero.at < 1200 && lastHero.rect && bounds
    const inset = fresh ? insetOf(lastHero.rect!, bounds!) : null
    const hero = pairHero && inset != null
    openingOrigins.set(to.key, { origin, inset: hero ? inset : null, radius: lastHero.radius })
    return { hero, back: false, recent, origin, target: recent ? 0.12 : 0.94, inset, radius: lastHero.radius }
  }
  const opened = openingOrigins.get(from.key)
  const hero = pairHero && opened?.inset != null
  return {
    hero, back: true, recent, origin: opened?.origin ?? '50% 50%', target: opened ? 0.12 : 0.96,
    inset: opened?.inset ?? null, radius: opened?.radius ?? 28,
  }
}

function insetOf(rect: DOMRect, bounds: DOMRect): string {
  const top = rect.top - bounds.top, left = rect.left - bounds.left
  const right = bounds.right - rect.right, bottom = bounds.bottom - rect.bottom
  return `${top}px ${right}px ${bottom}px ${left}px`
}

const layerVariants: Variants = {
  enter: (t: Transition) => t.hero && !t.back
    ? { opacity: 0, clipPath: `inset(${t.inset} round ${t.radius}px)`, scale: 1, transformOrigin: t.origin, zIndex: 1 }
    : t.back ? { opacity: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px round 0px)', zIndex: 1 }
    : { opacity: 0, scale: t.target, transformOrigin: t.origin, clipPath: 'inset(0px 0px 0px 0px round 0px)', zIndex: 1 },
  shown: (t: Transition) => ({
    opacity: 1, scale: 1, clipPath: 'inset(0px 0px 0px 0px round 0px)', zIndex: 1,
    transition: t.hero && !t.back
      ? { opacity: tween(260), clipPath: tween(340) }
      : t.back ? { opacity: tween(t.hero ? 120 : 180) }
      : { opacity: tween(110), scale: tween(340) },
  }),
  exit: (t: Transition) => t.hero && t.back
    ? { opacity: 0, clipPath: `inset(${t.inset} round ${t.radius}px)`, zIndex: 2, transition: { opacity: tween(300), clipPath: tween(340) } }
    : t.hero ? { opacity: 0, zIndex: 0, transition: { opacity: tween(140) } }
    : !t.back ? { opacity: 0, zIndex: 0, transition: { opacity: tween(150) } }
    : { scale: t.target, opacity: 0, transformOrigin: t.origin, zIndex: 0, transition: { scale: { duration: 0.3, ease: fastOutSlowIn }, opacity: { ...tween(110), delay: 0.19 } } },
}

const fullScreenRoutes: Route[] = ['vehicle-editor', 'maintenance-editor', 'document-editor', 'maintenance-detail', 'reminder-detail', 'document-detail']

function Main({ onLock, onOnboarding, onLoggedOut }: { onLock: () => void; onOnboarding: () => void; onLoggedOut: (user: string, deleted: boolean) => void }) {
  const { stack } = useNav()
  const entry = stack[stack.length - 1]
  const content = useRef<HTMLDivElement>(null)
  const previous = useRef<Entry>(entry)
  const transition = useRef<Transition>({ hero: false, back: false, recent: false, origin: '50% 50%', target: 1, inset: null, radius: 28 })
  if (previous.current.key !== entry.key) {
    transition.current = transitionFor(previous.current, entry, content.current?.getBoundingClientRect() ?? null)
    previous.current = entry
  }
  const showNavigation = !fullScreenRoutes.includes(entry.route)
  const page = rootTab()
  return (
    <>
      <div className="content" ref={content}>
        <AnimatePresence initial={false} custom={transition.current}>
          <motion.div key={entry.key} className="layer" custom={transition.current} variants={layerVariants}
            initial="enter" animate="shown" exit="exit">
            <div className="backdrop" />
            <Screen entry={entry} page={page} onLock={onLock} onOnboarding={onOnboarding} onLoggedOut={onLoggedOut} />
          </motion.div>
        </AnimatePresence>
      </div>
      {showNavigation && <FloatingGarageNavigation page={page} />}
    </>
  )
}

function Screen({ entry, page, onLock, onOnboarding, onLoggedOut }: {
  entry: Entry; page: Route; onLock: () => void; onOnboarding: () => void; onLoggedOut: (user: string, deleted: boolean) => void
}) {
  const data = useStore((s) => s.data)
  if (!data) return <LoadingOrError />
  const { vehicleId, itemId } = entry.params
  const vehicle = data.vehicles.find((v) => v.id === vehicleId)
  switch (entry.route) {
    case 'garage': return <GarageHome />
    case 'scadenze': return <ReminderScreen />
    case 'impostazioni': return <SettingsScreen onLock={onLock} onOnboarding={onOnboarding} onLoggedOut={onLoggedOut} />
    case 'detail': return vehicle ? <VehicleDetail vehicle={vehicle} sectionsPage={false} backLabel={page === 'scadenze' ? 'Scadenze' : 'Garage'} /> : <Gone entryKey={entry.key} />
    case 'sections': return vehicle ? <VehicleDetail vehicle={vehicle} sectionsPage /> : <Gone entryKey={entry.key} />
    case 'maintenance-detail': return <MaintenanceDetailScreen id={itemId!} />
    case 'reminder-detail': return <ReminderDetailScreen id={itemId!} />
    case 'document-detail': return <DocumentDetailScreen id={itemId!} />
    case 'vehicle-editor': return <VehicleEditor existing={entry.params.isNew ? null : vehicle ?? null} />
    case 'maintenance-editor': return vehicle ? <MaintenanceEditor vehicle={vehicle} existingId={itemId ?? null} /> : <Gone entryKey={entry.key} />
    case 'document-editor': return vehicle ? <DocumentEditor vehicle={vehicle} existingId={itemId ?? null} linkedMaintenanceId={null} /> : <Gone entryKey={entry.key} />
  }
}

/** The item was deleted meanwhile (on another phone): go back, like `?.let` showing nothing. */
function Gone({ entryKey }: { entryKey: number }) {
  useEffect(() => {
    const t = setTimeout(() => { if (top().key === entryKey) back() }, 50)
    return () => clearTimeout(t)
  }, [entryKey])
  return null
}

function LoadingOrError() {
  const error = useStore((s) => s.loadError)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', color: 'var(--onSurfaceVariant)', fontSize: 14 }}>
      {error ?? ''}
    </div>
  )
}

// --- FloatingGarageNavigation ------------------------------------------------------------------

const destinations: [Route, string, string][] = [['garage', 'Garage', 'garage-nav'], ['scadenze', 'Scadenze', 'calendar-nav'], ['impostazioni', 'Impostazioni', 'settings-nav']]

function FloatingGarageNavigation({ page }: { page: Route }) {
  const selectedIndex = Math.max(0, destinations.findIndex(([k]) => k === page))
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 22px calc(10px + var(--safe-bottom))', pointerEvents: 'none', zIndex: 5 }}>
      <div style={{
        position: 'relative', borderRadius: 34, background: 'color-mix(in srgb, var(--surface) 97%, transparent)',
        border: '1px solid var(--navBorder)', boxShadow: 'var(--navShadow)', padding: 6, pointerEvents: 'auto', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative' }}>
          <motion.div initial={false} animate={{ left: `${(selectedIndex * 100) / destinations.length}%` }} transition={spring(0.68, 400)}
            style={{ position: 'absolute', top: 0, width: `${100 / destinations.length}%`, height: 58, borderRadius: 28, background: 'var(--accent)' }} />
          <div role="tablist" style={{ display: 'flex', position: 'relative' }}>
            {destinations.map(([key, label, icon]) => {
              const selected = key === page
              return (
                <Pressable key={key} role="tab" selected={selected} pressed={0.9} ripple={false} label={label}
                  onClick={() => selectTab(key)}
                  style={{ flex: 1, height: 58, borderRadius: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div initial={false}
                    animate={{ color: selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)', scale: selected ? 1.12 : 1, y: selected ? -1 : 0 }}
                    transition={{ color: tween(250), scale: spring(0.4, 1500), y: spring(0.5, 1500) }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Icon name={icon} size={23} />
                  </motion.div>
                  <div style={{ height: 3 }} />
                  <motion.span initial={false} animate={{ color: selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)' }} transition={tween(250)}
                    style={{ fontSize: 11, lineHeight: '16px', letterSpacing: 0.5, fontWeight: selected ? 800 : 500, whiteSpace: 'nowrap' }}>{label}</motion.span>
                </Pressable>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
