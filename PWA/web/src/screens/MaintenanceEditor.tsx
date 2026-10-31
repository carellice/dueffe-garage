import { useEffect, useRef, useState } from 'react'
import {
  dateLabel, epochDay, formatNumber, now, parseDate, plusMonths, plusYears, today, uuid, type Maintenance, type Reminder, type Vehicle,
} from '../../../shared/model.ts'
import { actions, useStore } from '../lib/store.ts'
import { back } from '../lib/nav.ts'
import { Divider, GradientButton, Icon, OutlinedButton, Switch } from '../components/ui.tsx'
import { VehicleImage } from '../components/garage.tsx'
import { Choice, DateField, MaintenanceInput, NotesField, StepButton, UnitChoice } from '../components/editorFields.tsx'
import { toast } from '../components/overlays.tsx'

const types: [string, string, string][] = [
  ['service', 'Tagliando', 'wrench'], ['inspection', 'Revisione', 'settings-nav'], ['tax', 'Bollo', 'receipt'],
  ['insurance', 'Assicurazione', 'shield'], ['tires', 'Cambio gomme', 'tire'], ['custom', 'Altro', 'more'],
]
const modes: [string, string, string][] = [['date', 'Data', 'calendar-nav'], ['interval', 'Intervallo', 'repeat'], ['mileage', 'Km', 'speedometer'], ['both', 'Entrambi', 'coins']]
const defaults: Record<string, [number, string]> = { service: [1, 'years'], inspection: [2, 'years'], tax: [1, 'years'], insurance: [1, 'years'], tires: [6, 'months'] }

export function MaintenanceEditor({ vehicle, existingId }: { vehicle: Vehicle; existingId: string | null }) {
  const state = useStore((s) => s.data)!
  const existing = useRef(existingId ? state.maintenances.find((m) => m.id === existingId) ?? null : null).current
  const existingReminder = useRef(existing ? state.reminders.find((r) => r.maintenanceId === existing.id) ?? null : null).current
  const [type, setType] = useState(existing?.type ?? 'service')
  const [customName, setCustomName] = useState(existing?.customName ?? '')
  const [date, setDate] = useState(existing?.date ?? today())
  const [mileage, setMileage] = useState(String(existing?.mileage ?? vehicle.mileage))
  const [cost, setCost] = useState(formatNumber(existing?.cost ?? 0, 2, false))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [reminderEnabled, setReminderEnabled] = useState(existingReminder?.active ?? existing == null)
  const [reminderType, setReminderType] = useState(existingReminder?.type ?? 'interval')
  const [dueDate, setDueDate] = useState(existingReminder?.dueDate ?? '')
  const [threshold, setThreshold] = useState(existingReminder?.mileageThreshold != null ? String(existingReminder.mileageThreshold) : '')
  const [interval, setInterval] = useState(existingReminder?.intervalValue != null ? String(existingReminder.intervalValue) : '1')
  const [unit, setUnit] = useState(existingReminder?.intervalUnit.trim() ? existingReminder.intervalUnit : 'years')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  // LaunchedEffect(type): a new intervention gets the usual interval of its type.
  useEffect(() => {
    if (existing != null) return
    const d = defaults[type]
    if (d) { setInterval(String(d[0])); setUnit(d[1]) }
    setReminderEnabled(type !== 'custom')
  }, [type, existing])

  const save = async () => {
    const parsedDate = parseDate(date) ? date : null
    const km = /^\d+$/.test(mileage.trim()) ? Number(mileage.trim()) : null
    const euroText = cost.replace(',', '.').trim()
    const euro = euroText !== '' && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(euroText) ? Number(euroText) : null
    const due = ['date', 'both'].includes(reminderType) && parseDate(dueDate) ? dueDate : null
    const nextKm = /^-?\d+$/.test(threshold.trim()) ? Number(threshold.trim()) : null
    const intervalValue = /^-?\d+$/.test(interval) ? Number(interval) : null
    if (parsedDate == null || km == null || euro == null || !Number.isFinite(euro) || euro < 0 || (type === 'custom' && customName.trim() === '')) {
      setError("Controlla i dati dell'intervento")
      return
    }
    if (reminderEnabled && ((['date', 'both'].includes(reminderType) && (due == null || epochDay(due)! < epochDay(today())!)) ||
      (reminderType === 'interval' && (intervalValue == null || intervalValue < 1 || intervalValue > 24)) ||
      (['mileage', 'both'].includes(reminderType) && (nextKm == null || nextKm <= Math.max(km, vehicle.mileage))))) {
      setError('Controlla data, intervallo o soglia del promemoria')
      return
    }
    const m: Maintenance = {
      ...(existing ?? { id: uuid(), vehicleId: vehicle.id, createdAt: now() }),
      type, customName: type === 'custom' ? customName.trim() : '', date, mileage: km, cost: euro, notes: notes.trim(), updatedAt: now(),
    } as Maintenance
    const reminder: Reminder | null = !reminderEnabled ? null : {
      ...(existingReminder ?? { id: uuid(), maintenanceId: m.id, createdAt: now() }),
      type: reminderType,
      dueDate: reminderType === 'interval'
        ? (unit === 'months' ? plusMonths(parsedDate, intervalValue!) : plusYears(parsedDate, intervalValue!))!
        : ['date', 'both'].includes(reminderType) ? dueDate : '',
      mileageThreshold: ['mileage', 'both'].includes(reminderType) ? nextKm : null,
      intervalValue: reminderType === 'interval' ? intervalValue : null,
      intervalUnit: reminderType === 'interval' ? unit : '',
      active: vehicle.status === 'active', updatedAt: now(),
    } as Reminder
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

  const intervalNumber = Number(interval) || 1
  const nextDate = unit === 'months' ? plusMonths(date, intervalNumber) : plusYears(date, intervalNumber)
  return (
    <div className="scroll" ref={scroller}>
      <div style={{ padding: '18px 22px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--primary)', fontSize: 11, letterSpacing: 2, fontWeight: 900 }}>INTERVENTI</div>
            <div style={{ height: 5 }} />
            <div className="clamp2" style={{ fontSize: 31, lineHeight: '33px', fontWeight: 900 }}>{existing ? 'Modifica intervento' : 'Nuovo intervento'}</div>
            <div style={{ height: 3 }} />
            <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 17 }}>{vehicle.name}</div>
          </div>
          <div style={{ width: 86, height: 67, borderRadius: 17, background: 'var(--surfaceContainerHigh)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            {vehicle.hasPhoto ? <VehicleImage vehicle={vehicle} style={{ width: '100%', height: '100%', borderRadius: 0 }} /> : <Icon name="car" size={32} color="var(--primary)" />}
          </div>
        </div>
        <div role="radiogroup" style={{ borderRadius: 24, background: 'var(--surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, padding: '0 0 4px 2px' }}>Tipo di intervento</span>
          {[types.slice(0, 3), types.slice(3)].map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              {row.map(([key, label, icon]) => <Choice key={key} selected={key === type} label={label} icon={icon} onClick={() => setType(key)} />)}
            </div>
          ))}
        </div>
        {type === 'custom' && <MaintenanceInput value={customName} onChange={setCustomName} label="Nome intervento *" icon="edit" />}
        <DateField label="Data intervento *" value={date} onChange={setDate} />
        <div style={{ display: 'flex', gap: 10 }}>
          <MaintenanceInput value={mileage} onChange={setMileage} label="Chilometri *" icon="speedometer" suffix="km" inputMode="numeric" style={{ flex: 1, minWidth: 0 }} />
          <MaintenanceInput value={cost} onChange={setCost} label="Costo € *" icon="coins" suffix="€" inputMode="decimal" style={{ flex: 1, minWidth: 0 }} />
        </div>
        <NotesField value={notes} onChange={setNotes} />
        <Divider alpha={0.2} />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Promemoria</div>
            <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12 }}>Imposta un promemoria per questo intervento</div>
          </div>
          <Switch checked={reminderEnabled} onChange={setReminderEnabled} />
        </div>
        {reminderEnabled && <>
          <div role="radiogroup" style={{ display: 'flex', gap: 5 }}>
            {modes.map(([key, label, icon]) => <Choice key={key} compact selected={key === reminderType} label={label} icon={icon} onClick={() => setReminderType(key)} />)}
          </div>
          {(reminderType === 'date' || reminderType === 'both') && <DateField label="Data di scadenza *" value={dueDate} onChange={setDueDate} />}
          {reminderType === 'interval' && (
            <div style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--outline) 43%, transparent)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Ripeti ogni</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StepButton label="−" disabled={intervalNumber <= 1} onClick={() => setInterval(String(Math.max(1, intervalNumber - 1)))} />
                <span style={{ flex: 1, textAlign: 'center', fontSize: 27, fontWeight: 700 }}>{intervalNumber}</span>
                <StepButton label="+" disabled={intervalNumber >= 24} onClick={() => setInterval(String(Math.min(24, intervalNumber + 1)))} />
                <UnitChoice label="Mesi" selected={unit === 'months'} onClick={() => setUnit('months')} />
                <UnitChoice label="Anni" selected={unit === 'years'} onClick={() => setUnit('years')} />
              </div>
              {nextDate && <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13 }}>Prossima scadenza: {dateLabel(nextDate)}</span>}
            </div>
          )}
          {(reminderType === 'mileage' || reminderType === 'both') && (
            <MaintenanceInput value={threshold} onChange={setThreshold} label="Soglia chilometrica *" icon="speedometer" suffix="km" inputMode="numeric"
              onFocusChange={(f) => { if (f) setTimeout(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }), 300) }} />
          )}
        </>}
        {error && <span style={{ color: 'var(--error)' }}>{error}</span>}
        <div style={{ height: 2 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <OutlinedButton onClick={back} style={{ flex: 1, height: 52, borderRadius: 28, fontWeight: 600 }}>Annulla</OutlinedButton>
          <GradientButton onClick={save} enabled={!saving} height={52} radius={28} style={{ flex: 1 }}><span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>Salva intervento</span></GradientButton>
        </div>
      </div>
    </div>
  )
}
