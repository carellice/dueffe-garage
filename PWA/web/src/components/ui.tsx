import { animate, motion, useMotionValue, useTransform, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { icons, type IconName } from '../lib/icons.gen.ts'
import { accentGradient, alpha } from '../lib/theme.ts'
import { groupedInt } from '../../../shared/format.ts'
import { spring, Stiffness, tween } from './motion.ts'

// The building blocks of GarageDesign.kt (the "cockpit" look) and the Material 3 components the app uses.

export function Icon({ name, size = 24, color, style }: { name: IconName; size?: number; color?: string; style?: CSSProperties }) {
  const icon = icons[name]
  return (
    <svg width={size} height={size} viewBox={icon.viewBox} style={{ color, flexShrink: 0, ...style }} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.body }} />
  )
}

/** Kept for elements that still observe their size (no-op styling hook). */
export function useGradient<T extends HTMLElement>() {
  const last = useRef<T | null>(null)
  return useCallback((el: T | null) => { last.current = el }, [])
}

// --- press feedback ---------------------------------------------------------------------------

function addRipple(event: React.PointerEvent<HTMLElement>, color: string) {
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left, y = event.clientY - rect.top
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
  const span = document.createElement('span')
  span.className = 'ripple'
  Object.assign(span.style, { width: `${radius * 2}px`, height: `${radius * 2}px`, left: `${x - radius}px`, top: `${y - radius}px`, color })
  el.appendChild(span)
  setTimeout(() => span.remove(), 500)
}

type BouncyProps = Omit<HTMLMotionProps<'div'>, 'onClick'> & {
  onClick?: () => void
  pressed?: number
  ripple?: string | false
  disabled?: boolean
  label?: string
  role?: string
}

/** Modifier.bouncyClick: shrinks to .97 while pressed, springs back, with a ripple. */
export const Bouncy = forwardRef<HTMLDivElement, BouncyProps>(function Bouncy({ onClick, pressed = 0.97, ripple = 'currentColor', disabled, label, role = 'button', className, children, onPointerDown, ...rest }, ref) {
  return (
    <motion.div
      {...rest}
      ref={ref}
      role={role}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={`tap ${className ?? ''}`}
      whileTap={disabled ? undefined : { scale: pressed }}
      transition={spring(0.6, Stiffness.Medium)}
      onPointerDown={(e) => {
        if (!disabled && ripple !== false) addRipple(e, ripple)
        onPointerDown?.(e)
      }}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.() } }}
    >
      {children}
    </motion.div>
  )
})

/** Clickable without the scale (Modifier.clickable). */
export function Tap({ onClick, className, style, children, ripple = 'currentColor', label, role = 'button', disabled }: {
  onClick?: () => void; className?: string; style?: CSSProperties; children?: ReactNode; ripple?: string | false; label?: string; role?: string; disabled?: boolean
}) {
  return (
    <div role={role} aria-label={label} tabIndex={disabled ? -1 : 0} className={`tap ${className ?? ''}`} style={style}
      onPointerDown={(e) => { if (!disabled && ripple !== false) addRipple(e, ripple) }}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.() } }}>
      {children}
    </div>
  )
}

// --- buttons ----------------------------------------------------------------------------------

const buttonText: CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: 0.2, lineHeight: '20px', whiteSpace: 'nowrap' }

/** AccentButton: solid accent, precise corners. */
export function AccentButton({ onClick, children, style, enabled = true, radius = 16 }: {
  onClick: () => void; children: ReactNode; style?: CSSProperties; enabled?: boolean; radius?: number
}) {
  return (
    <Bouncy onClick={onClick} disabled={!enabled} ripple="var(--onAccent)" style={{
      minHeight: 52, borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 20px',
      background: 'var(--primary)', color: 'var(--onAccent)', opacity: enabled ? 1 : 0.4, ...buttonText, ...style,
    }}>{children}</Bouncy>
  )
}

/** GhostButton: hairline outline; [danger] tints it with the error colour. */
export function GhostButton({ onClick, children, style, danger = false, enabled = true }: {
  onClick: () => void; children: ReactNode; style?: CSSProperties; danger?: boolean; enabled?: boolean
}) {
  return (
    <Bouncy onClick={onClick} disabled={!enabled} style={{
      minHeight: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 18px',
      background: 'var(--surface)', color: danger ? 'var(--error)' : 'var(--onSurface)', opacity: enabled ? 1 : 0.45,
      border: `1px solid ${danger ? 'color-mix(in srgb, var(--error) 35%, transparent)' : 'color-mix(in srgb, var(--outline) 35%, transparent)'}`,
      ...buttonText, fontWeight: 600, ...style,
    }}>{children}</Bouncy>
  )
}

/** M3 OutlinedButton, kept for dialogs. */
export function OutlinedButton({ onClick, children, style, color = 'var(--primary)', border = 'var(--outlineVariant)', height = 40, radius = 20, disabled }: {
  onClick: () => void; children: ReactNode; style?: CSSProperties; color?: string; border?: string; height?: number; radius?: number; disabled?: boolean
}) {
  return (
    <Tap onClick={onClick} disabled={disabled} style={{
      height, borderRadius: radius, border: `1px solid ${border}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px', fontSize: 14, fontWeight: 500, letterSpacing: 0.1, lineHeight: '20px', opacity: disabled ? 0.38 : 1, ...style,
    }}>{children}</Tap>
  )
}

/** M3 TextButton. */
export function TextButton({ onClick, children, style, color = 'var(--primary)' }: { onClick: () => void; children: ReactNode; style?: CSSProperties; color?: string }) {
  return (
    <Tap onClick={onClick} style={{ minHeight: 40, borderRadius: 20, padding: '0 12px', color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 500, letterSpacing: 0.1, lineHeight: '20px', ...style }}>{children}</Tap>
  )
}

/** Round icon button. [overPhoto] gives it a dark translucent fill to sit on images. */
export function RoundIconButton({ icon, label, onClick, overPhoto = false, accent = false, style }: {
  icon: IconName; label: string; onClick: () => void; overPhoto?: boolean; accent?: boolean; style?: CSSProperties
}) {
  const bg = accent ? 'var(--primary)' : overPhoto ? 'rgba(0,0,0,.42)' : 'var(--surface)'
  const fg = accent ? 'var(--onAccent)' : overPhoto ? '#FFFFFF' : 'var(--onSurface)'
  return (
    <Bouncy onClick={onClick} label={label} ripple={fg} style={{
      width: 46, height: 46, borderRadius: '50%', background: bg, color: fg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${overPhoto ? 'rgba(255,255,255,.16)' : accent ? 'transparent' : 'var(--hairline)'}`,
      backdropFilter: overPhoto ? 'blur(8px)' : undefined, WebkitBackdropFilter: overPhoto ? 'blur(8px)' : undefined, ...style,
    }}>
      <Icon name={icon} size={22} />
    </Bouncy>
  )
}

// --- surfaces and type ------------------------------------------------------------------------

/** Panel: flat surface with a hairline border, the base of every group. */
export function Panel({ children, padding = 18, radius = 20, style, onClick, label }: {
  children: ReactNode; padding?: number; radius?: number; style?: CSSProperties; onClick?: () => void; label?: string
}) {
  const base: CSSProperties = { borderRadius: radius, background: 'var(--surface)', border: '1px solid var(--hairline)', padding, display: 'flex', flexDirection: 'column', ...style }
  return onClick ? <Bouncy onClick={onClick} label={label} style={base}>{children}</Bouncy> : <div style={base}>{children}</div>
}

/** Small uppercase label, the voice of instrument panels. */
export function Overline({ text, color = 'var(--onSurfaceVariant)', style }: { text: string; color?: string; style?: CSSProperties }) {
  return <div className="ellipsis" style={{ color, fontSize: 11, lineHeight: '16px', letterSpacing: 1.8, fontWeight: 700, textTransform: 'uppercase', ...style }}>{text}</div>
}

/** Section title with an optional action on the right. */
export function SectionTitle({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 40, padding: '0 2px', ...style }}>
      <div style={{ flex: 1, fontSize: 20, lineHeight: '26px', fontWeight: 700, letterSpacing: -0.2 }}>{title}</div>
      {action && onAction && (
        <Bouncy onClick={onAction} ripple="var(--primary)" style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600, borderRadius: 10, padding: '6px 8px' }}>{action}</Bouncy>
      )}
    </div>
  )
}

/** Big page title with an overline above it. */
export function PageHeading({ overline, title, subtitle, style }: { overline: string; title: string; subtitle?: string; style?: CSSProperties }) {
  return (
    <div style={{ minWidth: 0, ...style }}>
      <Overline text={overline} color="var(--primary)" />
      <div style={{ height: 6 }} />
      <div className="clamp2" style={{ fontSize: 34, lineHeight: '38px', fontWeight: 700, letterSpacing: -0.8, wordBreak: 'break-word' }}>{title}</div>
      {subtitle ? <><div style={{ height: 4 }} /><div style={{ color: 'var(--onSurfaceVariant)', fontSize: 15, lineHeight: '20px' }}>{subtitle}</div></> : null}
    </div>
  )
}

/** Top bar of an inner page: back button and optional title / actions. */
export function PageTopBar({ onBack, backLabel, title, actions }: { onBack: () => void; backLabel: string; title?: string; actions?: ReactNode }) {
  return (
    <div className="status-pad" style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px' }}>
        <RoundIconButton icon="arrowBack" label={`Torna a ${backLabel}`} onClick={onBack} />
        <div className="ellipsis" style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{title}</div>
        {actions}
      </div>
    </div>
  )
}

/** Icon in a soft square tinted badge. */
export function TintBadge({ icon, tint, background, size = 44, iconSize = 22 }: { icon: IconName; tint: string; background: string; size?: number; iconSize?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={iconSize} color={tint} />
    </div>
  )
}

/** Accent icon badge. */
export function AccentBadge({ icon, size = 44, iconSize = 22 }: { icon: IconName; size?: number; iconSize?: number }) {
  return <TintBadge icon={icon} tint="var(--primary)" background="color-mix(in srgb, var(--primary) 13%, transparent)" size={size} iconSize={iconSize} />
}

/** A small coloured dot plus label, the status light of the dashboard. */
export function StatusPill({ label, color, onPhoto = false, style }: { label: string; color: string; onPhoto?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '5px 10px', minWidth: 0,
      background: onPhoto ? 'rgba(0,0,0,.45)' : alpha(color, 0.13), ...style }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span className="ellipsis" style={{ color: onPhoto ? '#FFFFFF' : color, fontSize: 12, lineHeight: '16px', fontWeight: 600 }}>{label}</span>
    </div>
  )
}

export function Divider({ style }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: 'var(--hairline)', flexShrink: 0, ...style }} className="divider" />
}

/** Thin divider between rows of a grouped panel, inset from the left. */
export const RowDivider = ({ inset = 72 }: { inset?: number }) => <Divider style={{ marginLeft: inset }} />

/** One reading of the instrument cluster: big number, small label. */
export function Readout({ label, children, color = 'var(--onSurface)', flex = 1 }: { label: string; children: ReactNode; color?: string; flex?: number }) {
  return (
    <div style={{ flex, minWidth: 0 }}>
      <div style={{ fontSize: 24, lineHeight: '30px', fontWeight: 700, letterSpacing: -0.5, color, fontVariantNumeric: 'tabular-nums' }}>{children}</div>
      <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export const ReadoutDivider = () => <div style={{ width: 1, height: 40, background: 'var(--hairline)', flexShrink: 0 }} />

/** Modifier.staggerIn: fades and lifts 18 px into place, 420 ms, delay min(index, 8) × 45 ms. */
export function Stagger({ index, enabled = true, baseDelay = 45, children, style, className }: {
  index: number; enabled?: boolean; baseDelay?: number; children: ReactNode; style?: CSSProperties; className?: string
}) {
  if (!enabled) return <div style={style} className={className}>{children}</div>
  return (
    <motion.div className={className} style={style}
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ ...tween(420), delay: (Math.min(index, 8) * baseDelay) / 1000 }}>
      {children}
    </motion.div>
  )
}

/** AnimatedCount: counts up from zero, tween 900 ms. */
export function AnimatedCount({ value, style, animate: run = true, format = (v: number) => groupedInt(v) }: {
  value: number; style?: CSSProperties; animate?: boolean; format?: (v: number) => string
}) {
  const progress = useMotionValue(run ? 0 : 1)
  const text = useTransform(progress, (p) => format(value * p))
  useEffect(() => {
    const controls = animate(progress, 1, tween(900))
    return () => controls.stop()
  }, [value, progress])
  return <motion.span className="ellipsis" style={{ display: 'block', ...style }}>{text}</motion.span>
}

/** Gauge: a 270° speedometer arc, sweeping to [fraction]. */
export function Gauge({ fraction, color, size, stroke = 5, children }: { fraction: number; color: string; size: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const full = 2 * Math.PI * r
  const arc = full * 0.75
  const target = Math.min(1, Math.max(0, fraction))
  const c = size / 2
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="color-mix(in srgb, var(--outline) 18%, transparent)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${arc} ${full}`} transform={`rotate(135 ${c} ${c})`} />
        {target > 0 && (
          <motion.circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" transform={`rotate(135 ${c} ${c})`}
            strokeDasharray={`${arc} ${full}`} initial={{ strokeDashoffset: arc }} animate={{ strokeDashoffset: arc * (1 - target) }} transition={tween(1100)} />
        )}
      </svg>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

/** VehicleImage: the photo, cropped to fill. */
export function VehicleImage({ src, radius = 0, style }: { src: string; radius?: number; style?: CSSProperties }) {
  return (
    <div style={{ borderRadius: radius, overflow: 'hidden', ...style }}>
      <img src={src} alt="Foto auto" draggable={false} decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

/** Centered empty state with a badge, used when a list has nothing yet. */
export function EmptyState({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <Panel padding={24} style={{ alignItems: 'center', textAlign: 'center' }}>
      <AccentBadge icon={icon} size={56} iconSize={28} />
      <div style={{ height: 14 }} />
      <div style={{ fontSize: 18, lineHeight: '24px', fontWeight: 700 }}>{title}</div>
      <div style={{ height: 4 }} />
      <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 14, lineHeight: '19px' }}>{subtitle}</div>
    </Panel>
  )
}

/** Filter pill: accent fill when selected. */
export function Pill({ selected, label, icon, onClick }: { selected: boolean; label: string; icon?: IconName; onClick: () => void }) {
  const fg = selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)'
  return (
    <Bouncy onClick={onClick} role="radio" ripple={fg} style={{
      height: 38, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px',
      background: selected ? 'var(--primary)' : 'var(--surface)', border: `1px solid ${selected ? 'transparent' : 'var(--hairline)'}`,
      transition: 'background-color 200ms',
    }}>
      {icon && <Icon name={icon} size={17} color={fg} />}
      <span style={{ fontSize: 13, lineHeight: '20px', whiteSpace: 'nowrap', color: fg, fontWeight: selected ? 700 : 500 }}>{label}</span>
    </Bouncy>
  )
}

/** M3 Switch. */
export function Switch({ checked, onChange, enabled = true }: { checked: boolean; onChange: (value: boolean) => void; enabled?: boolean }) {
  const [pressed, setPressed] = useState(false)
  const thumb = pressed ? 28 : checked ? 24 : 16
  return (
    <div role="switch" aria-checked={checked} tabIndex={enabled ? 0 : -1}
      onClick={() => enabled && onChange(!checked)}
      onKeyDown={(e) => { if (enabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onChange(!checked) } }}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)} onPointerCancel={() => setPressed(false)}
      style={{
        width: 52, height: 32, borderRadius: 16, flexShrink: 0, position: 'relative', cursor: enabled ? 'pointer' : 'default',
        background: checked ? 'var(--primary)' : 'var(--surfaceContainerHighest)',
        border: checked ? '2px solid transparent' : '2px solid var(--outline)', transition: 'background-color 150ms, border-color 150ms',
        opacity: enabled ? 1 : 0.38,
      }}>
      <motion.div
        animate={{ x: checked ? 20 + (24 - thumb) / 2 : (24 - thumb) / 2 - 2 + 4, width: thumb, height: thumb }}
        transition={spring(1, Stiffness.Medium)}
        style={{ position: 'absolute', top: '50%', marginTop: -thumb / 2, left: 0, borderRadius: '50%',
          background: checked ? 'var(--onPrimary)' : 'var(--outline)' }} />
    </div>
  )
}

/** M3 Slider (Material 3 1.4): a 16 dp rounded track with a 4 × 44 dp handle. */
export function Slider({ value, min, max, onChange, enabled = true }: { value: number; min: number; max: number; onChange: (v: number) => void; enabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const fraction = (value - min) / (max - min)
  const update = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onChange(min + f * (max - min))
  }
  return (
    <div ref={track} style={{ height: 44, position: 'relative', touchAction: 'none', cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.38 }}
      onPointerDown={(e) => { if (!enabled) return; e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); update(e.clientX) }}
      onPointerMove={(e) => { if (dragging) update(e.clientX) }}
      onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
      <div style={{ position: 'absolute', left: 0, top: 14, height: 16, width: `calc(${fraction * 100}% - 6px)`, borderRadius: '8px 2px 2px 8px', background: 'var(--primary)' }} />
      <div style={{ position: 'absolute', right: 0, top: 14, height: 16, width: `calc(${(1 - fraction) * 100}% - 6px)`, borderRadius: '2px 8px 8px 2px', background: 'var(--secondaryContainer)' }} />
      <div style={{ position: 'absolute', top: 0, left: `calc(${fraction * 100}% - 2px)`, width: dragging ? 2 : 4, marginLeft: dragging ? 1 : 0, height: 44, borderRadius: 2, background: 'var(--primary)' }} />
    </div>
  )
}

/**
 * Full-screen editor frame: close button, big title, the form scrolling in between and the save bar
 * pinned at the bottom.
 */
export function EditorScaffold({ overline, title, subtitle, onDismiss, saveLabel, onSave, header, children, scrollRef }: {
  overline: string; title: string; subtitle: string; onDismiss: () => void; saveLabel: string; onSave: () => void
  header?: ReactNode; children: ReactNode; scrollRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="status-pad" style={{ flexShrink: 0 }}>
        <div style={{ padding: '8px 14px' }}><RoundIconButton icon="close" label="Chiudi senza salvare" onClick={onDismiss} /></div>
      </div>
      <div ref={scrollRef} className="scroll-y" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <div style={{ padding: '6px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Stagger index={0} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
            <PageHeading overline={overline} title={title} subtitle={subtitle} style={{ flex: 1 }} />
            {header}
          </Stagger>
          {children}
        </div>
      </div>
      <div className="nav-pad" style={{ flexShrink: 0, background: 'var(--background)', borderTop: '1px solid var(--hairline)' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 20px' }}>
          <GhostButton onClick={onDismiss} style={{ flex: 1 }}>Annulla</GhostButton>
          <AccentButton onClick={onSave} style={{ flex: 1.5 }}><span className="ellipsis">{saveLabel}</span></AccentButton>
        </div>
      </div>
    </div>
  )
}

export { accentGradient }
