import { motion } from 'framer-motion'
import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import {
  dateLabel, documentCategory, documentDate, documentSize, dueReminders, formatEuro, formatKm, formatLabel, intervalUnitLabel,
  maintenanceLabel, reminderDetailStatus, reminderDueDate, reminderSubtitle, type GarageDocument,
} from '../../../shared/model.ts'
import { actions, useStore } from '../lib/store.ts'
import { back, navigate, top } from '../lib/nav.ts'
import { documentAppearance, maintenanceAppearance, useIsDark, type Appearance } from '../lib/theme.ts'
import { openDocument, shareDocument } from '../lib/files.ts'
import { BackButton, Divider, GlassCard, GradientButton, Icon, OutlinedButton, Stagger } from '../components/ui.tsx'
import { DocumentThumbnail } from '../components/thumbnail.tsx'
import { confirmDelete, toast } from '../components/overlays.tsx'
import { spring } from '../components/motion.ts'

// ItemDetailScreens.kt: one page for an intervention, a deadline, a document.

/** The item is gone (deleted here or on another phone): close the page, if it is still on top. */
function useGone(missing: boolean) {
  const key = useRef(top().key).current
  useEffect(() => {
    if (!missing) return
    const t = setTimeout(() => { if (top().key === key) back() }, 50)
    return () => clearTimeout(t)
  }, [missing, key])
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="scroll">
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 15 }}>{children}</div>
    </div>
  )
}

function Header({ section, title, subtitle, appearance }: { section: string; title: string; subtitle: string; appearance: Appearance }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ color: 'var(--primary)', fontSize: 11, letterSpacing: 2, fontWeight: 900 }}>{section.toLocaleUpperCase('it-IT')}</span>
      <div style={{ height: 3 }} />
      <span style={{ fontSize: 33, lineHeight: '36px', fontWeight: 900, letterSpacing: -0.5, overflowWrap: 'anywhere' }}>{title}</span>
      <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 15 }}>{subtitle}</span>
      <div style={{ height: 6 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring(0.45, 200)}
          style={{ width: 62, height: 62, borderRadius: '50%', background: appearance.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={appearance.icon} size={31} color={appearance.tint} />
        </motion.div>
        <span style={{ color: appearance.tint, fontWeight: 700, background: appearance.background, borderRadius: 18, padding: '7px 12px' }}>{appearance.label}</span>
      </div>
    </div>
  )
}

function Fact({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{ padding: '9px 0', display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ width: 39, height: 39, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Icon name={icon} size={21} color="var(--primary)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 10, letterSpacing: 1 }}>{label.toLocaleUpperCase('it-IT')}</div>
        <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</div>
      </div>
    </div>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <Stagger index={2}><GlassCard padding={17}>{children}</GlassCard></Stagger>
}

function CardTitle({ text }: { text: string }) {
  return <span style={{ fontSize: 17, fontWeight: 700 }}>{text}</span>
}

function Actions({ onEdit, onDelete, editLabel, deleteLabel }: { onEdit: () => void; onDelete: () => void; editLabel: string; deleteLabel: string }) {
  return <>
    <GradientButton onClick={onEdit} height={52} radius={28} style={{ width: '100%' }}>
      <Icon name="edit" size={19} /><span style={{ width: 8 }} /><span style={{ fontWeight: 700 }}>{editLabel}</span>
    </GradientButton>
    <OutlinedButton onClick={onDelete} color="var(--error)" style={{ height: 52, borderRadius: 28, fontWeight: 600 }}>
      <Icon name="delete" size={19} /><span style={{ width: 8 }} />{deleteLabel}
    </OutlinedButton>
  </>
}

export function MaintenanceDetailScreen({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useIsDark()
  const maintenance = state.maintenances.find((m) => m.id === id)
  useGone(!maintenance)
  if (!maintenance) return null
  const reminder = state.reminders.find((r) => r.maintenanceId === maintenance.id)
  const due = reminder?.dueDate.trim() ? reminder.dueDate : null
  return (
    <Page>
      <BackButton label="Interventi" onClick={back} />
      <Header section="Intervento" title={maintenanceLabel(maintenance)} subtitle="Dettagli e manutenzione della tua auto" appearance={maintenanceAppearance(maintenance.type, dark)} />
      <Card>
        <Fact label="Data intervento" value={dateLabel(maintenance.date)} icon="calendar-nav" />
        <Divider />
        <Fact label="Chilometri" value={formatKm(maintenance.mileage)} icon="speedometer" />
        <Divider />
        <Fact label="Costo" value={formatEuro(maintenance.cost)} icon="coins" />
      </Card>
      {maintenance.notes.trim() !== '' && <Card>
        <CardTitle text="Note" />
        <div style={{ height: 8 }} />
        <span style={{ color: 'var(--onSurfaceVariant)', whiteSpace: 'pre-wrap', userSelect: 'text' }}>{maintenance.notes}</span>
      </Card>}
      {reminder && <Card>
        <CardTitle text="Promemoria attivo" />
        {due && <Fact label="Scadenza" value={dateLabel(due)} icon="calendar-nav" />}
        {reminder.mileageThreshold != null && <Fact label="Soglia chilometrica" value={formatKm(reminder.mileageThreshold)} icon="speedometer" />}
      </Card>}
      <Actions editLabel="Modifica intervento" deleteLabel="Elimina intervento"
        onEdit={() => navigate('maintenance-editor', { vehicleId: maintenance.vehicleId, itemId: maintenance.id })}
        onDelete={() => confirmDelete('Eliminare questo intervento e il suo promemoria?', () => {
          back()
          actions.deleteMaintenance(maintenance.id).catch((e) => toast((e as Error).message))
        })} />
    </Page>
  )
}

export function ReminderDetailScreen({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useIsDark()
  const due = useMemo(() => dueReminders(state).find((d) => d.reminder.id === id), [state, id])
  useGone(!due)
  if (!due) return null
  const date = reminderDueDate(due)
  const r = due.reminder
  return (
    <Page>
      <BackButton label="Scadenze" onClick={back} />
      <Header section="Scadenza" title={maintenanceLabel(due.maintenance)} subtitle={reminderSubtitle(due)} appearance={maintenanceAppearance(due.maintenance.type, dark)} />
      <Card>
        <Fact label="Stato" value={reminderDetailStatus(due)} icon="clock" />
        {date.trim() !== '' && <><Divider /><Fact label="Data di scadenza" value={dateLabel(date)} icon="calendar-nav" /></>}
        {r.mileageThreshold != null && <><Divider /><Fact label="Soglia chilometrica" value={formatKm(r.mileageThreshold)} icon="speedometer" /></>}
        {r.type === 'interval' && r.intervalValue != null && <><Divider />
          <Fact label="Intervallo" value={`Ogni ${r.intervalValue} ${intervalUnitLabel(r.intervalValue, r.intervalUnit)}`} icon="repeat" /></>}
      </Card>
      <Card>
        <CardTitle text="Intervento collegato" />
        <Fact label="Registrato il" value={dateLabel(due.maintenance.date)} icon="calendar-nav" />
        <Fact label="Chilometri registrati" value={formatKm(due.maintenance.mileage)} icon="speedometer" />
      </Card>
      <Actions editLabel="Modifica scadenza" deleteLabel="Elimina scadenza"
        onEdit={() => navigate('maintenance-editor', { vehicleId: due.vehicle.id, itemId: due.maintenance.id })}
        onDelete={() => confirmDelete("Eliminare questa scadenza? L'intervento resterà nel diario.", () => {
          back()
          actions.deleteReminder(r.id).catch((e) => toast((e as Error).message))
        })} />
    </Page>
  )
}

export function DocumentDetailScreen({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useIsDark()
  const document = state.documents.find((d) => d.id === id)
  useGone(!document)
  if (!document) return null
  const linked = state.maintenances.find((m) => m.id === document.maintenanceId)
  const category = documentCategory(document, linked ? [linked] : [])
  const onError = (m: string) => toast(m, true)
  return (
    <Page>
      <BackButton label="Documenti" onClick={back} />
      <Header section="Documento" title={document.name} subtitle="Una copia sempre a portata di mano" appearance={documentAppearance(category, dark)} />
      <DocumentThumbnail document={document} category={category} maxPixels={1200} style={{ width: '100%', height: 205 }} />
      <Card>
        <Fact label="Formato" value={formatLabel(document.mimeType) ?? document.mimeType} icon="document" />
        <Divider />
        <Fact label="Dimensione" value={documentSize(document.size)} icon="document" />
        <Divider />
        <Fact label="Aggiunto il" value={documentDate(document.addedAt)} icon="calendar-nav" />
        {linked && <><Divider /><Fact label="Intervento collegato" value={`${maintenanceLabel(linked)} · ${dateLabel(linked.date)}`} icon="wrench" /></>}
      </Card>
      <GradientButton onClick={() => openDocument(document, onError)} height={52} radius={28} style={{ width: '100%' }}><span style={{ fontWeight: 700 }}>Apri file</span></GradientButton>
      <OutlinedButton onClick={() => shareDocument(document, onError)} style={{ height: 52, borderRadius: 28, fontWeight: 600 }}>
        <Icon name="share" size={18} /><span style={{ width: 8 }} />Condividi
      </OutlinedButton>
      <Actions editLabel="Modifica documento" deleteLabel="Elimina documento"
        onEdit={() => navigate('document-editor', { vehicleId: document.vehicleId, itemId: document.id })}
        onDelete={() => confirmDelete(`Eliminare ${document.name}?`, () => {
          back()
          actions.deleteDocument(document.id).catch((e) => toast((e as Error).message))
        })} />
    </Page>
  )
}

export type { GarageDocument }
