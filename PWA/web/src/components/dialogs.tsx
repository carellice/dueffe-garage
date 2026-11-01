import { useEffect, useState } from 'react'
import { Dialog, DialogButton } from './overlays.tsx'
import { OutlinedField } from './fields.tsx'
import { Tap } from './ui.tsx'
import type { Vehicle } from '../../../shared/model.ts'
import { now } from '../../../shared/model.ts'
import { parseDate, todayString } from '../../../shared/format.ts'

/** ConfirmDelete of Screens.kt. */
export function ConfirmDelete({ text, onDismiss, onConfirm }: { text: string | null; onDismiss: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={text != null} onDismiss={onDismiss} title="Conferma eliminazione"
      confirm={<DialogButton label="Elimina" color="var(--error)" onClick={onConfirm} />}
      dismiss={<DialogButton label="Annulla" onClick={onDismiss} />}>
      {text}
    </Dialog>
  )
}

function Radio({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={onClick} role="radio" aria-checked={selected}>
      <Tap onClick={onClick} ripple="var(--primary)" style={{ width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? 'var(--primary)' : 'var(--onSurfaceVariant)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selected && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />}
        </span>
      </Tap>
      <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 16, lineHeight: '24px', letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}

/** StatusEditor: "Gestisci auto". */
export function StatusEditor({ vehicle, onDismiss, onSave }: { vehicle: Vehicle | null; onDismiss: () => void; onSave: (v: Vehicle) => void }) {
  const [status, setStatus] = useState('active')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!vehicle) return
    setStatus(vehicle.status)
    setDate(vehicle.statusDate || todayString())
    setNote(vehicle.statusNote)
    setError('')
  }, [vehicle])
  return (
    <Dialog open={vehicle != null} onDismiss={onDismiss} title="Gestisci auto"
      confirm={<DialogButton label="Conferma" onClick={() => {
        if (!vehicle) return
        if (status !== 'active' && !parseDate(date)) { setError('Data non valida'); return }
        onSave({ ...vehicle, status, statusDate: status === 'active' ? '' : date, statusNote: status === 'active' ? '' : note, updatedAt: now() })
      }} />}
      dismiss={<DialogButton label="Annulla" onClick={onDismiss} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {([['active', 'Attiva'], ['sold', 'Venduta'], ['scrapped', 'Rottamata']] as const).map(([key, label]) => (
          <Radio key={key} selected={status === key} label={label} onClick={() => setStatus(key)} />
        ))}
        {status !== 'active' && <>
          <OutlinedField value={date} onChange={setDate} label="Data AAAA-MM-GG" bg="var(--surfaceContainerHigh)" />
          <OutlinedField value={note} onChange={setNote} label="Nota sullo stato" bg="var(--surfaceContainerHigh)" />
        </>}
        {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
      </div>
    </Dialog>
  )
}

/** "Rinomina documento". */
export function RenameDialog({ name, onDismiss, onSave }: { name: string | null; onDismiss: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState('')
  useEffect(() => { if (name != null) setValue(name) }, [name])
  return (
    <Dialog open={name != null} onDismiss={onDismiss} title="Rinomina documento"
      confirm={<DialogButton label="Salva" onClick={() => { if (value.trim()) onSave(value.trim()) }} />}
      dismiss={<DialogButton label="Annulla" onClick={onDismiss} />}>
      <OutlinedField value={value} onChange={setValue} label="Nome" bg="var(--surfaceContainerHigh)" />
    </Dialog>
  )
}

/** PinSetupDialog: "Imposta PIN" / "Cambia PIN". */
export function PinSetupDialog({ open, existingPin, verifyPin, onDismiss, onSave }: {
  open: boolean; existingPin: boolean; verifyPin: (pin: string) => Promise<boolean>; onDismiss: () => void; onSave: (pin: string) => void
}) {
  const [current, setCurrent] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setCurrent(''); setPin(''); setConfirm(''); setError('') } }, [open])
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)
  return (
    <Dialog open={open} onDismiss={onDismiss} title={existingPin ? 'Cambia PIN' : 'Imposta PIN'}
      confirm={<DialogButton label="Salva PIN" onClick={async () => {
        const message = existingPin && !(await verifyPin(current)) ? 'PIN attuale non corretto'
          : pin.length < 4 || pin.length > 8 ? 'Il PIN deve avere da 4 a 8 cifre'
          : pin !== confirm ? 'I PIN non coincidono' : ''
        setError(message)
        if (!message) onSave(pin)
      }} />}
      dismiss={<DialogButton label="Annulla" onClick={onDismiss} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>Scegli un PIN da 4 a 8 cifre.</div>
        {existingPin && <OutlinedField value={current} onChange={(v) => { setCurrent(digits(v)); setError('') }} label="PIN attuale" type="password" inputMode="numeric" autoComplete="off" bg="var(--surfaceContainerHigh)" />}
        <OutlinedField value={pin} onChange={(v) => { setPin(digits(v)); setError('') }} label="Nuovo PIN" type="password" inputMode="numeric" autoComplete="off" bg="var(--surfaceContainerHigh)" />
        <OutlinedField value={confirm} onChange={(v) => { setConfirm(digits(v)); setError('') }} label="Conferma PIN" type="password" inputMode="numeric" autoComplete="off" bg="var(--surfaceContainerHigh)" />
        {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
      </div>
    </Dialog>
  )
}
