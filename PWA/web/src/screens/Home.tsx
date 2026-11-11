import { motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { AccentBadge, AccentButton, AnimatedCount, Bouncy, EmptyState, Icon, Overline, Panel, Readout, ReadoutDivider, RoundIconButton, RowDivider, SectionTitle, Stagger, StatusPill, TintBadge } from '../components/ui.tsx'
import { DeadlineGroup } from '../components/cards.tsx'
import { Plate, VehiclePhoto } from '../components/garage.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { spring } from '../components/motion.ts'
import { urgencyFor, useDark } from '../lib/theme.ts'
import { useStore } from '../lib/store.ts'
import { navigate, switchTab } from '../lib/nav.ts'
import { heroRef } from '../lib/hero.ts'
import type { DueReminder, VehicleRow } from '../../../shared/model.ts'
import { dueReminders, maintenanceLabel, reminderStatus } from '../../../shared/logic.ts'
import { euroRounded, formatKm, longToday, today } from '../../../shared/format.ts'

/** The stagger of the home plays only the first time it is shown (homeIntroPlayed). */
let homeIntroPlayed = false

/**
 * The garage at a glance: header with settings and "add car", the instrument cluster, the cars as a
 * showroom carousel and the next deadlines of every car.
 */
export function Home() {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const [intro] = useState(() => !homeIntroPlayed)
  homeIntroPlayed = true
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [query, setQuery] = useState('')
  const active = state.vehicles.filter((v) => v.status === 'active')
  const archivedAll = state.vehicles.filter((v) => v.status !== 'active')
  const archived = archivedAll.filter((v) => `${v.name} ${v.make} ${v.plate}`.toLocaleLowerCase('it-IT').includes(query.toLocaleLowerCase('it-IT')))
  const due = useMemo(() => dueReminders(state), [state])
  const year = String(today().y)
  const activeIds = new Set(active.map((v) => v.id))
  const spent = state.maintenances.filter((m) => activeIds.has(m.vehicleId) && m.date.startsWith(year)).reduce((sum, m) => sum + m.cost, 0)
  const soon = due.filter((d) => (d.days ?? Number.MAX_SAFE_INTEGER) <= 30).length
  const open = (id: string) => navigate('detail', { vehicleId: id, from: 'Garage' })
  const openReminder = (d: DueReminder) => navigate('reminder-detail', { vehicleId: d.vehicle.id, id: d.reminder.id })
  const ok = urgencyFor(365, dark).color
  return (
    <div className="scroll status-pad">
      <div style={{ padding: '14px 0 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Stagger index={0} enabled={intro} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 0 20px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Overline text={longToday()} />
            <div style={{ fontSize: 36, lineHeight: '40px', fontWeight: 700, letterSpacing: -1 }}>Garage</div>
          </div>
          <RoundIconButton icon="settingsNav" label="Impostazioni" onClick={() => switchTab('impostazioni')} />
          <RoundIconButton icon="add" label="Aggiungi auto" accent onClick={() => navigate('vehicle-editor')} />
        </Stagger>

        {active.length > 0 && (
          <Stagger index={1} enabled={intro} style={{ padding: '0 18px' }}>
            <Panel padding={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Readout label="In garage"><AnimatedCount value={active.length} animate={intro} /></Readout>
              <ReadoutDivider />
              <Readout label="In scadenza" color={soon > 0 ? urgencyFor(10, dark).color : undefined}><AnimatedCount value={soon} animate={intro} /></Readout>
              <ReadoutDivider />
              <Readout label={`Spesi nel ${year}`} flex={1.3}><AnimatedCount value={spent} animate={intro} format={(v) => euroRounded(v).replace('€', '€ ')} /></Readout>
            </Panel>
          </Stagger>
        )}

        {active.length === 0 ? (
          <Stagger index={1} enabled={intro} style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <EmptyState icon="car"
              title={state.vehicles.length === 0 ? 'Il garage è pronto' : 'Nessuna auto attiva'}
              subtitle={state.vehicles.length === 0 ? 'Aggiungi la tua prima auto: poi registri interventi, scadenze e documenti dalla sua pagina.' : "Aggiungi un'auto o consulta l'archivio qui sotto."} />
            <AccentButton onClick={() => navigate('vehicle-editor')}>
              <Icon name="add" size={20} />{state.vehicles.length === 0 ? 'Aggiungi la tua prima auto' : 'Aggiungi auto'}
            </AccentButton>
          </Stagger>
        ) : (
          <Stagger index={2} enabled={intro}>
            <SectionTitle title={active.length === 1 ? 'La tua auto' : 'Le tue auto'} style={{ padding: '0 20px' }} />
            <div style={{ height: 6 }} />
            {active.length === 1
              ? <div style={{ padding: '0 18px' }}><Showcase v={active[0]} next={due.find((d) => d.vehicle.id === active[0].id)} onOpen={() => open(active[0].id)} /></div>
              : <Carousel cars={active} due={due} onOpen={open} />}
          </Stagger>
        )}

        {active.length > 0 && (
          <Stagger index={3} enabled={intro} style={{ padding: '0 18px' }}>
            <SectionTitle title="Prossime scadenze" action={due.length ? 'Vedi tutte' : undefined} onAction={() => switchTab('scadenze')} />
            <div style={{ height: 6 }} />
            {due.length === 0 ? (
              <Panel padding={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TintBadge icon="shield" tint={ok} background={`color-mix(in srgb, ${ok} 13%, transparent)`} />
                <div>
                  <div style={{ fontWeight: 600 }}>Tutto in regola</div>
                  <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '18px' }}>Registra un intervento con promemoria per vederlo qui.</div>
                </div>
              </Panel>
            ) : <DeadlineGroup items={due.slice(0, 3)} showVehicle={active.length > 1} onClick={openReminder} />}
          </Stagger>
        )}

        {archivedAll.length > 0 && (
          <Stagger index={4} enabled={intro} style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Panel padding={14} onClick={() => setArchiveOpen(!archiveOpen)} label={archiveOpen ? 'Chiudi archivio' : 'Apri archivio'} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AccentBadge icon="folder" size={40} iconSize={20} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Archivio</div>
                <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '18px' }}>{`${archivedAll.length} ${archivedAll.length === 1 ? 'auto venduta o rottamata' : 'auto vendute o rottamate'}`}</div>
              </div>
              <motion.span initial={false} animate={{ rotate: archiveOpen ? 180 : 0 }} transition={spring(0.7)} style={{ display: 'flex', color: 'var(--onSurfaceVariant)' }}>
                <Icon name="chevronDown" size={20} />
              </motion.span>
            </Panel>
            {archiveOpen && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {archivedAll.length > 3 && <OutlinedField value={query} onChange={setQuery} label="Cerca nell'archivio" radius={14} bg="var(--background)" />}
                <Panel padding={0} style={{ overflow: 'hidden' }}>
                  {archived.map((v, i) => (
                    <div key={v.id}>
                      {i > 0 && <RowDivider inset={84} />}
                      <Bouncy onClick={() => open(v.id)} label={`Apri ${v.name}`} pressed={0.985} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
                        <div style={{ width: 60, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}><VehiclePhoto v={v} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ellipsis" style={{ fontWeight: 600 }}>{v.name}</div>
                          <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 13 }}>{[v.status === 'sold' ? 'Venduta' : 'Rottamata', v.plate.toLocaleUpperCase('it-IT')].filter(Boolean).join(' · ')}</div>
                        </div>
                        <Icon name="chevronRight" size={20} color="var(--onSurfaceVariant)" />
                      </Bouncy>
                    </div>
                  ))}
                  {archived.length === 0 && <div style={{ padding: 16, color: 'var(--onSurfaceVariant)' }}>Nessuna auto trovata</div>}
                </Panel>
              </motion.div>
            )}
          </Stagger>
        )}
      </div>
    </div>
  )
}

/** The cars side by side with snap scrolling; cards away from the centre recede like on a turntable. */
function Carousel({ cars, due, onOpen }: { cars: VehicleRow[]; due: DueReminder[]; onOpen: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [offsets, setOffsets] = useState<number[]>(() => cars.map((_, i) => (i === 0 ? 0 : 1)))
  const onScroll = () => {
    const el = track.current
    if (!el) return
    const width = el.clientWidth - 36 + 12
    const position = el.scrollLeft / width
    setPage(Math.round(position))
    setOffsets(cars.map((_, i) => Math.min(1, Math.abs(position - i))))
  }
  return (
    <>
      <div ref={track} onScroll={onScroll} className="scroll-x"
        style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '0 18px', scrollPadding: '0 18px' }}>
        {cars.map((v, i) => (
          <div key={v.id} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', transform: `scale(${1 - 0.06 * offsets[i]})`, opacity: 1 - 0.35 * offsets[i], transition: 'transform 60ms linear' }}>
            <Showcase v={v} next={due.find((d) => d.vehicle.id === v.id)} onOpen={() => onOpen(v.id)} />
          </div>
        ))}
      </div>
      <div style={{ height: 12 }} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
        {cars.map((v, i) => (
          <motion.div key={v.id} initial={false} animate={{ width: page === i ? 22 : 6 }} transition={spring(0.7)}
            style={{ height: 6, borderRadius: 3, background: page === i ? 'var(--primary)' : 'color-mix(in srgb, var(--outline) 35%, transparent)' }} />
        ))}
      </div>
    </>
  )
}

/** A car in the showroom: the photo edge to edge, the name over it and the two facts that matter. */
function Showcase({ v, next, onOpen }: { v: VehicleRow; next?: DueReminder; onOpen: () => void }) {
  const dark = useDark()
  const model = [`${v.make} ${v.model}`.trim(), v.year > 0 ? String(v.year) : ''].filter(Boolean).join(' · ')
  return (
    <Bouncy onClick={onOpen} label={`Apri ${v.name}`} pressed={0.98} style={{ borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
      <div ref={heroRef(`vehicle-page-${v.id}`)} style={{ position: 'relative', height: 210, borderRadius: '24px 24px 0 0', overflow: 'hidden' }}>
        <VehiclePhoto v={v} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,.78) 100%)' }} />
        {v.plate.trim() && <div style={{ position: 'absolute', top: 12, right: 12 }}><Plate plate={v.plate} type={v.vehicleType} registrationYear={v.year} compact /></div>}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
          <div className="ellipsis" style={{ color: '#FFFFFF', fontSize: 26, lineHeight: '29px', fontWeight: 700, letterSpacing: -0.5 }}>{v.name}</div>
          {model && <div className="ellipsis" style={{ color: 'rgba(255,255,255,.75)', fontSize: 14, lineHeight: '20px' }}>{model}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 16px' }}>
        <Icon name="speedometer" size={18} color="var(--primary)" />
        <span className="tnum" style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatKm(v.mileage)}</span>
        <span style={{ flex: 1 }} />
        {next
          ? <StatusPill label={`${maintenanceLabel(next.maintenance)} · ${reminderStatus(next)}`} color={urgencyFor(next.days, dark).color} style={{ maxWidth: 220 }} />
          : <StatusPill label="Tutto in regola" color={urgencyFor(365, dark).color} />}
      </div>
    </Bouncy>
  )
}
