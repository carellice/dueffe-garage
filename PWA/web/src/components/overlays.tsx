import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBackHandler } from '../lib/nav.ts'
import { Icon, Tap, TextButton } from './ui.tsx'
import { fastOutSlowIn, tween } from './motion.ts'
import { formatYMD, parseDate, today, type YMD } from '../../../shared/format.ts'

// Everything that floats above the screens, drawn in #overlays so no layer clips it.

export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.getElementById('overlays')!)
}

/** M3 AlertDialog: scrim, 28 dp corners, title, text and text buttons on the right. */
export function Dialog({ open, onDismiss, title, children, confirm, dismiss }: {
  open: boolean; onDismiss: () => void; title?: string; children?: ReactNode; confirm?: ReactNode; dismiss?: ReactNode
}) {
  useBackHandler(open, onDismiss)
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div key="dialog" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 40px' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween(150, 'linear')}>
            <div onClick={onDismiss} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.32)' }} />
            <motion.div role="dialog" aria-modal="true"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} transition={tween(220, fastOutSlowIn)}
              style={{ position: 'relative', width: '100%', minWidth: 280, maxWidth: 560, maxHeight: '100%', overflowY: 'auto', borderRadius: 28,
                background: 'var(--surfaceContainerHigh)', padding: 24, color: 'var(--onSurfaceVariant)' }}>
              {title && <div style={{ color: 'var(--onSurface)', fontSize: 24, lineHeight: '32px', paddingBottom: 16 }}>{title}</div>}
              <div style={{ fontSize: 14, lineHeight: '20px', letterSpacing: 0.25 }}>{children}</div>
              {(confirm || dismiss) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 24, flexWrap: 'wrap' }}>{dismiss}{confirm}</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  )
}

export const DialogButton = ({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) =>
  <TextButton onClick={onClick} color={color}>{label}</TextButton>

/** M3 DropdownMenu anchored under [anchor]. */
export function Menu({ open, anchor, onDismiss, items, matchWidth = false, maxHeight }: {
  open: boolean; anchor: HTMLElement | null; onDismiss: () => void; items: { label: string; onClick: () => void }[]; matchWidth?: boolean; maxHeight?: number
}) {
  useBackHandler(open, onDismiss)
  const [place, setPlace] = useState<CSSProperties>({})
  useLayoutEffect(() => {
    if (!open || !anchor) return
    const r = anchor.getBoundingClientRect()
    const height = Math.min(maxHeight ?? 99999, items.length * 48 + 16)
    const below = window.innerHeight - r.bottom
    const top = below >= height + 8 || below > r.top ? r.bottom : Math.max(8, r.top - height)
    const width = matchWidth ? r.width : undefined
    const left = matchWidth ? r.left : Math.min(r.left, window.innerWidth - 120 - 8)
    setPlace({ top, left, width, minWidth: matchWidth ? undefined : 112 })
  }, [open, anchor, items.length, matchWidth, maxHeight])
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div key="menu" style={{ position: 'fixed', inset: 0 }} initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
            <div onClick={onDismiss} style={{ position: 'absolute', inset: 0 }} />
            <motion.div role="menu" initial={{ opacity: 0, scaleY: 0.8 }} animate={{ opacity: 1, scaleY: 1 }} exit={{ opacity: 0 }}
              transition={tween(120, fastOutSlowIn)}
              style={{ position: 'absolute', ...place, transformOrigin: 'top', maxHeight, overflowY: 'auto', borderRadius: 4, padding: '8px 0',
                background: 'var(--surfaceContainer)', boxShadow: '0 2px 6px 2px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3)' }}>
              {items.map((item, i) => (
                <Tap key={i} role="menuitem" onClick={() => { item.onClick() }}
                  style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 14, fontWeight: 500, letterSpacing: 0.1, color: 'var(--onSurface)', whiteSpace: 'nowrap' }}>
                  {item.label}
                </Tap>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  )
}

// --- Toast: Toast.makeText(..., LENGTH_SHORT) ------------------------------------------------

let toastState: { text: string; key: number } | null = null
const toastListeners = new Set<() => void>()
let toastTimer: ReturnType<typeof setTimeout> | undefined

export function toast(text: string, long = false) {
  toastState = { text, key: Date.now() }
  toastListeners.forEach((l) => l())
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastState = null
    toastListeners.forEach((l) => l())
  }, long ? 3500 : 2000)
}

export function ToastHost() {
  const state = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l) }, () => toastState)
  return (
    <Portal>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom) + 44px)', display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 32px' }}>
        <AnimatePresence>
          {state && (
            <motion.div key={state.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween(180, 'linear')}
              className="toast"
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, lineHeight: '20px', padding: '8px 16px 8px 8px', borderRadius: 24, maxWidth: 360,
                boxShadow: '0 2px 6px rgba(0,0,0,.18)' }}>
              <img src="/icon-192.png" alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }} />
              {state.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  )
}

// --- M3 DatePickerDialog ---------------------------------------------------------------------

const weekdayLetters = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const shortMonths = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

export function DatePickerDialog({ open, value, onDismiss, onConfirm }: { open: boolean; value: string; onDismiss: () => void; onConfirm: (date: string) => void }) {
  const initial = parseDate(value) ?? today()
  const [selected, setSelected] = useState<YMD>(initial)
  const [month, setMonth] = useState({ y: initial.y, m: initial.m })
  const [yearMode, setYearMode] = useState(false)
  const yearList = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const start = parseDate(value) ?? today()
    setSelected(start)
    setMonth({ y: start.y, m: start.m })
    setYearMode(false)
  }, [open, value])
  useEffect(() => {
    if (yearMode) yearList.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'center' })
  }, [yearMode])
  useBackHandler(open, onDismiss)
  const first = new Date(Date.UTC(month.y, month.m - 1, 1)).getUTCDay()
  const offset = (first + 6) % 7
  const days = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate()
  const now = today()
  const move = (delta: number) => {
    const total = month.y * 12 + month.m - 1 + delta
    setMonth({ y: Math.floor(total / 12), m: (total % 12) + 1 })
  }
  const weekday = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][new Date(Date.UTC(selected.y, selected.m - 1, selected.d)).getUTCDay()]
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div key="date" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween(150, 'linear')}>
            <div onClick={onDismiss} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.32)' }} />
            <motion.div role="dialog" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} transition={tween(220)}
              style={{ position: 'relative', width: 360, maxWidth: '100%', borderRadius: 28, background: 'var(--surfaceContainerHigh)', color: 'var(--onSurface)', paddingBottom: 8 }}>
              <div style={{ padding: '16px 24px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0.1, color: 'var(--onSurfaceVariant)' }}>Seleziona data</div>
                <div style={{ fontSize: 32, lineHeight: '40px', paddingTop: 36 }}>{`${weekday} ${selected.d} ${shortMonths[selected.m - 1]}`}</div>
              </div>
              <div style={{ height: 1, background: 'var(--outlineVariant)' }} />
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 12px 4px 16px', height: 56 }}>
                <Tap onClick={() => setYearMode(!yearMode)} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40, padding: '0 8px', borderRadius: 20, fontSize: 14, fontWeight: 500, color: 'var(--onSurfaceVariant)' }}>
                  {`${monthNames[month.m - 1]} ${month.y}`}
                  <Icon name="chevronDown" size={18} style={{ transform: yearMode ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
                </Tap>
                <div style={{ flex: 1 }} />
                {!yearMode && <>
                  <Tap onClick={() => move(-1)} label="Mese precedente" style={{ width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onSurfaceVariant)' }}>
                    <Icon name="chevronRight" size={24} style={{ transform: 'rotate(180deg)' }} />
                  </Tap>
                  <Tap onClick={() => move(1)} label="Mese successivo" style={{ width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onSurfaceVariant)' }}>
                    <Icon name="chevronRight" size={24} />
                  </Tap>
                </>}
              </div>
              {yearMode ? (
                <div ref={yearList} style={{ height: 336, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 8, padding: '0 12px', alignContent: 'start' }}>
                  {Array.from({ length: 2100 - 1900 + 1 }, (_, i) => 1900 + i).map((y) => (
                    <div key={y} data-current={y === month.y}>
                      <Tap onClick={() => { setMonth({ y, m: month.m }); setYearMode(false) }}
                        style={{ height: 36, width: 72, margin: '0 auto', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                          background: y === month.y ? 'var(--primary)' : 'transparent', color: y === month.y ? 'var(--onPrimary)' : y === now.y ? 'var(--primary)' : 'var(--onSurfaceVariant)',
                          border: y === now.y && y !== month.y ? '1px solid var(--primary)' : undefined }}>{y}</Tap>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '0 12px', height: 336 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: 40, alignItems: 'center', textAlign: 'center', fontSize: 16 }}>
                    {weekdayLetters.map((d, i) => <div key={i}>{d}</div>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0 }}>
                    {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                      const isSelected = selected.y === month.y && selected.m === month.m && selected.d === d
                      const isToday = now.y === month.y && now.m === month.m && now.d === d
                      return (
                        <div key={d} style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Tap onClick={() => setSelected({ y: month.y, m: month.m, d })}
                            style={{ width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                              background: isSelected ? 'var(--primary)' : 'transparent', color: isSelected ? 'var(--onPrimary)' : isToday ? 'var(--primary)' : 'var(--onSurface)',
                              border: isToday && !isSelected ? '1px solid var(--primary)' : '1px solid transparent' }}>{d}</Tap>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 12px' }}>
                <TextButton onClick={onDismiss}>Annulla</TextButton>
                <TextButton onClick={() => onConfirm(formatYMD(selected))}>Conferma</TextButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  )
}
