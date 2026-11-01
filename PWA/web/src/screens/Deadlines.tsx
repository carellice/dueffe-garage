import { useMemo } from 'react'
import { AnimatedCount, EmptyIllustration, GlassCard, ProgressRing, SectionHeading, Stagger } from '../components/ui.tsx'
import { ReminderCard } from '../components/cards.tsx'
import { urgencyFor, useDark } from '../lib/theme.ts'
import { useStore } from '../lib/store.ts'
import { navigate } from '../lib/nav.ts'
import { dueReminders } from '../../../shared/logic.ts'
import type { DueReminder } from '../../../shared/model.ts'

/** ReminderScreen of HomeScreens.kt. */
export function Deadlines() {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const list = useMemo(() => dueReminders(state), [state])
  const overdue = list.filter((d) => (d.days ?? Number.MAX_SAFE_INTEGER) < 0)
  const soon = list.filter((d) => d.days != null && d.days >= 0 && d.days <= 30)
  const later = list.filter((d) => !overdue.includes(d) && !soon.includes(d))
  const open = (id: string) => navigate('detail', { vehicleId: id, from: 'Scadenze' })
  let offset = 2
  const groups: [string, DueReminder[], number][] = []
  for (const [title, group] of [['Scadute', overdue], ['Prossimi 30 giorni', soon], ['Più avanti', later]] as [string, DueReminder[]][]) {
    if (group.length) {
      groups.push([title, group, offset])
      offset += group.length + 1
    }
  }
  return (
    <div className="scroll status-pad">
      <div style={{ padding: '22px 18px 120px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeading kicker="Agenda" title="Scadenze" subtitle="Tutti i promemoria delle tue auto attive" />
        {list.length === 0 ? (
          <Stagger index={1}>
            <EmptyIllustration icon="calendarNav" title="Tutto in regola" subtitle="Nessuna scadenza da mostrare. Registra un intervento con promemoria per vederlo qui." />
          </Stagger>
        ) : (
          <Stagger index={1}>
            <GlassCard padding={16} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ProgressRing fraction={(list.length - overdue.length) / list.length} color={urgencyFor(200, dark).color} size={70} stroke={7}>
                <AnimatedCount value={list.length} style={{ fontSize: 22, lineHeight: '28px', fontWeight: 900, color: 'var(--onSurface)' }} />
              </ProgressRing>
              <div style={{ width: 16 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SummaryLine color={urgencyFor(-1, dark).color} label="Scadute" count={overdue.length} />
                <SummaryLine color={urgencyFor(10, dark).color} label="Entro 30 giorni" count={soon.length} />
                <SummaryLine color={urgencyFor(200, dark).color} label="Più avanti" count={later.length} />
              </div>
            </GlassCard>
          </Stagger>
        )}
        {groups.map(([title, group, base]) => (
          <div key={title} style={{ display: 'contents' }}>
            <Stagger index={base} style={{ paddingTop: 8 }}>
              <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 11, lineHeight: '16px', letterSpacing: 2, fontWeight: 900 }}>{title.toLocaleUpperCase('it-IT')}</div>
            </Stagger>
            {group.map((item, i) => (
              <Stagger key={item.reminder.id} index={base + 1 + i}>
                <ReminderCard item={item} showVehicle onClick={() => open(item.vehicle.id)} />
              </Stagger>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryLine({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ width: 8 }} />
      <span style={{ flex: 1, fontSize: 14, lineHeight: '20px', color: 'var(--onSurfaceVariant)', letterSpacing: 0.25 }}>{label}</span>
      <span style={{ fontSize: 15, lineHeight: '20px', fontWeight: 900, color: count > 0 ? color : 'var(--onSurfaceVariant)' }}>{count}</span>
    </div>
  )
}
