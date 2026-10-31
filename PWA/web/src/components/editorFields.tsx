import { type CSSProperties, type ReactNode, useRef, useState } from 'react'
import { dateLabel, today } from '../../../shared/model.ts'
import { FieldIcon } from './garage.tsx'
import { Icon, Pressable, TextButton } from './ui.tsx'
import { OutlinedTextField } from './fields.tsx'
import { AlertDialog, DropdownMenu, openDialog, pickDate } from './overlays.tsx'

// The form fields of VehicleEditor and MaintenanceEditor (Screens.kt).

const border43 = 'color-mix(in srgb, var(--outline) 43%, transparent)'

/** VehicleFieldFrame: a 59 dp row with the round icon, a small label and the content. */
export function FieldFrame({ label, icon, highlighted = false, onClick, trailing, children, style }: {
  label: string; icon: string; highlighted?: boolean; onClick?: () => void; trailing?: ReactNode; children: ReactNode; style?: CSSProperties
}) {
  const inner = <>
    <div style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', border: `1px solid ${highlighted ? 'var(--primary)' : 'color-mix(in srgb, var(--outline) 32%, transparent)'}` }} />
    <FieldIcon icon={icon} />
    <div style={{ width: 9 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, lineHeight: '16px' }}>{label}</div>
      <div style={{ height: 2 }} />
      {children}
    </div>
    {trailing}
  </>
  const frame: CSSProperties = { minHeight: 59, borderRadius: 16, background: 'var(--surface)', padding: '7px 10px', display: 'flex', alignItems: 'center', position: 'relative', ...style }
  return onClick
    ? <Pressable onClick={onClick} pressed={1} style={frame}>{inner}</Pressable>
    : <div style={frame}>{inner}</div>
}

export function VehicleTextField({ value, onChange, label, placeholder, icon, suffix, inputMode, style, upper }: {
  value: string; onChange: (v: string) => void; label: string; placeholder: string; icon: string; suffix?: string
  inputMode?: 'numeric' | 'decimal' | 'text'; style?: CSSProperties; upper?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <FieldFrame label={label} icon={icon} highlighted={focused} style={{ cursor: 'text', ...style }}
      trailing={suffix ? <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, paddingLeft: 4 }}>{suffix}</span> : undefined}>
      <div onClick={() => input.current?.focus()}>
        <input ref={input} className="field-input" aria-label={label} value={value} placeholder={placeholder} inputMode={inputMode}
          style={{ fontSize: 16, textTransform: upper ? 'uppercase' : undefined }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(e) => onChange(e.target.value)} />
      </div>
    </FieldFrame>
  )
}

export function SelectionField({ label, value, placeholder, icon, options, onChange, style }: {
  label: string; value: string; placeholder: string; icon: string; options: string[]; onChange: (v: string) => void; style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  return (
    <div ref={anchor} style={style}>
      <FieldFrame label={label} icon={icon} onClick={() => setOpen(true)} highlighted={open}
        trailing={<Icon name="chevron-down" size={19} color="var(--onSurfaceVariant)" />}>
        <div className="ellipsis" style={{ fontSize: 15, color: value === '' ? 'var(--onSurfaceVariant)' : 'var(--onSurface)' }}>{value === '' ? placeholder : value}</div>
      </FieldFrame>
      <DropdownMenu open={open} anchor={anchor.current} matchWidth onDismiss={() => setOpen(false)}
        items={options.map((o) => ({ label: o, onClick: () => { onChange(o); setOpen(false) } }))} />
    </div>
  )
}

/** VehicleYearField: the year typed in a dialog, between 1900 and this year. */
export function YearField({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: CSSProperties }) {
  return (
    <FieldFrame label="Anno *" icon="calendar-nav" style={style} onClick={() => openDialog((close) => <YearDialog value={value} onChange={onChange} close={close} />)}
      trailing={<Icon name="chevron-down" size={18} color="var(--onSurfaceVariant)" />}>
      <div style={{ fontSize: 15 }}>{value}</div>
    </FieldFrame>
  )
}

function YearDialog({ value, onChange, close }: { value: string; onChange: (v: string) => void; close: () => void }) {
  const [input, setInput] = useState(value)
  const [error, setError] = useState(false)
  const max = Number(today().slice(0, 4))
  return (
    <AlertDialog title="Anno dell'auto"
      dismiss={<TextButton onClick={close}>Annulla</TextButton>}
      confirm={<TextButton onClick={() => {
        const parsed = Number(input)
        if (input === '' || !Number.isInteger(parsed) || parsed < 1900 || parsed > max) setError(true)
        else { onChange(String(parsed)); close() }
      }}>Conferma</TextButton>}>
      <div style={{ paddingTop: 6 }}>
        <OutlinedTextField value={input} onChange={(v) => { setInput(v.replace(/\D/g, '')); setError(false) }} label="Anno" inputMode="numeric" notch="var(--surfaceContainerHigh)" />
        {error && <div style={{ color: 'var(--error)', fontSize: 12 }}>Inserisci un anno tra 1900 e {max}</div>}
      </div>
    </AlertDialog>
  )
}

export function RegistrationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <>
    <FieldFrame label="Data di immatricolazione" icon="calendar-nav" onClick={() => pickDate(value, onChange)} trailing={<FieldIcon icon="calendar-nav" />}>
      <div style={{ fontSize: 15, color: value.trim() === '' ? 'var(--onSurfaceVariant)' : 'var(--onSurface)' }}>{value.trim() === '' ? 'Seleziona data' : dateLabel(value)}</div>
    </FieldFrame>
    {value.trim() !== '' && <TextButton onClick={() => onChange('')} style={{ width: '100%' }}>Rimuovi data</TextButton>}
  </>
}

/** MaintenanceInput: OutlinedTextField with the round icon, 16 dp corners. */
export function MaintenanceInput({ value, onChange, label, icon, suffix, inputMode, style, onFocusChange }: {
  value: string; onChange: (v: string) => void; label: string; icon: string; suffix?: string; inputMode?: 'numeric' | 'decimal' | 'text'
  style?: CSSProperties; onFocusChange?: (f: boolean) => void
}) {
  return (
    <OutlinedTextField value={value} onChange={onChange} label={label} labelSize={12} leading={<FieldIcon icon={icon} />} suffix={suffix}
      inputMode={inputMode} radius={16} containerColor="var(--surface)" notch="var(--background)" unfocusedBorder={border43}
      textStyle={{ fontWeight: 600 }} style={style}
      onFocusChange={(f) => {
        onFocusChange?.(f)
        if (f) setTimeout(() => (document.activeElement as HTMLElement | null)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 240)
      }} />
  )
}

export function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ height: 96, borderRadius: 16, background: 'var(--surface)', border: `1px solid ${border43}`, padding: '13px 12px', display: 'flex', alignItems: 'flex-start' }}>
      <FieldIcon icon="document" />
      <div style={{ width: 11 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px' }}>Note</div>
        <div style={{ height: 4 }} />
        <textarea className="field-input" aria-label="Note" rows={2} value={value} placeholder="Aggiungi una nota..."
          style={{ fontSize: 14, lineHeight: '20px', letterSpacing: 0.25, height: 40 }} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}

/** MaintenanceDateField: 66 dp row, opens the date picker. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Pressable onClick={() => pickDate(value, onChange)} pressed={1} style={{ height: 66, borderRadius: 16, background: 'var(--surface)', padding: '0 15px', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: `1px solid ${border43}`, pointerEvents: 'none' }} />
      <Icon name="calendar-nav" size={25} color="var(--primary)" />
      <div style={{ width: 15 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px' }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{value.trim() === '' ? 'Seleziona data' : dateLabel(value)}</div>
      </div>
      <FieldIcon icon="calendar-nav" />
    </Pressable>
  )
}

/** MaintenanceChoice: a radio tile with icon and label. */
export function Choice({ selected, label, icon, onClick, compact = false }: { selected: boolean; label: string; icon: string; onClick: () => void; compact?: boolean }) {
  return (
    <Pressable onClick={onClick} pressed={1} role="radio" selected={selected} style={{
      flex: 1, minWidth: 0, height: compact ? 48 : 53, borderRadius: 13, padding: `0 ${compact ? 5 : 4}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: selected ? 'var(--secondaryContainer)' : 'var(--surface)',
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 13, pointerEvents: 'none', border: `1px solid ${selected ? 'var(--primary)' : border43}` }} />
      <Icon name={icon} size={compact ? 18 : 19} color={selected ? 'var(--primary)' : 'var(--onSurfaceVariant)'} />
      <span style={{ width: compact ? 4 : 3, flex: 'none' }} />
      <span className="ellipsis" style={{ fontSize: 10, fontWeight: selected ? 600 : 500 }}>{label}</span>
    </Pressable>
  )
}

export function UnitChoice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <Pressable onClick={onClick} pressed={1} role="radio" selected={selected} style={{
      height: 56, minWidth: 50, borderRadius: 13, padding: '0 9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      background: selected ? 'var(--secondaryContainer)' : 'var(--surface)',
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 13, pointerEvents: 'none', border: `1px solid ${selected ? 'var(--primary)' : border43}` }} />
      <span style={{ fontSize: 12, fontWeight: selected ? 700 : 500 }}>{label}</span>
    </Pressable>
  )
}

export function StepButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <Pressable onClick={onClick} disabled={disabled} pressed={1} style={{
      width: 52, height: 52, borderRadius: 14, border: '1px solid var(--outlineVariant)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--primary)', fontSize: 25, flex: 'none', opacity: disabled ? 0.38 : 1,
    }}>{label}</Pressable>
  )
}
