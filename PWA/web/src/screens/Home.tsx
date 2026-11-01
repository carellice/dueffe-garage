import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { AnimatedCount, Bouncy, EmptyIllustration, GradientButton, GradientText, Icon, ProgressRing, Stagger, TextButton, useGradient, VehicleImage } from '../components/ui.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { spring } from '../components/motion.ts'
import { Amber, Ember, Gold, alpha, maintenanceAppearance, urgencyFor, useDark } from '../lib/theme.ts'
import { fileUrl, useStore } from '../lib/store.ts'
import { navigate } from '../lib/nav.ts'
import { heroRef } from '../lib/hero.ts'
import type { IconName } from '../lib/icons.gen.ts'
import type { DueReminder, VehicleRow } from '../../../shared/model.ts'
import { dueReminders, maintenanceLabel, reminderDueDate, reminderStatus, statusLabel, vehicleSubtitle } from '../../../shared/logic.ts'
import { dateLabel, euroRounded, formatKm, longToday, today } from '../../../shared/format.ts'

/** The stagger of the home plays only the first time it is shown (homeIntroPlayed). */
let homeIntroPlayed = false

function greeting() {
  const hour = new Date().getHours()
  return hour >= 5 && hour <= 12 ? 'Buongiorno' : hour >= 13 && hour <= 17 ? 'Buon pomeriggio' : 'Buonasera'
}

export function Home() {
  const state = useStore((s) => s.data)!
  const [intro] = useState(() => !homeIntroPlayed)
  homeIntroPlayed = true
  const [archive, setArchive] = useState(false)
  const [query, setQuery] = useState('')
  const active = state.vehicles.filter((v) => v.status === 'active')
  const archived = state.vehicles.filter((v) => v.status !== 'active' && `${v.name} ${v.make} ${v.plate}`.toLocaleLowerCase('it-IT').includes(query.toLocaleLowerCase('it-IT')))
  const due = useMemo(() => dueReminders(state), [state])
  const year = String(today().y)
  const spent = state.maintenances.filter((m) => m.date.startsWith(year)).reduce((sum, m) => sum + m.cost, 0)
  const soon = due.filter((d) => (d.days ?? Number.MAX_SAFE_INTEGER) <= 30).length
  const open = (id: string) => navigate('detail', { vehicleId: id, from: 'Garage' })
  return (
    <div className="scroll status-pad">
      <div style={{ padding: '22px 18px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Stagger index={0} enabled={intro}>
          <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, lineHeight: '16px', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase' }}>{longToday().toLocaleUpperCase('it-IT')}</div>
          <div style={{ height: 4 }} />
          <div style={{ fontSize: 20, lineHeight: '24px', fontWeight: 600, color: 'var(--onSurfaceVariant)', letterSpacing: 0.5 }}>{greeting()},</div>
          <GradientText text="il tuo garage" size={40} />
        </Stagger>
        <Stagger index={1} enabled={intro} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <StatTile icon="car" value={active.length} label={active.length === 1 ? 'Auto attiva' : 'Auto attive'} animate={intro} />
          <StatTile icon="clock" value={soon} label="Entro 30 gg" highlight={soon > 0} animate={intro} />
          <StatTile icon="coins" value={spent} label={`Spesi nel ${year}`} money animate={intro} />
        </Stagger>
        {due[0] && (
          <Stagger index={2} enabled={intro}>
            <NextDeadlineCard item={due[0]} onClick={() => open(due[0].vehicle.id)} />
          </Stagger>
        )}
        <Stagger index={3} enabled={intro}>
          <GradientButton onClick={() => navigate('vehicle-editor')} height={58} shine layoutRef={heroRef('add-vehicle-page')} style={{ width: '100%' }}>
            <span style={{ fontSize: 26, lineHeight: '26px', fontWeight: 300 }}>＋</span>
            <span style={{ width: 9 }} />
            <span style={{ fontSize: 16, fontWeight: 900 }}>Aggiungi auto</span>
          </GradientButton>
        </Stagger>
        {active.length === 0 ? (
          <Stagger index={4} enabled={intro}>
            <EmptyIllustration icon="garageNav"
              title={state.vehicles.length === 0 ? 'Il garage è pronto' : 'Nessuna auto attiva'}
              subtitle={state.vehicles.length === 0 ? 'Aggiungi la tua prima auto per iniziare a tenere tutto sotto controllo.' : "Aggiungi un'auto o consulta l'archivio."} />
          </Stagger>
        ) : (
          <Stagger index={4} enabled={intro} style={{ paddingTop: 4 }}>
            <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, lineHeight: '16px', letterSpacing: 2, fontWeight: 900 }}>LE TUE AUTO</div>
          </Stagger>
        )}
        {active.map((v, index) => (
          <Stagger key={v.id} index={5 + index} enabled={intro}>
            <VehicleCard v={v} due={due.filter((d) => d.vehicle.id === v.id)} onOpen={() => open(v.id)} />
          </Stagger>
        ))}
        {state.vehicles.some((v) => v.status !== 'active') && (
          <>
            <div>
              <TextButton onClick={() => setArchive(!archive)} style={{ fontWeight: 700 }}>
                <motion.span initial={false} animate={{ rotate: archive ? 180 : 0 }} transition={spring(0.6)} style={{ display: 'inline-flex' }}>
                  <Icon name="chevronDown" size={18} />
                </motion.span>
                <span style={{ width: 6 }} />
                {archive ? 'Nascondi archivio' : `Mostra archivio (${state.vehicles.length - active.length})`}
              </TextButton>
            </div>
            {archive && (
              <>
                <Stagger index={0} enabled={intro}>
                  <OutlinedField value={query} onChange={setQuery} label="Cerca nell'archivio" radius={18} bg="var(--background)" />
                </Stagger>
                {archived.map((v, index) => (
                  <Stagger key={v.id} index={index + 1} enabled={intro}>
                    <VehicleCard v={v} due={[]} onOpen={() => open(v.id)} />
                  </Stagger>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatTile({ icon, value, label, highlight = false, money = false, animate }: { icon: IconName; value: number; label: string; highlight?: boolean; money?: boolean; animate: boolean }) {
  const dark = useDark()
  return (
    <div style={{
      flex: 1, minWidth: 0, borderRadius: 22, padding: '13px 12px',
      background: highlight ? `linear-gradient(135deg, ${alpha(Amber, dark ? 0.3 : 0.22)}, ${alpha(Ember, dark ? 0.16 : 0.1)})` : 'var(--surface)',
      border: `1px solid ${highlight ? alpha(Amber, 0.45) : 'color-mix(in srgb, var(--outline) 12%, transparent)'}`,
    }}>
      <Icon name={icon} size={20} color={highlight ? Amber : 'var(--primary)'} />
      <div style={{ height: 10 }} />
      <AnimatedCount value={value} animate={animate} format={money ? euroRounded : (v) => String(Math.trunc(v))}
        style={{ fontSize: money ? 22 : 26, lineHeight: '30px', fontWeight: 900, color: 'var(--onSurface)', letterSpacing: 0 }} />
      <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, lineHeight: '16px', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}

function NextDeadlineCard({ item, onClick }: { item: DueReminder; onClick: () => void }) {
  const dark = useDark()
  const urgency = urgencyFor(item.days, dark)
  const appearance = maintenanceAppearance(item.maintenance.type, dark)
  const days = item.days
  const fraction = days == null ? 0 : days <= 0 ? 1 : Math.min(1, Math.max(0.05, 1 - days / 365))
  const date = reminderDueDate(item)
  const gradient = useGradient<HTMLDivElement>()
  return (
    <Bouncy onClick={onClick} label="Apri auto" ripple="#FFFFFF" style={{
      borderRadius: 26, display: 'flex', alignItems: 'center', padding: 16, position: 'relative',
      background: 'linear-gradient(var(--ga, 135deg), #221D16, #0E0C0A)', border: `1px solid ${alpha(urgency.color, 0.4)}`,
    }} ref={gradient}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', containerType: 'size', overflow: 'hidden', borderRadius: 26 }}>
        <div style={{ position: 'absolute', right: '-140cqh', top: '-140cqh', width: '280cqh', height: '280cqh', borderRadius: '50%',
          background: `radial-gradient(closest-side, ${alpha(urgency.color, 0.28)}, transparent)` }} />
      </div>
      <ProgressRing fraction={fraction} color={urgency.color} size={64} stroke={5}>
        <Icon name={appearance.icon} size={26} color={urgency.color} />
      </ProgressRing>
      <div style={{ width: 14 }} />
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ color: Gold, fontSize: 10, lineHeight: '16px', letterSpacing: 2, fontWeight: 900 }}>PROSSIMA SCADENZA</div>
        <div style={{ height: 2 }} />
        <div className="ellipsis" style={{ color: '#FFFFFF', fontSize: 20, lineHeight: '24px', fontWeight: 900 }}>{maintenanceLabel(item.maintenance)}</div>
        <div className="ellipsis" style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, lineHeight: '20px', letterSpacing: 0.25 }}>{item.vehicle.name}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', position: 'relative' }}>
        <div style={{ color: urgency.color, fontSize: 14, lineHeight: '20px', fontWeight: 900, textAlign: 'right' }}>{reminderStatus(item)}</div>
        {date && <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, lineHeight: '16px', letterSpacing: 0.5 }}>{dateLabel(date)}</div>}
      </div>
    </Bouncy>
  )
}

export function VehicleCard({ v, due, onOpen }: { v: VehicleRow; due: DueReminder[]; onOpen: () => void }) {
  const dark = useDark()
  const next = due[0]
  const placeholder = useGradient<HTMLDivElement>()
  return (
    <Bouncy ref={heroRef(`vehicle-page-${v.id}`)} onClick={onOpen} label={`Apri ${v.name}`} style={{
      borderRadius: 28, background: 'var(--surface)', padding: 8, border: `1px solid ${dark ? 'rgba(255,255,255,.07)' : 'transparent'}`,
      boxShadow: dark ? 'none' : '0 7px 16px rgba(0,0,0,.13), 0 2px 5px rgba(0,0,0,.08)',
    }}>
      <div style={{ position: 'relative', height: v.hasPhoto ? 196 : 150, borderRadius: 22, overflow: 'hidden' }}>
        {v.hasPhoto ? (
          <VehicleImage src={fileUrl('vehicle', v.id, v.updatedAt)} radius={18} style={{ position: 'absolute', inset: 0 }} />
        ) : (
          <div ref={placeholder} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(var(--ga, 135deg), #2E2820, #12100D)', containerType: 'size' }}>
            <div style={{ position: 'absolute', left: '85cqw', top: '20cqh', width: '100cqw', height: '100cqw', marginLeft: '-50cqw', marginTop: '-50cqw', borderRadius: '50%',
              background: `radial-gradient(closest-side, ${alpha(Gold, 0.3)}, transparent)` }} />
            <div style={{ position: 'absolute', right: 14, top: '50%', marginTop: -59, transform: 'rotate(-8deg)' }}>
              <Icon name="car" size={118} color={alpha(Gold, 0.22)} />
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 0%, transparent 45%, rgba(0,0,0,.78) 100%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,.55)', borderRadius: 999, padding: '6px 11px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.status === 'active' ? '#2AD06D' : '#B4B1AA' }} />
          <span style={{ width: 6 }} />
          <span style={{ color: '#FFFFFF', fontSize: 11, lineHeight: '16px', fontWeight: 700, letterSpacing: 0.5 }}>{statusLabel(v.status)}</span>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, borderRadius: 6, overflow: 'hidden', background: '#F7F7F2', padding: '4px 8px 4px 12px',
          color: '#151515', fontSize: 12, lineHeight: '16px', letterSpacing: 1.6, fontWeight: 900, boxShadow: 'inset 6px 0 0 #0755AD' }}>
          {v.plate.toLocaleUpperCase('it-IT')}
        </div>
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
          <div className="ellipsis" style={{ color: '#FFFFFF', fontSize: 27, lineHeight: '30px', fontWeight: 900, letterSpacing: -0.4 }}>{v.name}</div>
          <div className="ellipsis" style={{ color: 'rgba(255,255,255,.78)', fontSize: 13, lineHeight: '20px', letterSpacing: 0.25 }}>{vehicleSubtitle(v)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 6px 6px 10px' }}>
        <Icon name="speedometer" size={18} color="var(--primary)" />
        <span style={{ width: 6 }} />
        <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '20px', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: 0.25 }}>{formatKm(v.mileage)}</span>
        {v.fuel.trim() && <>
          <span style={{ width: 12 }} />
          <Icon name="fuel" size={18} color="var(--primary)" />
          <span style={{ width: 6 }} />
          <span className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '20px', fontWeight: 600, minWidth: 0, letterSpacing: 0.25 }}>{v.fuel}</span>
        </>}
        <span style={{ flex: 1 }} />
        {next ? <UrgencyChip item={next} /> : <Icon name="chevronRight" size={20} color="var(--onSurfaceVariant)" />}
      </div>
    </Bouncy>
  )
}

function UrgencyChip({ item }: { item: DueReminder }) {
  const dark = useDark()
  const urgency = urgencyFor(item.days, dark)
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderRadius: 999, background: alpha(urgency.color, 0.14), padding: '5px 9px', flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: urgency.color }} />
      <span style={{ width: 5 }} />
      <span style={{ color: urgency.color, fontSize: 11, lineHeight: '16px', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{reminderStatus(item)}</span>
    </div>
  )
}
