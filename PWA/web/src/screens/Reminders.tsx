import { useMemo } from 'react'
import { dueReminders } from '../../../shared/model.ts'
import { useStore } from '../lib/store.ts'
import { navigate } from '../lib/nav.ts'
import { urgencyFor, useIsDark } from '../lib/theme.ts'
import { AnimatedCount, EmptyIllustration, GlassCard, ProgressRing, SectionHeading, Stagger } from '../components/ui.tsx'
import { ReminderListCard } from '../components/garage.tsx'

/** ReminderScreen: every deadline of the active vehicles, grouped by urgency. */
export function ReminderScreen() {
  const state = useStore((s) => s.data)!
  const dark = useIsDark()
  const list = useMemo(() => dueReminders(state), [state])
  const overdue = list.filter((d) => (d.days ?? Number.MAX_SAFE_INTEGER) < 0)
  const soon = list.filter((d) => d.days != null && d.days >= 0 && d.days <= 30)
  const later = list.filter((d) => !overdue.includes(d) && !soon.includes(d))
  const open = (vehicleId: string) => navigate('detail', { vehicleId })
  let offset = 2
  return (
    <div className="scroll">
      <div style={{ padding: '22px 18px 120px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeading kicker="Agenda" title="Scadenze" subtitle="Tutti i promemoria delle tue auto attive" />
        {list.length === 0
          ? <Stagger index={1}><EmptyIllustration icon="calendar-nav" title="Tutto in regola" subtitle="Nessuna scadenza da mostrare. Registra un intervento con promemoria per vederlo qui." /></Stagger>
          : <Stagger index={1}>
              <GlassCard padding={16} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ProgressRing fraction={(list.length - overdue.length) / list.length} color={urgencyFor(200, dark).color} size={70} stroke={7}>
                  <AnimatedCount value={list.length} format={(v) => String(Math.trunc(v))} style={{ fontSize: 22, fontWeight: 900, color: 'var(--onSurface)' }} />
                </ProgressRing>
                <div style={{ width: 16 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SummaryLine color={urgencyFor(-1, dark).color} label="Scadute" count={overdue.length} />
                  <SummaryLine color={urgencyFor(10, dark).color} label="Entro 30 giorni" count={soon.length} />
                  <SummaryLine color={urgencyFor(200, dark).color} label="Più avanti" count={later.length} />
                </div>
              </GlassCard>
            </Stagger>}
        {([['Scadute', overdue], ['Prossimi 30 giorni', soon], ['Più avanti', later]] as const).map(([title, group]) => {
          if (group.length === 0) return null
          const base = offset
          offset += group.length + 1
          return [
            <Stagger key={`header-${title}`} index={base} style={{ paddingTop: 8 }}>
              <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, letterSpacing: 2, fontWeight: 900 }}>{title.toLocaleUpperCase('it-IT')}</div>
            </Stagger>,
            ...group.map((item, i) => (
              <Stagger key={item.reminder.id} index={base + 1 + i}>
                <ReminderListCard item={item} showVehicle onClick={() => open(item.vehicle.id)} />
              </Stagger>
            )),
          ]
        })}
      </div>
    </div>
  )
}

function SummaryLine({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flex: 'none' }} />
      <span style={{ width: 8 }} />
      <span style={{ flex: 1, fontSize: 14, color: 'var(--onSurfaceVariant)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 900, color: count > 0 ? color : 'var(--onSurfaceVariant)' }}>{count}</span>
    </div>
  )
}
