import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { AccentButton, Gauge, TextButton } from '../components/ui.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { Backdrop } from '../components/garage.tsx'
import { spring } from '../components/motion.ts'
import { useDark } from '../lib/theme.ts'
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
            <Gauge fraction={register ? 0.66 : 0.33} color="var(--primary)" size={108} stroke={4}>
              <img src={dark ? '/garage_logo_dark.png' : '/garage_logo_light.png'} alt="Garage" style={{ width: 60, height: 60 }} />
            </Gauge>
            <div style={{ height: 14 }} />
            <div style={{ color: 'var(--onBackground)', fontSize: 28, lineHeight: '34px', fontWeight: 700, letterSpacing: -0.6, textAlign: 'center' }}>
              {register ? 'Crea il tuo Garage' : 'Bentornato'}
            </div>
            <div style={{ height: 5 }} />
            <div style={{ color: 'var(--onSurfaceVariant)', textAlign: 'center' }}>
              {register ? 'Scegli un nome utente e una password' : 'Entra nel tuo garage'}
            </div>
          </div>
          <div style={{ height: 25 }} />
          <form onSubmit={(e) => { e.preventDefault(); submit() }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <OutlinedField value={username} onChange={(v) => { setUsername(v); setError('') }} label="Nome utente" autoComplete="username" radius={14} container="var(--surface)" border="var(--hairline)" />
            <OutlinedField value={password} onChange={(v) => { setPassword(v); setError('') }} label="Password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
              radius={14} container="var(--surface)" border="var(--hairline)" onEnter={register ? undefined : submit} />
            <AnimatePresence initial={false}>
              {register && (
                <motion.div key="repeat" style={{ overflow: 'hidden' }} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring()}>
                  <OutlinedField value={repeat} onChange={(v) => { setRepeat(v); setError('') }} label="Ripeti la password" type="password" autoComplete="new-password"
                    radius={14} container="var(--surface)" border="var(--hairline)" onEnter={submit} style={{ marginTop: 6 }} />
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ color: 'var(--error)', fontSize: 13, lineHeight: '20px', minHeight: 20, textAlign: 'center' }}>{error}</div>
            <AccentButton onClick={submit} enabled={!busy}>{register ? 'Crea account' : 'Entra'}</AccentButton>
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
