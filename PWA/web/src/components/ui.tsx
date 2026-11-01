import { animate, motion, useMotionValue, useTransform, type HTMLMotionProps } from 'framer-motion'
import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { icons, type IconName } from '../lib/icons.gen.ts'
import { Gold, accentGradient, alpha, useDark } from '../lib/theme.ts'
import { groupedInt } from '../../../shared/format.ts'
import { fastOutSlowIn, spring, Stiffness, tween } from './motion.ts'

// The building blocks of GarageDesign.kt and the Material 3 components the app uses.

export function Icon({ name, size = 24, color, style }: { name: IconName; size?: number; color?: string; style?: CSSProperties }) {
  const icon = icons[name]
  return (
    <svg width={size} height={size} viewBox={icon.viewBox} style={{ color, flexShrink: 0, ...style }} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.body }} />
  )
}

// --- Brush.linearGradient: from the top left to the bottom right corner of each element -------

const observed = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect
    const el = entry.target as HTMLElement
    // Compose draws the gradient along the diagonal (0,0)→(w,h); CSS angles count from "to top", clockwise.
    if (width > 0 && height > 0) el.style.setProperty('--ga', `${90 + (Math.atan2(height, width) * 180) / Math.PI}deg`)
  }
})

/** Ref for elements with the accent gradient (.accent-bg / .accent-text) that are not square. */
export function useGradient<T extends HTMLElement>() {
  const last = useRef<T | null>(null)
  return useCallback((el: T | null) => {
    if (last.current) observed.unobserve(last.current)
    last.current = el
    if (el) observed.observe(el, { box: 'border-box' })
  }, [])
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
  /** Modifier.pressScale(pressed) */
  pressed?: number
  ripple?: string | false
  disabled?: boolean
  label?: string
  role?: string
}

/** Modifier.bouncyClick: shrinks to .965 while pressed, springs back, with a ripple. */
export const Bouncy = forwardRef<HTMLDivElement, BouncyProps>(function Bouncy({ onClick, pressed = 0.965, ripple = 'currentColor', disabled, label, role = 'button', className, children, onPointerDown, ...rest }, ref) {
  return (
    <motion.div
      {...rest}
      ref={ref}
      role={role}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={`tap ${className ?? ''}`}
      whileTap={disabled ? undefined : { scale: pressed }}
      transition={spring(0.55, Stiffness.Medium)}
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

/** Modifier.shimmer: a diagonal light sweep every 2.6 s after 0.9 s. */
function Shimmer() {
  const ref = useGradient<HTMLDivElement>()
  // The band spans (x - .35) w → x w along the diagonal, x from -1 to 2: as a translation of its own width.
  return (
    <motion.div ref={ref} aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '35%', pointerEvents: 'none',
      background: 'linear-gradient(var(--ga, 110deg), transparent, rgba(255,255,255,.28), transparent)' }}
      initial={{ x: '-386%' }} animate={{ x: ['-386%', '-386%', '471%'] }}
      transition={{ duration: 3.5, times: [0, 0.257, 1], ease: 'linear', repeat: Infinity }} />
  )
}

export function GradientButton({ onClick, children, style, radius = 28, height, enabled = true, shine = false, padding = '0 20px', fontSize = 15, layoutRef }: {
  onClick: () => void; children: ReactNode; style?: CSSProperties; radius?: number; height?: number; enabled?: boolean
  shine?: boolean; padding?: string; fontSize?: number; layoutRef?: (el: HTMLDivElement | null) => void
}) {
  const gradient = useGradient<HTMLDivElement>()
  const ref = useCallback((el: HTMLDivElement | null) => { gradient(el); layoutRef?.(el) }, [gradient, layoutRef])
  return (
    <Bouncy ref={ref} onClick={onClick} disabled={!enabled} ripple="#FFFFFF" className="accent-bg"
      style={{
        minHeight: 48, height, borderRadius: radius, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding, color: 'var(--onAccent)', fontSize, fontWeight: 700, letterSpacing: 0.2, lineHeight: '20px',
        boxShadow: enabled ? `0 6px 14px ${alpha('#FF9F1C', 0.32)}, 0 2px 5px ${alpha('#FF9F1C', 0.22)}` : 'none',
        opacity: enabled ? 1 : 0.45, ...style,
      }}>
      {shine && enabled && <Shimmer />}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>{children}</span>
    </Bouncy>
  )
}

/** M3 OutlinedButton. */
export function OutlinedButton({ onClick, children, style, color = 'var(--primary)', border = 'var(--outlineVariant)', height = 40, radius = 20, disabled }: {
  onClick: () => void; children: ReactNode; style?: CSSProperties; color?: string; border?: string; height?: number; radius?: number; disabled?: boolean
}) {
  return (
    <Tap onClick={onClick} disabled={disabled} style={{
      height, borderRadius: radius, border: `1px solid ${border}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0, padding: '0 24px', fontSize: 14, fontWeight: 500, letterSpacing: 0.1, lineHeight: '20px', opacity: disabled ? 0.38 : 1, ...style,
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

/** GarageBackButton: FilledTonalButton with the back arrow. */
export function BackButton({ label, onClick, style }: { label: string; onClick: () => void; style?: CSSProperties }) {
  return (
    <Tap onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', minHeight: 40, borderRadius: 24, padding: '9px 15px',
      background: 'var(--secondaryContainer)', color: 'var(--onSecondaryContainer)', fontSize: 14, fontWeight: 600, letterSpacing: 0.1, lineHeight: '20px', ...style,
    }}>
      <Icon name="arrowBack" size={20} />
      <span style={{ width: 7 }} />
      {label}
    </Tap>
  )
}

// --- surfaces ---------------------------------------------------------------------------------

/** GlassCard: elevated card with a hairline border. */
export function GlassCard({ children, radius = 26, padding = 18, style, className }: { children: ReactNode; radius?: number; padding?: number; style?: CSSProperties; className?: string }) {
  const dark = useDark()
  return (
    <div className={className} style={{
      borderRadius: radius, background: 'var(--surface)', border: '1px solid var(--hairline)', padding,
      boxShadow: dark ? 'none' : '0 4px 10px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', ...style,
    }}>{children}</div>
  )
}

/** GradientIcon: round badge filled with the brand gradient. */
export function GradientIcon({ icon, size = 46, iconSize = 23 }: { icon: IconName; size?: number; iconSize?: number }) {
  return (
    <div className="accent-bg" style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={iconSize} color="var(--onAccent)" />
    </div>
  )
}

export function Divider({ style }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: 'color-mix(in srgb, var(--outline) 17%, transparent)', flexShrink: 0, ...style }} className="divider" />
}

/** GradientText */
export function GradientText({ text, size, lineHeight }: { text: string; size: number; lineHeight?: number }) {
  const ref = useGradient<HTMLSpanElement>()
  return (
    <span ref={ref} className="accent-text" style={{ display: 'inline-block', fontSize: size, lineHeight: `${lineHeight ?? size * 1.08}px`, fontWeight: 900, letterSpacing: -0.5 }}>
      {text}
    </span>
  )
}

/** The small gradient dash before every kicker. */
export function Dash() {
  const ref = useGradient<HTMLDivElement>()
  return <div ref={ref} className="accent-bg" style={{ width: 18, height: 3, borderRadius: 2, flexShrink: 0 }} />
}

/** SectionHeading */
export function SectionHeading({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <Stagger index={0} style={{ paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Dash />
        <span style={{ width: 8 }} />
        <span className="kicker" style={{ color: 'var(--primary)', letterSpacing: 2.4 }}>{kicker}</span>
      </div>
      <div style={{ height: 6 }} />
      <div style={{ fontSize: 34, lineHeight: '37px', fontWeight: 900, letterSpacing: -0.6 }}>{title}</div>
      {subtitle ? <><div style={{ height: 3 }} /><div style={{ color: 'var(--onSurfaceVariant)', fontSize: 15, lineHeight: '24px', letterSpacing: 0.5 }}>{subtitle}</div></> : null}
    </Stagger>
  )
}

/** Modifier.staggerIn: fades and lifts into place, delay min(index, 10) × 40 ms, spring(0.82, Low). */
export function Stagger({ index, enabled = true, baseDelay = 40, children, style, className }: {
  index: number; enabled?: boolean; baseDelay?: number; children: ReactNode; style?: CSSProperties; className?: string
}) {
  if (!enabled) return <div style={style} className={className}>{children}</div>
  return (
    <motion.div className={className} style={style}
      initial={{ opacity: 0, y: 46, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring(0.82, Stiffness.Low), delay: (Math.min(index, 10) * baseDelay) / 1000, opacity: { ...spring(0.82, Stiffness.Low), delay: (Math.min(index, 10) * baseDelay) / 1000, restDelta: 0.01 } }}>
      {children}
    </motion.div>
  )
}

/** AnimatedCount: counts up from zero, tween 1100 ms. */
export function AnimatedCount({ value, style, animate: run = true, format = (v: number) => groupedInt(v) }: {
  value: number; style?: CSSProperties; animate?: boolean; format?: (v: number) => string
}) {
  const progress = useMotionValue(run ? 0 : 1)
  const text = useTransform(progress, (p) => format(value * p))
  useEffect(() => {
    const controls = animate(progress, 1, tween(1100))
    return () => controls.stop()
  }, [value, progress])
  return <motion.span className="ellipsis" style={{ display: 'block', ...style }}>{text}</motion.span>
}

/** ProgressRing: a track and an arc from the top, animated to [fraction] in 1200 ms. */
export function ProgressRing({ fraction, color, size, stroke = 5, children }: { fraction: number; color: string; size: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const target = Math.min(1, Math.max(0, fraction))
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb, var(--outline) 16%, transparent)" strokeWidth={stroke} className="ring-track" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap={target > 0 ? 'round' : 'butt'}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - target) }} transition={tween(1200)} />
      </svg>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

/** VehicleImage: the photo, cropped to fill. */
export function VehicleImage({ src, radius = 18, style }: { src: string; radius?: number; style?: CSSProperties }) {
  return (
    <div style={{ borderRadius: radius, overflow: 'hidden', background: 'var(--background)', ...style }}>
      <img src={src} alt="Foto auto" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

/** EmptyIllustration: floating gradient icon in a card. */
export function EmptyIllustration({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <GlassCard padding={26} style={{ alignItems: 'center' }}>
      <motion.div style={{ width: 96, height: 96, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        initial={{ y: -6 }} animate={{ y: 6 }} transition={{ duration: 1.8, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle closest-side, ${alpha(Gold, 0.35)}, transparent)` }} />
        <div style={{ position: 'relative' }}><GradientIcon icon={icon} size={64} iconSize={32} /></div>
      </motion.div>
      <div style={{ height: 14 }} />
      <div style={{ fontSize: 21, lineHeight: '28px', fontWeight: 900, textAlign: 'center', letterSpacing: 0 }}>{title}</div>
      <div style={{ height: 4 }} />
      <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 14, lineHeight: '19px', textAlign: 'center', letterSpacing: 0.25 }}>{subtitle}</div>
    </GlassCard>
  )
}

/** DetailEmptyState */
export function DetailEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ borderRadius: 23, background: 'var(--surface)', padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <GradientIcon icon="document" size={56} iconSize={27} />
      <div style={{ height: 9 }} />
      <div style={{ fontWeight: 700, fontSize: 16, lineHeight: '24px', letterSpacing: 0.5 }}>{title}</div>
      <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', textAlign: 'center', letterSpacing: 0.5 }}>{subtitle}</div>
    </div>
  )
}

/** The filter pills of the Diario: height 43, secondaryContainer when selected. */
export function Pill({ selected, label, icon, iconColor, radius = 13, padding = 14, iconSize = 20, onClick }: {
  selected: boolean; label: string; icon?: IconName; iconColor?: string; radius?: number; padding?: number; iconSize?: number; onClick: () => void
}) {
  return (
    <Bouncy onClick={onClick} role="radio" style={{
      height: 43, borderRadius: radius, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: `0 ${padding}px`,
      background: selected ? 'var(--secondaryContainer)' : 'var(--surface)',
      border: `1px solid ${selected ? 'var(--secondaryContainer)' : 'color-mix(in srgb, var(--outline) 38%, transparent)'}`,
    }}>
      {icon && <Icon name={icon} size={iconSize} color={iconColor ?? 'var(--onSurfaceVariant)'} />}
      <span style={{ fontSize: 13, lineHeight: '20px', letterSpacing: 0.5, whiteSpace: 'nowrap',
        color: selected ? 'var(--onSecondaryContainer)' : 'var(--onSurfaceVariant)', fontWeight: selected ? 700 : 500 }}>{label}</span>
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

export { accentGradient }
