import { useState } from 'react'
import { AccentBadge, EditorScaffold, Icon, Overline, Panel, TintBadge } from '../components/ui.tsx'
import type { IconName } from '../lib/icons.gen.ts'
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

  const status = picked ? ['File selezionato', picked.label] : existing ? ['File attuale', existing.name] : ['Nessun file scelto', 'PDF, immagini e altri file fino a 10 MB']
  return (
    <EditorScaffold overline="Documento" title={existing ? 'Modifica documento' : 'Nuovo documento'} subtitle="Conserva una copia accessibile anche offline."
      onDismiss={() => back()} saveLabel="Salva documento" onSave={save}>
      <Overline text={existing ? 'Sostituisci il file' : 'Scegli il file'} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Source label="Fotocamera" icon="camera" onClick={() => choose('image/*', true)} />
        <Source label="Galleria" icon="image" onClick={() => choose('image/*')} />
        <Source label="File" icon="folder" onClick={() => choose('*/*')} />
      </div>
      <Panel padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {picked || existing ? <AccentBadge icon="document" size={40} iconSize={20} />
          : <TintBadge icon="document" tint="var(--onSurfaceVariant)" background="var(--surfaceContainerHigh)" size={40} iconSize={20} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{status[0]}</div>
          <div className="clamp2" style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '18px', wordBreak: 'break-word' }}>{status[1]}</div>
        </div>
      </Panel>
      <Overline text="Dettagli" style={{ paddingTop: 4 }} />
      <OutlinedField value={name} onChange={(v) => { setName(v); setError('') }} label="Nome documento *" radius={14} bg="var(--background)" />
      <div ref={setAnchor}>
        <OutlinedField value={linked ? `${maintenanceLabel(linked)} · ${dateLabel(linked.date)}` : 'Nessun intervento'} readOnly radius={14}
          label="Collega a un intervento (facoltativo)" bg="var(--background)" onClick={() => setMenu(true)}
          trailing={<Icon name="chevronDown" size={24} color="var(--onSurfaceVariant)" style={{ transform: menu ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />} />
      </div>
      <Menu open={menu} anchor={anchor} matchWidth onDismiss={() => setMenu(false)} items={[
        { label: 'Nessun intervento', onClick: () => { setLinkedId(null); setMenu(false) } },
        ...maintenances.map((m) => ({ label: `${maintenanceLabel(m)} · ${dateLabel(m.date)}`, onClick: () => { setLinkedId(m.id); setMenu(false) } })),
      ]} />
      {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
    </EditorScaffold>
  )
}

function Source({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) {
  return (
    <Panel padding={14} onClick={onClick} label={label} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={26} color="var(--primary)" />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </Panel>
  )
}
