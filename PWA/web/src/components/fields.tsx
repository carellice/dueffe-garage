import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon, Tap } from './ui.tsx'
import { DatePickerDialog, Menu } from './overlays.tsx'
import type { IconName } from '../lib/icons.gen.ts'
import { dateLabel } from '../../../shared/format.ts'

// Text fields of Screens.kt: the Material 3 OutlinedTextField and the custom frames of the forms.

const outline = (pct: number) => `color-mix(in srgb, var(--outline) ${pct}%, transparent)`

/** MaintenanceIcon: icon in a 34 dp circle. */
export function FieldIcon({ icon, size = 19 }: { icon: IconName; size?: number }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={size} color="var(--primary)" />
    </div>
  )
}

type InputMode = 'text' | 'numeric' | 'decimal'

/** M3 OutlinedTextField with a floating label. */
export function OutlinedField({ value, onChange, label, placeholder, leading, suffix, radius = 4, bg = 'transparent', container, border = 'var(--outline)',
  inputMode = 'text', type = 'text', autoComplete, bold = false, fontSize = 16, style, onFocusChange, onEnter, readOnly, trailing, onClick, inputRef, maxLength, autoFocus }: {
  value: string; onChange?: (value: string) => void; label?: string; placeholder?: string; leading?: ReactNode; suffix?: string
  radius?: number; bg?: string; container?: string; border?: string; inputMode?: InputMode; type?: string; autoComplete?: string
  bold?: boolean; fontSize?: number; style?: CSSProperties; onFocusChange?: (focused: boolean) => void; onEnter?: () => void
  readOnly?: boolean; trailing?: ReactNode; onClick?: () => void; inputRef?: (el: HTMLInputElement | null) => void; maxLength?: number; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const id = useId()
  const floated = focused || value !== '' || (!!placeholder && focused)
  const active = focused && !readOnly
  const labelBg = container ?? bg
  return (
    <div style={{ position: 'relative', minHeight: 56, borderRadius: radius, background: container, display: 'flex', alignItems: 'center', cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none',
        border: active ? '2px solid var(--primary)' : `1px solid ${border}` }} />
      {leading && <div style={{ width: 52, display: 'flex', justifyContent: 'center', flexShrink: 0, paddingLeft: 4 }}>{leading}</div>}
      <div style={{ position: 'relative', flex: 1, alignSelf: 'stretch', display: 'flex', alignItems: 'center', paddingLeft: leading ? 0 : 16, paddingRight: trailing ? 0 : 16 }}>
        {label && (
          <label htmlFor={id} style={{
            position: 'absolute', pointerEvents: 'none', whiteSpace: 'nowrap', transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
            left: floated ? (leading ? -40 : 12) : (leading ? 0 : 16), top: floated ? -9 : '50%', transform: floated ? 'none' : 'translateY(-50%)',
            fontSize: floated ? 12 : 16, lineHeight: floated ? '16px' : '24px', padding: floated ? '0 4px' : 0, background: floated ? labelBg : 'transparent',
            color: active ? 'var(--primary)' : 'var(--onSurfaceVariant)', letterSpacing: floated ? 0.4 : 0.5,
          }}>{label}</label>
        )}
        <input id={id} ref={inputRef} value={value} readOnly={readOnly} type={type} inputMode={inputMode} autoComplete={autoComplete} maxLength={maxLength} autoFocus={autoFocus}
          placeholder={floated || !label ? placeholder : undefined}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => { setFocused(true); onFocusChange?.(true) }}
          onBlur={() => { setFocused(false); onFocusChange?.(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.() }}
          style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--onSurface)', fontSize, lineHeight: '24px',
            letterSpacing: 0.5, fontWeight: bold ? 600 : 400, padding: '16px 0', caretColor: 'var(--primary)', cursor: onClick ? 'pointer' : undefined }} />
        {suffix && floated && <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, paddingLeft: 4 }}>{suffix}</span>}
      </div>
      {trailing && <div style={{ width: 48, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>{trailing}</div>}
    </div>
  )
}

/** MaintenanceInput: outlined field with the round icon, radius 16, surface container. */
export function MaintenanceInput({ value, onChange, label, icon, suffix, inputMode, onFocusChange, style }: {
  value: string; onChange: (v: string) => void; label: string; icon: IconName; suffix?: string; inputMode?: InputMode; onFocusChange?: (f: boolean) => void; style?: CSSProperties
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  return (
    <OutlinedField value={value} onChange={onChange} label={label} leading={<FieldIcon icon={icon} />} suffix={suffix} radius={16}
      container="var(--surface)" border={outline(43)} inputMode={inputMode} bold style={style}
      inputRef={(el) => { ref.current = el }}
      onFocusChange={(f) => {
        onFocusChange?.(f)
        if (f) setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 240)
      }} />
  )
}

/** VehicleFieldFrame: icon, small label and the content, radius 16, min height 59. */
export function VehicleFieldFrame({ label, icon, highlighted = false, onClick, trailing, children, style, frameRef }: {
  label: string; icon: IconName; highlighted?: boolean; onClick?: () => void; trailing?: ReactNode; children: ReactNode; style?: CSSProperties
  frameRef?: (el: HTMLDivElement | null) => void
}) {
  const content = (
    <>
      <FieldIcon icon={icon} />
      <div style={{ width: 9 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, lineHeight: '16px', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ height: 2 }} />
        {children}
      </div>
      {trailing}
    </>
  )
  const frame: CSSProperties = {
    minHeight: 59, borderRadius: 16, background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '7px 10px',
    border: `1px solid ${highlighted ? 'var(--primary)' : outline(32)}`, ...style,
  }
  return (
    <div ref={frameRef} style={style?.flex ? { flex: style.flex, minWidth: 0 } : undefined}>
      {onClick ? <Tap onClick={onClick} style={frame} ripple="var(--onSurface)">{content}</Tap> : <div style={frame}>{content}</div>}
    </div>
  )
}

/** VehicleTextField */
export function VehicleTextField({ value, onChange, label, placeholder, icon, suffix, inputMode = 'text', style, uppercase }: {
  value: string; onChange: (v: string) => void; label: string; placeholder: string; icon: IconName; suffix?: string; inputMode?: InputMode; style?: CSSProperties; uppercase?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <VehicleFieldFrame label={label} icon={icon} highlighted={focused} style={style}
      trailing={suffix ? <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, paddingLeft: 4 }}>{suffix}</span> : undefined}>
      <div style={{ position: 'relative' }} onClick={() => input.current?.focus()}>
        {value === '' && <div className="ellipsis" style={{ position: 'absolute', inset: 0, color: 'color-mix(in srgb, var(--onSurfaceVariant) 70%, transparent)', fontSize: 15, lineHeight: '24px', pointerEvents: 'none' }}>{placeholder}</div>}
        <input ref={input} value={value} aria-label={label} inputMode={inputMode} autoCapitalize={uppercase ? 'characters' : undefined}
          onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ width: '100%', border: 0, outline: 0, padding: 0, background: 'transparent', color: 'var(--onSurface)', fontSize: 16, lineHeight: '24px', letterSpacing: 0.5, caretColor: 'var(--primary)' }} />
      </div>
    </VehicleFieldFrame>
  )
}

/** VehicleSelectionField: the frame opening a dropdown of [options]. */
export function VehicleSelectionField({ label, value, placeholder, icon, options, onChange, style }: {
  label: string; value: string; placeholder: string; icon: IconName; options: string[]; onChange: (v: string) => void; style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <VehicleFieldFrame label={label} icon={icon} onClick={() => setOpen(true)} style={style} frameRef={setAnchor}
        trailing={<Icon name="chevronDown" size={19} color="var(--onSurfaceVariant)" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />}>
        <div className="ellipsis" style={{ color: value ? 'var(--onSurface)' : 'var(--onSurfaceVariant)', fontSize: 15, lineHeight: '24px', letterSpacing: 0.5 }}>{value || placeholder}</div>
      </VehicleFieldFrame>
      <Menu open={open} anchor={anchor} matchWidth maxHeight={360} onDismiss={() => setOpen(false)}
        items={options.map((o) => ({ label: o, onClick: () => { onChange(o); setOpen(false) } }))} />
    </>
  )
}

/** MaintenanceDateField: height 66, calendar icon, opens the date picker. */
export function MaintenanceDateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tap onClick={() => setOpen(true)} ripple="var(--onSurface)" style={{ height: 66, borderRadius: 16, background: 'var(--surface)', border: `1px solid ${outline(43)}`,
        display: 'flex', alignItems: 'center', padding: '0 15px' }}>
        <Icon name="calendarNav" size={25} color="var(--primary)" />
        <div style={{ width: 15 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{label}</div>
          <div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 600, letterSpacing: 0.5 }}>{value ? dateLabel(value) : 'Seleziona data'}</div>
        </div>
        <FieldIcon icon="calendarNav" />
      </Tap>
      <DatePickerDialog open={open} value={value} onDismiss={() => setOpen(false)} onConfirm={(d) => { onChange(d); setOpen(false) }} />
    </>
  )
}
