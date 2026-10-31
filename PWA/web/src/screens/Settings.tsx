import { type ReactNode, useEffect, useState } from 'react'
import { backupStatus, today } from '../../../shared/model.ts'
import { api } from '../lib/api.ts'
import { actions, loggedUser, mutate, updateSettings, useStore, type ThemeMode } from '../lib/store.ts'
import { hasPin, setPin, verifyPin } from '../lib/pin.ts'
import { disablePush, enablePush, pushSupported } from '../lib/push.ts'
import { deviceLockAvailable, registerDeviceLock } from '../lib/deviceLock.ts'
import { download, pickFile } from '../lib/files.ts'
import { serverVersion } from '../App.tsx'
import {
  Divider, GlassCard, GradientButton, GradientIcon, Icon, OutlinedButton, Pressable, SectionHeading, Slider, Stagger, Switch, TextButton,
} from '../components/ui.tsx'
import { AlertDialog, confirmDelete, openDialog, toast } from '../components/overlays.tsx'
import { OutlinedTextField } from '../components/fields.tsx'

export function SettingsScreen({ onLock, onOnboarding, onLoggedOut }: { onLock: () => void; onOnboarding: () => void; onLoggedOut: (user: string, deleted: boolean) => void }) {
  const settings = useStore((s) => s.settings)
  const meta = useStore((s) => s.data!.meta)
  const [leadDays, setLeadDays] = useState(meta.leadDays)
  useEffect(() => setLeadDays(meta.leadDays), [meta.leadDays])
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  useEffect(() => {
    // A passkey needs a host name: never an IP address.
    deviceLockAvailable().then((ok) => setBiometricAvailable(ok && !/^[\d.]+$|^\[/.test(location.hostname)))
  }, [])
  const muted = 'var(--onSurfaceVariant)'
  const notifications = settings.remindersEnabled

  const onNotifications = async (enabled: boolean) => {
    if (!enabled) {
      await disablePush()
      return
    }
    if (!pushSupported()) {
      toast('Notifiche non disponibili: apri Garage in HTTPS e installala come app', true)
      return
    }
    toast((await enablePush()) ? 'Notifiche abilitate' : 'Permesso notifiche non concesso')
  }

  const onProtection = (enabled: boolean) => {
    if (enabled) {
      if (hasPin()) {
        updateSettings({ protection: true })
        toast('Protezione attivata')
      } else pinSetup(true)
    } else {
      updateSettings({ protection: false })
      toast('Protezione disattivata')
    }
  }

  const onBiometric = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ lockCredential: null })
      return
    }
    const credential = await registerDeviceLock()
    if (credential) updateSettings({ lockCredential: credential })
    else toast('Biometria non disponibile su questo dispositivo')
  }

  const onExport = async () => {
    try {
      const response = await fetch('/api/backup', { credentials: 'same-origin' })
      if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? `Errore ${response.status}`)
      download(await response.blob(), `garage_${today()}.json`)
      toast('Backup esportato')
      await mutate(async () => undefined)
    } catch (e) {
      toast(`Esportazione non riuscita: ${(e as Error).message}`)
    }
  }

  const onImport = async () => {
    const file = await pickFile('application/json,.json')
    if (!file) return
    let text: string
    let summary: string
    try {
      if (file.size > 250 * 1024 * 1024) throw new Error('File troppo grande')
      text = await file.text()
      const data = JSON.parse(text).data
      summary = `${data.vehicles.length} auto · ${data.maintenances.length} interventi · ${data.documents.length} documenti`
    } catch (e) {
      toast(`Backup non leggibile: ${(e as Error).message}`)
      return
    }
    openDialog((close) => (
      <AlertDialog title="Importa backup"
        dismiss={<TextButton onClick={close}>Annulla</TextButton>}
        confirm={<TextButton onClick={async () => {
          close()
          try {
            await mutate(() => api('/api/backup', { method: 'POST', body: text, headers: { 'Content-Type': 'application/json' } }))
            toast('Backup importato')
          } catch (e) {
            toast(`Importazione annullata: ${(e as Error).message}`)
          }
        }}>Importa</TextButton>}>
        {`${summary}\n\nL'importazione sostituirà tutti i dati attuali. Il file non è cifrato.`}
      </AlertDialog>
    ))
  }

  return (
    <div className="scroll">
      <div style={{ padding: '22px 18px 120px', display: 'flex', flexDirection: 'column', gap: 15 }}>
        <SectionHeading kicker="Garage" title="Impostazioni" subtitle="Il tuo spazio, come piace a te." />
        <SettingsPanel icon="settings-nav" title="Aspetto" subtitle="Scegli come vedere il tuo garage" index={1}>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 20, background: 'var(--surfaceContainer)' }}>
            {([['system', 'Sistema', 'settings-nav'], ['light', 'Chiaro', 'calendar-nav'], ['dark', 'Scuro', 'garage-nav']] as [ThemeMode, string, string][]).map(([key, label, icon]) => {
              const selected = settings.theme === key
              const color = selected ? 'var(--onAccent)' : muted
              return (
                <Pressable key={key} onClick={() => updateSettings({ theme: key })} style={{
                  flex: 1, borderRadius: 17, padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selected ? 'var(--accent)' : 'transparent',
                }}>
                  <Icon name={icon} size={16} color={color} />
                  <span style={{ width: 5 }} />
                  <span style={{ color, fontSize: 12, fontWeight: selected ? 700 : 500 }}>{label}</span>
                </Pressable>
              )
            })}
          </div>
        </SettingsPanel>
        <SettingsPanel icon="calendar-nav" title="Scadenze" subtitle="Promemoria per arrivare sempre in tempo" index={2}>
          <SwitchRow title="Notifiche" subtitle="Avvisami delle prossime scadenze" checked={notifications} onChange={onNotifications} />
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Preavviso</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{leadDays} giorni</span>
          </div>
          <Slider value={leadDays} min={1} max={30} disabled={!notifications}
            onChange={(v) => setLeadDays(Math.min(30, Math.max(1, Math.trunc(v))))}
            onCommit={(v) => actions.setLeadDays(Math.min(30, Math.max(1, Math.trunc(v)))).catch((e) => toast((e as Error).message))} />
        </SettingsPanel>
        <SettingsPanel icon="shield" title="Privacy e accesso" subtitle="I tuoi dati restano nelle tue mani" index={3}>
          <SwitchRow title="Proteggi Garage" subtitle="Richiedi il PIN all'apertura" checked={settings.protection} onChange={onProtection} />
          {settings.protection && <>
            <Divider />
            <SwitchRow title="Biometria" subtitle={biometricAvailable ? 'Usa impronta o volto' : 'Non disponibile su questo dispositivo'}
              checked={settings.lockCredential != null} onChange={onBiometric} disabled={!biometricAvailable || !hasPin()} />
            <SettingsAction label="Cambia PIN" icon="edit" onClick={() => pinSetup(false)} />
            <SettingsAction label="Blocca adesso" icon="shield" onClick={onLock} />
          </>}
          <span style={{ color: muted, fontSize: 12, lineHeight: '17px' }}>Il blocco protegge l'accesso all'app; i backup esportati non sono cifrati.</span>
        </SettingsPanel>
        <SettingsPanel icon="folder" title="I tuoi dati" subtitle="Esporta o ripristina il tuo archivio" index={4}>
          <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>{backupStatus(meta.lastChange, meta.lastExport)}</span>
          <GradientButton onClick={onExport} height={48} radius={24} style={{ width: '100%' }}><span style={{ fontWeight: 700 }}>Esporta backup</span></GradientButton>
          <OutlinedButton onClick={onImport} style={{ height: 48, borderRadius: 24, fontWeight: 700 }}>Importa backup</OutlinedButton>
          <span style={{ color: muted, fontSize: 12 }}>Il file include foto e documenti e non è cifrato.</span>
        </SettingsPanel>
        <SettingsPanel icon="note" title="Garage" subtitle="L'archivio è disponibile anche offline" index={5}>
          <SettingsAction label="Rivedi l'introduzione" icon="chevron-right" onClick={onOnboarding} />
        </SettingsPanel>
        <SettingsPanel icon="garage-nav" title="Account" subtitle={`Sei entrato come ${loggedUser()}`} index={6}>
          <SettingsAction label="Cambia password" icon="edit" onClick={changePassword} />
          <SettingsAction label="Esci" icon="arrow-back" onClick={async () => {
            await disablePush()
            await api('/api/logout', { method: 'POST' }).catch(() => undefined)
            onLoggedOut(loggedUser(), false)
          }} />
          <SettingsAction label="Elimina account" icon="delete" destructive onClick={() => deleteAccount(onLoggedOut)} />
        </SettingsPanel>
        <Stagger index={7}>
          <OutlinedButton color="var(--error)" onClick={() => confirmDelete('Eliminare definitivamente auto, interventi e documenti?', async () => {
            try {
              await actions.clear()
              toast('Dati eliminati')
            } catch (e) {
              toast((e as Error).message)
            }
          })} style={{ height: 50, borderRadius: 25, width: '100%', fontWeight: 700 }}>
            <Icon name="delete" size={18} />
            <span style={{ width: 8 }} />
            Elimina tutti i dati
          </OutlinedButton>
        </Stagger>
        <UpdateCard />
      </div>
    </div>
  )
}

function SettingsPanel({ icon, title, subtitle, index, children }: { icon: string; title: string; subtitle: string; index: number; children: ReactNode }) {
  return (
    <Stagger index={index}>
      <GlassCard padding={0}>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GradientIcon icon={icon} size={46} iconSize={22} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
              <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 12 }}>{subtitle}</div>
            </div>
          </div>
          <Divider alpha={0.16} />
          {children}
        </div>
      </GlassCard>
    </Stagger>
  )
}

function SwitchRow({ title, subtitle, checked, onChange, disabled }: { title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12 }}>{subtitle}</div>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function SettingsAction({ label, icon, onClick, destructive = false }: { label: string; icon: string; onClick: () => void; destructive?: boolean }) {
  const color = destructive ? 'var(--error)' : 'var(--primary)'
  return (
    <Pressable onClick={onClick} style={{ borderRadius: 15, padding: '7px 0', display: 'flex', alignItems: 'center' }}>
      <Icon name={icon} size={20} color={color} />
      <span style={{ width: 10 }} />
      <span style={{ flex: 1, color, fontWeight: 600 }}>{label}</span>
      <Icon name="chevron-right" size={18} color="var(--onSurfaceVariant)" />
    </Pressable>
  )
}

// --- PinSetupDialog ----------------------------------------------------------------------------

function pinSetup(enablesProtection: boolean) {
  openDialog((close) => <PinSetupDialog close={close} enablesProtection={enablesProtection} />)
}

function PinSetupDialog({ close, enablesProtection }: { close: () => void; enablesProtection: boolean }) {
  const existing = hasPin()
  const [current, setCurrent] = useState('')
  const [pin, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)
  const field = (value: string, set: (v: string) => void, label: string) => (
    <OutlinedTextField value={value} onChange={(v) => { set(digits(v)); setError('') }} label={label} type="password" inputMode="numeric"
      notch="var(--surfaceContainerHigh)" autoComplete="off" />
  )
  const save = async () => {
    const message = existing && !(await verifyPin(current)) ? 'PIN attuale non corretto'
      : pin.length < 4 || pin.length > 8 ? 'Il PIN deve avere da 4 a 8 cifre'
      : pin !== confirm ? 'I PIN non coincidono' : ''
    setError(message)
    if (message) return
    await setPin(pin)
    close()
    if (enablesProtection) {
      updateSettings({ protection: true })
      toast('Protezione attivata')
    } else toast('PIN aggiornato')
  }
  return (
    <AlertDialog title={existing ? 'Cambia PIN' : 'Imposta PIN'}
      dismiss={<TextButton onClick={close}>Annulla</TextButton>}
      confirm={<TextButton onClick={save}>Salva PIN</TextButton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
        <span>Scegli un PIN da 4 a 8 cifre.</span>
        {existing && field(current, setCurrent, 'PIN attuale')}
        {field(pin, setPinValue, 'Nuovo PIN')}
        {field(confirm, setConfirm, 'Conferma PIN')}
        {error && <span style={{ color: 'var(--error)' }}>{error}</span>}
      </div>
    </AlertDialog>
  )
}

// --- account (the PWA's own: one garage per person) ---------------------------------------------

function changePassword() {
  openDialog((close) => <PasswordDialog close={close} />)
}

function PasswordDialog({ close }: { close: () => void }) {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const save = async () => {
    if (password !== repeat) { setError('Le password non coincidono'); return }
    try {
      await api('/api/account/password', { method: 'POST', json: { current, password } })
      close()
      toast('Password aggiornata')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <AlertDialog title="Cambia password"
      dismiss={<TextButton onClick={close}>Annulla</TextButton>}
      confirm={<TextButton onClick={save}>Salva</TextButton>}>
      <form onSubmit={(e) => { e.preventDefault(); save() }} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
        <input type="text" autoComplete="username" value={loggedUser()} readOnly hidden />
        <OutlinedTextField value={current} onChange={(v) => { setCurrent(v); setError('') }} label="Password attuale" type="password" autoComplete="current-password" notch="var(--surfaceContainerHigh)" />
        <OutlinedTextField value={password} onChange={(v) => { setPassword(v); setError('') }} label="Nuova password" type="password" autoComplete="new-password" notch="var(--surfaceContainerHigh)" />
        <OutlinedTextField value={repeat} onChange={(v) => { setRepeat(v); setError('') }} label="Ripeti la nuova password" type="password" autoComplete="new-password" notch="var(--surfaceContainerHigh)" />
        {error && <span style={{ color: 'var(--error)' }}>{error}</span>}
      </form>
    </AlertDialog>
  )
}

function deleteAccount(onLoggedOut: (user: string, deleted: boolean) => void) {
  openDialog((close) => <DeleteAccountDialog close={close} onLoggedOut={onLoggedOut} />)
}

function DeleteAccountDialog({ close, onLoggedOut }: { close: () => void; onLoggedOut: (user: string, deleted: boolean) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const confirm = async () => {
    try {
      await disablePush()
      await api('/api/account/delete', { method: 'POST', json: { password } })
      close()
      onLoggedOut(loggedUser(), true)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <AlertDialog title="Elimina account"
      dismiss={<TextButton onClick={close}>Annulla</TextButton>}
      confirm={<TextButton color="var(--error)" onClick={confirm}>Elimina</TextButton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span>L'account e tutto il suo garage (auto, interventi, documenti) saranno eliminati dal server. Non si può annullare.</span>
        <OutlinedTextField value={password} onChange={(v) => { setPassword(v); setError('') }} label="Password" type="password" autoComplete="current-password" notch="var(--surfaceContainerHigh)" />
        {error && <span style={{ color: 'var(--error)' }}>{error}</span>}
      </div>
    </AlertDialog>
  )
}

// --- Aggiornamenti (AppUpdateCard): the service worker and the server version --------------------

function UpdateCard() {
  const [checking, setChecking] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [error, setError] = useState<string | null>(null)
  const check = async () => {
    setChecking(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (registration) {
        await registration.update()
        await new Promise((r) => setTimeout(r, 1500))
        setWaiting(registration.waiting ?? registration.installing ?? null)
      }
    } catch {
      setError('Controllo non riuscito. Riprova.')
    } finally {
      setChecking(false)
    }
  }
  useEffect(() => { check() }, [])
  return (
    <div style={{ borderRadius: 20, background: 'var(--surfaceContainerHighest)', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 500, letterSpacing: 0.15 }}>Aggiornamenti</span>
      <span style={{ fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>Versione installata: {serverVersion || '—'}</span>
      {checking ? <span>Controllo aggiornamenti…</span>
        : waiting ? <>
            <span>Disponibile una nuova versione</span>
            <Pressable onClick={() => {
              navigator.serviceWorker.addEventListener('controllerchange', () => location.reload())
              waiting.postMessage('skipWaiting')
            }} pressed={1} style={{ height: 40, borderRadius: 999, background: 'var(--primary)', color: 'var(--onPrimary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, letterSpacing: 0.2 }}>
              Aggiorna ora
            </Pressable>
          </>
        : !error && <span>Nessun aggiornamento disponibile.</span>}
      {error && <span style={{ color: 'var(--error)', fontSize: 12, lineHeight: '16px' }}>{error}</span>}
      {!checking && <TextButton onClick={check} style={{ alignSelf: 'flex-start' }}>Controlla aggiornamenti</TextButton>}
    </div>
  )
}
