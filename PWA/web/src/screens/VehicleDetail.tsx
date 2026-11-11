import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AccentButton, AnimatedCount, Bouncy, Divider, EmptyState, GhostButton, Icon, Panel, Pill, Readout, ReadoutDivider, RoundIconButton, RowDivider, SectionTitle, Stagger, StatusPill } from '../components/ui.tsx'
import { DeadlineGroup, DocumentTile, MaintenanceRow } from '../components/cards.tsx'
import { Plate, VehiclePhoto } from '../components/garage.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { ConfirmDelete, RenameDialog, StatusEditor } from '../components/dialogs.tsx'
import { Menu, toast } from '../components/overlays.tsx'
import { tween } from '../components/motion.ts'
import { documentAppearance, maintenanceAppearance, useDark } from '../lib/theme.ts'
import { actions, useStore } from '../lib/store.ts'
import { backToTab, back, navigate } from '../lib/nav.ts'
import { copyText, shareDocument } from '../lib/files.ts'
import type { GarageDocument, Vehicle, VehicleRow } from '../../../shared/model.ts'
import { now } from '../../../shared/model.ts'
import { documentCategory, dueReminders, maintenanceLabel, notesUpdatedLabel, statusLabel, vehicleTypeLabel } from '../../../shared/logic.ts'
import { dateLabel, euro, euroRounded, groupedInt } from '../../../shared/format.ts'

const maintenanceFilters = ['all', 'service', 'inspection', 'tax', 'insurance', 'tires', 'custom']
const documentFilters = ['all', 'insurance', 'inspection', 'tax', 'service', 'other']
const HERO = 400


/**
 * Everything about one car on a single scrolling page, no tabs: photo with name and plate, the
 * instrument cluster, deadlines, history, documents and notes. The dock at the bottom adds an
 * intervention or a document; rarer actions sit in the menu at the top.
 */
export function VehicleDetail({ vehicleId, backLabel = 'Garage' }: { vehicleId: string; backLabel?: string }) {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const v = state.vehicles.find((x) => x.id === vehicleId)
  const [query, setQuery] = useState('')
  const [docQuery, setDocQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [documentFilter, setDocumentFilter] = useState('all')
  const [allMaintenances, setAllMaintenances] = useState(false)
  const [statusEdit, setStatusEdit] = useState<Vehicle | null>(null)
  const [deleteVehicle, setDeleteVehicle] = useState(false)
  const [deleteDocument, setDeleteDocument] = useState<GarageDocument | null>(null)
  const [renameDocument, setRenameDocument] = useState<GarageDocument | null>(null)
  const [menu, setMenu] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLDivElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [dock, setDock] = useState(true)
  const scroller = useRef<HTMLDivElement>(null)
  const photo = useRef<HTMLDivElement>(null)
  const lastY = useRef(0)
  const reminders = useMemo(() => dueReminders(state).filter((d) => d.vehicle.id === vehicleId), [state, vehicleId])

  // Parallax written straight to the style (no re-render); the hero clips it, so the photo edge never shows.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onScroll = () => {
      const y = el.scrollTop
      if (photo.current) photo.current.style.transform = `translate3d(0, ${Math.min(y, HERO) * 0.4}px, 0)`
      setCollapsed(y > HERO - 100)
      if (y > lastY.current + 8) setDock(false)
      else if (y < lastY.current - 8) setDock(true)
      lastY.current = y
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  if (!v) return null
  const maintenances = state.maintenances.filter((m) => m.vehicleId === v.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const docs = state.documents.filter((d) => d.vehicleId === v.id).sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0))
  const includes = (text: string, q: string) => text.toLocaleLowerCase('it-IT').includes(q.toLocaleLowerCase('it-IT'))
  const filtered = maintenances.filter((m) => (typeFilter === 'all' || m.type === typeFilter) && includes(`${maintenanceLabel(m)} ${m.notes} ${m.date}`, query))
  const shown = allMaintenances ? filtered : filtered.slice(0, 4)
  const filteredDocs = docs.filter((d) => includes(d.name, docQuery) && (documentFilter === 'all' || documentCategory(d, state.maintenances) === documentFilter))
  const total = maintenances.reduce((s, m) => s + m.cost, 0)
  const run = (work: Promise<unknown>, done?: string) => work.then(() => { if (done) toast(done) }).catch((e: Error) => toast(e.message, true))
  const model = [`${v.make} ${v.model}`.trim(), vehicleTypeLabel(v.vehicleType)].filter(Boolean).join(' · ')
  const specs = [v.fuel.trim() && ['fuel', v.fuel], v.year > 0 && ['calendarNav', String(v.year)],
    v.registrationDate.trim() && ['licensePlate', `Immatricolata ${v.registrationDate.slice(5, 7)}/${v.registrationDate.slice(0, 4)}`]].filter(Boolean) as ['fuel' | 'calendarNav' | 'licensePlate', string][]

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={scroller} className="scroll">
        {/* Hero: clipped box, photo under the status bar. */}
        <div style={{ position: 'relative', height: HERO, overflow: 'hidden' }}>
          <div ref={photo} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}><VehiclePhoto v={v} /></div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.5) 0%, transparent 22%, transparent 50%, color-mix(in srgb, var(--background) 85%, transparent) 85%, var(--background) 100%)' }} />
          <div className="status-pad" style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px' }}>
              <RoundIconButton icon="arrowBack" label={`Torna a ${backLabel}`} onClick={() => back()} overPhoto />
              <span style={{ flex: 1 }} />
              <div ref={setMenuAnchor}><RoundIconButton icon="more" label="Altre azioni" onClick={() => setMenu(true)} overPhoto /></div>
            </div>
          </div>
          <Stagger index={0} style={{ position: 'absolute', left: 20, right: 20, bottom: 62 }}>
            {v.status !== 'active' && <div style={{ marginBottom: 10 }}><StatusPill label={statusLabel(v.status) + (v.statusDate ? ` il ${dateLabel(v.statusDate)}` : '')} color="#8B95A7" onPhoto /></div>}
            <div className="clamp2" style={{ color: 'var(--onBackground)', fontSize: 34, lineHeight: '38px', fontWeight: 700, letterSpacing: -0.9, wordBreak: 'break-word' }}>{v.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <span className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 15, minWidth: 0 }}>{model}</span>
              {v.plate.trim() && <Plate plate={v.plate} type={v.vehicleType} registrationYear={Number(v.registrationDate.slice(0, 4)) || v.year} compact />}
            </div>
          </Stagger>
        </div>

        <div style={{ marginTop: -44, padding: '0 18px 140px', display: 'flex', flexDirection: 'column', gap: 26, position: 'relative' }}>
          <Stagger index={1}>
            <Panel padding={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Readout label="Chilometri" flex={1.2}><AnimatedCount value={v.mileage} /></Readout>
                <ReadoutDivider />
                <Readout label="Spesi in tutto" flex={1.1}><AnimatedCount value={total} format={(x) => euroRounded(x).replace('€', '€ ')} /></Readout>
                <ReadoutDivider />
                <Readout label="Interventi" flex={0.8}><AnimatedCount value={maintenances.length} format={(x) => groupedInt(x)} /></Readout>
              </div>
              {specs.length > 0 && <>
                <Divider style={{ margin: '14px 0 12px' }} />
                <div className="scroll-x" style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
                  {specs.map(([icon, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--onSurfaceVariant)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      <Icon name={icon} size={16} />{label}
                    </div>
                  ))}
                </div>
              </>}
            </Panel>
          </Stagger>

          {reminders.length > 0 && (
            <Stagger index={2}>
              <SectionTitle title="Scadenze" />
              <div style={{ height: 6 }} />
              <DeadlineGroup items={reminders} showVehicle={false} onClick={(d) => navigate('reminder-detail', { vehicleId: v.id, id: d.reminder.id })} />
            </Stagger>
          )}

          <Stagger index={3}>
            <SectionTitle title="Interventi" />
            <div style={{ height: 6 }} />
            {maintenances.length > 4 && <>
              <div className="scroll-x" style={{ display: 'flex', gap: 7, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
                {maintenanceFilters.map((type) => {
                  const a = maintenanceAppearance(type, dark)
                  return <Pill key={type} selected={typeFilter === type} label={type === 'all' ? 'Tutti' : a.label} icon={type === 'all' ? undefined : a.icon}
                    onClick={() => { setTypeFilter(type); setAllMaintenances(true) }} />
                })}
              </div>
              <div style={{ height: 10 }} />
            </>}
            {maintenances.length > 8 && allMaintenances && <>
              <OutlinedField value={query} onChange={setQuery} placeholder="Cerca interventi" radius={14} bg="var(--background)" leading={<Icon name="search" size={20} color="var(--onSurfaceVariant)" />} />
              <div style={{ height: 10 }} />
            </>}
            {maintenances.length === 0 ? <EmptyState icon="wrench" title="Ancora nessun intervento" subtitle="Tagliandi, revisioni, bollo e assicurazione: registrali con «Intervento» qui sotto." />
              : filtered.length === 0 ? <EmptyState icon="search" title="Nessun intervento trovato" subtitle="Prova un altro filtro." />
              : (
                <Panel padding={0} style={{ overflow: 'hidden' }}>
                  <AnimatePresence initial={false}>
                    {shown.map((m, i) => (
                      <motion.div key={m.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tween(260)}>
                        {i > 0 && <RowDivider />}
                        <MaintenanceRow maintenance={m} onOpen={() => navigate('maintenance-detail', { vehicleId: v.id, id: m.id })} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {(filtered.length > 4 || allMaintenances) && <>
                    <Divider />
                    <Bouncy onClick={() => { setAllMaintenances(!allMaintenances); if (allMaintenances) { setQuery(''); setTypeFilter('all') } }} pressed={0.99}
                      style={{ padding: 16, color: 'var(--primary)', fontWeight: 600 }}>
                      {allMaintenances ? 'Mostra meno' : `Mostra tutti (${filtered.length})`}
                    </Bouncy>
                  </>}
                </Panel>
              )}
            {maintenances.length > 0 && (
              <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, padding: '8px 4px 0' }}>
                {`${maintenances.length} ${maintenances.length === 1 ? 'intervento' : 'interventi'} · ${euro(total)} in tutto`}
              </div>
            )}
          </Stagger>

          <Stagger index={4}>
            <SectionTitle title="Documenti" />
            <div style={{ height: 6 }} />
            {docs.length > 4 && <>
              <div className="scroll-x" style={{ display: 'flex', gap: 7, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>
                {documentFilters.map((category) => {
                  const a = documentAppearance(category, dark)
                  return <Pill key={category} selected={documentFilter === category} label={category === 'all' ? 'Tutti' : a.label} icon={category === 'all' ? undefined : a.icon} onClick={() => setDocumentFilter(category)} />
                })}
              </div>
              <div style={{ height: 10 }} />
            </>}
            {docs.length > 8 && <>
              <OutlinedField value={docQuery} onChange={setDocQuery} placeholder="Cerca documenti" radius={14} bg="var(--background)" leading={<Icon name="search" size={20} color="var(--onSurfaceVariant)" />} />
              <div style={{ height: 10 }} />
            </>}
            {docs.length === 0 ? <EmptyState icon="document" title="Nessun documento" subtitle="Libretto, polizza, ricevute: fotografali o scegli un file con «Documento» qui sotto." />
              : filteredDocs.length === 0 ? <EmptyState icon="search" title="Nessun documento trovato" subtitle="Prova un altro filtro." />
              : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {filteredDocs.map((d) => (
                    <DocumentTile key={d.id} document={d} category={documentCategory(d, state.maintenances)}
                      onOpen={() => navigate('document-detail', { vehicleId: v.id, id: d.id })} onShare={() => shareDocument(d)}
                      onRename={() => setRenameDocument(d)} onDelete={() => setDeleteDocument(d)} />
                  ))}
                </div>
              )}
          </Stagger>

          <Stagger index={5}>
            <SectionTitle title="Note" />
            <div style={{ height: 6 }} />
            <NotesCard v={v} />
          </Stagger>
        </div>
      </div>

      {/* Once the photo has scrolled away, a solid bar takes its place at the top. */}
      <AnimatePresence>
        {collapsed && (
          <motion.div key="bar" className="status-pad" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tween(180)}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, background: 'var(--background)', borderBottom: '1px solid var(--hairline)', zIndex: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px' }}>
              <RoundIconButton icon="arrowBack" label={`Torna a ${backLabel}`} onClick={() => back()} />
              <div className="ellipsis" style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{v.name}</div>
              {v.plate.trim() && <Plate plate={v.plate} type={v.vehicleType} registrationYear={v.year} compact />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The two things added most often, always at hand at the bottom. */}
      <motion.div className="nav-pad" initial={false} animate={{ y: dock ? 0 : '110%' }} transition={tween(260)}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3, background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--background) 92%, transparent) 30%, var(--background))' }}>
        <div style={{ display: 'flex', gap: 10, padding: '22px 18px 14px' }}>
          <AccentButton onClick={() => navigate('maintenance-editor', { vehicleId: v.id })} style={{ flex: 1 }}><Icon name="add" size={20} />Intervento</AccentButton>
          <GhostButton onClick={() => navigate('document-editor', { vehicleId: v.id })} style={{ flex: 1 }}><Icon name="document" size={19} />Documento</GhostButton>
        </div>
      </motion.div>

      <Menu open={menu} anchor={menuAnchor} onDismiss={() => setMenu(false)} items={[
        { label: 'Modifica auto', onClick: () => { setMenu(false); navigate('vehicle-editor', { id: v.id }) } },
        { label: 'Cambia stato', onClick: () => { setMenu(false); setStatusEdit(v) } },
        ...(v.plate.trim() ? [{ label: 'Copia targa', onClick: () => { setMenu(false); copyText(v.plate).then(() => toast('Targa copiata')) } }] : []),
        { label: 'Elimina auto', onClick: () => { setMenu(false); setDeleteVehicle(true) } },
      ]} />
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

/** The car's notes, edited in place; "Salva note" appears only when something changed. */
function NotesCard({ v }: { v: VehicleRow }) {
  const [notes, setNotes] = useState(v.notes)
  useEffect(() => setNotes(v.notes), [v.id, v.notes])
  const changed = notes !== v.notes
  return (
    <Panel padding={16}>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Note sull'auto"
        placeholder="Scrivi qui le tue note sull'auto: gomme, misure, officina di fiducia…"
        onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300) }}
        style={{ width: '100%', minHeight: 96, resize: 'vertical', border: 0, outline: 0, background: 'transparent', padding: 0, color: 'var(--onSurface)',
          fontSize: 16, lineHeight: '23px', caretColor: 'var(--primary)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 40 }}>
        <Icon name="clock" size={15} color="var(--onSurfaceVariant)" />
        <span className="ellipsis" style={{ flex: 1, color: 'var(--onSurfaceVariant)', fontSize: 12 }}>
          {v.notesUpdatedAt ? `Modificate il ${notesUpdatedLabel(v.notesUpdatedAt)}` : 'Mai modificate'}
        </span>
        <AnimatePresence>
          {changed && (
            <motion.div key="save" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={tween(180)}>
              <AccentButton radius={12} style={{ minHeight: 40, padding: '0 16px', fontSize: 14 }}
                onClick={() => actions.saveVehicle({ ...v, notes, notesUpdatedAt: now(), updatedAt: now() }).then(() => toast('Note salvate')).catch((e: Error) => toast(e.message, true))}>
                Salva note
              </AccentButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  )
}
