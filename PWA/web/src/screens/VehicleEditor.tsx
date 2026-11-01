import { useState } from 'react'
import { GradientButton, Icon, OutlinedButton, TextButton } from '../components/ui.tsx'
import { DatePickerDialog, Dialog, DialogButton, toast } from '../components/overlays.tsx'
import { FieldIcon, OutlinedField, VehicleFieldFrame, VehicleSelectionField, VehicleTextField } from '../components/fields.tsx'
import { actions, fileUrl, useStore } from '../lib/store.ts'
import { back, replace } from '../lib/nav.ts'
import { photoDataUrl, pickFile } from '../lib/files.ts'
import { now, uuid, type Vehicle } from '../../../shared/model.ts'
import { fuelOptions, vehicleTypeLabel, vehicleTypes } from '../../../shared/logic.ts'
import { dateLabel, today } from '../../../shared/format.ts'

const newVehicle = (): Vehicle => ({
  id: uuid(), name: '', make: '', model: '', year: today().y, plate: '', mileage: 0, registrationDate: '', fuel: '', vehicleType: 'car',
  notes: '', notesUpdatedAt: '', status: 'active', statusDate: '', statusNote: '', addedAt: now(), createdAt: now(), updatedAt: now(),
})

/** VehicleEditor of Screens.kt: "Nuova auto" / "Modifica auto". */
export function VehicleEditor({ id }: { id?: string }) {
  const existing = useStore((s) => s.data?.vehicles.find((v) => v.id === id))
  const [name, setName] = useState(existing?.name ?? '')
  const [make, setMake] = useState(existing?.make ?? '')
  const [model, setModel] = useState(existing?.model ?? '')
  const [year, setYear] = useState(String(existing?.year ?? today().y))
  const [plate, setPlate] = useState(existing?.plate ?? '')
  const [mileage, setMileage] = useState(existing ? String(existing.mileage) : '')
  const [registration, setRegistration] = useState(existing?.registrationDate ?? '')
  const [vehicleType, setVehicleType] = useState(existing?.vehicleType ?? 'car')
  const [fuelChoice, setFuelChoice] = useState(existing ? (fuelOptions.includes(existing.fuel) || !existing.fuel.trim() ? existing.fuel : 'Altro') : '')
  const [customFuel, setCustomFuel] = useState(existing && existing.fuel.trim() && !fuelOptions.includes(existing.fuel) ? existing.fuel : '')
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const clear = (set: (v: string) => void) => (v: string) => { set(v); setError('') }

  const pickPhoto = async () => {
    const file = await pickFile('image/*')
    if (!file) return
    try { setPhoto(await photoDataUrl(file)) } catch (e) { setError((e as Error).message) }
  }

  const save = async () => {
    if (saving) return
    const parsedYear = /^\d+$/.test(year) ? Number(year) : NaN
    const parsedKm = /^\d+$/.test(mileage.trim()) ? Number(mileage.trim()) : NaN
    if (!name.trim() || !make.trim() || !plate.trim() || !(parsedYear >= 1900 && parsedYear <= today().y) || !(parsedKm >= 0)) {
      setError('Controlla nome, marca, targa, anno e chilometri'); return
    }
    const fuel = fuelChoice === 'Altro' ? customFuel.trim() : fuelChoice
    if (fuelChoice === 'Altro' && !fuel) { setError('Specifica il carburante'); return }
    const value: Vehicle = {
      ...(existing ?? newVehicle()), name: name.trim(), make: make.trim(), model: model.trim(), year: parsedYear, plate: plate.trim(),
      mileage: parsedKm, registrationDate: registration, fuel, vehicleType, updatedAt: now(),
    }
    setSaving(true)
    try {
      await actions.saveVehicle(value, photo)
      toast('Auto salvata')
      if (existing) back()
      else replace('detail', { vehicleId: value.id, from: 'Garage' })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="scroll status-pad">
      <div style={{ padding: '17px 20px calc(28px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ paddingBottom: 10 }}>
          <div className="kicker" style={{ color: 'var(--primary)', letterSpacing: 2 }}>SCHEDA AUTO</div>
          <div style={{ height: 3 }} />
          <div style={{ fontSize: 33, lineHeight: '36px', fontWeight: 900 }}>{existing ? 'Modifica auto' : 'Nuova auto'}</div>
          <div style={{ height: 5 }} />
          <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 15, lineHeight: '20px', letterSpacing: 0.5 }}>I dettagli della tua auto, sempre a portata di mano.</div>
        </div>
        <PhotoField preview={photo ?? (existing?.hasPhoto ? fileUrl('vehicle', existing.id, existing.updatedAt) : undefined)} onClick={pickPhoto} />
        <div style={{ height: 1 }} />
        <VehicleTextField value={name} onChange={clear(setName)} label="Nome auto *" placeholder="Es. La mia auto" icon="car" />
        <VehicleTextField value={make} onChange={clear(setMake)} label="Marca *" placeholder="Es. Volkswagen" icon="shield" />
        <VehicleTextField value={model} onChange={setModel} label="Modello" placeholder="Es. UP" icon="layers" />
        <VehicleSelectionField label="Tipo veicolo *" value={vehicleTypeLabel(vehicleType)} placeholder="Seleziona tipo" icon="car"
          options={vehicleTypes.map(([, label]) => label)} onChange={(label) => setVehicleType(vehicleTypes.find(([, l]) => l === label)![0])} />
        <div style={{ display: 'flex', gap: 8 }}>
          <YearField value={year} onChange={clear(setYear)} />
          <VehicleTextField value={mileage} onChange={clear(setMileage)} label="Chilometri *" placeholder="Es. 0" icon="speedometer" suffix="km" inputMode="numeric" style={{ flex: 1 }} />
        </div>
        <VehicleTextField value={plate} onChange={(v) => { setPlate(v.toLocaleUpperCase('it-IT')); setError('') }} label="Targa *" placeholder="Es. EN093PW" icon="licensePlate" uppercase />
        <VehicleSelectionField label="Carburante" value={fuelChoice} placeholder="Seleziona carburante" icon="fuel"
          options={['Non specificato', ...fuelOptions, 'Altro']} onChange={(v) => { setFuelChoice(v === 'Non specificato' ? '' : v); setError('') }} />
        {fuelChoice === 'Altro' && <VehicleTextField value={customFuel} onChange={clear(setCustomFuel)} label="Specifica carburante *" placeholder="Es. Benzina/etanolo" icon="fuel" />}
        <RegistrationField value={registration} onChange={setRegistration} />
        {error && <div style={{ color: 'var(--error)', paddingTop: 3, fontSize: 16, lineHeight: '24px', letterSpacing: 0.5 }}>{error}</div>}
        <div style={{ height: 4 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <OutlinedButton onClick={() => back()} height={52} radius={28} style={{ flex: 1, padding: 0 }}><span style={{ fontWeight: 600 }}>Annulla</span></OutlinedButton>
          <GradientButton onClick={save} height={52} style={{ flex: 1 }}><span style={{ fontWeight: 700 }}>Salva auto</span></GradientButton>
        </div>
      </div>
    </div>
  )
}

/** VehiclePhotoField: dashed frame, the photo when there is one. */
function PhotoField({ preview, onClick }: { preview?: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="tap" role="button" style={{ position: 'relative', height: 148, borderRadius: 24, background: 'var(--surface)', padding: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg style={{ position: 'absolute', inset: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', overflow: 'visible', pointerEvents: 'none' }}>
        <rect x="1" y="1" style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }} rx="20" fill="none" stroke="color-mix(in srgb, var(--outline) 35%, transparent)" strokeWidth="1" strokeDasharray="8 6" />
      </svg>
      {preview ? <>
        <img src={preview} alt="Foto auto selezionata" style={{ position: 'absolute', inset: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', objectFit: 'cover', borderRadius: 20 }} />
        <span style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', color: '#FFFFFF', fontWeight: 600, fontSize: 13, lineHeight: '20px',
          background: 'rgba(0,0,0,.72)', borderRadius: 18, padding: '7px 15px', whiteSpace: 'nowrap' }}>Sostituisci foto</span>
      </> : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 62, height: 62, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="car" size={38} color="var(--primary)" />
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: 'var(--onPrimary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, lineHeight: '20px' }}>+</div>
          </div>
          <div style={{ height: 6 }} />
          <div style={{ fontSize: 15, lineHeight: '24px', fontWeight: 600, letterSpacing: 0.5 }}>Aggiungi una foto</div>
          <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--onSurfaceVariant)', letterSpacing: 0.4 }}>Foto della tua auto (facoltativa)</div>
        </div>
      )}
    </div>
  )
}

/** VehicleYearField: opens "Anno dell'auto". */
function YearField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(value)
  const [error, setError] = useState(false)
  const max = today().y
  return (
    <>
      <VehicleFieldFrame label="Anno *" icon="calendarNav" style={{ flex: 1 }} onClick={() => { setInput(value); setError(false); setOpen(true) }}
        trailing={<Icon name="chevronDown" size={18} color="var(--onSurfaceVariant)" />}>
        <div style={{ fontSize: 15, lineHeight: '24px', letterSpacing: 0.5 }}>{value}</div>
      </VehicleFieldFrame>
      <Dialog open={open} onDismiss={() => setOpen(false)} title="Anno dell'auto"
        confirm={<DialogButton label="Conferma" onClick={() => {
          const parsed = /^\d+$/.test(input) ? Number(input) : NaN
          if (!(parsed >= 1900 && parsed <= max)) setError(true)
          else { onChange(String(parsed)); setOpen(false) }
        }} />}
        dismiss={<DialogButton label="Annulla" onClick={() => setOpen(false)} />}>
        <OutlinedField value={input} onChange={(v) => { setInput(v.replace(/\D/g, '')); setError(false) }} label="Anno" inputMode="numeric" bg="var(--surfaceContainerHigh)" />
        {error && <div style={{ color: 'var(--error)', fontSize: 12, lineHeight: '16px' }}>{`Inserisci un anno tra 1900 e ${max}`}</div>}
      </Dialog>
    </>
  )
}

/** VehicleRegistrationField */
function RegistrationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <VehicleFieldFrame label="Data di immatricolazione" icon="calendarNav" onClick={() => setOpen(true)} trailing={<FieldIcon icon="calendarNav" />}>
        <div style={{ color: value ? 'var(--onSurface)' : 'var(--onSurfaceVariant)', fontSize: 15, lineHeight: '24px', letterSpacing: 0.5 }}>{value ? dateLabel(value) : 'Seleziona data'}</div>
      </VehicleFieldFrame>
      {value && <TextButton onClick={() => onChange('')} style={{ width: '100%' }}>Rimuovi data</TextButton>}
      <DatePickerDialog open={open} value={value} onDismiss={() => setOpen(false)} onConfirm={(d) => { onChange(d); setOpen(false) }} />
    </>
  )
}
