import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { GradientButton, TextButton } from '../components/ui.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { Backdrop } from '../components/garage.tsx'
import { fastOutSlowIn, spring } from '../components/motion.ts'
import { Gold, alpha, useDark } from '../lib/theme.ts'
import { api } from '../lib/api.ts'

/** Accounts exist only in the web version: the screen follows the lock screen of the app. */
export function Login({ onLoggedIn }: { onLoggedIn: (username: string) => void }) {
  const dark = useDark()
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
    try {
      const result = await api<{ username: string }>(register ? '/api/register' : '/api/login', { method: 'POST', json: { username, password } })
      onLoggedIn(result.username)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="layer">
      <Backdrop />
      <div className="scroll status-pad nav-pad">
        <div style={{ minHeight: '100%', padding: '32px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 110, height: 110, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(Gold, 0.35)}, transparent)` }}
                initial={{ scale: 0.9 }} animate={{ scale: 1.08 }} transition={{ duration: 1.8, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }} />
              <img src={dark ? '/garage_logo_dark.png' : '/garage_logo_light.png'} alt="Garage" style={{ width: 74, height: 74, position: 'relative' }} />
            </div>
            <div style={{ height: 14 }} />
            <div style={{ color: 'var(--onBackground)', fontSize: 31, lineHeight: '36px', fontWeight: 900, letterSpacing: -0.5, textAlign: 'center' }}>
              {register ? 'Crea il tuo Garage' : 'Bentornato'}
            </div>
            <div style={{ height: 5 }} />
            <div style={{ color: 'var(--onSurfaceVariant)', textAlign: 'center' }}>
              {register ? 'Scegli un nome utente e una password' : 'Entra nel tuo garage'}
            </div>
          </div>
          <div style={{ height: 25 }} />
          <form onSubmit={(e) => { e.preventDefault(); submit() }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <OutlinedField value={username} onChange={(v) => { setUsername(v); setError('') }} label="Nome utente" autoComplete="username" radius={16} container="var(--surface)" border="color-mix(in srgb, var(--outline) 43%, transparent)" />
            <OutlinedField value={password} onChange={(v) => { setPassword(v); setError('') }} label="Password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
              radius={16} container="var(--surface)" border="color-mix(in srgb, var(--outline) 43%, transparent)" onEnter={register ? undefined : submit} />
            <AnimatePresence initial={false}>
              {register && (
                <motion.div key="repeat" style={{ overflow: 'hidden' }} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring()}>
                  <OutlinedField value={repeat} onChange={(v) => { setRepeat(v); setError('') }} label="Ripeti la password" type="password" autoComplete="new-password"
                    radius={16} container="var(--surface)" border="color-mix(in srgb, var(--outline) 43%, transparent)" onEnter={submit} style={{ marginTop: 6 }} />
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ color: 'var(--error)', fontSize: 13, lineHeight: '20px', minHeight: 20, textAlign: 'center' }}>{error}</div>
            <GradientButton onClick={submit} height={54} shine enabled={!busy}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>{register ? 'Crea account' : 'Entra'}</span>
            </GradientButton>
            <button type="submit" hidden />
          </form>
          <div style={{ height: 12 }} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TextButton onClick={() => { setRegister(!register); setError('') }} style={{ fontWeight: 700 }}>
              {register ? 'Ho già un account' : 'Non hai un account? Creane uno'}
            </TextButton>
          </div>
        </div>
      </div>
    </div>
  )
}
