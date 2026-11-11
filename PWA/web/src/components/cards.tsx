import { useState, type CSSProperties } from 'react'
import { Bouncy, Gauge, Icon, Panel, RowDivider, Tap, TintBadge } from './ui.tsx'
import { Menu } from './overlays.tsx'
import { deadlineFraction, documentAppearance, maintenanceAppearance, urgencyFor, useDark } from '../lib/theme.ts'
import { fileUrl } from '../lib/store.ts'
import type { DueReminder, GarageDocument, Maintenance } from '../../../shared/model.ts'
import { documentDate, documentFormat, maintenanceLabel, reminderDueDate, reminderStatus, reminderSubtitle } from '../../../shared/logic.ts'
import { dateLabel, euro, euroRounded, formatKm } from '../../../shared/format.ts'

const muted = 'var(--onSurfaceVariant)'

/** DeadlineRow: a gauge that fills as the date approaches, what it is, the car and how long is left. */
export function DeadlineRow({ item, showVehicle, onClick }: { item: DueReminder; showVehicle: boolean; onClick: () => void }) {
  const dark = useDark()
  const appearance = maintenanceAppearance(item.maintenance.type, dark)
  const urgency = urgencyFor(item.days, dark)
  const date = reminderDueDate(item)
  const threshold = item.reminder.type !== 'date' && item.reminder.type !== 'interval' ? item.reminder.mileageThreshold : null
  const detail = [showVehicle ? item.vehicle.name : '', date ? dateLabel(date) : '', threshold != null ? formatKm(threshold) : ''].filter(Boolean).join(' · ')
  return (
    <Bouncy onClick={onClick} label={`Apri scadenza ${appearance.label}`} pressed={0.985} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 12 }}>
      <Gauge fraction={deadlineFraction(item.days)} color={urgency.color} size={46} stroke={3.5}>
        <Icon name={appearance.icon} size={20} color={urgency.color} />
      </Gauge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ellipsis" style={{ fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>{maintenanceLabel(item.maintenance)}</div>
        <div className="ellipsis" style={{ color: muted, fontSize: 13, lineHeight: '18px' }}>{detail || reminderSubtitle(item)}</div>
      </div>
      <div className="tnum" style={{ color: urgency.color, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{reminderStatus(item)}</div>
    </Bouncy>
  )
}

/** A grouped list of deadlines inside one panel. */
export function DeadlineGroup({ items, showVehicle, onClick }: { items: DueReminder[]; showVehicle: boolean; onClick: (d: DueReminder) => void }) {
  return (
    <Panel padding={0} style={{ overflow: 'hidden' }}>
      {items.map((d, i) => (
        <div key={d.reminder.id}>
          {i > 0 && <RowDivider />}
          <DeadlineRow item={d} showVehicle={showVehicle} onClick={() => onClick(d)} />
        </div>
      ))}
    </Panel>
  )
}

/** One intervention of the history: type badge, date and km, cost. */
export function MaintenanceRow({ maintenance, onOpen }: { maintenance: Maintenance; onOpen: () => void }) {
  const dark = useDark()
  const appearance = maintenanceAppearance(maintenance.type, dark)
  const note = maintenance.notes.split(/\r\n|\r|\n/)[0].trim()
  const line = [dateLabel(maintenance.date), formatKm(maintenance.mileage), note].filter(Boolean).join(' · ')
  return (
    <Bouncy onClick={onOpen} label="Apri dettaglio intervento" pressed={0.985} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 12 }}>
      <TintBadge icon={appearance.icon} tint={appearance.tint} background={appearance.background} size={46} iconSize={22} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ellipsis" style={{ fontSize: 16, lineHeight: '22px', fontWeight: 600 }}>{maintenanceLabel(maintenance)}</div>
        <div className="ellipsis" style={{ color: muted, fontSize: 13, lineHeight: '18px' }}>{line}</div>
      </div>
      <div className="tnum" style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{maintenance.cost % 1 ? euro(maintenance.cost) : euroRounded(maintenance.cost).replace('€', '€ ')}</div>
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
        ? <img src={fileUrl('document', document.id, document.updatedAt)} alt="" draggable={false} decoding="async" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Icon name="document" size={iconSize} color={appearance.tint} />}
    </div>
  )
}

/** A document as a tile with its preview; the ⋮ button holds the quick actions. */
export function DocumentTile({ document, category, onOpen, onShare, onRename, onDelete }: {
  document: GarageDocument; category: string; onOpen: () => void; onShare: () => void; onRename: () => void; onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <Bouncy onClick={onOpen} label={`Apri ${document.name}`} style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
        <DocumentThumbnail document={document} category={category} style={{ width: '100%', height: 112, borderRadius: 0 }} />
        <div style={{ padding: '10px 12px' }}>
          <div className="ellipsis" style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600 }}>{document.name}</div>
          <div className="ellipsis" style={{ color: muted, fontSize: 12, lineHeight: '16px' }}>{`${documentFormat(document)} · ${documentDate(document.addedAt)}`}</div>
        </div>
      </Bouncy>
      <div ref={setAnchor} style={{ position: 'absolute', top: 6, right: 6 }}>
        <Tap onClick={() => setMenu(true)} label="Altre azioni" ripple="#FFFFFF" style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,.45)', color: '#FFFFFF' }}>
          <Icon name="more" size={18} />
        </Tap>
      </div>
      <Menu open={menu} anchor={anchor} onDismiss={() => setMenu(false)} items={[
        { label: 'Condividi', onClick: () => { setMenu(false); onShare() } },
        { label: 'Rinomina', onClick: () => { setMenu(false); onRename() } },
        { label: 'Elimina', onClick: () => { setMenu(false); onDelete() } },
      ]} />
    </div>
  )
}
