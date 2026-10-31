import { animate, motion, useMotionValue } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store.ts'
import { verifyPin } from '../lib/pin.ts'
import { unlockWithDevice } from '../lib/deviceLock.ts'
import { useIsDark } from '../lib/theme.ts'
import { GradientButton, Pressable, TextButton } from '../components/ui.tsx'
import { toast } from '../components/overlays.tsx'
import { fastOutSlowIn, spring } from '../components/motion.ts'

/** GarageLockScreen: the PIN pad, with the passkey as "Bio". */
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const settings = useStore((s) => s.settings)
  const isDark = useIsDark()
  const hasPin = !!settings.pinHash
  const pinLength = settings.pinLength
  const biometric = settings.lockCredential != null
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const failures = useRef(0)
  const blockedUntil = useRef(0)
  const checking = useRef(false)
  const shake = useMotionValue(0)

  const onBiometric = useCallback(async () => {
    if (await unlockWithDevice(settings.lockCredential)) onUnlocked()
  }, [settings.lockCredential, onUnlocked])

  useEffect(() => { if (biometric && hasPin) onBiometric() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shakeIt = () => {
    shake.set(0)
    animate(shake, [0, -18, 16, -12, 8, -4, 0], { duration: 0.42, times: [0, 50 / 420, 120 / 420, 190 / 420, 260 / 420, 330 / 420, 1] })
  }

  const digit = async (value: number) => {
    if (checking.current) return
    if (performance.now() < blockedUntil.current) { setError('Riprova tra qualche secondo'); shakeIt(); return }
    if (pin.length >= 8) return
    const candidate = pin + value
    setPin(candidate)
    setError('')
    const shouldCheck = pinLength >= 4 && pinLength <= 8 ? candidate.length === pinLength : candidate.length >= 4
    if (shouldCheck) {
      checking.current = true
      const ok = await verifyPin(candidate)
      checking.current = false
      if (ok) { setPin(''); failures.current = 0; onUnlocked(); return }
    }
    if ((pinLength >= 4 && pinLength <= 8 && candidate.length === pinLength) || candidate.length === 8) {
      setPin('')
      failures.current++
      shakeIt()
      if (failures.current >= 5) {
        blockedUntil.current = performance.now() + 30_000
        failures.current = 0
        setError('Troppi tentativi. Riprova tra 30 secondi')
      } else setError('PIN non corretto')
    }
  }

  const dots = pinLength >= 4 && pinLength <= 8 ? pinLength : 6
  return (
    <div className="backdrop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--safe-top)) 26px calc(var(--safe-bottom))' }}>
      <div style={{ width: 110, height: 110, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1.08 }} transition={{ duration: 1.8, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,216,77,.35), transparent)' }} />
        <img src={isDark ? '/garage_logo_dark.png' : '/garage_logo_light.png'} alt="Garage" width={74} height={74} style={{ position: 'relative' }} />
      </div>
      <div style={{ height: 14 }} />
      <div style={{ color: 'var(--onBackground)', fontSize: 31, fontWeight: 900, letterSpacing: -0.5, position: 'relative' }}>Garage protetto</div>
      <div style={{ height: 5 }} />
      <div style={{ color: 'var(--onSurfaceVariant)', position: 'relative' }}>{hasPin ? 'Inserisci il tuo PIN' : 'Usa il blocco schermo del dispositivo'}</div>
      <div style={{ height: 25 }} />
      {hasPin ? <div style={{ width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <motion.div style={{ x: shake, display: 'flex', gap: 14, alignItems: 'center', height: 24 }}>
          {Array.from({ length: dots }, (_, i) => {
            const filled = i < pin.length
            return <motion.div key={i} animate={{ scale: filled ? 1.25 : 1 }} transition={spring(0.35, 1500)}
              style={{ width: 13, height: 13, borderRadius: '50%', background: filled ? 'var(--accent)' : 'color-mix(in srgb, var(--outline) 40%, transparent)' }} />
          })}
        </motion.div>
        <div style={{ height: 10 }} />
        <div style={{ color: 'var(--error)', fontSize: 13, minHeight: 24 }}>{error}</div>
        <div style={{ height: 18 }} />
        {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((row) => (
          <div key={row[0]} style={{ width: '100%', display: 'flex', justifyContent: 'space-evenly', marginBottom: 12 }}>
            {row.map((n) => <PinKey key={n} label={String(n)} onClick={() => digit(n)} />)}
          </div>
        ))}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-evenly', alignItems: 'center' }}>
          <div style={{ width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {biometric && <TextButton onClick={onBiometric} style={{ fontSize: 13 }}>Bio</TextButton>}
          </div>
          <PinKey label="0" onClick={() => digit(0)} />
          <PinKey label="⌫" onClick={() => { if (pin) { setPin(pin.slice(0, -1)); setError('') } }} />
        </div>
      </div>
        : <GradientButton onClick={async () => { if (await unlockWithDevice(settings.lockCredential)) onUnlocked(); else toast('Sblocco non riuscito') }} height={54} style={{ width: '100%', position: 'relative' }}>Sblocca</GradientButton>}
    </div>
  )
}

function PinKey({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Pressable onClick={onClick} label={label === '⌫' ? 'Cancella cifra' : `Cifra ${label}`} style={{
      width: 70, height: 70, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--pinBorder)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--onSurface)', fontSize: 28, fontWeight: 600,
    }}>{label}</Pressable>
  )
}
