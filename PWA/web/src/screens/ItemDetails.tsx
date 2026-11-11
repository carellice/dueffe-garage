import { motion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { AccentButton, AnimatedCount, Gauge, GhostButton, Icon, Overline, PageTopBar, Panel, Readout, ReadoutDivider, RowDivider, Stagger, StatusPill, TintBadge } from '../components/ui.tsx'
import { DocumentThumbnail } from '../components/cards.tsx'
import { ConfirmDelete } from '../components/dialogs.tsx'
import { toast } from '../components/overlays.tsx'
import { spring, Stiffness } from '../components/motion.ts'
import { deadlineFraction, documentAppearance, maintenanceAppearance, urgencyFor, useDark } from '../lib/theme.ts'
import { actions, useStore } from '../lib/store.ts'
import { back, navigate } from '../lib/nav.ts'
import { openDocument, shareDocument } from '../lib/files.ts'
import type { IconName } from '../lib/icons.gen.ts'
import { documentCategory, documentDate, documentFormat, dueReminders, intervalText, maintenanceLabel, reminderDetailStatus, reminderDueDate } from '../../../shared/logic.ts'
import { dateLabel, documentSize, euro, formatKm, groupedInt } from '../../../shared/format.ts'

// ItemDetailScreens.kt: maintenance, reminder and document details, laid out as spec sheets.

const fail = (e: Error) => toast(e.message, true)

/** Detail page frame: top bar, a header with the type badge, the content and the actions at the bottom. */
function DetailScaffold({ overline, title, subtitle, icon, accent, actions, children }: {
  overline: string; title: string; subtitle?: string; icon: IconName; accent: string; actions: ReactNode; children: ReactNode
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <PageTopBar onBack={() => back()} backLabel="Auto" />
      <div className="scroll-y" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <div style={{ padding: '8px 18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Stagger index={0} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring(0.55, Stiffness.Low)}>
              <TintBadge icon={icon} tint={accent} background={`color-mix(in srgb, ${accent} 14%, transparent)`} size={60} iconSize={28} />
            </motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Overline text={overline} color={accent} />
              <div className="clamp2" style={{ fontSize: 28, lineHeight: '32px', fontWeight: 700, letterSpacing: -0.6, wordBreak: 'break-word' }}>{title}</div>
              {subtitle && <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 14 }}>{subtitle}</div>}
            </div>
          </Stagger>
          {children}
        </div>
      </div>
      <div className="nav-pad" style={{ flexShrink: 0 }}>
        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>{actions}</div>
      </div>
    </div>
  )
}

/** A spec sheet: label on the left, value on the right, hairlines in between. */
function SpecSheet({ rows, index = 1 }: { rows: [string, string][]; index?: number }) {
  return (
    <Stagger index={index}>
      <Panel padding={0}>
        {rows.map(([label, value], i) => (
          <div key={label}>
            {i > 0 && <RowDivider inset={16} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <span style={{ flex: 1, color: 'var(--onSurfaceVariant)', fontSize: 14 }}>{label}</span>
              <span className="tnum" style={{ flex: 1.4, textAlign: 'right', fontSize: 15, fontWeight: 600, wordBreak: 'break-word' }}>{value}</span>
            </div>
          </div>
        ))}
      </Panel>
    </Stagger>
  )
}

function NotesPanel({ text }: { text: string }) {
  return (
    <Stagger index={2}>
      <Panel padding={16}>
        <Overline text="Note" />
        <div style={{ height: 8 }} />
        <div style={{ fontSize: 15, lineHeight: '22px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
      </Panel>
    </Stagger>
  )
}

function EditDelete({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <GhostButton onClick={onDelete} danger style={{ flex: 1 }}><Icon name="delete" size={18} />Elimina</GhostButton>
      <AccentButton onClick={onEdit} style={{ flex: 1 }}><Icon name="edit" size={18} />Modifica</AccentButton>
    </div>
  )
}

export function MaintenanceDetail({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const [confirm, setConfirm] = useState(false)
  const maintenance = state.maintenances.find((m) => m.id === id)
  if (!maintenance) return null
  const reminder = state.reminders.find((r) => r.maintenanceId === maintenance.id)
  const appearance = maintenanceAppearance(maintenance.type, dark)
  const reminderRows: [string, string][] = []
  if (reminder?.dueDate.trim()) reminderRows.push(['Scadenza', dateLabel(reminder.dueDate)])
  if (reminder?.mileageThreshold != null) reminderRows.push(['Soglia', formatKm(reminder.mileageThreshold)])
  if (reminder?.type === 'interval' && reminder.intervalValue != null) reminderRows.push(['Ripetizione', intervalText(reminder.intervalValue, reminder.intervalUnit)])
  return (
    <DetailScaffold overline="Intervento" title={maintenanceLabel(maintenance)} icon={appearance.icon} accent={appearance.tint}
      actions={<EditDelete onEdit={() => navigate('maintenance-editor', { vehicleId: maintenance.vehicleId, id: maintenance.id })} onDelete={() => setConfirm(true)} />}>
      <Stagger index={1}>
        <Panel padding={16} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Readout label="Costo"><AnimatedCount value={maintenance.cost} format={euro} /></Readout>
          <ReadoutDivider />
          <Readout label="Chilometri"><AnimatedCount value={maintenance.mileage} format={groupedInt} /></Readout>
        </Panel>
      </Stagger>
      <SpecSheet rows={[['Data', dateLabel(maintenance.date)], ['Tipo', appearance.label]]} />
      {maintenance.notes.trim() && <NotesPanel text={maintenance.notes} />}
      {reminder && reminderRows.length > 0 && <>
        <Overline text="Promemoria attivo" style={{ padding: '4px 4px 0' }} />
        <SpecSheet rows={reminderRows} index={3} />
      </>}
      <ConfirmDelete text={confirm ? 'Eliminare questo intervento e il suo promemoria?' : null} onDismiss={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); back(); actions.deleteMaintenance(maintenance.id).catch(fail) }} />
    </DetailScaffold>
  )
}

export function ReminderDetail({ id }: { id: string }) {
  const state = useStore((s) => s.data)!
  const dark = useDark()
  const [confirm, setConfirm] = useState(false)
  const due = useMemo(() => dueReminders(state).find((d) => d.reminder.id === id), [state, id])
  if (!due) return null
  const appearance = maintenanceAppearance(due.maintenance.type, dark)
  const urgency = urgencyFor(due.days, dark)
  const date = reminderDueDate(due)
  const mileage = due.reminder.type === 'mileage' && due.kmLeft != null
  const big = mileage ? groupedInt(Math.max(due.kmLeft!, 0)) : due.days != null ? String(Math.abs(due.days)) : '—'
  const unit = mileage ? 'km' : due.days != null && due.days < 0 ? 'giorni fa' : 'giorni'
  const rows: [string, string][] = []
  if (date.trim()) rows.push(['Data di scadenza', dateLabel(date)])
  if (due.reminder.mileageThreshold != null) rows.push(['Soglia chilometrica', formatKm(due.reminder.mileageThreshold)])
  if (due.reminder.type === 'interval' && due.reminder.intervalValue != null) rows.push(['Ripetizione', intervalText(due.reminder.intervalValue, due.reminder.intervalUnit)])
  rows.push(['Ultimo intervento', dateLabel(due.maintenance.date)], ['Km registrati', formatKm(due.maintenance.mileage)])
  return (
    <DetailScaffold overline="Scadenza" title={maintenanceLabel(due.maintenance)} subtitle={due.vehicle.name} icon={appearance.icon} accent={urgency.color}
      actions={<EditDelete onEdit={() => navigate('maintenance-editor', { vehicleId: due.maintenance.vehicleId, id: due.maintenance.id })} onDelete={() => setConfirm(true)} />}>
      <Stagger index={1}>
        <Panel padding={20} style={{ alignItems: 'center' }}>
          <Gauge fraction={deadlineFraction(due.days)} color={urgency.color} size={150} stroke={8}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span className="tnum" style={{ fontSize: 38, lineHeight: '44px', fontWeight: 700, color: urgency.color, letterSpacing: -1 }}>{big}</span>
              <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13 }}>{unit}</span>
            </div>
          </Gauge>
          <div style={{ height: 8 }} />
          <StatusPill label={reminderDetailStatus(due)} color={urgency.color} />
        </Panel>
      </Stagger>
      <SpecSheet rows={rows} index={2} />
      {due.maintenance.notes.trim() && <NotesPanel text={due.maintenance.notes} />}
      <ConfirmDelete text={confirm ? "Eliminare questa scadenza? L'intervento resterà nel diario." : null} onDismiss={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); back(); actions.deleteReminder(due.reminder.id).catch(fail) }} />
    </DetailScaffold>
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
  const rows: [string, string][] = [['Formato', documentFormat(document)], ['Dimensione', documentSize(document.size)], ['Aggiunto il', documentDate(document.addedAt)]]
  if (linked) rows.push(['Intervento', `${maintenanceLabel(linked)} · ${dateLabel(linked.date)}`])
  return (
    <DetailScaffold overline="Documento" title={document.name} subtitle={appearance.label} icon="document" accent="var(--primary)"
      actions={<>
        <div style={{ display: 'flex', gap: 10 }}>
          <GhostButton onClick={() => shareDocument(document)} style={{ flex: 1 }}><Icon name="share" size={18} />Condividi</GhostButton>
          <AccentButton onClick={() => openDocument(document)} style={{ flex: 1 }}>Apri file</AccentButton>
        </div>
        <EditDelete onEdit={() => navigate('document-editor', { vehicleId: document.vehicleId, id: document.id })} onDelete={() => setConfirm(true)} />
      </>}>
      <Stagger index={1}>
        <div onClick={() => openDocument(document)} className="tap" role="button" aria-label="Apri file">
          <DocumentThumbnail document={document} category={category} style={{ width: '100%', height: 230, borderRadius: 20 }} />
        </div>
      </Stagger>
      <SpecSheet rows={rows} index={2} />
      <ConfirmDelete text={confirm ? `Eliminare ${document.name}?` : null} onDismiss={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); back(); actions.deleteDocument(document.id).catch(fail) }} />
    </DetailScaffold>
  )
}
