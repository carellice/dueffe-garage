import { motion } from 'framer-motion'
import { useState, type CSSProperties } from 'react'
import { Bouncy, Icon, Tap } from './ui.tsx'
import { Menu } from './overlays.tsx'
import { alpha, documentAppearance, maintenanceAppearance, urgencyFor, useDark } from '../lib/theme.ts'
import { fileUrl } from '../lib/store.ts'
import type { DueReminder, GarageDocument, Maintenance } from '../../../shared/model.ts'
import { documentDate, documentFormat, maintenanceLabel, reminderDueDate, reminderStatus, reminderSubtitle } from '../../../shared/logic.ts'
import { dateLabel, documentSize, euro, formatKm } from '../../../shared/format.ts'

const muted = 'var(--onSurfaceVariant)'

function TypeBadge({ label, tint, background, radius = 15, padding = '2px 9px' }: { label: string; tint: string; background: string; radius?: number; padding?: string }) {
  return (
    <span style={{ alignSelf: 'flex-start', borderRadius: radius, background, padding, color: tint, fontSize: 11, lineHeight: '16px', fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{label}</span>
  )
}

/** ReminderListCard of Screens.kt. */
export function ReminderCard({ item, showVehicle = false, onClick, style }: { item: DueReminder; showVehicle?: boolean; onClick: () => void; style?: CSSProperties }) {
  const dark = useDark()
  const appearance = maintenanceAppearance(item.maintenance.type, dark)
  const dueDate = reminderDueDate(item)
  const urgency = urgencyFor(item.days, dark)
  const urgent = (item.days ?? Number.MAX_SAFE_INTEGER) < 0
  const title = item.maintenance.type === 'service' ? 'Tagliando periodico' : item.maintenance.type === 'tax' ? 'Bollo auto' : maintenanceLabel(item.maintenance)
  return (
    <Bouncy onClick={onClick} label={`Apri scadenza ${appearance.label}`} style={{
      borderRadius: 22, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 12px 13px 16px',
      position: 'relative', ...style,
    }}>
      <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: urgency.color }} />
      {urgent ? (
        <motion.div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 22, border: `1px solid ${urgency.color}`, pointerEvents: 'none' }}
          initial={{ opacity: 0.25 + 0.35 * 0.35 }} animate={{ opacity: 0.6 }} transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], repeat: Infinity, repeatType: 'reverse' }} />
      ) : (
        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 22, border: '1px solid color-mix(in srgb, var(--outline) 10%, transparent)', pointerEvents: 'none' }} />
      )}
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: appearance.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={appearance.icon} size={27} color={appearance.tint} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {showVehicle
          ? <div className="ellipsis" style={{ color: 'var(--primary)', fontSize: 10, lineHeight: '16px', letterSpacing: 1.5, fontWeight: 900 }}>{item.vehicle.name.toLocaleUpperCase('it-IT')}</div>
          : <TypeBadge label={appearance.label} tint={appearance.tint} background={appearance.background} />}
        <div className="clamp2" style={{ fontSize: 15, lineHeight: '20px', fontWeight: 700, letterSpacing: 0.15 }}>{title}</div>
        <div className="ellipsis" style={{ color: muted, fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{reminderSubtitle(item)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {dueDate && <>
            <Icon name="calendarNav" size={14} color={muted} />
            <span style={{ color: muted, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{dateLabel(dueDate)}</span>
          </>}
          {item.kmLeft != null && item.reminder.type !== 'mileage' ? <>
            <span style={{ color: muted, fontSize: 11, lineHeight: '16px' }}>·</span>
            <Icon name="speedometer" size={14} color={muted} />
            <span style={{ color: muted, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{item.reminder.mileageThreshold != null ? formatKm(item.reminder.mileageThreshold) : ''}</span>
          </> : item.reminder.type === 'mileage' && item.reminder.mileageThreshold != null ? <>
            <Icon name="speedometer" size={14} color={muted} />
            <span style={{ color: muted, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{formatKm(item.reminder.mileageThreshold)}</span>
          </> : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 24, background: alpha(urgency.color, 0.14), padding: '8px 9px', flexShrink: 0 }}>
        <Icon name="clock" size={15} color={urgency.color} />
        <span style={{ color: urgency.color, fontSize: 11, lineHeight: '16px', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{reminderStatus(item)}</span>
      </div>
    </Bouncy>
  )
}

/** MaintenanceListCard of Screens.kt. */
export function MaintenanceCard({ maintenance, onOpen }: { maintenance: Maintenance; onOpen: () => void }) {
  const dark = useDark()
  const appearance = maintenanceAppearance(maintenance.type, dark)
  const title = maintenance.type === 'inspection' ? 'Revisione periodica' : maintenance.type === 'tax' ? 'Bollo auto' : maintenanceLabel(maintenance)
  return (
    <Bouncy onClick={onOpen} label="Apri dettaglio intervento" style={{ borderRadius: 22, background: 'var(--surface)', padding: '14px 15px', display: 'flex', alignItems: 'center' }}>
      <div style={{ width: 58, height: 58, borderRadius: '50%', background: appearance.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={appearance.icon} size={31} color={appearance.tint} />
      </div>
      <div style={{ width: 12 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <TypeBadge label={appearance.label} tint={appearance.tint} background={appearance.background} radius={18} padding="3px 10px" />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 900, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{euro(maintenance.cost)}</span>
        </div>
        <div className="ellipsis" style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700, letterSpacing: 0.5 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="calendarNav" size={14} color={muted} />
          <span style={{ color: muted, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{dateLabel(maintenance.date)}</span>
          <span style={{ color: muted, fontSize: 12, lineHeight: '16px' }}>·</span>
          <Icon name="speedometer" size={14} color={muted} />
          <span style={{ color: muted, fontSize: 11, lineHeight: '16px', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{formatKm(maintenance.mileage)}</span>
        </div>
        {maintenance.notes.trim() && (
          <div className="ellipsis" style={{ color: 'color-mix(in srgb, var(--onSurfaceVariant) 72%, transparent)', fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>
            {maintenance.notes.split(/\r\n|\r|\n/)[0]}
          </div>
        )}
      </div>
    </Bouncy>
  )
}

/** DocumentThumbnail: the image itself, or the document icon (PDF pages are not rendered on the web). */
export function DocumentThumbnail({ document, category, style, iconSize = 32 }: { document: GarageDocument; category: string; style?: CSSProperties; iconSize?: number }) {
  const dark = useDark()
  const appearance = documentAppearance(category, dark)
  const [failed, setFailed] = useState(false)
  const image = document.mimeType.startsWith('image/') && !failed
  return (
    <div style={{ width: 72, height: 72, borderRadius: 13, overflow: 'hidden', background: appearance.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}>
      {image
        ? <img src={fileUrl('document', document.id, document.updatedAt)} alt="" draggable={false} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Icon name="document" size={iconSize} color={appearance.tint} />}
    </div>
  )
}

/** DocumentListCard of Screens.kt. */
export function DocumentCard({ document, category, onOpen, onShare, onRename, onDelete }: {
  document: GarageDocument; category: string; onOpen: () => void; onShare: () => void; onRename: () => void; onDelete: () => void
}) {
  const dark = useDark()
  const appearance = documentAppearance(category, dark)
  const [menu, setMenu] = useState(false)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  return (
    <Bouncy onClick={onOpen} label={`Apri ${document.name}`} style={{ borderRadius: 22, background: 'var(--surface)', padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <DocumentThumbnail document={document} category={category} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TypeBadge label={appearance.label} tint={appearance.tint} background={appearance.background} radius={16} />
        <div className="clamp2" style={{ fontSize: 15, lineHeight: '20px', fontWeight: 700, letterSpacing: 0.15, wordBreak: 'break-word' }}>{document.name}</div>
        <div style={{ color: muted, fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{`${documentFormat(document)} · ${documentSize(document.size)}`}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="calendarNav" size={15} color={muted} />
          <span style={{ color: muted, fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{documentDate(document.addedAt)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div ref={setAnchor}>
          <Tap onClick={() => setMenu(true)} label="Altre azioni" style={{ width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
            <Icon name="more" size={20} />
          </Tap>
        </div>
        <Tap onClick={onShare} style={{ minHeight: 40, borderRadius: 20, display: 'flex', alignItems: 'center', color: 'var(--primary)', fontSize: 12, fontWeight: 500, letterSpacing: 0.1 }}>
          <Icon name="share" size={19} />
          <span style={{ width: 4 }} />
          Condividi
        </Tap>
        <Menu open={menu} anchor={anchor} onDismiss={() => setMenu(false)} items={[
          { label: 'Rinomina', onClick: () => { setMenu(false); onRename() } },
          { label: 'Elimina', onClick: () => { setMenu(false); onDelete() } },
        ]} />
      </div>
    </Bouncy>
  )
}
