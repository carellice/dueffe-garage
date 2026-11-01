import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { Bouncy, Icon, useGradient } from './ui.tsx'
import { spring, Stiffness, tween } from './motion.ts'
import { Amber, Gold, alpha, useDark } from '../lib/theme.ts'
import { switchTab, type Route } from '../lib/nav.ts'
import type { IconName } from '../lib/icons.gen.ts'

/** Modifier.garageBackdrop(): the theme color plus two slowly drifting warm glows. */
export function Backdrop({ children }: { children?: ReactNode }) {
  const dark = useDark()
  const glowA = dark ? alpha(Gold, 0.1) : alpha('#FFC94D', 0.22)
  const glowB = dark ? alpha(Amber, 0.07) : alpha('#FFB38A', 0.18)
  // r = maxDimension × .55 (and .8 of it); centers drift between two points over 9 s, back and forth.
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--background)', overflow: 'clip', containerType: 'size' }}>
      <motion.div style={{ position: 'absolute', width: '110cqmax', height: '110cqmax', marginLeft: '-55cqmax', marginTop: '-55cqmax', borderRadius: '50%',
        background: `radial-gradient(closest-side, ${glowA}, transparent)` }}
        initial={{ left: '85%', top: '4%' }} animate={{ left: '60%', top: '10%' }}
        transition={{ duration: 9, ease: [0.4, 0, 0.2, 1], repeat: Infinity, repeatType: 'reverse' }} />
      <motion.div style={{ position: 'absolute', width: '88cqmax', height: '88cqmax', marginLeft: '-44cqmax', marginTop: '-44cqmax', borderRadius: '50%',
        background: `radial-gradient(closest-side, ${glowB}, transparent)` }}
        initial={{ left: '8%', top: '62%' }} animate={{ left: '28%', top: '54%' }}
        transition={{ duration: 9, ease: [0.4, 0, 0.2, 1], repeat: Infinity, repeatType: 'reverse' }} />
      {children}
    </div>
  )
}

/** VehiclePlate: the Italian plate, on two lines for motorcycles and scooters. */
export function Plate({ plate, type, registrationYear }: { plate: string; type: string; registrationYear: number }) {
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

const destinations: [Route, string, IconName][] = [['garage', 'Garage', 'garageNav'], ['scadenze', 'Scadenze', 'calendarNav'], ['impostazioni', 'Impostazioni', 'settingsNav']]

/** FloatingGarageNavigation: the floating bar with the sliding gradient pill. */
export function BottomBar({ page }: { page: Route }) {
  const dark = useDark()
  const selectedIndex = Math.max(0, destinations.findIndex(([key]) => key === page))
  const pill = useGradient<HTMLDivElement>()
  return (
    <div className="nav-pad" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 5 }}>
      <div style={{ padding: '10px 22px', pointerEvents: 'none' }}>
        <div role="tablist" style={{
          pointerEvents: 'auto', position: 'relative', borderRadius: 34, padding: 6,
          background: 'color-mix(in srgb, var(--surface) 97%, transparent)', border: '1px solid var(--navHairline)',
          boxShadow: dark ? `0 12px 24px ${alpha(Gold, 0.18)}, 0 4px 10px ${alpha(Gold, 0.12)}` : '0 12px 24px rgba(0,0,0,.18), 0 4px 10px rgba(0,0,0,.12)',
        }}>
          <div style={{ position: 'relative', display: 'flex' }}>
            <motion.div ref={pill} className="accent-bg" style={{ position: 'absolute', top: 0, left: 0, width: `${100 / destinations.length}%`, height: 58, borderRadius: 28 }}
              initial={false} animate={{ x: `${selectedIndex * 100}%` }} transition={spring(0.68, Stiffness.MediumLow)} />
            {destinations.map(([key, label, icon]) => {
              const selected = key === page
              const tint = selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)'
              return (
                <Bouncy key={key} role="tab" aria-selected={selected} pressed={0.9} ripple={false} onClick={() => switchTab(key)}
                  style={{ flex: 1, height: 58, borderRadius: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <motion.div initial={false} animate={{ scale: selected ? 1.12 : 1, y: selected ? -1 : 0 }}
                    transition={{ scale: spring(0.4, Stiffness.Medium), y: spring(0.5, Stiffness.Medium) }}
                    style={{ color: tint, transition: 'color 250ms' }}>
                    <Icon name={icon} size={23} />
                  </motion.div>
                  <div style={{ height: 3 }} />
                  <span style={{ color: tint, transition: 'color 250ms', fontSize: 11, lineHeight: '16px', fontWeight: selected ? 800 : 500, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{label}</span>
                </Bouncy>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export { tween }
