import { useMemo } from 'react'
import { AnimatedCount, EmptyState, Overline, PageHeading, PageTopBar, Panel, Readout, ReadoutDivider, Stagger } from '../components/ui.tsx'
import { DeadlineGroup } from '../components/cards.tsx'
import { urgencyFor, useDark } from '../lib/theme.ts'
import { useStore } from '../lib/store.ts'
import { back, navigate } from '../lib/nav.ts'
import { dueReminders } from '../../../shared/logic.ts'
import type { DueReminder } from '../../../shared/model.ts'

/** ReminderScreen of HomeScreens.kt: every deadline of the active cars, grouped by how close it is. */
export function Deadlines() {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const list = useMemo(() => dueReminders(state), [state])
  const overdue = list.filter((d) => (d.days ?? Number.MAX_SAFE_INTEGER) < 0)
  const soon = list.filter((d) => d.days != null && d.days >= 0 && d.days <= 30)
  const later = list.filter((d) => !overdue.includes(d) && !soon.includes(d))
  const multipleCars = new Set(list.map((d) => d.vehicle.id)).size > 1
  const open = (d: DueReminder) => navigate('reminder-detail', { vehicleId: d.vehicle.id, id: d.reminder.id })
  const groups = ([['Scadute', overdue], ['Prossimi 30 giorni', soon], ['Più avanti', later]] as [string, DueReminder[]][]).filter(([, g]) => g.length)
  return (
    <div className="scroll">
      <PageTopBar onBack={() => back()} backLabel="Garage" />
      <div style={{ padding: '0 18px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Stagger index={0} style={{ padding: '0 2px' }}><PageHeading overline="Agenda" title="Scadenze" subtitle="Tutti i promemoria delle tue auto attive" /></Stagger>
        {list.length === 0 ? (
          <Stagger index={1}><EmptyState icon="calendarNav" title="Tutto in regola" subtitle="Nessuna scadenza da mostrare. Registra un intervento con promemoria per vederlo qui." /></Stagger>
        ) : (
          <Stagger index={1}>
            <Panel padding={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Readout label="Scadute" color={overdue.length ? urgencyFor(-1, dark).color : undefined}><AnimatedCount value={overdue.length} /></Readout>
              <ReadoutDivider />
              <Readout label="Entro 30 giorni" color={soon.length ? urgencyFor(10, dark).color : undefined}><AnimatedCount value={soon.length} /></Readout>
              <ReadoutDivider />
              <Readout label="Più avanti"><AnimatedCount value={later.length} /></Readout>
            </Panel>
          </Stagger>
        )}
        {groups.map(([title, group], i) => (
          <Stagger key={title} index={2 + i}>
            <Overline text={title} style={{ padding: '0 4px 8px' }} />
            <DeadlineGroup items={group} showVehicle={multipleCars} onClick={open} />
          </Stagger>
        ))}
      </div>
    </div>
  )
}
