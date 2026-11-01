import { motion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { BackButton, Divider, GlassCard, GradientButton, Icon, OutlinedButton, Stagger } from '../components/ui.tsx'
import { DocumentThumbnail } from '../components/cards.tsx'
import { ConfirmDelete } from '../components/dialogs.tsx'
import { toast } from '../components/overlays.tsx'
import { spring, Stiffness } from '../components/motion.ts'
import { documentAppearance, maintenanceAppearance, useDark, type Appearance } from '../lib/theme.ts'
import { actions, useStore } from '../lib/store.ts'
import { back, navigate } from '../lib/nav.ts'
import { openDocument, shareDocument } from '../lib/files.ts'
import type { IconName } from '../lib/icons.gen.ts'
import { documentCategory, documentDate, dueReminders, intervalText, maintenanceLabel, reminderDetailStatus, reminderDueDate, reminderSubtitle } from '../../../shared/logic.ts'
import { dateLabel, documentSize, euro, formatKm } from '../../../shared/format.ts'

// ItemDetailScreens.kt: maintenance, reminder and document details.

function Header({ section, title, subtitle, appearance }: { section: string; title: string; subtitle: string; appearance: Appearance }) {
  return (
    <div>
      <div className="kicker" style={{ color: 'var(--primary)', letterSpacing: 2 }}>{section.toLocaleUpperCase('it-IT')}</div>
      <div style={{ height: 3 }} />
      <div style={{ fontSize: 33, lineHeight: '36px', fontWeight: 900, letterSpacing: -0.5, wordBreak: 'break-word' }}>{title}</div>
      <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 15, lineHeight: '24px', letterSpacing: 0.5 }}>{subtitle}</div>
      <div style={{ height: 6 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring(0.45, Stiffness.Low)}
          style={{ width: 62, height: 62, borderRadius: '50%', background: appearance.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={appearance.icon} size={31} color={appearance.tint} />
        </motion.div>
        <span style={{ color: appearance.tint, fontWeight: 700, background: appearance.background, borderRadius: 18, padding: '7px 12px', fontSize: 16, lineHeight: '24px', letterSpacing: 0.5 }}>{appearance.label}</span>
      </div>
    </div>
  )
}

function Fact({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0' }}>
      <div style={{ width: 39, height: 39, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={21} color="var(--primary)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 10, lineHeight: '16px', letterSpacing: 1 }}>{label.toLocaleUpperCase('it-IT')}</div>
        <div style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, letterSpacing: 0.5, wordBreak: 'break-word' }}>{value}</div>
      </div>
    </div>
  )
}

const Card = ({ children }: { children: ReactNode }) => <Stagger index={2}><GlassCard padding={17}>{children}</GlassCard></Stagger>
const CardTitle = ({ text }: { text: string }) => <div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700, letterSpacing: 0.5 }}>{text}</div>
const Line = () => <Divider style={{ background: 'color-mix(in srgb, var(--outline) 18%, transparent)' }} />

function Actions({ onEdit, onDelete, editLabel, deleteLabel }: { onEdit: () => void; onDelete: () => void; editLabel: string; deleteLabel: string }) {
  return <>
    <GradientButton onClick={onEdit} height={52}>
      <Icon name="edit" size={19} /><span style={{ width: 8 }} /><span style={{ fontWeight: 700 }}>{editLabel}</span>
    </GradientButton>
    <OutlinedButton onClick={onDelete} height={52} radius={28} color="var(--error)">
      <Icon name="delete" size={19} /><span style={{ width: 8 }} /><span style={{ fontWeight: 600 }}>{deleteLabel}</span>
    </OutlinedButton>
  </>
}

const Page = ({ children }: { children: ReactNode }) => (
  <div className="scroll status-pad">
    <div style={{ padding: 18, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 15 }}>{children}</div>
  </div>
)

const fail = (e: Error) => toast(e.message, true)

export function MaintenanceDetail({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const [confirm, setConfirm] = useState(false)
  const maintenance = state.maintenances.find((m) => m.id === id)
  if (!maintenance) return null
  const reminder = state.reminders.find((r) => r.maintenanceId === maintenance.id)
  const appearance = maintenanceAppearance(maintenance.type, dark)
  return (
    <Page>
      <BackButton label="Interventi" onClick={() => back()} />
      <Header section="Intervento" title={maintenanceLabel(maintenance)} subtitle="Dettagli e manutenzione della tua auto" appearance={appearance} />
      <Card>
        <Fact label="Data intervento" value={dateLabel(maintenance.date)} icon="calendarNav" />
        <Line />
        <Fact label="Chilometri" value={formatKm(maintenance.mileage)} icon="speedometer" />
        <Line />
        <Fact label="Costo" value={euro(maintenance.cost)} icon="coins" />
      </Card>
      {maintenance.notes.trim() && (
        <Card>
          <CardTitle text="Note" />
          <div style={{ height: 8 }} />
          <div style={{ color: 'var(--onSurfaceVariant)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{maintenance.notes}</div>
        </Card>
      )}
      {reminder && (
        <Card>
          <CardTitle text="Promemoria attivo" />
          {reminder.dueDate.trim() && <Fact label="Scadenza" value={dateLabel(reminder.dueDate)} icon="calendarNav" />}
          {reminder.mileageThreshold != null && <Fact label="Soglia chilometrica" value={formatKm(reminder.mileageThreshold)} icon="speedometer" />}
        </Card>
      )}
      <Actions editLabel="Modifica intervento" deleteLabel="Elimina intervento"
        onEdit={() => navigate('maintenance-editor', { vehicleId: maintenance.vehicleId, id: maintenance.id })} onDelete={() => setConfirm(true)} />
      <ConfirmDelete text={confirm ? 'Eliminare questo intervento e il suo promemoria?' : null} onDismiss={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); back(); actions.deleteMaintenance(maintenance.id).catch(fail) }} />
    </Page>
  )
}

export function ReminderDetail({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const [confirm, setConfirm] = useState(false)
  const due = useMemo(() => dueReminders(state).find((d) => d.reminder.id === id), [state, id])
  if (!due) return null
  const appearance = maintenanceAppearance(due.maintenance.type, dark)
  const date = reminderDueDate(due)
  return (
    <Page>
      <BackButton label="Scadenze" onClick={() => back()} />
      <Header section="Scadenza" title={maintenanceLabel(due.maintenance)} subtitle={reminderSubtitle(due)} appearance={appearance} />
      <Card>
        <Fact label="Stato" value={reminderDetailStatus(due)} icon="clock" />
        {date.trim() && <><Line /><Fact label="Data di scadenza" value={dateLabel(date)} icon="calendarNav" /></>}
        {due.reminder.mileageThreshold != null && <><Line /><Fact label="Soglia chilometrica" value={formatKm(due.reminder.mileageThreshold)} icon="speedometer" /></>}
        {due.reminder.type === 'interval' && due.reminder.intervalValue != null && <><Line /><Fact label="Intervallo" value={intervalText(due.reminder.intervalValue, due.reminder.intervalUnit)} icon="repeat" /></>}
      </Card>
      <Card>
        <CardTitle text="Intervento collegato" />
        <Fact label="Registrato il" value={dateLabel(due.maintenance.date)} icon="calendarNav" />
        <Fact label="Chilometri registrati" value={formatKm(due.maintenance.mileage)} icon="speedometer" />
      </Card>
      <Actions editLabel="Modifica scadenza" deleteLabel="Elimina scadenza"
        onEdit={() => navigate('maintenance-editor', { vehicleId: due.maintenance.vehicleId, id: due.maintenance.id })} onDelete={() => setConfirm(true)} />
      <ConfirmDelete text={confirm ? "Eliminare questa scadenza? L'intervento resterà nel diario." : null} onDismiss={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); back(); actions.deleteReminder(due.reminder.id).catch(fail) }} />
    </Page>
  )
}

export function DocumentDetail({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const [confirm, setConfirm] = useState(false)
  const document = state.documents.find((d) => d.id === id)
  if (!document) return null
  const linked = state.maintenances.find((m) => m.id === document.maintenanceId)
  const category = documentCategory(document, linked ? [linked] : [])
  const appearance = documentAppearance(category, dark)
  const format = document.mimeType === 'application/pdf' ? 'PDF' : document.mimeType === 'image/jpeg' ? 'JPG' : document.mimeType === 'image/png' ? 'PNG' : document.mimeType
  return (
    <Page>
      <BackButton label="Documenti" onClick={() => back()} />
      <Header section="Documento" title={document.name} subtitle="Una copia sempre a portata di mano" appearance={appearance} />
      <DocumentThumbnail document={document} category={category} style={{ width: '100%', height: 205 }} />
      <Card>
        <Fact label="Formato" value={format} icon="document" />
        <Line />
        <Fact label="Dimensione" value={documentSize(document.size)} icon="document" />
        <Line />
        <Fact label="Aggiunto il" value={documentDate(document.addedAt)} icon="calendarNav" />
        {linked && <><Line /><Fact label="Intervento collegato" value={`${maintenanceLabel(linked)} · ${dateLabel(linked.date)}`} icon="wrench" /></>}
      </Card>
      <GradientButton onClick={() => openDocument(document)} height={52}><span style={{ fontWeight: 700 }}>Apri file</span></GradientButton>
      <OutlinedButton onClick={() => shareDocument(document)} height={52} radius={28}>
        <Icon name="share" size={18} /><span style={{ width: 8 }} /><span style={{ fontWeight: 600 }}>Condividi</span>
      </OutlinedButton>
      <Actions editLabel="Modifica documento" deleteLabel="Elimina documento"
        onEdit={() => navigate('document-editor', { vehicleId: document.vehicleId, id: document.id })} onDelete={() => setConfirm(true)} />
      <ConfirmDelete text={confirm ? `Eliminare ${document.name}?` : null} onDismiss={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); back(); actions.deleteDocument(document.id).catch(fail) }} />
    </Page>
  )
}
