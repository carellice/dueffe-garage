import { type ReactNode } from 'react'
import { VehicleImage } from './ui.tsx'
import { tween } from './motion.ts'
import { Ice, alpha, useDark } from '../lib/theme.ts'
import { fileUrl } from '../lib/store.ts'
import { icons } from '../lib/icons.gen.ts'
import type { VehicleRow } from '../../../shared/model.ts'

/** Modifier.cockpitBackdrop(): the theme colour with one faint accent glow at the top, like a lit dashboard. */
export function Backdrop({ children }: { children?: ReactNode }) {
  const dark = useDark()
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--background)', overflow: 'clip' }}>
      <div style={{ position: 'absolute', left: '-55%', right: '-55%', top: '-75vw', height: '150vw', maxHeight: 900, borderRadius: '50%',
        background: `radial-gradient(closest-side, color-mix(in srgb, var(--primary) ${dark ? 9 : 6}%, transparent), transparent)` }} />
      {children}
    </div>
  )
}

/** The car photo, or a carbon backdrop with the outline of the car; the outline scales with the box. */
export function VehiclePhoto({ v, style }: { v: VehicleRow; style?: React.CSSProperties }) {
  if (v.hasPhoto) return <VehicleImage src={fileUrl('vehicle', v.id, v.updatedAt)} style={{ width: '100%', height: '100%', ...style }} />
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', containerType: 'size', background: 'linear-gradient(135deg, #1A2230, #07090C)', ...style }}>
      <div style={{ position: 'absolute', left: '78cqw', top: '25cqh', width: '110cqw', height: '110cqw', marginLeft: '-55cqw', marginTop: '-55cqw', borderRadius: '50%',
        background: `radial-gradient(closest-side, ${alpha(Ice, 0.22)}, transparent)` }} />
      <div style={{ position: 'absolute', right: '5cqmin', top: '50%', transform: 'translateY(-50%) rotate(-6deg)', width: 'min(45cqw, 55cqh)', height: 'min(45cqw, 55cqh)', color: 'rgba(255,255,255,.14)' }}>
        <svg viewBox="0 0 24 24" width="100%" height="100%" dangerouslySetInnerHTML={{ __html: icons.car.body }} />
      </div>
    </div>
  )
}

/** VehiclePlate: the Italian plate, on two lines for motorcycles and scooters. */
export function Plate({ plate, type, registrationYear, compact = false }: { plate: string; type: string; registrationYear: number; compact?: boolean }) {
  if (compact) return (
    <span style={{ display: 'inline-block', flexShrink: 0, borderRadius: 6, background: '#F7F7F2', padding: '4px 9px 4px 14px', color: '#151515', fontSize: 14, lineHeight: '18px',
      letterSpacing: 1.8, fontWeight: 900, boxShadow: 'inset 7px 0 0 #0755AD', whiteSpace: 'nowrap' }}>{plate.toLocaleUpperCase('it-IT').replace(/\s/g, '')}</span>
  )
  const twoWheeler = type === 'motorcycle' || type === 'scooter'
  const display = plate.toLocaleUpperCase('it-IT').replace(/\s/g, '')
  const blue = '#0755AD'
  const text: React.CSSProperties = { color: '#171717', fontWeight: 900, letterSpacing: 2, fontFamily: 'Roboto' }
  const midpoint = Math.floor((display.length + 1) / 2)
  return (
    <div style={{ height: twoWheeler ? 82 : 64, width: twoWheeler ? 144 : 246, border: '2px solid #363636', borderRadius: 7, overflow: 'hidden',
      background: '#F9F9F5', display: 'flex', alignItems: 'center', alignSelf: 'center', flexShrink: 0 }}>
      <div style={{ height: '100%', width: twoWheeler ? 24 : 31, background: blue, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#FFDF58', fontSize: 13, lineHeight: '15px' }}>✦</span>
        <span style={{ color: '#FFFFFF', fontSize: 13, lineHeight: '20px', fontWeight: 900 }}>I</span>
        <span style={{ height: 3 }} />
      </div>
      <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
        {twoWheeler ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ ...text, fontSize: 23, lineHeight: '25px' }}>{display.slice(0, midpoint)}</span>
            <span style={{ ...text, fontSize: 23, lineHeight: '25px' }}>{display.slice(midpoint)}</span>
          </div>
        ) : (
          <span style={{ ...text, fontSize: display.length > 8 ? 21 : 26, lineHeight: '32px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{display}</span>
        )}
      </div>
      {!twoWheeler && (
        <div style={{ height: '100%', width: 24, background: blue, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ height: 3 }} />
          <span style={{ color: '#FFFFFF', fontSize: 10, lineHeight: '14px', fontWeight: 700 }}>{String(((registrationYear % 100) + 100) % 100).padStart(2, '0')}</span>
          <span style={{ color: '#FFFFFF', fontSize: 13, lineHeight: '18px' }}>◌</span>
          <span style={{ height: 3 }} />
        </div>
      )}
    </div>
  )
}

export { tween }
