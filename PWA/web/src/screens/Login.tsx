import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { api } from '../lib/api.ts'
import { useIsDark } from '../lib/theme.ts'
import { GradientButton, TextButton } from '../components/ui.tsx'
import { OutlinedTextField } from '../components/fields.tsx'
import { fastOutSlowIn, spring, tween } from '../components/motion.ts'

/** The PWA's own entrance, in the style of the lock screen: one private garage per account. */
export function LoginScreen({ onLoggedIn }: { onLoggedIn: (username: string) => void }) {
  const isDark = useIsDark()
  const [register, setRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    if (register && password !== repeat) { setError('Le password non coincidono'); return }
    setBusy(true)
    setError('')
    try {
      const result = await api<{ username: string }>(register ? '/api/register' : '/api/login', { method: 'POST', json: { username, password } })
      onLoggedIn(result.username)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const clear = (set: (v: string) => void) => (v: string) => { set(v); setError('') }
  return (
    <div className="backdrop">
      <div className="scroll">
        <form onSubmit={(e) => { e.preventDefault(); submit() }}
          style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'calc(24px + var(--safe-top)) 26px calc(24px + var(--safe-bottom))', gap: 12, position: 'relative' }}>
          <div style={{ alignSelf: 'center', width: 110, height: 110, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1.08 }} transition={{ duration: 1.8, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,216,77,.35), transparent)' }} />
            <img src={isDark ? '/garage_logo_dark.png' : '/garage_logo_light.png'} alt="Garage" width={74} height={74} style={{ position: 'relative' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 31, fontWeight: 900, letterSpacing: -0.5, lineHeight: '38px' }}>{register ? 'Crea il tuo Garage' : 'Bentornato'}</div>
            <div style={{ color: 'var(--onSurfaceVariant)', marginTop: 5 }}>{register ? 'Un garage privato, solo per te.' : 'Entra nel tuo garage.'}</div>
          </div>
          <div style={{ height: 8 }} />
          <OutlinedTextField value={username} onChange={clear(setUsername)} label="Nome utente" autoComplete="username" name="username" radius={16} containerColor="var(--surface)" notch="var(--surface)" />
          <OutlinedTextField value={password} onChange={clear(setPassword)} label="Password" type="password" name="password"
            autoComplete={register ? 'new-password' : 'current-password'} radius={16} containerColor="var(--surface)" notch="var(--surface)" onEnter={register ? undefined : submit} />
          <AnimatePresence initial={false}>
            {register && (
              <motion.div key="repeat" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, transition: { height: spring(1, 400), opacity: tween(200) } }}
                exit={{ height: 0, opacity: 0, transition: tween(180) }} style={{ overflow: 'hidden', margin: '-6px -6px 0', padding: '6px 6px 0' }}>
                <OutlinedTextField value={repeat} onChange={clear(setRepeat)} label="Ripeti la password" type="password" autoComplete="new-password" radius={16} containerColor="var(--surface)" notch="var(--surface)" onEnter={submit} />
              </motion.div>
            )}
          </AnimatePresence>
          {error && <span style={{ color: 'var(--error)', fontSize: 14 }}>{error}</span>}
          <div style={{ height: 4 }} />
          <GradientButton onClick={submit} enabled={!busy} height={54} style={{ width: '100%' }}>
            <span style={{ fontSize: 16, fontWeight: 900 }}>{register ? 'Crea account' : 'Entra'}</span>
          </GradientButton>
          <button type="submit" hidden />
          <TextButton onClick={() => { setRegister(!register); setError('') }} style={{ alignSelf: 'center' }}>
            {register ? 'Hai già un account? Entra' : 'Nuovo qui? Crea un account'}
          </TextButton>
        </form>
      </div>
    </div>
  )
}
