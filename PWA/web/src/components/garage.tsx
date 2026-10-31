import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import {
  dateLabel, formatKm, maintenanceLabel, reminderDueDate, reminderStatus, reminderSubtitle, type DueReminder,
} from '../../../shared/model.ts'
import { alpha, maintenanceAppearance, urgencyFor, useIsDark } from '../lib/theme.ts'
import { vehiclePhotoUrl } from '../lib/files.ts'
import { GradientIcon, Icon, Pressable } from './ui.tsx'

// Pieces shared by several screens of Screens.kt and HomeScreens.kt.

/** VehicleImage: the photo, cropped to fill. */
export function VehicleImage({ vehicle, style }: { vehicle: { id: string; updatedAt: string; hasPhoto: boolean }; style?: CSSProperties }) {
  if (!vehicle.hasPhoto) return null
  return (
    <div style={{ borderRadius: 18, background: 'var(--background)', overflow: 'hidden', ...style }}>
      <img src={vehiclePhotoUrl(vehicle)} alt="Foto auto" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

/** A circle with the type icon, tinted like maintenanceAppearance. */
export function TypeBadge({ type, size, iconSize }: { type: string; size: number; iconSize: number }) {
  const a = maintenanceAppearance(type, useIsDark())
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: a.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={a.icon} size={iconSize} color={a.tint} />
    </div>
  )
}

export function Chip({ label, tint, background, radius = 15, padding = '2px 9px', fontSize = 11 }: { label: string; tint: string; background: string; radius?: number; padding?: string; fontSize?: number }) {
  return (
    <span style={{ alignSelf: 'flex-start', borderRadius: radius, background, padding, color: tint, fontSize, lineHeight: '16px', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
  )
}

/** MaintenanceIcon: the small round icon at the start of the form fields. */
export function FieldIcon({ icon }: { icon: string }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surfaceContainerHigh)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={icon} size={19} color="var(--primary)" />
    </div>
  )
}

/** ReminderListCard: a deadline with its urgency, pulsing border when overdue. */
export function ReminderListCard({ item, showVehicle = false, onClick }: { item: DueReminder; showVehicle?: boolean; onClick: () => void }) {
  const dark = useIsDark()
  const appearance = maintenanceAppearance(item.maintenance.type, dark)
  const dueDate = reminderDueDate(item)
  const urgency = urgencyFor(item.days, dark)
  const urgent = (item.days ?? Number.MAX_SAFE_INTEGER) < 0
  const muted = 'var(--onSurfaceVariant)'
  const title = item.maintenance.type === 'service' ? 'Tagliando periodico' : item.maintenance.type === 'tax' ? 'Bollo auto' : maintenanceLabel(item.maintenance)
  return (
    <Pressable onClick={onClick} label={`Apri scadenza ${appearance.label}`} style={{
      borderRadius: 22, background: 'var(--surface)', padding: '13px 12px 13px 16px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: urgency.color }} />
      {urgent
        ? <motion.div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: `1px solid ${urgency.color}`, pointerEvents: 'none' }}
            initial={{ opacity: 0.25 + 0.35 * 0.35 }} animate={{ opacity: 0.6 }} transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], repeat: Infinity, repeatType: 'reverse' }} />
        : <div style={{ position: 'absolute', inset: 0, borderRadius: 22, border: '1px solid var(--outline)', opacity: 0.1, pointerEvents: 'none' }} />}
      <TypeBadge type={item.maintenance.type} size={54} iconSize={27} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {showVehicle
          ? <span className="ellipsis" style={{ color: 'var(--primary)', fontSize: 10, letterSpacing: 1.5, fontWeight: 900, lineHeight: '24px' }}>{item.vehicle.name.toLocaleUpperCase('it-IT')}</span>
          : <Chip label={appearance.label} tint={appearance.tint} background={appearance.background} />}
        <span className="clamp2" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span className="ellipsis" style={{ color: muted, fontSize: 12 }}>{reminderSubtitle(item)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: muted, fontSize: 11, whiteSpace: 'nowrap' }}>
          {dueDate.trim() !== '' && <><Icon name="calendar-nav" size={14} /><span>{dateLabel(dueDate)}</span></>}
          {item.kmLeft != null && item.reminder.type !== 'mileage'
            ? <><span style={{ fontSize: 11 }}>·</span><Icon name="speedometer" size={14} /><span>{item.reminder.mileageThreshold != null ? formatKm(item.reminder.mileageThreshold) : ''}</span></>
            : item.reminder.type === 'mileage' && item.reminder.mileageThreshold != null
              ? <><Icon name="speedometer" size={14} /><span>{formatKm(item.reminder.mileageThreshold)}</span></>
              : null}
        </div>
      </div>
      <div style={{ borderRadius: 24, background: alpha(urgency.color, 0.14), padding: '8px 9px', display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
        <Icon name="clock" size={15} color={urgency.color} />
        <span style={{ color: urgency.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{reminderStatus(item)}</span>
      </div>
    </Pressable>
  )
}

/** Maintenance/Reminder/Document filter pill: secondaryContainer when selected. */
export function FilterPill({ label, icon, selected, onClick, radius = 13, padding = 14, iconSize = 20, iconTint }: {
  label: string; icon?: string; selected: boolean; onClick: () => void; radius?: number; padding?: number; iconSize?: number; iconTint?: string
}) {
  return (
    <Pressable onClick={onClick} style={{
      height: 43, borderRadius: radius, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: `0 ${padding}px`,
      background: selected ? 'var(--secondaryContainer)' : 'var(--surface)',
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none', border: selected ? '1px solid var(--secondaryContainer)' : '1px solid color-mix(in srgb, var(--outline) 38%, transparent)' }} />
      {icon && <Icon name={icon} size={iconSize} color={iconTint ?? 'var(--onSurfaceVariant)'} />}
      <span style={{ fontSize: 13, whiteSpace: 'nowrap', color: selected ? 'var(--onSecondaryContainer)' : 'var(--onSurfaceVariant)', fontWeight: selected ? 700 : 500 }}>{label}</span>
    </Pressable>
  )
}

/** DetailEmptyState of the vehicle diary. */
export function DetailEmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ borderRadius: 23, background: 'var(--surface)', padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <GradientIcon icon="document" size={56} iconSize={27} />
      <div style={{ height: 9 }} />
      <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
      <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', textAlign: 'center' }}>{subtitle}</span>
    </div>
  )
}

export function Column({ children, gap = 0, style }: { children: ReactNode; gap?: number; style?: CSSProperties }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>{children}</div>
}
