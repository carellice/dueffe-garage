import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  dateLabel, dueReminders, formatKm, formatNumber, greeting, longDate, maintenanceLabel, reminderDueDate, reminderStatus,
  statusLabel, today, type DueReminder, type Vehicle,
} from '../../../shared/model.ts'
import { useStore } from '../lib/store.ts'
import { navigate } from '../lib/nav.ts'
import { alpha, Amber, Ember, Gold, maintenanceAppearance, urgencyFor, useIsDark } from '../lib/theme.ts'
import { AnimatedCount, EmptyIllustration, GradientButton, GradientText, Icon, Pressable, ProgressRing, Stagger, TextButton } from '../components/ui.tsx'
import { VehicleImage } from '../components/garage.tsx'
import { OutlinedTextField } from '../components/fields.tsx'
import { spring } from '../components/motion.ts'

/** The intro plays once per app start (homeIntroPlayed). */
let homeIntroPlayed = false

export function GarageHome() {
  const state = useStore((s) => s.data)!
  const [archive, setArchive] = useState(false)
  const [query, setQuery] = useState('')
  const active = state.vehicles.filter((v) => v.status === 'active')
  const q = query.toLocaleLowerCase('it-IT')
  const archived = state.vehicles.filter((v) => v.status !== 'active' && `${v.name} ${v.make} ${v.plate}`.toLocaleLowerCase('it-IT').includes(q))
  const due = useMemo(() => dueReminders(state), [state])
  const year = today().slice(0, 4)
  const spent = state.maintenances.filter((m) => m.date.startsWith(year)).reduce((sum, m) => sum + m.cost, 0)
  const soon = due.filter((d) => (d.days ?? Number.MAX_SAFE_INTEGER) <= 30).length
  const intro = useRef(!homeIntroPlayed).current
  useEffect(() => { homeIntroPlayed = true }, [])
  const next = due[0]
  return (
    <div className="scroll">
      <div style={{ padding: '22px 18px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Stagger index={0} enabled={intro}>
          <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>{longDate(today()).toLocaleUpperCase('it-IT')}</div>
          <div style={{ height: 4 }} />
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--onSurfaceVariant)' }}>{greeting()},</div>
          <GradientText text="il tuo garage" size={40} />
        </Stagger>
        <Stagger index={1} enabled={intro} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <StatTile icon="car" value={active.length} label={active.length === 1 ? 'Auto attiva' : 'Auto attive'} animate={intro} />
          <StatTile icon="clock" value={soon} label="Entro 30 gg" highlight={soon > 0} animate={intro} />
          <StatTile icon="coins" value={spent} label={`Spesi nel ${year}`} money animate={intro} />
        </Stagger>
        {next && <Stagger index={2} enabled={intro}><NextDeadlineCard item={next} onClick={() => navigate('detail', { vehicleId: next.vehicle.id })} /></Stagger>}
        <Stagger index={3} enabled={intro}>
          <div data-hero="add-vehicle-page" data-radius="28">
            <GradientButton onClick={() => navigate('vehicle-editor', { isNew: true })} height={58} shine style={{ width: '100%' }}>
              <span style={{ fontSize: 26, lineHeight: '26px', fontWeight: 300 }}>＋</span>
              <span style={{ width: 9 }} />
              <span style={{ fontSize: 16, fontWeight: 900 }}>Aggiungi auto</span>
            </GradientButton>
          </div>
        </Stagger>
        {active.length === 0
          ? <Stagger index={4} enabled={intro}>
              <EmptyIllustration icon="garage-nav"
                title={state.vehicles.length === 0 ? 'Il garage è pronto' : 'Nessuna auto attiva'}
                subtitle={state.vehicles.length === 0 ? 'Aggiungi la tua prima auto per iniziare a tenere tutto sotto controllo.' : "Aggiungi un'auto o consulta l'archivio."} />
            </Stagger>
          : <Stagger index={4} enabled={intro} style={{ paddingTop: 4 }}>
              <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, letterSpacing: 2, fontWeight: 900 }}>LE TUE AUTO</div>
            </Stagger>}
        {active.map((v, i) => (
          <Stagger key={v.id} index={5 + i} enabled={intro}>
            <VehicleCard v={v} due={due.filter((d) => d.vehicle.id === v.id)} />
          </Stagger>
        ))}
        {state.vehicles.some((v) => v.status !== 'active') && <>
          <TextButton onClick={() => setArchive(!archive)} style={{ alignSelf: 'flex-start' }}>
            <motion.span style={{ display: 'flex' }} animate={{ rotate: archive ? 180 : 0 }} transition={spring(0.6, 1500)}>
              <Icon name="chevron-down" size={18} />
            </motion.span>
            <span style={{ width: 6 }} />
            {archive ? 'Nascondi archivio' : `Mostra archivio (${state.vehicles.length - active.length})`}
          </TextButton>
          <AnimatePresence>
            {archive && <motion.div key="archive" style={{ display: 'flex', flexDirection: 'column', gap: 16 }} exit={{ opacity: 0 }}>
              <Stagger index={0} enabled={intro}>
                <OutlinedTextField value={query} onChange={setQuery} label="Cerca nell'archivio" radius={18} />
              </Stagger>
              {archived.map((v, i) => <Stagger key={v.id} index={i + 1} enabled={intro}><VehicleCard v={v} due={[]} /></Stagger>)}
            </motion.div>}
          </AnimatePresence>
        </>}
      </div>
    </div>
  )
}

function StatTile({ icon, value, label, highlight = false, money = false, animate = true }: {
  icon: string; value: number; label: string; highlight?: boolean; money?: boolean; animate?: boolean
}) {
  const dark = useIsDark()
  return (
    <div style={{
      flex: 1, minWidth: 0, borderRadius: 22, padding: '13px 12px',
      background: highlight ? `linear-gradient(to bottom right, ${alpha(Amber, dark ? 0.30 : 0.22)}, ${alpha(Ember, dark ? 0.16 : 0.10)})` : 'var(--surface)',
      border: highlight ? `1px solid ${alpha(Amber, 0.45)}` : '1px solid color-mix(in srgb, var(--outline) 12%, transparent)',
    }}>
      <Icon name={icon} size={20} color={highlight ? Amber : 'var(--primary)'} />
      <div style={{ height: 10 }} />
      <AnimatedCount value={value} animateIn={animate}
        format={money ? (v) => `€${formatNumber(v, 0)}` : (v) => String(Math.trunc(v))}
        style={{ fontSize: money ? 22 : 26, lineHeight: '30px', fontWeight: 900, color: 'var(--onSurface)', letterSpacing: 0.5 }} />
      <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 11 }}>{label}</div>
    </div>
  )
}

function NextDeadlineCard({ item, onClick }: { item: DueReminder; onClick: () => void }) {
  const dark = useIsDark()
  const urgency = urgencyFor(item.days, dark)
  const appearance = maintenanceAppearance(item.maintenance.type, dark)
  const days = item.days
  const fraction = days == null ? 0 : days <= 0 ? 1 : Math.min(1, Math.max(0.05, 1 - days / 365))
  const date = reminderDueDate(item)
  return (
    <Pressable onClick={onClick} label="Apri auto" style={{
      borderRadius: 26, padding: 16, display: 'flex', alignItems: 'center',
      background: `radial-gradient(circle at 100% 0%, ${alpha(urgency.color, 0.28)}, transparent 140%), linear-gradient(to bottom right, #221D16, #0E0C0A)`,
      border: `1px solid ${alpha(urgency.color, 0.4)}`,
    }}>
      <ProgressRing fraction={fraction} color={urgency.color} size={64} stroke={5}>
        <Icon name={appearance.icon} size={26} color={urgency.color} />
      </ProgressRing>
      <div style={{ width: 14 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: Gold, fontSize: 10, letterSpacing: 2, fontWeight: 900 }}>PROSSIMA SCADENZA</div>
        <div style={{ height: 2 }} />
        <div className="ellipsis" style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>{maintenanceLabel(item.maintenance)}</div>
        <div className="ellipsis" style={{ color: 'rgba(255,255,255,.65)', fontSize: 13 }}>{item.vehicle.name}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ color: urgency.color, fontSize: 14, fontWeight: 900, textAlign: 'right' }}>{reminderStatus(item)}</span>
        {date.trim() !== '' && <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 11 }}>{dateLabel(date)}</span>}
      </div>
    </Pressable>
  )
}

function VehicleCard({ v, due }: { v: Vehicle; due: DueReminder[] }) {
  const dark = useIsDark()
  const next = due[0]
  const muted = 'var(--onSurfaceVariant)'
  return (
    <div data-hero={`vehicle-page-${v.id}`} data-radius="28">
      <Pressable onClick={() => navigate('detail', { vehicleId: v.id })} label={`Apri ${v.name}`} style={{
        borderRadius: 28, background: 'var(--surface)', padding: 8,
        boxShadow: dark ? 'none' : '0 7px 18px rgba(0,0,0,.12), 0 3px 6px rgba(0,0,0,.06)',
        border: dark ? '1px solid rgba(255,255,255,.07)' : '1px solid transparent',
      }}>
        <div style={{ position: 'relative', height: v.hasPhoto ? 196 : 150, borderRadius: 22, overflow: 'hidden' }}>
          {v.hasPhoto
            ? <VehicleImage vehicle={v} style={{ position: 'absolute', inset: 0, borderRadius: 18 }} />
            : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 85% 20%, rgba(255,216,77,.30), transparent 50cqw), linear-gradient(to bottom right, #2E2820, #12100D)', containerType: 'inline-size' }}>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%) rotate(-8deg)', color: alpha(Gold, 0.22) }}>
                  <Icon name="car" size={118} />
                </div>
              </div>}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, transparent 45%, rgba(0,0,0,.78) 100%)' }} />
          <div style={{ position: 'absolute', left: 10, top: 10, background: 'rgba(0,0,0,.55)', borderRadius: 999, padding: '6px 11px', display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.status === 'active' ? '#2AD06D' : '#B4B1AA' }} />
            <span style={{ width: 6 }} />
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: '16px' }}>{statusLabel(v.status)}</span>
          </div>
          <span style={{
            position: 'absolute', right: 10, top: 10, color: '#151515', fontSize: 12, letterSpacing: 1.6, fontWeight: 900, lineHeight: '24px',
            borderRadius: 6, background: 'linear-gradient(to right, #0755AD 6px, #F7F7F2 6px)', padding: '4px 8px 4px 12px',
          }}>{v.plate.toLocaleUpperCase('it-IT')}</span>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 14px' }}>
            <div className="ellipsis" style={{ color: '#fff', fontSize: 27, lineHeight: '30px', fontWeight: 900, letterSpacing: -0.4 }}>{v.name}</div>
            <div className="ellipsis" style={{ color: 'rgba(255,255,255,.78)', fontSize: 13 }}>
              {[`${v.make} ${v.model}`.trim(), String(v.year)].filter((s) => s.trim() !== '').join(' · ')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 6px 6px 10px' }}>
          <Icon name="speedometer" size={18} color="var(--primary)" />
          <span style={{ width: 6 }} />
          <span style={{ color: muted, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatKm(v.mileage)}</span>
          {v.fuel.trim() !== '' && <>
            <span style={{ width: 12 }} />
            <Icon name="fuel" size={18} color="var(--primary)" />
            <span style={{ width: 6 }} />
            <span className="ellipsis" style={{ color: muted, fontSize: 13, fontWeight: 600, minWidth: 0 }}>{v.fuel}</span>
          </>}
          <span style={{ flex: 1 }} />
          {next
            ? (() => {
                const u = urgencyFor(next.days, dark)
                return (
                  <div style={{ borderRadius: 999, background: alpha(u.color, 0.14), padding: '5px 9px', display: 'flex', alignItems: 'center', flex: 'none' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.color }} />
                    <span style={{ width: 5 }} />
                    <span style={{ color: u.color, fontSize: 11, fontWeight: 700, lineHeight: '16px', whiteSpace: 'nowrap' }}>{reminderStatus(next)}</span>
                  </div>
                )
              })()
            : <Icon name="chevron-right" size={20} color={muted} />}
        </div>
      </Pressable>
    </div>
  )
}
