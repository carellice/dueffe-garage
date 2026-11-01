import { useEffect, useRef, useState } from 'react'
import { Divider, GradientButton, Icon, OutlinedButton, Switch, Tap, VehicleImage } from '../components/ui.tsx'
import { toast } from '../components/overlays.tsx'
import { FieldIcon, MaintenanceDateField, MaintenanceInput } from '../components/fields.tsx'
import { actions, fileUrl, useStore } from '../lib/store.ts'
import { back } from '../lib/nav.ts'
import type { IconName } from '../lib/icons.gen.ts'
import { now, uuid, type Maintenance, type Reminder } from '../../../shared/model.ts'
import { dateLabel, decimal2, formatYMD, isBefore, parseDate, plusMonths, plusYears, today, todayString } from '../../../shared/format.ts'

const types: [string, string, IconName][] = [
  ['service', 'Tagliando', 'wrench'], ['inspection', 'Revisione', 'settingsNav'], ['tax', 'Bollo', 'receipt'],
  ['insurance', 'Assicurazione', 'shield'], ['tires', 'Cambio gomme', 'tire'], ['custom', 'Altro', 'more'],
]
const modes: [string, string, IconName][] = [['date', 'Data', 'calendarNav'], ['interval', 'Intervallo', 'repeat'], ['mileage', 'Km', 'speedometer'], ['both', 'Entrambi', 'coins']]
const defaults: Record<string, [number, string]> = { service: [1, 'years'], inspection: [2, 'years'], tax: [1, 'years'], insurance: [1, 'years'], tires: [6, 'months'] }

/** MaintenanceEditor of Screens.kt: "Nuovo intervento" / "Modifica intervento" with its reminder. */
export function MaintenanceEditor({ vehicleId, id }: { vehicleId: string; id?: string }) {
  const state = useStore((s) => s.data)!
  const vehicle = state.vehicles.find((v) => v.id === vehicleId)
  const existing = state.maintenances.find((m) => m.id === id)
  const existingReminder = existing ? state.reminders.find((r) => r.maintenanceId === existing.id) : undefined
  const [type, setType] = useState(existing?.type ?? 'service')
  const [customName, setCustomName] = useState(existing?.customName ?? '')
  const [date, setDate] = useState(existing?.date ?? todayString())
  const [mileage, setMileage] = useState(String(existing?.mileage ?? vehicle?.mileage ?? 0))
  const [cost, setCost] = useState(decimal2(existing?.cost ?? 0))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [reminderEnabled, setReminderEnabled] = useState(existingReminder?.active ?? !existing)
  const [reminderType, setReminderType] = useState(existingReminder?.type ?? 'interval')
  const [dueDate, setDueDate] = useState(existingReminder?.dueDate ?? '')
  const [threshold, setThreshold] = useState(existingReminder?.mileageThreshold?.toString() ?? '')
  const [interval, setIntervalValue] = useState(existingReminder?.intervalValue?.toString() ?? '1')
  const [unit, setUnit] = useState(existingReminder?.intervalUnit || 'years')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  // LaunchedEffect(type): a new maintenance takes the usual interval of its type.
  useEffect(() => {
    if (existing) return
    const d = defaults[type]
    if (d) { setIntervalValue(String(d[0])); setUnit(d[1]) }
    setReminderEnabled(type !== 'custom')
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!vehicle) return null

  const save = async () => {
    if (saving) return
    const parsedDate = parseDate(date)
    const km = /^\d+$/.test(mileage.trim()) ? Number(mileage.trim()) : NaN
    const euroValue = /^\s*\d+([.,]\d+)?\s*$/.test(cost) ? Number(cost.replace(',', '.')) : NaN
    const due = ['date', 'both'].includes(reminderType) ? parseDate(dueDate) : null
    const nextKm = /^\d+$/.test(threshold.trim()) ? Number(threshold.trim()) : NaN
    const intervalValue = /^\d+$/.test(interval) ? Number(interval) : NaN
    if (!parsedDate || !(km >= 0) || !(euroValue >= 0) || !Number.isFinite(euroValue) || (type === 'custom' && !customName.trim())) {
      setError("Controlla i dati dell'intervento"); return
    }
    if (reminderEnabled && ((['date', 'both'].includes(reminderType) && (!due || isBefore(due, today()))) ||
      (reminderType === 'interval' && !(intervalValue >= 1 && intervalValue <= 24)) ||
      (['mileage', 'both'].includes(reminderType) && !(nextKm > Math.max(km, vehicle.mileage))))) {
      setError('Controlla data, intervallo o soglia del promemoria'); return
    }
    const m: Maintenance = {
      ...(existing ?? { id: uuid(), vehicleId: vehicle.id, createdAt: now() } as Maintenance),
      type, customName: type === 'custom' ? customName.trim() : '', date, mileage: km, cost: euroValue, notes: notes.trim(), updatedAt: now(),
    }
    const reminder: Reminder | null = !reminderEnabled ? null : {
      ...(existingReminder ?? { id: uuid(), maintenanceId: m.id, createdAt: now() } as Reminder),
      type: reminderType,
      dueDate: reminderType === 'interval' ? formatYMD(unit === 'months' ? plusMonths(parsedDate, intervalValue) : plusYears(parsedDate, intervalValue))
        : ['date', 'both'].includes(reminderType) ? dueDate : '',
      mileageThreshold: ['mileage', 'both'].includes(reminderType) ? nextKm : null,
      intervalValue: reminderType === 'interval' ? intervalValue : null,
      intervalUnit: reminderType === 'interval' ? unit : '',
      active: vehicle.status === 'active', updatedAt: now(),
    }
    setSaving(true)
    try {
      await actions.saveMaintenance(m, reminder)
      toast('Intervento salvato')
      back()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const muted = 'var(--onSurfaceVariant)'
  return (
    <div className="scroll status-pad" ref={scroller}>
      <div style={{ padding: '18px 22px calc(28px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker" style={{ color: 'var(--primary)', letterSpacing: 2 }}>INTERVENTI</div>
            <div style={{ height: 5 }} />
            <div className="clamp2" style={{ fontSize: 31, lineHeight: '33px', fontWeight: 900 }}>{existing ? 'Modifica intervento' : 'Nuovo intervento'}</div>
            <div style={{ height: 3 }} />
            <div className="ellipsis" style={{ color: muted, fontSize: 17, lineHeight: '24px', letterSpacing: 0.5 }}>{vehicle.name}</div>
          </div>
          <div style={{ width: 86, height: 67, borderRadius: 17, overflow: 'hidden', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {vehicle.hasPhoto ? <VehicleImage src={fileUrl('vehicle', vehicle.id, vehicle.updatedAt)} radius={18} style={{ width: '100%', height: '100%' }} /> : <Icon name="car" size={32} color="var(--primary)" />}
          </div>
        </div>
        <div style={{ borderRadius: 24, background: 'var(--surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup">
          <div style={{ fontSize: 18, lineHeight: '24px', fontWeight: 700, padding: '0 0 4px 2px' }}>Tipo di intervento</div>
          {[types.slice(0, 3), types.slice(3)].map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              {row.map(([key, label, icon]) => <Choice key={key} selected={type === key} label={label} icon={icon} onClick={() => setType(key)} />)}
            </div>
          ))}
        </div>
        {type === 'custom' && <MaintenanceInput value={customName} onChange={setCustomName} label="Nome intervento *" icon="edit" />}
        <MaintenanceDateField label="Data intervento *" value={date} onChange={setDate} />
        <div style={{ display: 'flex', gap: 10 }}>
          <MaintenanceInput value={mileage} onChange={setMileage} label="Chilometri *" icon="speedometer" suffix="km" inputMode="numeric" style={{ flex: 1, minWidth: 0 }} />
          <MaintenanceInput value={cost} onChange={setCost} label="Costo € *" icon="coins" suffix="€" inputMode="decimal" style={{ flex: 1, minWidth: 0 }} />
        </div>
        <NotesField value={notes} onChange={setNotes} />
        <Divider style={{ background: 'color-mix(in srgb, var(--outline) 20%, transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, lineHeight: '24px', fontWeight: 700 }}>Promemoria</div>
            <div style={{ color: muted, fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>Imposta un promemoria per questo intervento</div>
          </div>
          <Switch checked={reminderEnabled} onChange={setReminderEnabled} />
        </div>
        {reminderEnabled && <>
          <div style={{ display: 'flex', gap: 5 }} role="radiogroup">
            {modes.map(([key, label, icon]) => <Choice key={key} selected={reminderType === key} label={label} icon={icon} compact onClick={() => setReminderType(key)} />)}
          </div>
          {(reminderType === 'date' || reminderType === 'both') && <MaintenanceDateField label="Data di scadenza *" value={dueDate} onChange={setDueDate} />}
          {reminderType === 'interval' && (
            <IntervalPicker value={Number(interval) || 1} unit={unit} date={date} onValue={(v) => setIntervalValue(String(v))} onUnit={setUnit} />
          )}
          {(reminderType === 'mileage' || reminderType === 'both') && (
            <MaintenanceInput value={threshold} onChange={setThreshold} label="Soglia chilometrica *" icon="speedometer" suffix="km" inputMode="numeric"
              onFocusChange={(f) => { if (f) setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }), 300) }} />
          )}
        </>}
        {error && <div style={{ color: 'var(--error)', fontSize: 16, lineHeight: '24px', letterSpacing: 0.5 }}>{error}</div>}
        <div style={{ height: 2 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <OutlinedButton onClick={() => back()} height={52} radius={28} style={{ flex: 1, padding: 0 }}><span style={{ fontWeight: 600 }}>Annulla</span></OutlinedButton>
          <GradientButton onClick={save} height={52} style={{ flex: 1 }} padding="0 12px"><span className="ellipsis" style={{ fontWeight: 700, fontSize: 13 }}>Salva intervento</span></GradientButton>
        </div>
      </div>
    </div>
  )
}

/** MaintenanceChoice */
function Choice({ selected, label, icon, onClick, compact = false }: { selected: boolean; label: string; icon: IconName; onClick: () => void; compact?: boolean }) {
  return (
    <Tap onClick={onClick} role="radio" ripple="var(--onSurface)" style={{
      flex: 1, minWidth: 0, height: compact ? 48 : 53, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: `0 ${compact ? 5 : 4}px`, background: selected ? 'var(--secondaryContainer)' : 'var(--surface)',
      border: `1px solid ${selected ? 'var(--primary)' : 'color-mix(in srgb, var(--outline) 43%, transparent)'}`,
    }}>
      <Icon name={icon} size={compact ? 18 : 19} color={selected ? 'var(--primary)' : 'var(--onSurfaceVariant)'} />
      <span style={{ width: compact ? 4 : 3, flexShrink: 0 }} />
      <span className="ellipsis" style={{ fontSize: 10, lineHeight: '16px', letterSpacing: 0.5, fontWeight: selected ? 600 : 500 }}>{label}</span>
    </Tap>
  )
}

/** MaintenanceNotesField: height 96, two or three lines. */
function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  return (
    <div ref={box} style={{ height: 96, borderRadius: 16, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--outline) 43%, transparent)',
      padding: '13px 12px', display: 'flex', alignItems: 'flex-start' }}>
      <FieldIcon icon="document" />
      <div style={{ width: 11 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>Note</div>
        <div style={{ height: 4 }} />
        <textarea value={value} onChange={(e) => onChange(e.target.value)} aria-label="Note" placeholder="Aggiungi una nota..."
          onFocus={() => setTimeout(() => box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 240)}
          style={{ flex: 1, resize: 'none', border: 0, outline: 0, padding: 0, background: 'transparent', color: 'var(--onSurface)', fontSize: 14, lineHeight: '20px',
            letterSpacing: 0.25, caretColor: 'var(--primary)' }} />
      </div>
    </div>
  )
}

/** MaintenanceIntervalPicker: "Ripeti ogni" with − / + and months or years. */
function IntervalPicker({ value, unit, date, onValue, onUnit }: { value: number; unit: string; date: string; onValue: (v: number) => void; onUnit: (u: string) => void }) {
  const parsed = parseDate(date)
  const next = parsed ? formatYMD(unit === 'months' ? plusMonths(parsed, value) : plusYears(parsed, value)) : null
  const stepper = (label: string, enabled: boolean, onClick: () => void) => (
    <Tap onClick={onClick} disabled={!enabled} style={{ width: 52, height: 52, borderRadius: 14, border: '1px solid var(--outlineVariant)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 25, color: enabled ? 'var(--primary)' : 'color-mix(in srgb, var(--onSurface) 38%, transparent)' }}>{label}</Tap>
  )
  return (
    <div style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--outline) 43%, transparent)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 15, lineHeight: '24px', letterSpacing: 0.5 }}>Ripeti ogni</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {stepper('−', value > 1, () => onValue(Math.max(1, value - 1)))}
        <div style={{ flex: 1, textAlign: 'center', fontSize: 27, lineHeight: '32px', fontWeight: 700 }}>{value}</div>
        {stepper('+', value < 24, () => onValue(Math.min(24, value + 1)))}
        <Unit label="Mesi" selected={unit === 'months'} onClick={() => onUnit('months')} />
        <Unit label="Anni" selected={unit === 'years'} onClick={() => onUnit('years')} />
      </div>
      {next && <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '20px', letterSpacing: 0.25 }}>{`Prossima scadenza: ${dateLabel(next)}`}</div>}
    </div>
  )
}

function Unit({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <Tap onClick={onClick} role="radio" ripple="var(--onSurface)" style={{ height: 56, minWidth: 50, borderRadius: 13, padding: '0 9px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected ? 'var(--secondaryContainer)' : 'var(--surface)',
      border: `1px solid ${selected ? 'var(--primary)' : 'color-mix(in srgb, var(--outline) 43%, transparent)'}`,
      fontSize: 12, lineHeight: '16px', letterSpacing: 0.5, fontWeight: selected ? 700 : 500 }}>{label}</Tap>
  )
}
