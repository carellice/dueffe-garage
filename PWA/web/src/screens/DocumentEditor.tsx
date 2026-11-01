import { useState } from 'react'
import { BackButton, GlassCard, GradientButton, Icon, OutlinedButton, SectionHeading } from '../components/ui.tsx'
import { Menu, toast } from '../components/overlays.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { actions, useStore } from '../lib/store.ts'
import { back } from '../lib/nav.ts'
import { pickFile, readDataUrl } from '../lib/files.ts'
import { now, uuid, type GarageDocument } from '../../../shared/model.ts'
import { maintenanceLabel } from '../../../shared/logic.ts'
import { dateLabel, todayString } from '../../../shared/format.ts'

type Picked = { file: File; label: string }

/** DocumentEditor of Screens.kt: "Nuovo documento" / "Modifica documento". */
export function DocumentEditor({ vehicleId, id }: { vehicleId: string; id?: string }) {
  const state = useStore((s) => s.data)!
  const existing = state.documents.find((d) => d.id === id)
  const maintenances = state.maintenances.filter((m) => m.vehicleId === vehicleId)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [name, setName] = useState(existing?.name ?? '')
  const [error, setError] = useState('')
  const [linkedId, setLinkedId] = useState<string | null>(existing?.maintenanceId ?? null)
  const [menu, setMenu] = useState(false)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  const [saving, setSaving] = useState(false)
  const linked = maintenances.find((m) => m.id === linkedId)

  const choose = async (accept: string, camera = false) => {
    const file = await pickFile(accept, camera ? 'environment' : undefined)
    if (!file) {
      if (camera) setError('Foto non acquisita')
      return
    }
    setPicked({ file, label: file.name || 'Pronto' })
    setName(camera ? `Foto_${todayString()}` : file.name.replace(/\.[^.]*$/, '') || file.name)
    setError('')
  }

  const save = async () => {
    if (saving) return
    if ((!picked && !existing) || !name.trim()) { setError('Scegli un file e inserisci il nome'); return }
    try {
      if (picked && picked.file.size > 10 * 1024 * 1024) throw new Error('File troppo grande')
      if (picked && picked.file.size === 0) throw new Error('File vuoto')
      if (linkedId != null && !maintenances.some((m) => m.id === linkedId)) throw new Error('Intervento non disponibile')
      const mime = picked ? picked.file.type || 'application/octet-stream' : existing!.mimeType
      const document: GarageDocument = {
        id: existing?.id ?? uuid(), vehicleId, name: name.trim(), mimeType: mime,
        category: mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'document',
        size: picked ? picked.file.size : existing!.size, addedAt: existing?.addedAt ?? now(), updatedAt: now(), maintenanceId: linkedId,
      }
      setSaving(true)
      await actions.saveDocument(document, picked ? await readDataUrl(picked.file) : undefined)
      toast('Documento salvato')
      back()
    } catch (e) {
      setError((e as Error).message || 'File non leggibile')
      setSaving(false)
    }
  }

  const small = { padding: '0 12px', fontSize: 12 }
  return (
    <div className="scroll status-pad">
      <div style={{ padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BackButton label="Diario auto" onClick={() => back()} />
        <SectionHeading kicker="Documenti" title={existing ? 'Modifica documento' : 'Nuovo documento'} subtitle="Conserva una copia accessibile anche offline." />
        <GlassCard>
          <div style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700 }}>Scegli il file</div>
          <div style={{ height: 5 }} />
          <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '20px', letterSpacing: 0.25 }}>PDF, immagini e altri file fino a 10 MB. Il documento resta sul tuo server.</div>
          <div style={{ height: 15 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <OutlinedButton onClick={() => choose('image/*', true)} style={{ flex: 1, ...small }}>Fotocamera</OutlinedButton>
            <OutlinedButton onClick={() => choose('image/*')} style={{ flex: 1, ...small }}>Galleria</OutlinedButton>
          </div>
          <div style={{ height: 0 }} />
          <OutlinedButton onClick={() => choose('*/*')}>{!picked && !existing ? 'Scegli PDF o file' : 'Cambia file'}</OutlinedButton>
          {picked ? <><div style={{ height: 8 }} /><div className="clamp2" style={{ color: 'var(--primary)', fontSize: 12, lineHeight: '16px' }}>{`File selezionato: ${picked.label}`}</div></>
            : existing ? <><div style={{ height: 8 }} /><div className="clamp2" style={{ color: 'var(--primary)', fontSize: 12, lineHeight: '16px' }}>{`File attuale: ${existing.name}`}</div></> : null}
        </GlassCard>
        <OutlinedField value={name} onChange={(v) => { setName(v); setError('') }} label="Nome documento *" bg="var(--background)" />
        <div ref={setAnchor}>
          <OutlinedField value={linked ? `${maintenanceLabel(linked)} · ${dateLabel(linked.date)}` : 'Nessun intervento'} readOnly
            label="Collega a un intervento (facoltativo)" bg="var(--background)" onClick={() => setMenu(true)}
            trailing={<Icon name="chevronDown" size={24} color="var(--onSurfaceVariant)" style={{ transform: menu ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />} />
        </div>
        <Menu open={menu} anchor={anchor} matchWidth onDismiss={() => setMenu(false)} items={[
          { label: 'Nessun intervento', onClick: () => { setLinkedId(null); setMenu(false) } },
          ...maintenances.map((m) => ({ label: `${maintenanceLabel(m)} · ${dateLabel(m.date)}`, onClick: () => { setLinkedId(m.id); setMenu(false) } })),
        ]} />
        {error && <div style={{ color: 'var(--error)', fontSize: 16, lineHeight: '24px', letterSpacing: 0.5 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <OutlinedButton onClick={() => back()} style={{ flex: 1, padding: 0 }}>Annulla</OutlinedButton>
          <GradientButton onClick={save} style={{ flex: 1 }} padding="0 12px"><span className="ellipsis">Salva documento</span></GradientButton>
        </div>
      </div>
    </div>
  )
}
