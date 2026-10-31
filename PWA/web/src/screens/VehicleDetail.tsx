import { AnimatePresence, motion } from 'framer-motion'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  dateLabel, documentCategory, documentDate, documentSize, dueReminders, formatEuro, formatKm, formatLabel, maintenanceLabel,
  notesUpdatedLabel, now, parseDate, statusLabel, today, vehicleTypeLabel, type GarageDocument, type Maintenance, type Vehicle,
} from '../../../shared/model.ts'
import { actions, setTab, useStore } from '../lib/store.ts'
import { back, backToRoot, navigate } from '../lib/nav.ts'
import { documentAppearance, maintenanceAppearance, useIsDark } from '../lib/theme.ts'
import { copyText, shareDocument } from '../lib/files.ts'
import {
  BackButton, Divider, GlassCard, GradientButton, GradientIcon, Icon, Kicker, Pressable, TextButton, VDivider,
} from '../components/ui.tsx'
import { Chip, DetailEmptyState, FilterPill, ReminderListCard, TypeBadge, VehicleImage } from '../components/garage.tsx'
import { DocumentThumbnail } from '../components/thumbnail.tsx'
import { OutlinedTextField } from '../components/fields.tsx'
import { AlertDialog, confirmDelete, DropdownMenu, openDialog, toast } from '../components/overlays.tsx'
import { spring, tween } from '../components/motion.ts'

const types = ['all', 'service', 'inspection', 'tax', 'insurance', 'tires', 'custom']

export function VehicleDetail({ vehicle: v, sectionsPage, backLabel = 'Garage' }: { vehicle: Vehicle; sectionsPage: boolean; backLabel?: string }) {
  const state = useStore((s) => s.data)!
  const tab = useStore((s) => s.tab)
  const dark = useIsDark()
  const maintenances = state.maintenances.filter((m) => m.vehicleId === v.id)
  const docs = state.documents.filter((d) => d.vehicleId === v.id)
  const reminders = useMemo(() => dueReminders(state).filter((d) => d.vehicle.id === v.id), [state, v.id])
  const [query, setQuery] = useState('')
  useEffect(() => setQuery(''), [tab, v.id])
  const [typeFilter, setTypeFilter] = useState('all')
  const [documentFilter, setDocumentFilter] = useState('all')
  const [reminderFilter, setReminderFilter] = useState('all')
  const [notes, setNotes] = useState(v.notes)
  useEffect(() => setNotes(v.notes), [v.notes])
  const muted = 'var(--onSurfaceVariant)'
  const q = query.toLocaleLowerCase('it-IT')

  let sectionItems: [string, ReactNode][] = []
  if (sectionsPage) {
    if (tab === 'Interventi') {
      sectionItems.push(['interventi-add', <GradientButton key="a" onClick={() => navigate('maintenance-editor', { vehicleId: v.id })} height={52} radius={28} style={{ width: '100%' }}>
        <span style={{ fontSize: 24 }}>＋</span><span style={{ width: 8 }} /><span style={{ fontWeight: 700 }}>Registra intervento</span>
      </GradientButton>])
      if (maintenances.length > 0) {
        sectionItems.push(['interventi-search', <SearchField key="s" value={query} onChange={setQuery} placeholder="Cerca interventi" />])
        sectionItems.push(['interventi-filters', <div key="f" className="hscroll" style={{ gap: 7 }}>
          {types.map((t) => {
            const a = maintenanceAppearance(t, dark)
            return <FilterPill key={t} radius={14} iconSize={19} label={t === 'all' ? 'Tutti' : a.label} icon={t === 'all' ? undefined : a.icon} selected={typeFilter === t} onClick={() => setTypeFilter(t)} />
          })}
        </div>])
      }
      const filtered = maintenances.filter((m) => (typeFilter === 'all' || m.type === typeFilter) && `${maintenanceLabel(m)} ${m.notes} ${m.date}`.toLocaleLowerCase('it-IT').includes(q))
      if (filtered.length === 0) sectionItems.push(['interventi-empty', maintenances.length === 0
        ? <DetailEmptyState key="e" title="Nessun intervento registrato." subtitle="Registra il primo intervento per tenere traccia della manutenzione della tua auto." />
        : <DetailEmptyState key="e" title="Nessun intervento trovato." subtitle="Prova un'altra ricerca o seleziona un altro filtro." />])
      for (const m of filtered) sectionItems.push([`maintenance-${m.id}`, <MaintenanceListCard key={m.id} maintenance={m} onOpen={() => navigate('maintenance-detail', { vehicleId: v.id, itemId: m.id })} />])
    } else if (tab === 'Scadenze') {
      if (reminders.length > 0) sectionItems.push(['scadenze-filters', <div key="f" className="hscroll" style={{ gap: 7 }}>
        {types.map((t) => {
          const a = maintenanceAppearance(t, dark)
          return <FilterPill key={t} label={t === 'all' ? 'Tutte' : a.label} icon={t === 'all' ? undefined : a.icon} selected={reminderFilter === t} onClick={() => setReminderFilter(t)} />
        })}
      </div>])
      const filtered = reminders.filter((r) => reminderFilter === 'all' || r.maintenance.type === reminderFilter)
      if (filtered.length === 0) sectionItems.push(['scadenze-empty', reminders.length === 0
        ? <DetailEmptyState key="e" title="Nessuna scadenza attiva." subtitle="Le prossime scadenze della tua auto compariranno qui." />
        : <DetailEmptyState key="e" title="Nessuna scadenza trovata." subtitle="Seleziona un altro filtro per vedere le scadenze." />])
      for (const r of filtered) sectionItems.push([`reminder-${r.reminder.id}`, <ReminderListCard key={r.reminder.id} item={r} onClick={() => navigate('reminder-detail', { vehicleId: v.id, itemId: r.reminder.id })} />])
    } else if (tab === 'Documenti') {
      sectionItems.push(['documenti-add', <GradientButton key="a" onClick={() => navigate('document-editor', { vehicleId: v.id })} height={52} radius={28} style={{ width: '100%' }}>
        <span style={{ fontSize: 24 }}>＋</span><span style={{ width: 8 }} /><span style={{ fontWeight: 700 }}>Aggiungi documento</span>
      </GradientButton>])
      if (docs.length > 0) {
        sectionItems.push(['documenti-search', <SearchField key="s" value={query} onChange={setQuery} placeholder="Cerca documenti" />])
        sectionItems.push(['documenti-filters', <div key="f" className="hscroll" style={{ gap: 7 }}>
          {['all', 'insurance', 'inspection', 'tax', 'service', 'other'].map((c) => {
            const a = documentAppearance(c, dark)
            const selected = documentFilter === c
            return <FilterPill key={c} padding={13} label={c === 'all' ? 'Tutti' : a.label} icon={c === 'all' ? 'folder' : a.icon} selected={selected}
              iconTint={selected ? 'var(--onSecondaryContainer)' : 'var(--onSurfaceVariant)'} onClick={() => setDocumentFilter(c)} />
          })}
        </div>])
      }
      const filtered = docs.filter((d) => d.name.toLocaleLowerCase('it-IT').includes(q) && (documentFilter === 'all' || documentCategory(d, state.maintenances) === documentFilter))
        .sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
      if (filtered.length === 0) sectionItems.push(['documenti-empty', docs.length === 0
        ? <DetailEmptyState key="e" title="Nessun documento salvato." subtitle="Aggiungi libretto, assicurazione e altri documenti della tua auto." />
        : <DetailEmptyState key="e" title="Nessun documento trovato." subtitle="Prova un'altra ricerca o seleziona un altro filtro." />])
      for (const d of filtered) sectionItems.push([`document-${d.id}`, <DocumentListCard key={d.id} document={d} category={documentCategory(d, state.maintenances)}
        onOpen={() => navigate('document-detail', { vehicleId: v.id, itemId: d.id })} />])
    } else {
      sectionItems = [['note-card', <NotesCard key="n" updatedAt={v.notesUpdatedAt} value={notes} onChange={setNotes}
        onSave={() => actions.saveVehicle({ ...v, notes, notesUpdatedAt: now(), updatedAt: now() }).catch((e) => toast((e as Error).message))} />]]
    }
  }

  return (
    <div className="scroll">
      <div style={{ padding: '14px 18px 96px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!sectionsPage && (
          <div style={{ position: 'relative', height: v.hasPhoto ? 250 : 72 }}>
            {v.hasPhoto && <>
              <VehicleImage vehicle={v} style={{ position: 'absolute', inset: 0, borderRadius: 28 }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 28, background: 'linear-gradient(to bottom, rgba(0,0,0,.35) 0%, transparent 30%, transparent 70%, rgba(0,0,0,.35) 100%)' }} />
            </>}
            <BackButton label={backLabel} onClick={back} style={{ position: 'absolute', left: 12, top: 12 }} />
          </div>
        )}
        {sectionsPage && <BackButton label="Dettaglio auto" onClick={back} />}
        <div style={{ padding: 2 }}>
          <Kicker text={sectionsPage ? 'DIARIO' : 'LA TUA AUTO'} />
          <div style={{ height: 4 }} />
          <div className="clamp2" style={{ fontSize: 34, lineHeight: '37px', fontWeight: 900, letterSpacing: -0.6 }}>{sectionsPage ? 'La vita della tua auto' : v.name}</div>
          <div className="clamp2" style={{ color: muted, fontSize: 16 }}>{sectionsPage ? `${v.name} · Interventi, scadenze, documenti e note` : `${v.make} ${v.model}`.trim()}</div>
        </div>
        {!sectionsPage && <>
          <GlassCard padding={0}>
            <div style={{ padding: '15px 16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ alignSelf: 'center' }}>
                <VehiclePlate plate={v.plate} type={v.vehicleType} year={Number(v.registrationDate.slice(0, 4)) || v.year} />
              </div>
              <div style={{ height: 16 }} /><Divider alpha={0.17} /><div style={{ height: 13 }} />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <DetailFact label="TIPO" value={vehicleTypeLabel(v.vehicleType)} icon="car" />
                <VDivider height={45} />
                <DetailFact label="ANNO" value={String(v.year)} icon="calendar-nav" />
              </div>
              <div style={{ height: 13 }} /><Divider alpha={0.17} /><div style={{ height: 13 }} />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <DetailFact label="CHILOMETRI" value={formatKm(v.mileage)} icon="speedometer" />
                  <DetailFact label="IMMATRICOLATA" value={v.registrationDate.trim() === '' ? 'Non indicata' : dateLabel(v.registrationDate)} icon="calendar-nav" />
                </div>
                <VDivider height={100} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <DetailFact label="STATO" value={statusLabel(v.status)} icon="car" statusDot={v.status === 'active'} />
                  <DetailFact label="CARBURANTE" value={v.fuel.trim() === '' ? 'Non indicato' : v.fuel} icon="fuel" />
                </div>
              </div>
              <div style={{ height: 15 }} /><Divider alpha={0.17} /><div style={{ height: 13 }} />
              <div style={{ display: 'flex', gap: 2 }}>
                <DetailAction label="Copia targa" icon="copy" onClick={async () => { await copyText(v.plate); toast('Targa copiata') }} />
                <DetailAction label="Modifica" icon="edit" onClick={() => navigate('vehicle-editor', { vehicleId: v.id })} />
                <DetailAction label="Stato" icon="car" onClick={() => statusEditor(v)} />
                <DetailAction label="Elimina auto" icon="delete" destructive onClick={() => confirmDelete(`Eliminare ${v.name} e tutti i suoi dati?`, () => {
                  backToRoot()
                  actions.deleteVehicle(v.id).catch((e) => toast((e as Error).message))
                })} />
              </div>
            </div>
          </GlassCard>
          <div data-hero={`sections-page-${v.id}`} data-radius="28">
            <GradientButton onClick={() => { setTab('Interventi'); navigate('sections', { vehicleId: v.id }) }} height={56} radius={28} shine style={{ width: '100%' }}>
              <Icon name="wrench" size={21} />
              <span style={{ width: 9 }} />
              <span style={{ fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap' }}>Interventi, scadenze, documenti e note</span>
            </GradientButton>
          </div>
        </>}
        {sectionsPage && <SectionTabs tab={tab} />}
        {sectionsPage && (
          <AnimatePresence initial={false} mode="popLayout">
            {sectionItems.map(([key, node]) => (
              <motion.div key={key} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ opacity: spring(1, 400), layout: spring(1, 400) }}>
                {node}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

const sections: [string, string][] = [['Interventi', 'wrench'], ['Scadenze', 'calendar-nav'], ['Documenti', 'document'], ['Note', 'note']]

function SectionTabs({ tab }: { tab: string }) {
  const index = Math.max(0, sections.findIndex(([l]) => l === tab))
  return (
    <div style={{ borderRadius: 32, background: 'var(--surface)', padding: 3, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 32, border: '1px solid var(--outline)', opacity: 0.18, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <motion.div initial={false} animate={{ left: `${(index * 100) / sections.length}%` }} transition={spring(0.7, 400)}
          style={{ position: 'absolute', top: 0, width: `${100 / sections.length}%`, height: 43, borderRadius: 28, background: 'var(--accent)' }} />
        <div role="tablist" style={{ display: 'flex', position: 'relative' }}>
          {sections.map(([label, icon]) => {
            const selected = tab === label
            return (
              <Pressable key={label} role="tab" selected={selected} pressed={1} onClick={() => setTab(label)}
                style={{ flex: 1, height: 43, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.span initial={false} animate={{ color: selected ? 'var(--onAccent)' : 'var(--primary)' }} transition={tween(260)} style={{ display: 'flex' }}>
                  <Icon name={icon} size={16} />
                </motion.span>
                <span style={{ width: 4 }} />
                <motion.span initial={false} animate={{ color: selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)' }} transition={tween(260)}
                  style={{ fontSize: 10, fontWeight: selected ? 700 : 500, whiteSpace: 'nowrap' }}>{label}</motion.span>
              </Pressable>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <OutlinedTextField value={value} onChange={onChange} placeholder={placeholder} radius={17} leading={<Icon name="search" size={22} color="var(--onSurfaceVariant)" />} />
}

/** The Italian plate: blue EU band, two lines for motorcycles and scooters. */
function VehiclePlate({ plate, type, year }: { plate: string; type: string; year: number }) {
  const twoWheeler = type === 'motorcycle' || type === 'scooter'
  const display = plate.toLocaleUpperCase('it-IT').replace(/\s/g, '')
  const band = (width: number, top: ReactNode, bottom: ReactNode) => (
    <div style={{ width, alignSelf: 'stretch', background: '#0755AD', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', flex: 'none' }}>
      {top}{bottom}
    </div>
  )
  const text: React.CSSProperties = { color: '#171717', fontWeight: 900, letterSpacing: 2 }
  const mid = Math.floor((display.length + 1) / 2)
  return (
    <div style={{ height: twoWheeler ? 82 : 64, width: twoWheeler ? 144 : 246, border: '2px solid #363636', borderRadius: 7, overflow: 'hidden', background: '#F9F9F5', display: 'flex', alignItems: 'center' }}>
      {band(twoWheeler ? 24 : 31,
        <span style={{ color: '#FFDF58', fontSize: 13, lineHeight: '15px' }}>✦</span>,
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>I</span><div style={{ height: 3 }} /></div>)}
      <div style={{ flex: 1, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
        {twoWheeler
          ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ ...text, fontSize: 23, lineHeight: '25px' }}>{display.slice(0, mid)}</span>
              <span style={{ ...text, fontSize: 23, lineHeight: '25px' }}>{display.slice(mid)}</span>
            </div>
          : <span style={{ ...text, fontSize: display.length > 8 ? 21 : 26, whiteSpace: 'nowrap' }}>{display}</span>}
      </div>
      {!twoWheeler && band(24,
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={{ height: 3 }} /><span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{String(((year % 100) + 100) % 100).padStart(2, '0')}</span></div>,
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ color: '#fff', fontSize: 13 }}>◌</span><div style={{ height: 3 }} /></div>)}
    </div>
  )
}

function DetailFact({ label, value, icon, statusDot = false }: { label: string; value: string; icon: string; statusDot?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '3px 5px', display: 'flex', alignItems: 'center' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={icon} size={20} color="var(--primary)" />
      </div>
      <div style={{ width: 9 }} />
      <div style={{ minWidth: 0 }}>
        <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 10, lineHeight: '13px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {statusDot && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#17C977', flex: 'none' }} /><span style={{ width: 5 }} /></>}
          <span className="clamp2" style={{ fontSize: 14, lineHeight: '18px', fontWeight: 700 }}>{value}</span>
        </div>
      </div>
    </div>
  )
}

function DetailAction({ label, icon, onClick, destructive = false }: { label: string; icon: string; onClick: () => void; destructive?: boolean }) {
  const color = destructive ? 'var(--error)' : 'var(--primary)'
  return (
    <Pressable onClick={onClick} style={{ flex: 1, minWidth: 0, borderRadius: 15, padding: '4px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: destructive ? 'color-mix(in srgb, var(--error) 10%, transparent)' : 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={color} />
      </div>
      <div style={{ height: 5 }} />
      <span className="ellipsis" style={{ color: destructive ? color : 'var(--onSurfaceVariant)', fontSize: 10, maxWidth: '100%' }}>{label}</span>
    </Pressable>
  )
}

function MaintenanceListCard({ maintenance: m, onOpen }: { maintenance: Maintenance; onOpen: () => void }) {
  const a = maintenanceAppearance(m.type, useIsDark())
  const title = m.type === 'inspection' ? 'Revisione periodica' : m.type === 'tax' ? 'Bollo auto' : maintenanceLabel(m)
  const muted = 'var(--onSurfaceVariant)'
  return (
    <Pressable onClick={onOpen} label="Apri dettaglio intervento" style={{ borderRadius: 22, background: 'var(--surface)', padding: '14px 15px', display: 'flex', alignItems: 'center' }}>
      <TypeBadge type={m.type} size={58} iconSize={31} />
      <div style={{ width: 12 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Chip label={a.label} tint={a.tint} background={a.background} radius={18} padding="3px 10px" />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap' }}>{formatEuro(m.cost)}</span>
        </div>
        <span className="ellipsis" style={{ fontSize: 17, fontWeight: 700 }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: muted, fontSize: 11, whiteSpace: 'nowrap' }}>
          <Icon name="calendar-nav" size={14} /><span>{dateLabel(m.date)}</span>
          <span style={{ fontSize: 12 }}>·</span>
          <Icon name="speedometer" size={14} /><span>{formatKm(m.mileage)}</span>
        </div>
        {m.notes.trim() !== '' && <span className="ellipsis" style={{ color: muted, opacity: 0.72, fontSize: 12 }}>{m.notes.split(/\r?\n/)[0]}</span>}
      </div>
    </Pressable>
  )
}

function DocumentListCard({ document: d, category, onOpen }: { document: GarageDocument; category: string; onOpen: () => void }) {
  const a = documentAppearance(category, useIsDark())
  const [menu, setMenu] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const ext = d.name.includes('.') ? d.name.slice(d.name.lastIndexOf('.') + 1) : 'FILE'
  const format = formatLabel(d.mimeType) ?? ext.toLocaleUpperCase('it-IT')
  return (
    <Pressable onClick={onOpen} label={`Apri ${d.name}`} style={{ borderRadius: 22, background: 'var(--surface)', padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <DocumentThumbnail document={d} category={category} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Chip label={a.label} tint={a.tint} background={a.background} radius={16} />
        <span className="clamp2" style={{ fontSize: 15, fontWeight: 700 }}>{d.name}</span>
        <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 12 }}>{format} · {documentSize(d.size)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--onSurfaceVariant)', fontSize: 12 }}>
          <Icon name="calendar-nav" size={15} /><span>{documentDate(d.addedAt)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div ref={anchor}>
          <Pressable pressed={1} label="Altre azioni" onClick={() => setMenu(true)} style={{ width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onSurfaceVariant)' }}>
            <Icon name="more" size={20} />
          </Pressable>
        </div>
        <DropdownMenu open={menu} anchor={anchor.current} onDismiss={() => setMenu(false)} items={[
          { label: 'Rinomina', onClick: () => { setMenu(false); renameDocument(d) } },
          { label: 'Elimina', onClick: () => { setMenu(false); confirmDelete(`Eliminare ${d.name}?`, () => actions.deleteDocument(d.id).catch((e) => toast((e as Error).message))) } },
        ]} />
        <TextButton onClick={() => shareDocument(d, (m) => toast(m, true))} style={{ padding: 0, fontSize: 12, fontWeight: 700 }}>
          <Icon name="share" size={19} /><span style={{ width: 4 }} />Condividi
        </TextButton>
      </div>
    </Pressable>
  )
}

export function renameDocument(d: GarageDocument) {
  openDialog((close) => <RenameDialog document={d} close={close} />)
}

function RenameDialog({ document: d, close }: { document: GarageDocument; close: () => void }) {
  const [name, setName] = useState(d.name)
  return (
    <AlertDialog title="Rinomina documento"
      dismiss={<TextButton onClick={close}>Annulla</TextButton>}
      confirm={<TextButton onClick={() => {
        if (name.trim() === '') return
        close()
        actions.saveDocument({ ...d, name: name.trim(), updatedAt: now() }).catch((e) => toast((e as Error).message))
      }}>Salva</TextButton>}>
      <div style={{ paddingTop: 6 }}>
        <OutlinedTextField value={name} onChange={setName} label="Nome" notch="var(--surfaceContainerHigh)" />
      </div>
    </AlertDialog>
  )
}

function NotesCard({ updatedAt, value, onChange, onSave }: { updatedAt: string; value: string; onChange: (v: string) => void; onSave: () => void }) {
  const badge = (
    <div style={{ borderRadius: 24, background: 'var(--surfaceContainerHigh)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}>
      <Icon name="clock" size={18} color="var(--onSurfaceVariant)" />
      <span className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 12 }}>Ultima modifica: {notesUpdatedLabel(updatedAt)}</span>
    </div>
  )
  return (
    <div style={{ borderRadius: 28, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GradientIcon icon="note" size={56} iconSize={27} />
          <div>
            <div style={{ fontSize: 27, lineHeight: '30px', fontWeight: 900 }}>Appunti</div>
            <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 13 }}>Note e promemoria sulla tua auto.</div>
          </div>
        </div>
        {badge}
      </div>
      <OutlinedTextField value={value} onChange={onChange} multiline minRows={6} height={210} radius={16} containerColor="var(--surface)"
        placeholder="Scrivi le tue note sull'auto..." />
      <GradientButton onClick={onSave} height={52} radius={28} style={{ width: '100%' }}><span style={{ fontSize: 17, fontWeight: 700 }}>Salva note</span></GradientButton>
    </div>
  )
}

/** StatusEditor: "Gestisci auto". */
function statusEditor(v: Vehicle) {
  openDialog((close) => <StatusDialog vehicle={v} close={close} />)
}

function StatusDialog({ vehicle: v, close }: { vehicle: Vehicle; close: () => void }) {
  const [status, setStatus] = useState(v.status)
  const [date, setDate] = useState(v.statusDate.trim() === '' ? today() : v.statusDate)
  const [note, setNote] = useState(v.statusNote)
  const [error, setError] = useState('')
  return (
    <AlertDialog title="Gestisci auto"
      dismiss={<TextButton onClick={close}>Annulla</TextButton>}
      confirm={<TextButton onClick={() => {
        if (status !== 'active' && !parseDate(date)) { setError('Data non valida'); return }
        close()
        actions.saveVehicle({ ...v, status, statusDate: status === 'active' ? '' : date, statusNote: status === 'active' ? '' : note, updatedAt: now() })
          .then(() => toast('Stato aggiornato')).catch((e) => toast((e as Error).message))
      }}>Conferma</TextButton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--onSurfaceVariant)' }}>
        {([['active', 'Attiva'], ['sold', 'Venduta'], ['scrapped', 'Rottamata']] as const).map(([key, label]) => (
          <div key={key} role="radio" aria-checked={status === key} onClick={() => setStatus(key)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${status === key ? 'var(--primary)' : 'var(--onSurfaceVariant)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {status === key && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />}
              </div>
            </div>
            <span>{label}</span>
          </div>
        ))}
        {status !== 'active' && <>
          <OutlinedTextField value={date} onChange={setDate} label="Data AAAA-MM-GG" notch="var(--surfaceContainerHigh)" />
          <OutlinedTextField value={note} onChange={setNote} label="Nota sullo stato" notch="var(--surfaceContainerHigh)" />
        </>}
        {error && <span style={{ color: 'var(--error)' }}>{error}</span>}
      </div>
    </AlertDialog>
  )
}
