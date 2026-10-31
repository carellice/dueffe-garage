import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode,
  useCallback, useEffect, useRef, useState,
} from 'react'
import { icons, type IconName } from '../lib/icons.ts'
import { fastOutSlowIn, spring, tween } from './motion.ts'

// The building blocks of GarageDesign.kt and the Material 3 components the screens use.

export function Icon({ name, size = 24, color, style }: { name: IconName | string; size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ flex: 'none', display: 'block', color, ...style }} aria-hidden
      dangerouslySetInnerHTML={{ __html: icons[name as IconName] ?? '' }} />
  )
}

// --- press feedback ------------------------------------------------------------------------------

/** Material ripple: a circle grows from the touch point while pressed. */
function useRipple(color?: string) {
  const host = useRef<HTMLElement | null>(null)
  const current = useRef<HTMLSpanElement | null>(null)
  const start = useCallback((e: ReactPointerEvent) => {
    const el = host.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    const r = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
    const span = document.createElement('span')
    span.className = 'ripple'
    Object.assign(span.style, { left: `${x - r}px`, top: `${y - r}px`, width: `${2 * r}px`, height: `${2 * r}px` })
    if (color) span.style.background = color
    el.appendChild(span)
    current.current = span
  }, [color])
  const end = useCallback(() => {
    const span = current.current
    current.current = null
    if (!span) return
    span.classList.add('out')
    setTimeout(() => span.remove(), 500)
  }, [])
  return { host, start, end }
}

type PressableProps = {
  onClick?: () => void
  children?: ReactNode
  style?: CSSProperties
  className?: string
  /** pressScale target, .965 by default; 1 = no scale (plain clickable). */
  pressed?: number
  ripple?: boolean
  rippleColor?: string
  disabled?: boolean
  label?: string
  role?: string
  selected?: boolean
}

/** Modifier.bouncyClick: shrinks slightly while pressed, springing back on release, with a ripple. */
export function Pressable({ onClick, children, style, className, pressed = 0.965, ripple = true, rippleColor, disabled, label, role = 'button', selected }: PressableProps) {
  const { host, start, end } = useRipple(rippleColor)
  const [down, setDown] = useState(false)
  return (
    <motion.div
      ref={host as never}
      role={role}
      aria-label={label}
      aria-selected={role === 'tab' ? selected : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={`ripple-host ${className ?? ''}`}
      style={{ cursor: disabled ? 'default' : 'pointer', ...style }}
      animate={{ scale: down && pressed !== 1 ? pressed : 1 }}
      transition={spring(0.55, 1500)}
      onPointerDown={(e) => {
        if (disabled) return
        setDown(true)
        if (ripple) start(e)
      }}
      onPointerUp={() => { setDown(false); end() }}
      onPointerLeave={() => { setDown(false); end() }}
      onPointerCancel={() => { setDown(false); end() }}
      onClick={() => { if (!disabled) onClick?.() }}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.() } }}
    >
      {children}
    </motion.div>
  )
}

// --- GarageDesign ---------------------------------------------------------------------------

export function GradientButton({ onClick, children, style, radius = 28, enabled = true, padding = '0 20px', shine = false, height = 48, label }: {
  onClick: () => void; children: ReactNode; style?: CSSProperties; radius?: number; enabled?: boolean; padding?: string
  shine?: boolean; height?: number; label?: string
}) {
  return (
    <Pressable onClick={onClick} disabled={!enabled} rippleColor="#fff" label={label} className={shine && enabled ? 'shimmer' : undefined}
      style={{
        minHeight: 48, height, borderRadius: radius, background: 'var(--accent)', color: 'var(--onAccent)',
        boxShadow: enabled ? '0 6px 14px rgba(255,159,28,.30), 0 2px 5px rgba(255,159,28,.25)' : 'none',
        opacity: enabled ? 1 : 0.45, padding, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, lineHeight: '20px', letterSpacing: 0.2, ...style,
      }}>
      {children}
    </Pressable>
  )
}

/** GlassCard: elevated card with a hairline border, the base surface of the redesign. */
export function GlassCard({ children, style, radius = 26, padding = 18 }: { children: ReactNode; style?: CSSProperties; radius?: number; padding?: number }) {
  return (
    <div style={{
      borderRadius: radius, background: 'var(--surface)', border: '1px solid var(--hairline)',
      boxShadow: 'var(--cardShadow)', padding, display: 'flex', flexDirection: 'column', ...style,
    }}>
      {children}
    </div>
  )
}

/** Round icon badge filled with the brand gradient. */
export function GradientIcon({ icon, size = 46, iconSize = 23 }: { icon: string; size?: number; iconSize?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={icon} size={iconSize} color="var(--onAccent)" />
    </div>
  )
}

/** Number that counts up from zero when first shown (tween 1100 ms FastOutSlowIn). */
export function AnimatedCount({ value, format, animateIn = true, style }: { value: number; format: (v: number) => string; animateIn?: boolean; style?: CSSProperties }) {
  const progress = useMotionValue(animateIn ? 0 : 1)
  useEffect(() => {
    const controls = animate(progress, 1, tween(1100))
    return () => controls.stop()
  }, [value, progress])
  const text = useTransform(progress, (p) => format(value * p))
  return <motion.span className="ellipsis" style={{ display: 'block', ...style }}>{text}</motion.span>
}

/** Progress ring drawn behind [children], animated to [fraction] (tween 1200 ms). */
export function ProgressRing({ fraction, color, size, stroke = 5, children }: { fraction: number; color: string; size: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const target = Math.min(1, Math.max(0, fraction))
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--outline)" strokeOpacity={0.16} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - target), opacity: target === 0 ? 0 : 1 }}
          transition={{ duration: 1.2, ease: fastOutSlowIn }} />
      </svg>
      {children}
    </div>
  )
}

/** Text filled with the brand gradient. */
export function GradientText({ text, size, lineHeight }: { text: string; size: number; lineHeight?: number }) {
  return (
    <div className="gradient-text" style={{ fontSize: size, lineHeight: `${lineHeight ?? Math.round(size * 1.08)}px`, fontWeight: 900, letterSpacing: -0.5 }}>{text}</div>
  )
}

/** Modifier.staggerIn: fades and lifts content into place, staggered by [index]. */
export function Stagger({ index, children, enabled = true, base = 40, style }: { index: number; children: ReactNode; enabled?: boolean; base?: number; style?: CSSProperties }) {
  if (!enabled) return <div style={style}>{children}</div>
  return (
    <motion.div style={style} initial={{ opacity: 0, y: 46, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring(0.82, 200), delay: (Math.min(index, 10) * base) / 1000 }}>
      {children}
    </motion.div>
  )
}

export function Kicker({ text, color = 'var(--primary)' }: { text: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ width: 18, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
      <div style={{ width: 8 }} />
      <span style={{ color, fontSize: 11, letterSpacing: 2.4, fontWeight: 900, textTransform: 'uppercase' }}>{text}</span>
    </div>
  )
}

export function SectionHeading({ kicker, title, subtitle = '' }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <Stagger index={0} style={{ paddingBottom: 8 }}>
      <Kicker text={kicker.toLocaleUpperCase('it-IT')} />
      <div style={{ height: 6 }} />
      <div style={{ fontSize: 34, lineHeight: '37px', fontWeight: 900, letterSpacing: -0.6 }}>{title}</div>
      {subtitle && <><div style={{ height: 3 }} /><div style={{ color: 'var(--onSurfaceVariant)', fontSize: 15 }}>{subtitle}</div></>}
    </Stagger>
  )
}

export function Divider({ alpha = 0.18, style }: { alpha?: number; style?: CSSProperties }) {
  return <div style={{ height: 1, flex: 'none', background: 'var(--outline)', opacity: alpha, ...style }} />
}

export function VDivider({ height, alpha = 0.18 }: { height: number; alpha?: number }) {
  return <div style={{ width: 1, height, flex: 'none', background: 'var(--outline)', opacity: alpha }} />
}

/** EmptyIllustration of HomeScreens.kt: a bobbing badge (±6, 1800 ms reverse). */
export function EmptyIllustration({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <GlassCard padding={26} style={{ alignItems: 'center' }}>
      <motion.div style={{ width: 96, height: 96, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        initial={{ y: -6 }} animate={{ y: 6 }} transition={{ duration: 1.8, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,216,77,.35), transparent)' }} />
        <GradientIcon icon={icon} size={64} iconSize={32} />
      </motion.div>
      <div style={{ height: 14 }} />
      <div style={{ fontSize: 21, fontWeight: 900, textAlign: 'center' }}>{title}</div>
      <div style={{ height: 4 }} />
      <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 14, lineHeight: '19px', textAlign: 'center' }}>{subtitle}</div>
    </GlassCard>
  )
}

// --- Material 3 buttons ------------------------------------------------------------------------

type ButtonProps = { onClick: () => void; children: ReactNode; style?: CSSProperties; disabled?: boolean; color?: string; label?: string }

const labelLarge: CSSProperties = { fontSize: 14, lineHeight: '20px', fontWeight: 700, letterSpacing: 0.2 }

/** OutlinedButton: full radius, 1 dp outlineVariant border, primary content. */
export function OutlinedButton({ onClick, children, style, disabled, color = 'var(--primary)', label }: ButtonProps) {
  return (
    <Pressable onClick={onClick} disabled={disabled} pressed={1} label={label} style={{
      minHeight: 40, borderRadius: 999, border: '1px solid var(--outlineVariant)', color, padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.38 : 1, ...labelLarge, ...style,
    }}>{children}</Pressable>
  )
}

export function TextButton({ onClick, children, style, disabled, color = 'var(--primary)', label }: ButtonProps) {
  return (
    <Pressable onClick={onClick} disabled={disabled} pressed={1} label={label} style={{
      minHeight: 40, borderRadius: 999, color, padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.38 : 1, ...labelLarge, ...style,
    }}>{children}</Pressable>
  )
}

/** GarageBackButton: FilledTonalButton with the back arrow. */
export function BackButton({ label, onClick, style }: { label: string; onClick: () => void; style?: CSSProperties }) {
  return (
    <Pressable onClick={onClick} pressed={1} label={label} style={{
      alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '9px 15px', borderRadius: 24,
      background: 'var(--secondaryContainer)', color: 'var(--onSecondaryContainer)', ...labelLarge, fontWeight: 600, ...style,
    }}>
      <Icon name="arrow-back" size={20} />
      <span style={{ width: 7 }} />
      {label}
    </Pressable>
  )
}

// --- Material 3 Switch and Slider -----------------------------------------------------------

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const [pressed, setPressed] = useState(false)
  const thumb = pressed ? 28 : checked ? 24 : 16
  return (
    <div role="switch" aria-checked={checked} aria-disabled={disabled || undefined} tabIndex={0}
      onPointerDown={() => !disabled && setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onChange(!checked) } }}
      style={{
        width: 52, height: 32, borderRadius: 16, flex: 'none', position: 'relative', cursor: disabled ? 'default' : 'pointer',
        background: checked ? 'var(--primary)' : 'var(--surfaceContainerHighest)',
        border: checked ? '2px solid transparent' : '2px solid var(--outline)', opacity: disabled ? 0.38 : 1,
        transition: 'background 150ms, border-color 150ms',
      }}>
      <motion.div
        animate={{ x: checked ? 28 - thumb / 2 + 4 : 14 - thumb / 2 - 2, width: thumb, height: thumb }}
        transition={spring(1, 1500)}
        style={{
          position: 'absolute', top: '50%', marginTop: -thumb / 2, left: 0, borderRadius: '50%',
          background: checked ? 'var(--onPrimary)' : 'var(--outline)',
        }} />
    </div>
  )
}

/** Material 3 Slider (1.4): 16 dp track with a gap around the 4×44 dp handle. */
export function Slider({ value, min, max, onChange, onCommit, disabled }: {
  value: number; min: number; max: number; onChange: (v: number) => void; onCommit?: (v: number) => void; disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const fraction = (value - min) / (max - min)
  const fromEvent = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - rect.left - 10) / (rect.width - 20)))
    return min + f * (max - min)
  }
  const latest = useRef(value)
  latest.current = value
  return (
    <div ref={ref} role="slider" aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-disabled={disabled || undefined}
      style={{ height: 44, position: 'relative', touchAction: 'none', opacity: disabled ? 0.38 : 1, cursor: disabled ? 'default' : 'pointer' }}
      onPointerDown={(e) => {
        if (disabled) return
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        setDragging(true)
        onChange(fromEvent(e.clientX))
      }}
      onPointerMove={(e) => { if (dragging) onChange(fromEvent(e.clientX)) }}
      onPointerUp={() => { if (dragging) { setDragging(false); onCommit?.(latest.current) } }}
      onPointerCancel={() => setDragging(false)}>
      <div style={{ position: 'absolute', left: 10, right: 10, top: 14, height: 16 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `calc(${fraction * 100}% - 6px)`, background: 'var(--primary)', borderRadius: '8px 2px 2px 8px', minWidth: 0 }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `calc(${(1 - fraction) * 100}% - 6px)`, background: 'var(--secondaryContainer)', borderRadius: '2px 8px 8px 2px' }} />
        <div style={{ position: 'absolute', right: 6, top: 6, width: 4, height: 4, borderRadius: 2, background: 'var(--primary)' }} />
        <motion.div animate={{ width: dragging ? 2 : 4 }} style={{
          position: 'absolute', left: `${fraction * 100}%`, top: -14, height: 44, marginLeft: -2, borderRadius: 2, background: 'var(--primary)',
        }} />
      </div>
    </div>
  )
}
