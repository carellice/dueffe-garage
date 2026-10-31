import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useBackHandler } from '../lib/nav.ts'
import { epochDay, fromEpochDay, monthName, parseDate, today } from '../../../shared/model.ts'
import { Icon, Pressable, TextButton } from './ui.tsx'
import { tween } from './motion.ts'

// Everything floating (AlertDialog, DatePickerDialog, DropdownMenu, Toast) renders in #overlays,
// so it is never clipped by a screen.

export function Portal({ children }: { children: ReactNode }) {
  const host = document.getElementById('overlays')
  return host ? createPortal(children, host) : null
}

// --- dialogs -------------------------------------------------------------------------------------

type DialogEntry = { id: number; render: (close: () => void) => ReactNode }
let dialogs: DialogEntry[] = []
let nextDialog = 1
const dialogListeners = new Set<() => void>()
const emitDialogs = () => dialogListeners.forEach((l) => l())

export function openDialog(render: (close: () => void) => ReactNode): () => void {
  const id = nextDialog++
  dialogs = [...dialogs, { id, render }]
  emitDialogs()
  return () => {
    dialogs = dialogs.filter((d) => d.id !== id)
    emitDialogs()
  }
}

export function DialogHost() {
  const list = useSyncExternalStore(
    (l) => { dialogListeners.add(l); return () => dialogListeners.delete(l) },
    () => dialogs,
  )
  return (
    <Portal>
      <AnimatePresence>
        {list.map((d) => <DialogFrame key={d.id} entry={d} />)}
      </AnimatePresence>
    </Portal>
  )
}

function DialogFrame({ entry }: { entry: DialogEntry }) {
  const close = useCallback(() => {
    dialogs = dialogs.filter((d) => d.id !== entry.id)
    emitDialogs()
  }, [entry.id])
  useBackHandler(true, close)
  return (
    <>
      <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween(150)} onClick={close} />
      <div className="overlay-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={tween(150)}>
          {entry.render(close)}
        </motion.div>
      </div>
    </>
  )
}

/** Material 3 AlertDialog with the app's extraLarge shape (32 dp). */
export function AlertDialog({ title, children, confirm, dismiss, width }: { title?: ReactNode; children?: ReactNode; confirm?: ReactNode; dismiss?: ReactNode; width?: number }) {
  return (
    <div role="dialog" style={{
      background: 'var(--surfaceContainerHigh)', borderRadius: 32, padding: 24, minWidth: 280, maxWidth: 560,
      width: width ?? 'min(312px, calc(100vw - 48px))', boxShadow: '0 6px 20px rgba(0,0,0,.18)',
      maxHeight: 'calc(100dvh - 96px)', display: 'flex', flexDirection: 'column',
    }}>
      {title && <div style={{ fontSize: 24, lineHeight: '32px', letterSpacing: 0, color: 'var(--onSurface)', marginBottom: 16 }}>{title}</div>}
      {children && <div style={{ fontSize: 14, lineHeight: '20px', letterSpacing: 0.25, color: 'var(--onSurfaceVariant)', overflowY: 'auto', whiteSpace: 'pre-line' }}>{children}</div>}
      {(confirm || dismiss) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>{dismiss}{confirm}</div>
      )}
    </div>
  )
}

/** ConfirmDelete of Screens.kt. */
export function confirmDelete(text: string, onConfirm: () => void) {
  openDialog((close) => (
    <AlertDialog title="Conferma eliminazione"
      dismiss={<TextButton onClick={close}>Annulla</TextButton>}
      confirm={<TextButton color="var(--error)" onClick={() => { close(); onConfirm() }}>Elimina</TextButton>}>
      {text}
    </AlertDialog>
  ))
}

// --- toast ----------------------------------------------------------------------------------------

let toastState: { id: number; text: string } | null = null
let nextToast = 1
const toastListeners = new Set<() => void>()
let toastTimer: ReturnType<typeof setTimeout> | undefined

/** Toast.makeText(context, value, LENGTH_SHORT). */
export function toast(text: string, long = false) {
  toastState = { id: nextToast++, text }
  toastListeners.forEach((l) => l())
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastState = null; toastListeners.forEach((l) => l()) }, long ? 3500 : 2000)
}

export function ToastHost() {
  const current = useSyncExternalStore(
    (l) => { toastListeners.add(l); return () => toastListeners.delete(l) },
    () => toastState,
  )
  return (
    <Portal>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--safe-bottom) + 64px)', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 80 }}>
        <AnimatePresence>
          {current && (
            <motion.div key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween(200)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'calc(100vw - 48px)', padding: '8px 16px 8px 8px',
                borderRadius: 24, background: 'var(--toastBg, #2F2F33)', color: '#F4F4F4', fontSize: 14, lineHeight: '20px', letterSpacing: 0.25,
                boxShadow: '0 2px 8px rgba(0,0,0,.25)',
              }}>
              <img src="/icon-192.png" alt="" width={24} height={24} style={{ borderRadius: 6 }} />
              <span>{current.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  )
}

// --- dropdown menu --------------------------------------------------------------------------------

/** Material 3 DropdownMenu anchored under [anchor]. */
export function DropdownMenu({ open, anchor, onDismiss, items, maxHeight = 360, matchWidth = false }: {
  open: boolean; anchor: HTMLElement | null; onDismiss: () => void
  items: { label: string; onClick: () => void }[]; maxHeight?: number; matchWidth?: boolean
}) {
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null)
  const menu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !anchor) return
    const r = anchor.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const up = below < Math.min(maxHeight, items.length * 48 + 16) && r.top > below
    setPos({ left: r.left, top: up ? r.top : r.bottom, width: r.width, up })
  }, [open, anchor, items.length, maxHeight])
  useBackHandler(open, onDismiss)
  return (
    <Portal>
      <AnimatePresence>
        {open && pos && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={onDismiss} />
            <motion.div ref={menu} role="menu"
              initial={{ opacity: 0, scaleY: 0.8 }} animate={{ opacity: 1, scaleY: 1 }} exit={{ opacity: 0 }} transition={tween(120)}
              style={{
                position: 'fixed', zIndex: 61, left: Math.min(pos.left, window.innerWidth - (matchWidth ? pos.width : 200) - 8),
                ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
                width: matchWidth ? pos.width : undefined, minWidth: 112, maxWidth: 280, maxHeight, overflowY: 'auto',
                transformOrigin: pos.up ? 'bottom' : 'top', background: 'var(--surfaceContainer)', borderRadius: 4, padding: '8px 0',
                boxShadow: '0 2px 6px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3)',
              }}>
              {items.map((item) => (
                <Pressable key={item.label} pressed={1} role="menuitem" onClick={item.onClick}
                  style={{ height: 48, padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 14, lineHeight: '20px', letterSpacing: 0.1, color: 'var(--onSurface)', whiteSpace: 'nowrap' }}>
                  {item.label}
                </Pressable>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  )
}

// --- date picker -----------------------------------------------------------------------------------

const WEEK = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

/** Material 3 DatePickerDialog: month grid, Monday first (Locale.ITALY). */
export function pickDate(initial: string, onSelected: (value: string) => void) {
  openDialog((close) => <DatePicker initial={initial} close={close} onSelected={onSelected} />)
}

function DatePicker({ initial, close, onSelected }: { initial: string; close: () => void; onSelected: (v: string) => void }) {
  const start = parseDate(initial) ? initial : today()
  const [selected, setSelected] = useState(start)
  const p = parseDate(start)!
  const [month, setMonth] = useState({ y: p.y, m: p.m })
  const [yearMode, setYearMode] = useState(false)
  const first = epochDay(`${month.y}-${String(month.m).padStart(2, '0')}-01`)!
  const offset = (new Date(first * 86_400_000).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate()
  const sel = parseDate(selected)!
  const now = today()
  const shift = (n: number) => setMonth(({ y, m }) => {
    const t = y * 12 + (m - 1) + n
    return { y: Math.floor(t / 12), m: (t % 12) + 1 }
  })
  const yearsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (yearMode) yearsRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'center' })
  }, [yearMode])
  const headline = `${sel.d} ${monthName(sel.m).slice(0, 3)} ${sel.y}`
  return (
    <div role="dialog" style={{ background: 'var(--surfaceContainerHigh)', borderRadius: 28, width: 'min(360px, calc(100vw - 32px))', boxShadow: '0 6px 20px rgba(0,0,0,.18)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 12px 12px 24px' }}>
        <div style={{ fontSize: 14, lineHeight: '20px', letterSpacing: 0.1, color: 'var(--onSurfaceVariant)', fontWeight: 500 }}>Seleziona data</div>
        <div style={{ fontSize: 32, lineHeight: '40px', letterSpacing: 0, marginTop: 36, color: 'var(--onSurface)' }}>{headline}</div>
      </div>
      <div style={{ height: 1, background: 'var(--outlineVariant)' }} />
      <div style={{ display: 'flex', alignItems: 'center', height: 56, padding: '0 12px 0 16px' }}>
        <Pressable pressed={1} onClick={() => setYearMode(!yearMode)} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40, padding: '0 8px', borderRadius: 20, fontSize: 14, fontWeight: 500, letterSpacing: 0.1, color: 'var(--onSurfaceVariant)' }}>
          {monthName(month.m)} {month.y}
          <Icon name="chevron-down" size={18} style={{ transform: yearMode ? 'rotate(180deg)' : undefined, transition: 'transform 200ms' }} />
        </Pressable>
        <div style={{ flex: 1 }} />
        {!yearMode && <>
          <Pressable pressed={1} label="Mese precedente" onClick={() => shift(-1)} style={{ width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onSurfaceVariant)' }}>
            <Icon name="chevron-right" size={22} style={{ transform: 'rotate(180deg)' }} />
          </Pressable>
          <Pressable pressed={1} label="Mese successivo" onClick={() => shift(1)} style={{ width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onSurfaceVariant)' }}>
            <Icon name="chevron-right" size={22} />
          </Pressable>
        </>}
      </div>
      {yearMode ? (
        <div ref={yearsRef} style={{ height: 288, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 8, padding: '0 12px' }}>
          {Array.from({ length: 2100 - 1900 + 1 }, (_, i) => 1900 + i).map((y) => {
            const current = y === month.y
            return (
              <Pressable key={y} pressed={1} onClick={() => { setMonth({ y, m: month.m }); setYearMode(false) }}
                style={{ height: 36, margin: '0 auto', width: 72, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  background: current ? 'var(--primary)' : 'transparent', color: current ? 'var(--onPrimary)' : 'var(--onSurfaceVariant)' }}>
                <span data-current={current}>{y}</span>
              </Pressable>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '0 12px', height: 288 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', height: 40, alignItems: 'center', textAlign: 'center', fontSize: 16, color: 'var(--onSurface)' }}>
            {WEEK.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0 }}>
            {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const value = fromEpochDay(first + i)
              const isSel = value === selected
              const isToday = value === now
              return (
                <div key={value} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable pressed={1} onClick={() => setSelected(value)} label={value}
                    style={{
                      width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, letterSpacing: 0.25,
                      background: isSel ? 'var(--primary)' : 'transparent', color: isSel ? 'var(--onPrimary)' : isToday ? 'var(--primary)' : 'var(--onSurface)',
                      border: isToday && !isSel ? '1px solid var(--primary)' : '1px solid transparent',
                    }}>{i + 1}</Pressable>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 12px 12px' }}>
        <TextButton onClick={close}>Annulla</TextButton>
        <TextButton onClick={() => { onSelected(selected); close() }}>Conferma</TextButton>
      </div>
    </div>
  )
}
