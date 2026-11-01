import { useEffect, useState, type ReactNode } from 'react'
import { Bouncy, Divider, GlassCard, GradientButton, GradientIcon, Icon, OutlinedButton, SectionHeading, Slider, Stagger, Switch, useGradient } from '../components/ui.tsx'
import { Dialog, DialogButton, toast } from '../components/overlays.tsx'
import { OutlinedField } from '../components/fields.tsx'
import { ConfirmDelete, PinSetupDialog } from '../components/dialogs.tsx'
import { actions, forgetUser, loggedUser, refresh, updateSettings, useStore, type ThemeMode } from '../lib/store.ts'
import { api } from '../lib/api.ts'
import { disablePush, enablePush, pushSupported } from '../lib/push.ts'
import { deviceLockAvailable, registerDeviceLock } from '../lib/deviceLock.ts'
import { setPin, verifyPin } from '../lib/pin.ts'
import { download, pickFile } from '../lib/files.ts'
import { lockNow } from '../lib/lock.ts'
import type { IconName } from '../lib/icons.gen.ts'
import { todayString } from '../../../shared/format.ts'

/** SettingsScreen.kt, plus the account and the web app updates. */
export function Settings({ onOnboarding, version }: { onOnboarding: () => void; version: string }) {
  const settings = useStore((s) => s.settings)
  const data = useStore((s) => s.data)!
  const [leadDays, setLeadDays] = useState(data.leadDays)
  useEffect(() => setLeadDays(data.leadDays), [data.leadDays])
  const [clearConfirm, setClearConfirm] = useState(false)
  const [pinSetup, setPinSetup] = useState<null | { enablesProtection: boolean }>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [importing, setImporting] = useState<{ text: string; summary: string } | null>(null)
  const [account, setAccount] = useState<null | 'password' | 'delete'>(null)
  useEffect(() => { deviceLockAvailable().then(setBiometricAvailable) }, [])
  const muted = 'var(--onSurfaceVariant)'
  const hasPin = !!settings.pinHash

  const backupStatus = !data.lastExport ? 'Nessun backup esportato' : data.lastChange > data.lastExport ? 'Un nuovo backup è consigliato' : 'Backup aggiornato'

  const onNotifications = async (enabled: boolean) => {
    if (!enabled) { await disablePush(); return }
    if (!pushSupported()) { toast('Notifiche disponibili solo aprendo Garage in HTTPS e installandola come app', true); return }
    const ok = await enablePush()
    toast(ok ? 'Notifiche abilitate' : 'Permesso notifiche non concesso')
  }

  const onProtection = (enabled: boolean) => {
    if (enabled) {
      if (hasPin) { updateSettings({ protection: true }); toast('Protezione attivata') }
      else setPinSetup({ enablesProtection: true })
    } else { updateSettings({ protection: false }); toast('Protezione disattivata') }
  }

  const onBiometric = async (enabled: boolean) => {
    if (!enabled) { updateSettings({ lockCredential: null }); return }
    const credential = await registerDeviceLock()
    if (credential) updateSettings({ lockCredential: credential })
    else toast('Biometria non disponibile su questo dispositivo', true)
  }

  const exportBackup = async () => {
    try {
      const response = await fetch('/api/backup', { credentials: 'same-origin' })
      if (!response.ok) throw new Error()
      download(await response.blob(), `garage_${todayString()}.json`)
      toast('Backup esportato')
      refresh(true)
    } catch {
      toast('Esportazione non riuscita: server non raggiungibile', true)
    }
  }

  const importBackup = async () => {
    const file = await pickFile('application/json,.json')
    if (!file) return
    try {
      if (file.size > 250 * 1024 * 1024) throw new Error('Backup oltre 250 MB')
      const text = await file.text()
      const json = JSON.parse(text).data
      setImporting({ text, summary: `${json.vehicles.length} auto · ${json.maintenances.length} interventi · ${json.documents.length} documenti` })
    } catch (e) {
      toast(`Backup non leggibile: ${(e as Error).message}`, true)
    }
  }

  return (
    <div className="scroll status-pad">
      <div style={{ padding: '22px 18px 120px', display: 'flex', flexDirection: 'column', gap: 15 }}>
        <SectionHeading kicker="Garage" title="Impostazioni" subtitle="Il tuo spazio, come piace a te." />
        <Panel icon="settingsNav" title="Aspetto" subtitle="Scegli come vedere il tuo garage" index={1}>
          <ThemePicker theme={settings.theme} onChange={(theme) => updateSettings({ theme })} />
        </Panel>
        <Panel icon="calendarNav" title="Scadenze" subtitle="Promemoria per arrivare sempre in tempo" index={2}>
          <SwitchRow title="Notifiche" subtitle={pushSupported() ? 'Avvisami delle prossime scadenze' : 'Apri Garage in HTTPS e installala come app'}
            checked={settings.remindersEnabled} onChange={onNotifications} />
          <Line />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Preavviso</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{`${leadDays} giorni`}</span>
          </div>
          <Slider value={leadDays} min={1} max={30} enabled={settings.remindersEnabled}
            onChange={(v) => setLeadDays(Math.min(30, Math.max(1, Math.trunc(v))))} />
          <SaveLeadDays value={leadDays} saved={data.leadDays} />
        </Panel>
        <Panel icon="shield" title="Privacy e accesso" subtitle="I tuoi dati restano nelle tue mani" index={3}>
          <SwitchRow title="Proteggi Garage" subtitle="Richiedi il PIN all'apertura" checked={settings.protection} onChange={onProtection} />
          {settings.protection && <>
            <Line />
            <SwitchRow title="Biometria" subtitle={biometricAvailable ? 'Usa impronta o volto' : 'Non disponibile su questo dispositivo'}
              checked={!!settings.lockCredential} onChange={onBiometric} enabled={biometricAvailable && hasPin} />
            <Action label="Cambia PIN" icon="edit" onClick={() => setPinSetup({ enablesProtection: false })} />
            <Action label="Blocca adesso" icon="shield" onClick={lockNow} />
          </>}
          <div style={{ color: muted, fontSize: 12, lineHeight: '17px', letterSpacing: 0.4 }}>Il blocco protegge l'accesso all'app; i backup esportati non sono cifrati.</div>
        </Panel>
        <Panel icon="folder" title="I tuoi dati" subtitle="Esporta o ripristina il tuo archivio" index={4}>
          <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13, lineHeight: '20px', letterSpacing: 0.25 }}>{backupStatus}</div>
          <GradientButton onClick={exportBackup} height={48} radius={24}><span style={{ fontWeight: 700 }}>Esporta backup</span></GradientButton>
          <OutlinedButton onClick={importBackup} height={48} radius={24}>Importa backup</OutlinedButton>
          <div style={{ color: muted, fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>Il file include foto e documenti e non è cifrato. È lo stesso formato dell'app Android.</div>
        </Panel>
        <Panel icon="note" title="Garage" subtitle="L'archivio è sul tuo server, anche offline" index={5}>
          <Action label="Rivedi l'introduzione" icon="chevronRight" onClick={onOnboarding} />
        </Panel>
        <Panel icon="shield" title="Account" subtitle={`Sei entrato come ${loggedUser()}`} index={6}>
          <Action label="Cambia password" icon="edit" onClick={() => setAccount('password')} />
          <Action label="Esci" icon="arrowBack" onClick={async () => {
            await disablePush()
            await api('/api/logout', { method: 'POST' }).catch(() => {})
            location.reload()
          }} />
          <Action label="Elimina account" icon="delete" onClick={() => setAccount('delete')} destructive />
        </Panel>
        <Stagger index={7}>
          <OutlinedButton onClick={() => setClearConfirm(true)} height={50} radius={25} color="var(--error)">
            <Icon name="delete" size={18} /><span style={{ width: 8 }} />Elimina tutti i dati
          </OutlinedButton>
        </Stagger>
        <UpdateCard version={version} />
      </div>
      <ConfirmDelete text={clearConfirm ? 'Eliminare definitivamente auto, interventi e documenti?' : null} onDismiss={() => setClearConfirm(false)}
        onConfirm={() => { setClearConfirm(false); actions.clear().then(() => toast('Dati eliminati')).catch((e: Error) => toast(e.message, true)) }} />
      <PinSetupDialog open={pinSetup != null} existingPin={hasPin} verifyPin={verifyPin} onDismiss={() => setPinSetup(null)}
        onSave={async (pin) => {
          const enables = pinSetup?.enablesProtection
          await setPin(pin)
          setPinSetup(null)
          if (enables) { updateSettings({ protection: true }); toast('Protezione attivata') } else toast('PIN aggiornato')
        }} />
      <Dialog open={importing != null} onDismiss={() => setImporting(null)} title="Importa backup"
        confirm={<DialogButton label="Importa" onClick={() => {
          const text = importing!.text
          setImporting(null)
          actions.importBackup(text).then(() => toast('Backup importato')).catch((e: Error) => toast(`Importazione annullata: ${e.message}`, true))
        }} />}
        dismiss={<DialogButton label="Annulla" onClick={() => setImporting(null)} />}>
        <div style={{ whiteSpace: 'pre-line' }}>{`${importing?.summary ?? ''}\n\nL'importazione sostituirà tutti i dati di questo account sul server. Il file non è cifrato.`}</div>
      </Dialog>
      <AccountDialogs mode={account} onDismiss={() => setAccount(null)} />
    </div>
  )
}

/** The notice days are saved when the slider stops moving. */
function SaveLeadDays({ value, saved }: { value: number; saved: number }) {
  useEffect(() => {
    if (value === saved) return
    const timer = setTimeout(() => actions.setLeadDays(value).catch((e: Error) => toast(e.message, true)), 500)
    return () => clearTimeout(timer)
  }, [value, saved])
  return null
}

function Panel({ icon, title, subtitle, index, children }: { icon: IconName; title: string; subtitle: string; index: number; children: ReactNode }) {
  return (
    <Stagger index={index}>
      <GlassCard padding={0}>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <GradientIcon icon={icon} size={46} iconSize={22} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700 }}>{title}</div>
              <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{subtitle}</div>
            </div>
          </div>
          <Divider style={{ background: 'color-mix(in srgb, var(--outline) 16%, transparent)' }} />
          {children}
        </div>
      </GlassCard>
    </Stagger>
  )
}

const Line = () => <Divider style={{ background: 'color-mix(in srgb, var(--outline) 18%, transparent)' }} />

function ThemePicker({ theme, onChange }: { theme: ThemeMode; onChange: (t: ThemeMode) => void }) {
  const options: [ThemeMode, string, IconName][] = [['SYSTEM', 'Sistema', 'settingsNav'], ['LIGHT', 'Chiaro', 'calendarNav'], ['DARK', 'Scuro', 'garageNav']]
  return (
    <div style={{ display: 'flex', gap: 4, borderRadius: 20, background: 'var(--surfaceContainer)', padding: 4 }}>
      {options.map(([key, label, icon]) => <ThemeOption key={key} selected={theme === key} label={label} icon={icon} onClick={() => onChange(key)} />)}
    </div>
  )
}

function ThemeOption({ selected, label, icon, onClick }: { selected: boolean; label: string; icon: IconName; onClick: () => void }) {
  const ref = useGradient<HTMLDivElement>()
  const color = selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)'
  return (
    <Bouncy ref={ref} onClick={onClick} className={selected ? 'accent-bg' : ''} style={{ flex: 1, borderRadius: 17, padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={16} color={color} />
      <span style={{ width: 5 }} />
      <span style={{ color, fontSize: 12, lineHeight: '16px', letterSpacing: 0.5, fontWeight: selected ? 700 : 500 }}>{label}</span>
    </Bouncy>
  )
}

function SwitchRow({ title, subtitle, checked, onChange, enabled = true }: { title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void; enabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{subtitle}</div>
      </div>
      <span style={{ width: 8 }} />
      <Switch checked={checked} onChange={onChange} enabled={enabled} />
    </div>
  )
}

function Action({ label, icon, onClick, destructive = false }: { label: string; icon: IconName; onClick: () => void; destructive?: boolean }) {
  const color = destructive ? 'var(--error)' : 'var(--primary)'
  return (
    <Bouncy onClick={onClick} style={{ borderRadius: 15, padding: '7px 0', display: 'flex', alignItems: 'center' }}>
      <Icon name={icon} size={20} color={color} />
      <span style={{ width: 10 }} />
      <span style={{ flex: 1, color, fontWeight: 600 }}>{label}</span>
      <Icon name="chevronRight" size={18} color="var(--onSurfaceVariant)" />
    </Bouncy>
  )
}

/** Replaces the native in-app APK updater: the web app updates itself from the server. */
function UpdateCard({ version }: { version: string }) {
  const [status, setStatus] = useState('')
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const check = async () => {
    setStatus('Controllo in corso…')
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (!registration) { setStatus('Aggiornamenti automatici: Garage si aggiorna da sola'); return }
      await registration.update()
      await new Promise((r) => setTimeout(r, 1500))
      if (registration.waiting) { setWaiting(registration.waiting); setStatus('Nuova versione disponibile: tocca per aggiornare') }
      else setStatus('Garage è aggiornata')
    } catch {
      setStatus('Server non raggiungibile')
    }
  }
  return (
    <Stagger index={8}>
      <GlassCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GradientIcon icon="repeat" size={46} iconSize={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700 }}>Aggiornamenti</div>
            <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', letterSpacing: 0.4 }}>{`Versione ${version || '—'} · aggiornata ogni notte dal server`}</div>
          </div>
        </div>
        <div style={{ height: 13 }} />
        {waiting ? (
          <GradientButton onClick={() => {
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload())
            waiting.postMessage('skipWaiting')
          }} height={48} radius={24}><span style={{ fontWeight: 700 }}>Aggiorna adesso</span></GradientButton>
        ) : (
          <OutlinedButton onClick={check} height={48} radius={24}>Controlla aggiornamenti</OutlinedButton>
        )}
        {status && <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '16px', paddingTop: 8 }}>{status}</div>}
      </GlassCard>
    </Stagger>
  )
}

function AccountDialogs({ mode, onDismiss }: { mode: null | 'password' | 'delete'; onDismiss: () => void }) {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { setCurrent(''); setPassword(''); setRepeat(''); setError('') }, [mode])
  const field = (value: string, set: (v: string) => void, label: string, autoComplete: string) => (
    <OutlinedField value={value} onChange={(v) => { set(v); setError('') }} label={label} type="password" autoComplete={autoComplete} bg="var(--surfaceContainerHigh)" />
  )
  if (mode === 'delete') {
    return (
      <Dialog open onDismiss={onDismiss} title="Elimina account"
        confirm={<DialogButton label="Elimina" color="var(--error)" onClick={async () => {
          try {
            await disablePush()
            await api('/api/account/delete', { method: 'POST', json: { password: current } })
            forgetUser(loggedUser())
            location.reload()
          } catch (e) { setError((e as Error).message) }
        }} />}
        dismiss={<DialogButton label="Annulla" onClick={onDismiss} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>L'account e tutti i suoi dati (auto, interventi, documenti) verranno eliminati dal server per sempre.</div>
          {field(current, setCurrent, 'Password', 'current-password')}
          {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
        </div>
      </Dialog>
    )
  }
  return (
    <Dialog open={mode === 'password'} onDismiss={onDismiss} title="Cambia password"
      confirm={<DialogButton label="Salva" onClick={async () => {
        if (password !== repeat) { setError('Le password non coincidono'); return }
        try {
          await api('/api/account/password', { method: 'POST', json: { current, password } })
          onDismiss()
          toast('Password aggiornata')
        } catch (e) { setError((e as Error).message) }
      }} />}
      dismiss={<DialogButton label="Annulla" onClick={onDismiss} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {field(current, setCurrent, 'Password attuale', 'current-password')}
        {field(password, setPassword, 'Nuova password', 'new-password')}
        {field(repeat, setRepeat, 'Ripeti la nuova password', 'new-password')}
        {error && <div style={{ color: 'var(--error)' }}>{error}</div>}
      </div>
    </Dialog>
  )
}
