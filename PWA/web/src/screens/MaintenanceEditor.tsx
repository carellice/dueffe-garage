import { useEffect, useRef, useState } from 'react'
import { AccentBadge, EditorScaffold, Icon, Overline, Panel, Switch, Tap } from '../components/ui.tsx'
import { VehiclePhoto } from '../components/garage.tsx'
import { toast } from '../components/overlays.tsx'
import { FieldIcon, MaintenanceDateField, MaintenanceInput } from '../components/fields.tsx'
import { actions, useStore } from '../lib/store.ts'
import { back } from '../lib/nav.ts'
import type { IconName } from '../lib/icons.gen.ts'
import { now, uuid, type Maintenance, type Reminder } from '../../../shared/model.ts'
import { dateLabel, decimal2, formatYMD, isBefore, parseDate, plusMonths, plusYears, today, todayString } from '../../../shared/format.ts'

const types: [string, string, IconName][] = [
  ['service', 'Tagliando', 'wrench'], ['inspection', 'Revisione', 'settingsNav'], ['tax', 'Bollo', 'receipt'],
  ['insurance', 'Assicurazione', 'shield'], ['tires', 'Cambio gomme', 'tire'], ['custom', 'Altro', 'more'],
]
const modes: [string, string, IconName][] = [['date', 'Data', 'calendarNav'], ['interval', 'Intervallo', 'repeat'], ['mileage', 'Km', 'speedometer'], ['both', 'Data e km', 'layers']]
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
    <EditorScaffold overline="Intervento" title={existing ? 'Modifica intervento' : 'Nuovo intervento'} subtitle={vehicle.name}
      onDismiss={() => back()} saveLabel="Salva intervento" onSave={save} scrollRef={scroller}
      header={<div style={{ width: 78, height: 58, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}><VehiclePhoto v={vehicle} /></div>}>
      <Overline text="Tipo" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup">
        {[types.slice(0, 3), types.slice(3)].map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            {row.map(([key, label, icon]) => <Choice key={key} selected={type === key} label={label} icon={icon} onClick={() => setType(key)} />)}
          </div>
        ))}
      </div>
      {type === 'custom' && <MaintenanceInput value={customName} onChange={setCustomName} label="Nome intervento *" icon="edit" />}
      <Overline text="Dettagli" style={{ paddingTop: 4 }} />
      <MaintenanceDateField label="Data intervento *" value={date} onChange={setDate} />
      <div style={{ display: 'flex', gap: 10 }}>
        <MaintenanceInput value={mileage} onChange={setMileage} label="Chilometri *" icon="speedometer" suffix="km" inputMode="numeric" style={{ flex: 1, minWidth: 0 }} />
        <MaintenanceInput value={cost} onChange={setCost} label="Costo *" icon="coins" suffix="€" inputMode="decimal" style={{ flex: 1, minWidth: 0 }} />
      </div>
      <NotesField value={notes} onChange={setNotes} />
      <Panel padding={16} style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AccentBadge icon="clock" size={40} iconSize={20} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Promemoria</div>
            <div style={{ color: muted, fontSize: 13, lineHeight: '18px' }}>Ricordami quando rifarlo</div>
          </div>
          <Switch checked={reminderEnabled} onChange={setReminderEnabled} />
        </div>
        {reminderEnabled && (
          <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }} role="radiogroup">
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
          </div>
        )}
      </Panel>
      {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
    </EditorScaffold>
  )
}

/** MaintenanceChoice: icon over label, accent outline when selected. */
function Choice({ selected, label, icon, onClick, compact = false }: { selected: boolean; label: string; icon: IconName; onClick: () => void; compact?: boolean }) {
  return (
    <Tap onClick={onClick} role="radio" ripple="var(--onSurface)" style={{
      flex: 1, minWidth: 0, height: compact ? 58 : 70, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
      padding: '0 4px', background: selected ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--surface)',
      border: `1px solid ${selected ? 'var(--primary)' : 'var(--hairline)'}`, transition: 'background-color 200ms, border-color 200ms',
    }}>
      <Icon name={icon} size={compact ? 19 : 22} color={selected ? 'var(--primary)' : 'var(--onSurfaceVariant)'} />
      <span className="ellipsis" style={{ fontSize: compact ? 11 : 12, lineHeight: '16px', maxWidth: '100%', fontWeight: selected ? 600 : 500,
        color: selected ? 'var(--onSurface)' : 'var(--onSurfaceVariant)' }}>{label}</span>
    </Tap>
  )
}

/** MaintenanceNotesField: height 96, two or three lines. */
function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  return (
    <div ref={box} style={{ height: 96, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--hairline)',
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
