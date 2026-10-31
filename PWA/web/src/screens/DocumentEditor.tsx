import { useRef, useState } from 'react'
import { dateLabel, documentCategoryForMime, maintenanceLabel, now, today, uuid, type GarageDocument, type Vehicle } from '../../../shared/model.ts'
import { actions, useStore } from '../lib/store.ts'
import { back } from '../lib/nav.ts'
import { pickFile, readDataUrl } from '../lib/files.ts'
import { BackButton, GlassCard, GradientButton, Icon, OutlinedButton, SectionHeading } from '../components/ui.tsx'
import { OutlinedTextField } from '../components/fields.tsx'
import { DropdownMenu, toast } from '../components/overlays.tsx'

const MAX = 10 * 1024 * 1024

export function DocumentEditor({ vehicle, existingId, linkedMaintenanceId }: { vehicle: Vehicle; existingId: string | null; linkedMaintenanceId: string | null }) {
  const state = useStore((s) => s.data)!
  const existing = useRef<GarageDocument | null>(existingId ? state.documents.find((d) => d.id === existingId) ?? null : null).current
  const maintenances = state.maintenances.filter((m) => m.vehicleId === vehicle.id)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState(existing?.name ?? '')
  const [error, setError] = useState('')
  const [linked, setLinked] = useState<string | null>(existing?.maintenanceId ?? linkedMaintenanceId)
  const [menu, setMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)

  const choose = async (accept: string, camera = false) => {
    const picked = await pickFile(accept, camera)
    if (!picked) {
      if (camera) setError('Foto non acquisita')
      return
    }
    setFile(picked)
    setName(camera ? `Foto_${today()}` : picked.name.includes('.') ? picked.name.slice(0, picked.name.lastIndexOf('.')) : picked.name)
    setError('')
  }

  const save = async () => {
    if ((file == null && existing == null) || name.trim() === '') { setError('Scegli un file e inserisci il nome'); return }
    try {
      if (file && file.size === 0) throw new Error('File vuoto')
      if (file && file.size > MAX) throw new Error('File troppo grande')
      if (linked != null && !maintenances.some((m) => m.id === linked)) throw new Error('Intervento non disponibile')
      const mime = file ? file.type || 'application/octet-stream' : existing!.mimeType
      const document: GarageDocument = {
        id: existing?.id ?? uuid(), vehicleId: vehicle.id, name: name.trim(), mimeType: mime, category: documentCategoryForMime(mime),
        size: file?.size ?? existing!.size, addedAt: existing?.addedAt ?? now(), updatedAt: now(), maintenanceId: linked,
      }
      setSaving(true)
      await actions.saveDocument(document, file ? await readDataUrl(file) : undefined)
      toast('Documento salvato')
      back()
    } catch (e) {
      setError((e as Error).message || 'File non leggibile')
      setSaving(false)
    }
  }

  const linkedMaintenance = maintenances.find((m) => m.id === linked)
  return (
    <div className="scroll">
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BackButton label="Diario auto" onClick={back} />
        <SectionHeading kicker="Documenti" title={existing ? 'Modifica documento' : 'Nuovo documento'} subtitle="Conserva una copia accessibile anche offline." />
        <GlassCard>
          <span style={{ fontSize: 20, fontWeight: 700 }}>Scegli il file</span>
          <div style={{ height: 5 }} />
          <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13 }}>PDF, immagini e altri file fino a 10 MB. Il documento resta sul tuo server.</span>
          <div style={{ height: 15 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <OutlinedButton onClick={() => choose('image/*', true)} style={{ flex: 1, fontSize: 12 }}>Fotocamera</OutlinedButton>
            <OutlinedButton onClick={() => choose('image/*')} style={{ flex: 1, fontSize: 12 }}>Galleria</OutlinedButton>
          </div>
          <OutlinedButton onClick={() => choose('*/*')}>{file == null && existing == null ? 'Scegli PDF o file' : 'Cambia file'}</OutlinedButton>
          {file
            ? <><div style={{ height: 8 }} /><span className="clamp2" style={{ color: 'var(--primary)', fontSize: 12 }}>File selezionato: {file.name || 'Pronto'}</span></>
            : existing && <><div style={{ height: 8 }} /><span className="clamp2" style={{ color: 'var(--primary)', fontSize: 12 }}>File attuale: {existing.name}</span></>}
        </GlassCard>
        <OutlinedTextField value={name} onChange={(v) => { setName(v); setError('') }} label="Nome documento *" />
        <div ref={anchor}>
          <OutlinedTextField value={linkedMaintenance ? `${maintenanceLabel(linkedMaintenance)} · ${dateLabel(linkedMaintenance.date)}` : 'Nessun intervento'}
            label="Collega a un intervento (facoltativo)" readOnly onClick={() => setMenu(true)}
            trailing={<Icon name="chevron-down" size={24} color="var(--onSurfaceVariant)" style={{ transform: menu ? 'rotate(180deg)' : undefined }} />} />
        </div>
        <DropdownMenu open={menu} anchor={anchor.current} matchWidth onDismiss={() => setMenu(false)} items={[
          { label: 'Nessun intervento', onClick: () => { setLinked(null); setMenu(false) } },
          ...maintenances.map((m) => ({ label: `${maintenanceLabel(m)} · ${dateLabel(m.date)}`, onClick: () => { setLinked(m.id); setMenu(false) } })),
        ]} />
        {error && <span style={{ color: 'var(--error)' }}>{error}</span>}
        <div style={{ display: 'flex', gap: 10 }}>
          <OutlinedButton onClick={back} style={{ flex: 1 }}>Annulla</OutlinedButton>
          <GradientButton onClick={save} enabled={!saving} style={{ flex: 1 }}>Salva documento</GradientButton>
        </div>
      </div>
    </div>
  )
}
