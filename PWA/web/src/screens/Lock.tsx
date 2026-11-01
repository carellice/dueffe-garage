import { animate, motion, useMotionValue } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Bouncy, TextButton } from '../components/ui.tsx'
import { Backdrop } from '../components/garage.tsx'
import { fastOutSlowIn, spring, Stiffness } from '../components/motion.ts'
import { Gold, alpha, useDark } from '../lib/theme.ts'
import { useStore } from '../lib/store.ts'
import { verifyPin } from '../lib/pin.ts'
import { unlockWithDevice } from '../lib/deviceLock.ts'
import { unlock } from '../lib/lock.ts'

/** GarageLockScreen of HomeScreens.kt. */
export function Lock() {
  const dark = useDark()
  const settings = useStore((s) => s.settings)
  const pinLength = settings.pinLength >= 4 && settings.pinLength <= 8 ? settings.pinLength : 0
  const biometric = !!settings.lockCredential
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const failures = useRef(0)
  const blockedUntil = useRef(0)
  const checking = useRef(false)
  const shake = useMotionValue(0)

  const tryBiometric = async () => {
    if (await unlockWithDevice(settings.lockCredential)) unlock()
  }
  useEffect(() => { if (biometric) tryBiometric() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shakeIt = () => {
    shake.set(0)
    animate(shake, [0, -18, 16, -12, 8, -4, 0], { duration: 0.42, times: [0, 50, 120, 190, 260, 330, 420].map((t) => t / 420), ease: 'linear' })
  }

  const digit = async (value: number) => {
    if (checking.current) return
    if (Date.now() < blockedUntil.current) { setError('Riprova tra qualche secondo'); shakeIt(); return }
    if (pin.length >= 8) return
    const candidate = pin + value
    setPin(candidate)
    setError('')
    const shouldCheck = pinLength ? candidate.length === pinLength : candidate.length >= 4
    if (shouldCheck) {
      checking.current = true
      const ok = await verifyPin(candidate)
      checking.current = false
      if (ok) { setPin(''); failures.current = 0; unlock(); return }
    }
    if ((pinLength && candidate.length === pinLength) || candidate.length === 8) {
      setPin('')
      failures.current++
      shakeIt()
      if (failures.current >= 5) { blockedUntil.current = Date.now() + 30_000; failures.current = 0; setError('Troppi tentativi. Riprova tra 30 secondi') }
      else setError('PIN non corretto')
    }
  }

  return (
    <div className="layer">
      <Backdrop />
      <div className="status-pad nav-pad" style={{ position: 'absolute', inset: 0, padding: '0 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 110, height: 110, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(Gold, 0.35)}, transparent)` }}
            initial={{ scale: 0.9 }} animate={{ scale: 1.08 }} transition={{ duration: 1.8, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }} />
          <img src={dark ? '/garage_logo_dark.png' : '/garage_logo_light.png'} alt="Garage" style={{ width: 74, height: 74, position: 'relative' }} />
        </div>
        <div style={{ height: 14 }} />
        <div style={{ color: 'var(--onBackground)', fontSize: 31, lineHeight: '36px', fontWeight: 900, letterSpacing: -0.5 }}>Garage protetto</div>
        <div style={{ height: 5 }} />
        <div style={{ color: 'var(--onSurfaceVariant)' }}>Inserisci il tuo PIN</div>
        <div style={{ height: 25 }} />
        <motion.div style={{ x: shake, display: 'flex', gap: 14, alignItems: 'center' }}>
          {Array.from({ length: pinLength || 6 }, (_, index) => {
            const filled = index < pin.length
            return (
              <motion.div key={index} className={filled ? 'accent-bg' : ''} initial={false} animate={{ scale: filled ? 1.25 : 1 }} transition={spring(0.35, Stiffness.Medium)}
                style={{ width: 13, height: 13, borderRadius: '50%', background: filled ? undefined : 'color-mix(in srgb, var(--outline) 40%, transparent)' }} />
            )
          })}
        </motion.div>
        <div style={{ height: 10 }} />
        <div style={{ color: 'var(--error)', fontSize: 13, lineHeight: '20px', minHeight: 20 }}>{error}</div>
        <div style={{ height: 18 }} />
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row) => (
          <div key={row[0]} style={{ width: '100%', display: 'flex', justifyContent: 'space-evenly', marginBottom: 12 }}>
            {row.map((n) => <Key key={n} label={String(n)} onClick={() => digit(n)} />)}
          </div>
        ))}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-evenly', alignItems: 'center' }}>
          <div style={{ width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {biometric && <TextButton onClick={tryBiometric} style={{ fontSize: 13, fontWeight: 700 }}>Bio</TextButton>}
          </div>
          <Key label="0" onClick={() => digit(0)} />
          <Key label="⌫" onClick={() => { if (pin) { setPin(pin.slice(0, -1)); setError('') } }} />
        </div>
      </div>
    </div>
  )
}

function Key({ label, onClick }: { label: string; onClick: () => void }) {
  const dark = useDark()
  return (
    <Bouncy onClick={onClick} label={label === '⌫' ? 'Cancella cifra' : `Cifra ${label}`} style={{
      width: 70, height: 70, borderRadius: '50%', background: 'var(--surface)', border: `1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onSurface)', fontSize: 28, lineHeight: '36px', fontWeight: 600,
    }}>{label}</Bouncy>
  )
}
