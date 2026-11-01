import { motion } from 'framer-motion'
import { Children, Fragment, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BackButton, Bouncy, DetailEmptyState, Divider, Dash, GlassCard, GradientButton, GradientIcon, Icon, Pill, Tap, VehicleImage, useGradient } from '../components/ui.tsx'
import { DocumentCard, MaintenanceCard, ReminderCard } from '../components/cards.tsx'
import { Plate } from '../components/garage.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { ConfirmDelete, RenameDialog, StatusEditor } from '../components/dialogs.tsx'
import { toast } from '../components/overlays.tsx'
import { spring, Stiffness } from '../components/motion.ts'
import { documentAppearance, maintenanceAppearance, useDark } from '../lib/theme.ts'
import { actions, fileUrl, useStore } from '../lib/store.ts'
import { backToTab, back, navigate } from '../lib/nav.ts'
import { heroRef } from '../lib/hero.ts'
import { copyText, shareDocument } from '../lib/files.ts'
import type { IconName } from '../lib/icons.gen.ts'
import type { GarageDocument, Vehicle, VehicleRow } from '../../../shared/model.ts'
import { now } from '../../../shared/model.ts'
import { documentCategory, dueReminders, maintenanceLabel, notesUpdatedLabel, statusLabel, vehicleTypeLabel } from '../../../shared/logic.ts'
import { dateLabel, formatKm } from '../../../shared/format.ts'

/** The selected section of the Diario survives leaving the vehicle, like `tab` in GarageApp. */
let sectionTab = 'Interventi'
export const resetSectionTab = () => { sectionTab = 'Interventi' }

const sections: [string, IconName][] = [['Interventi', 'wrench'], ['Scadenze', 'calendarNav'], ['Documenti', 'document'], ['Note', 'note']]
const maintenanceFilters = ['all', 'service', 'inspection', 'tax', 'insurance', 'tires', 'custom']
const documentFilters = ['all', 'insurance', 'inspection', 'tax', 'service', 'other']

/** VehicleDetail of Screens.kt: the vehicle page, or with [sectionsPage] its Diario. */
export function VehicleDetail({ vehicleId, sectionsPage, backLabel = 'Garage' }: { vehicleId: string; sectionsPage: boolean; backLabel?: string }) {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const v = state.vehicles.find((x) => x.id === vehicleId)
  const [tab, setTabState] = useState(sectionTab)
  const setTab = (t: string) => { sectionTab = t; setTabState(t); setQuery('') }
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [documentFilter, setDocumentFilter] = useState('all')
  const [reminderFilter, setReminderFilter] = useState('all')
  const [statusEdit, setStatusEdit] = useState<Vehicle | null>(null)
  const [deleteVehicle, setDeleteVehicle] = useState(false)
  const [deleteDocument, setDeleteDocument] = useState<GarageDocument | null>(null)
  const [renameDocument, setRenameDocument] = useState<GarageDocument | null>(null)
  const reminders = useMemo(() => dueReminders(state).filter((d) => d.vehicle.id === vehicleId), [state, vehicleId])
  if (!v) return null
  const maintenances = state.maintenances.filter((m) => m.vehicleId === v.id)
  const docs = state.documents.filter((d) => d.vehicleId === v.id)
  const includes = (text: string) => text.toLocaleLowerCase('it-IT').includes(query.toLocaleLowerCase('it-IT'))
  const muted = 'var(--onSurfaceVariant)'

  const run = (work: Promise<unknown>, done?: string) => work.then(() => { if (done) toast(done) }).catch((e: Error) => toast(e.message, true))

  let content: ReactNode = null
  if (sectionsPage) {
    if (tab === 'Interventi') {
      const filtered = maintenances.filter((m) => (typeFilter === 'all' || m.type === typeFilter) && includes(`${maintenanceLabel(m)} ${m.notes} ${m.date}`))
      content = <>
        <Item key="interventi-add" k="interventi-add">
          <GradientButton onClick={() => navigate('maintenance-editor', { vehicleId: v.id })} height={52} style={{ width: '100%' }}>
            <span style={{ fontSize: 24 }}>＋</span><span style={{ width: 8 }} /><span style={{ fontWeight: 700 }}>Registra intervento</span>
          </GradientButton>
        </Item>
        {maintenances.length > 0 && <>
          <Item key="interventi-search" k="interventi-search"><SearchField value={query} onChange={setQuery} placeholder="Cerca interventi" /></Item>
          <Item key="interventi-filters" k="interventi-filters">
            <FilterRow>{maintenanceFilters.map((type) => {
              const a = maintenanceAppearance(type, dark)
              return <Pill key={type} selected={typeFilter === type} label={type === 'all' ? 'Tutti' : a.label} icon={type === 'all' ? undefined : a.icon} iconSize={19} radius={14} onClick={() => setTypeFilter(type)} />
            })}</FilterRow>
          </Item>
        </>}
        {filtered.length === 0 && <Item key="interventi-empty" k="interventi-empty">
          {maintenances.length === 0
            ? <DetailEmptyState title="Nessun intervento registrato." subtitle="Registra il primo intervento per tenere traccia della manutenzione della tua auto." />
            : <DetailEmptyState title="Nessun intervento trovato." subtitle="Prova un'altra ricerca o seleziona un altro filtro." />}
        </Item>}
        {filtered.map((m) => <Item key={m.id} k={`maintenance-${m.id}`}><MaintenanceCard maintenance={m} onOpen={() => navigate('maintenance-detail', { vehicleId: v.id, id: m.id })} /></Item>)}
      </>
    } else if (tab === 'Scadenze') {
      const filtered = reminders.filter((r) => reminderFilter === 'all' || r.maintenance.type === reminderFilter)
      content = <>
        {reminders.length > 0 && <Item key="scadenze-filters" k="scadenze-filters">
          <FilterRow>{maintenanceFilters.map((type) => {
            const a = maintenanceAppearance(type, dark)
            return <Pill key={type} selected={reminderFilter === type} label={type === 'all' ? 'Tutte' : a.label} icon={type === 'all' ? undefined : a.icon} onClick={() => setReminderFilter(type)} />
          })}</FilterRow>
        </Item>}
        {filtered.length === 0 && <Item key="scadenze-empty" k="scadenze-empty">
          {reminders.length === 0
            ? <DetailEmptyState title="Nessuna scadenza attiva." subtitle="Le prossime scadenze della tua auto compariranno qui." />
            : <DetailEmptyState title="Nessuna scadenza trovata." subtitle="Seleziona un altro filtro per vedere le scadenze." />}
        </Item>}
        {filtered.map((r) => <Item key={r.reminder.id} k={`reminder-${r.reminder.id}`}><ReminderCard item={r} onClick={() => navigate('reminder-detail', { vehicleId: v.id, id: r.reminder.id })} /></Item>)}
      </>
    } else if (tab === 'Documenti') {
      const filtered = docs.filter((d) => includes(d.name) && (documentFilter === 'all' || documentCategory(d, state.maintenances) === documentFilter))
        .sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
      content = <>
        <Item key="documenti-add" k="documenti-add">
          <GradientButton onClick={() => navigate('document-editor', { vehicleId: v.id })} height={52} style={{ width: '100%' }}>
            <span style={{ fontSize: 24 }}>＋</span><span style={{ width: 8 }} /><span style={{ fontWeight: 700 }}>Aggiungi documento</span>
          </GradientButton>
        </Item>
        {docs.length > 0 && <Item key="documenti-search" k="documenti-search"><SearchField value={query} onChange={setQuery} placeholder="Cerca documenti" /></Item>}
        {docs.length > 0 && <Item key="documenti-filters" k="documenti-filters">
          <FilterRow>{documentFilters.map((category) => {
            const a = documentAppearance(category, dark)
            const selected = documentFilter === category
            return <Pill key={category} selected={selected} label={category === 'all' ? 'Tutti' : a.label} icon={category === 'all' ? 'folder' : a.icon} padding={13}
              iconColor={selected ? 'var(--onSecondaryContainer)' : 'var(--onSurfaceVariant)'} onClick={() => setDocumentFilter(category)} />
          })}</FilterRow>
        </Item>}
        {filtered.length === 0 && <Item key="documenti-empty" k="documenti-empty">
          {docs.length === 0
            ? <DetailEmptyState title="Nessun documento salvato." subtitle="Aggiungi libretto, assicurazione e altri documenti della tua auto." />
            : <DetailEmptyState title="Nessun documento trovato." subtitle="Prova un'altra ricerca o seleziona un altro filtro." />}
        </Item>}
        {filtered.map((d) => (
          <Item key={d.id} k={`document-${d.id}`}>
            <DocumentCard document={d} category={documentCategory(d, state.maintenances)}
              onOpen={() => navigate('document-detail', { vehicleId: v.id, id: d.id })} onShare={() => shareDocument(d)}
              onRename={() => setRenameDocument(d)} onDelete={() => setDeleteDocument(d)} />
          </Item>
        ))}
      </>
    } else {
      content = <Item key="note-card" k="note-card"><NotesCard v={v} /></Item>
    }
  }

  return (
    <div className="scroll status-pad">
      <div style={{ padding: '14px 18px 96px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!sectionsPage && (
          <div style={{ position: 'relative', height: v.hasPhoto ? 250 : 72 }}>
            {v.hasPhoto && <>
              <VehicleImage src={fileUrl('vehicle', v.id, v.updatedAt)} radius={28} style={{ position: 'absolute', inset: 0 }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 28, background: 'linear-gradient(180deg, rgba(0,0,0,.35) 0%, transparent 30%, transparent 70%, rgba(0,0,0,.35) 100%)' }} />
            </>}
            <BackButton label={backLabel} onClick={() => back()} style={{ position: 'absolute', top: 12, left: 12 }} />
          </div>
        )}
        {sectionsPage && <BackButton label="Dettaglio auto" onClick={() => back()} />}
        <div style={{ padding: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Dash />
            <span style={{ width: 8 }} />
            <span className="kicker" style={{ color: 'var(--primary)', letterSpacing: 2.4 }}>{sectionsPage ? 'DIARIO' : 'LA TUA AUTO'}</span>
          </div>
          <div style={{ height: 4 }} />
          <div className="clamp2" style={{ fontSize: 34, lineHeight: '37px', fontWeight: 900, letterSpacing: -0.6, wordBreak: 'break-word' }}>{sectionsPage ? 'La vita della tua auto' : v.name}</div>
          <div className="clamp2" style={{ color: muted, fontSize: 16, lineHeight: '24px', letterSpacing: 0.5 }}>
            {sectionsPage ? `${v.name} · Interventi, scadenze, documenti e note` : `${v.make} ${v.model}`.trim()}
          </div>
        </div>
        {!sectionsPage && (
          <GlassCard padding={0}>
            <div style={{ padding: '15px 16px', display: 'flex', flexDirection: 'column' }}>
              <Plate plate={v.plate} type={v.vehicleType} registrationYear={Number(v.registrationDate.slice(0, 4)) || v.year} />
              <div style={{ height: 16 }} /><Divider /><div style={{ height: 13 }} />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Fact label="TIPO" value={vehicleTypeLabel(v.vehicleType)} icon="car" />
                <VDivider height={45} />
                <Fact label="ANNO" value={String(v.year)} icon="calendarNav" />
              </div>
              <div style={{ height: 13 }} /><Divider /><div style={{ height: 13 }} />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <Fact label="CHILOMETRI" value={formatKm(v.mileage)} icon="speedometer" />
                  <Fact label="IMMATRICOLATA" value={v.registrationDate.trim() ? dateLabel(v.registrationDate) : 'Non indicata'} icon="calendarNav" />
                </div>
                <VDivider height={100} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <Fact label="STATO" value={statusLabel(v.status)} icon="car" statusDot={v.status === 'active'} />
                  <Fact label="CARBURANTE" value={v.fuel.trim() || 'Non indicato'} icon="fuel" />
                </div>
              </div>
              <div style={{ height: 15 }} /><Divider /><div style={{ height: 13 }} />
              <div style={{ display: 'flex', gap: 2 }}>
                <Action label="Copia targa" icon="copy" onClick={() => copyText(v.plate).then(() => toast('Targa copiata'))} />
                <Action label="Modifica" icon="edit" onClick={() => navigate('vehicle-editor', { id: v.id })} />
                <Action label="Stato" icon="car" onClick={() => setStatusEdit(v)} />
                <Action label="Elimina auto" icon="delete" destructive onClick={() => setDeleteVehicle(true)} />
              </div>
            </div>
          </GlassCard>
        )}
        {!sectionsPage && (
          <GradientButton onClick={() => { setTab('Interventi'); navigate('sections', { vehicleId: v.id }) }} height={56} shine layoutRef={heroRef(`sections-page-${v.id}`)} style={{ width: '100%' }}>
            <Icon name="wrench" size={21} />
            <span style={{ width: 9 }} />
            <span className="ellipsis" style={{ fontSize: 13, fontWeight: 900 }}>Interventi, scadenze, documenti e note</span>
          </GradientButton>
        )}
        {sectionsPage && <SectionTabs tab={tab} onTab={setTab} />}
        {sectionsPage && flatten(content)}
      </div>
      <StatusEditor vehicle={statusEdit} onDismiss={() => setStatusEdit(null)}
        onSave={(updated) => { setStatusEdit(null); run(actions.saveVehicle(updated), 'Stato aggiornato') }} />
      <ConfirmDelete text={deleteVehicle ? `Eliminare ${v.name} e tutti i suoi dati?` : null} onDismiss={() => setDeleteVehicle(false)}
        onConfirm={() => { setDeleteVehicle(false); backToTab(); run(actions.deleteVehicle(v.id)) }} />
      <ConfirmDelete text={deleteDocument ? `Eliminare ${deleteDocument.name}?` : null} onDismiss={() => setDeleteDocument(null)}
        onConfirm={() => { const d = deleteDocument!; setDeleteDocument(null); run(actions.deleteDocument(d.id)) }} />
      <RenameDialog name={renameDocument?.name ?? null} onDismiss={() => setRenameDocument(null)}
        onSave={(name) => { const d = renameDocument!; setRenameDocument(null); run(actions.saveDocument({ ...d, name, updatedAt: now() })) }} />
    </div>
  )
}

/** The items inside fragments as one keyed list, so an item keeps its state when the list changes. */
function flatten(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((c) => (isValidElement(c) && c.type === Fragment ? flatten((c.props as { children?: ReactNode }).children) : [c]))
}

/** LazyItemScope.animateItem(): new items fade in, the others slide to their new place. */
function Item({ k, children }: { k: string; children: ReactNode }) {
  return (
    <motion.div key={k} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ opacity: spring(1, Stiffness.MediumLow), layout: spring(1, Stiffness.MediumLow) }}>
      {children}
    </motion.div>
  )
}

function FilterRow({ children }: { children: ReactNode }) {
  return <div className="scroll-x" style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -18px', padding: '0 18px' }}>{children}</div>
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <OutlinedField value={value} onChange={onChange} placeholder={placeholder} radius={17} bg="var(--background)"
      leading={<Icon name="search" size={22} color="var(--onSurfaceVariant)" />} />
  )
}

function SectionTabs({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  const index = Math.max(0, sections.findIndex(([label]) => label === tab))
  const pill = useGradient<HTMLDivElement>()
  return (
    <div style={{ borderRadius: 32, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--outline) 18%, transparent)', padding: 3 }}>
      <div style={{ position: 'relative', display: 'flex' }}>
        <motion.div ref={pill} className="accent-bg" style={{ position: 'absolute', top: 0, left: 0, width: `${100 / sections.length}%`, height: 43, borderRadius: 28 }}
          initial={false} animate={{ x: `${index * 100}%` }} transition={spring(0.7, Stiffness.MediumLow)} />
        {sections.map(([label, icon]) => {
          const selected = tab === label
          return (
            <Tap key={label} role="tab" onClick={() => onTab(label)} style={{ flex: 1, height: 43, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span style={{ color: selected ? 'var(--onAccent)' : 'var(--primary)', transition: 'color 260ms', display: 'flex' }}><Icon name={icon} size={16} /></span>
              <span style={{ width: 4 }} />
              <span style={{ fontSize: 10, lineHeight: '16px', letterSpacing: 0.5, fontWeight: selected ? 700 : 500, color: selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)', transition: 'color 260ms', whiteSpace: 'nowrap' }}>{label}</span>
            </Tap>
          )
        })}
      </div>
    </div>
  )
}

function VDivider({ height }: { height: number }) {
  return <div style={{ width: 1, height, background: 'color-mix(in srgb, var(--outline) 18%, transparent)', flexShrink: 0 }} />
}

/** DetailFact */
function Fact({ label, value, icon, statusDot = false }: { label: string; value: string; icon: IconName; statusDot?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', padding: '3px 5px' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={20} color="var(--primary)" />
      </div>
      <div style={{ width: 9 }} />
      <div style={{ minWidth: 0 }}>
        <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 10, lineHeight: '13px', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {statusDot && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#17C977', flexShrink: 0 }} /><span style={{ width: 5 }} /></>}
          <span className="clamp2" style={{ fontSize: 14, lineHeight: '18px', fontWeight: 700, letterSpacing: 0.25 }}>{value}</span>
        </div>
      </div>
    </div>
  )
}

/** DetailAction */
function Action({ label, icon, onClick, destructive = false }: { label: string; icon: IconName; onClick: () => void; destructive?: boolean }) {
  const color = destructive ? 'var(--error)' : 'var(--primary)'
  return (
    <Bouncy onClick={onClick} style={{ flex: 1, minWidth: 0, borderRadius: 15, padding: '4px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: destructive ? 'color-mix(in srgb, var(--error) 10%, transparent)' : 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={color} />
      </div>
      <div style={{ height: 5 }} />
      <div className="ellipsis" style={{ color: destructive ? color : 'var(--onSurfaceVariant)', fontSize: 10, lineHeight: '16px', letterSpacing: 0.5, maxWidth: '100%' }}>{label}</div>
    </Bouncy>
  )
}

/** GarageNotesCard */
function NotesCard({ v }: { v: VehicleRow }) {
  const [notes, setNotes] = useState(v.notes)
  useEffect(() => setNotes(v.notes), [v.id, v.notes])
  const box = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const observer = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 560))
    if (box.current) observer.observe(box.current)
    return () => observer.disconnect()
  }, [])
  const heading = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <GradientIcon icon="note" size={56} iconSize={27} />
      <div>
        <div style={{ fontSize: 27, lineHeight: '30px', fontWeight: 900 }}>Appunti</div>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '20px', letterSpacing: 0.25 }}>Note e promemoria sulla tua auto.</div>
      </div>
    </div>
  )
  const badge = (
    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 24, background: 'var(--surfaceContainerHigh)', padding: '8px 12px' }}>
      <Icon name="clock" size={18} color="var(--onSurfaceVariant)" />
      <span className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{`Ultima modifica: ${notesUpdatedLabel(v.notesUpdatedAt)}`}</span>
    </div>
  )
  const [focused, setFocused] = useState(false)
  return (
    <div ref={box} style={{ borderRadius: 28, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {wide ? <div style={{ display: 'flex', alignItems: 'center' }}><div style={{ flex: 1 }}>{heading}</div>{badge}</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{heading}{badge}</div>}
      <div style={{ position: 'relative', height: 210, borderRadius: 16, background: 'var(--surface)' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', border: focused ? '2px solid var(--primary)' : '1px solid var(--outline)' }} />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scrivi le tue note sull'auto..."
          onFocus={(e) => { setFocused(true); const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300) }}
          onBlur={() => setFocused(false)}
          style={{ width: '100%', height: '100%', resize: 'none', border: 0, outline: 0, background: 'transparent', padding: 16, color: 'var(--onSurface)',
            fontSize: 16, lineHeight: '24px', letterSpacing: 0.5, caretColor: 'var(--primary)' }} />
      </div>
      <GradientButton onClick={() => actions.saveVehicle({ ...v, notes, notesUpdatedAt: now(), updatedAt: now() }).catch((e: Error) => toast(e.message, true))} height={52}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>Salva note</span>
      </GradientButton>
    </div>
  )
}
