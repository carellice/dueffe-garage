import { useEffect, useState } from 'react'
import { fuelOptions, now, today, uuid, vehicleTypeLabel, vehicleTypes, type Vehicle } from '../../../shared/model.ts'
import { actions } from '../lib/store.ts'
import { back, replaceTop } from '../lib/nav.ts'
import { compressImage, pickFile, readDataUrl, vehiclePhotoUrl } from '../lib/files.ts'
import { GradientButton, Icon, OutlinedButton, Pressable } from '../components/ui.tsx'
import { RegistrationField, SelectionField, VehicleTextField, YearField } from '../components/editorFields.tsx'
import { toast } from '../components/overlays.tsx'

export function VehicleEditor({ existing }: { existing: Vehicle | null }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [make, setMake] = useState(existing?.make ?? '')
  const [model, setModel] = useState(existing?.model ?? '')
  const [year, setYear] = useState(String(existing?.year ?? Number(today().slice(0, 4))))
  const [plate, setPlate] = useState(existing?.plate ?? '')
  const [mileage, setMileage] = useState(existing ? String(existing.mileage) : '')
  const [registration, setRegistration] = useState(existing?.registrationDate ?? '')
  const [vehicleType, setVehicleType] = useState(existing?.vehicleType ?? 'car')
  const [fuelChoice, setFuelChoice] = useState(existing ? (fuelOptions.includes(existing.fuel) || existing.fuel.trim() === '' ? existing.fuel : 'Altro') : '')
  const [customFuel, setCustomFuel] = useState(existing && existing.fuel.trim() !== '' && !fuelOptions.includes(existing.fuel) ? existing.fuel : '')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pickPhoto = async () => {
    const file = await pickFile('image/*')
    if (!file) return
    try {
      const blob = await compressImage(file)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
    } catch {
      setError('Foto non leggibile')
    }
  }

  const save = async () => {
    const parsedYear = /^\d+$/.test(year) ? Number(year) : NaN
    const parsedKm = /^\d+$/.test(mileage.trim()) ? Number(mileage.trim()) : NaN
    if (name.trim() === '' || make.trim() === '' || plate.trim() === '' || !(parsedYear >= 1900 && parsedYear <= Number(today().slice(0, 4))) || !(parsedKm >= 0)) {
      setError('Controlla nome, marca, targa, anno e chilometri')
      return
    }
    const fuel = fuelChoice === 'Altro' ? customFuel.trim() : fuelChoice
    if (fuelChoice === 'Altro' && fuel === '') { setError('Specifica il carburante'); return }
    setSaving(true)
    try {
      const base = existing ?? {
        id: uuid(), notes: '', notesUpdatedAt: '', status: 'active', statusDate: '', statusNote: '', addedAt: now(), createdAt: now(),
      }
      const { hasPhoto: _ignored, ...rest } = { hasPhoto: false, ...base } as Vehicle
      const value = {
        ...rest, name: name.trim(), make: make.trim(), model: model.trim(), year: parsedYear, plate: plate.trim().toLocaleUpperCase('it-IT'),
        mileage: parsedKm, registrationDate: registration, fuel, vehicleType, updatedAt: now(),
      }
      await actions.saveVehicle(value, photo ? await readDataUrl(photo) : undefined)
      toast('Auto salvata')
      if (existing) back()
      else replaceTop('detail', { vehicleId: value.id })
    } catch (e) {
      setError((e as Error).message || 'Foto non leggibile')
      setSaving(false)
    }
  }

  const clearError = <T,>(set: (v: T) => void) => (v: T) => { set(v); setError('') }
  return (
    <div className="scroll">
      <div style={{ padding: '17px 20px 28px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ paddingBottom: 10 }}>
          <div style={{ color: 'var(--primary)', fontSize: 11, letterSpacing: 2, fontWeight: 900 }}>SCHEDA AUTO</div>
          <div style={{ height: 3 }} />
          <div style={{ fontSize: 33, lineHeight: '36px', fontWeight: 900 }}>{existing ? 'Modifica auto' : 'Nuova auto'}</div>
          <div style={{ height: 5 }} />
          <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 15, lineHeight: '20px' }}>I dettagli della tua auto, sempre a portata di mano.</div>
        </div>
        <PhotoField preview={preview ?? (existing?.hasPhoto ? vehiclePhotoUrl(existing) : null)} onClick={pickPhoto} />
        <div style={{ height: 1 }} />
        <VehicleTextField value={name} onChange={clearError(setName)} label="Nome auto *" placeholder="Es. La mia auto" icon="car" />
        <VehicleTextField value={make} onChange={clearError(setMake)} label="Marca *" placeholder="Es. Volkswagen" icon="shield" />
        <VehicleTextField value={model} onChange={setModel} label="Modello" placeholder="Es. UP" icon="layers" />
        <SelectionField label="Tipo veicolo *" value={vehicleTypeLabel(vehicleType)} placeholder="Seleziona tipo" icon="car"
          options={vehicleTypes.map(([, l]) => l)} onChange={(label) => setVehicleType(vehicleTypes.find(([, l]) => l === label)![0])} />
        <div style={{ display: 'flex', gap: 8 }}>
          <YearField value={year} onChange={clearError(setYear)} style={{ flex: 1, minWidth: 0 }} />
          <VehicleTextField value={mileage} onChange={clearError(setMileage)} label="Chilometri *" placeholder="Es. 0" icon="speedometer" suffix="km" inputMode="numeric" style={{ flex: 1, minWidth: 0 }} />
        </div>
        <VehicleTextField value={plate} onChange={(v) => { setPlate(v.toLocaleUpperCase('it-IT')); setError('') }} label="Targa *" placeholder="Es. EN093PW" icon="license-plate" />
        <SelectionField label="Carburante" value={fuelChoice} placeholder="Seleziona carburante" icon="fuel"
          options={['Non specificato', ...fuelOptions, 'Altro']} onChange={(v) => { setFuelChoice(v === 'Non specificato' ? '' : v); setError('') }} />
        {fuelChoice === 'Altro' && <VehicleTextField value={customFuel} onChange={clearError(setCustomFuel)} label="Specifica carburante *" placeholder="Es. Benzina/etanolo" icon="fuel" />}
        <RegistrationField value={registration} onChange={setRegistration} />
        {error && <span style={{ color: 'var(--error)', paddingTop: 3 }}>{error}</span>}
        <div style={{ height: 4 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <OutlinedButton onClick={back} style={{ flex: 1, height: 52, borderRadius: 28, fontWeight: 600 }}>Annulla</OutlinedButton>
          <GradientButton onClick={save} enabled={!saving} height={52} radius={28} style={{ flex: 1 }}><span style={{ fontWeight: 700 }}>Salva auto</span></GradientButton>
        </div>
      </div>
    </div>
  )
}

function PhotoField({ preview, onClick }: { preview: string | null; onClick: () => void }) {
  return (
    <Pressable onClick={onClick} pressed={1} style={{ height: 148, borderRadius: 24, background: 'var(--surface)', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 1, borderRadius: 20, border: '1px dashed color-mix(in srgb, var(--outline) 35%, transparent)', pointerEvents: 'none' }} />
      {preview
        ? <>
            <img src={preview} alt="Foto auto selezionata" style={{ position: 'absolute', inset: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', objectFit: 'cover', borderRadius: 20 }} />
            <span style={{ position: 'absolute', bottom: 18, color: '#fff', fontWeight: 600, fontSize: 13, background: 'rgba(0,0,0,.72)', borderRadius: 18, padding: '7px 15px', lineHeight: '20px' }}>Sostituisci foto</span>
          </>
        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="car" size={38} color="var(--primary)" />
              <div style={{ position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: 'var(--onPrimary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, lineHeight: '20px' }}>+</div>
            </div>
            <div style={{ height: 6 }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Aggiungi una foto</span>
            <span style={{ fontSize: 12, color: 'var(--onSurfaceVariant)' }}>Foto della tua auto (facoltativa)</span>
          </div>}
    </Pressable>
  )
}
