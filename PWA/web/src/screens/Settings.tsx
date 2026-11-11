import { useEffect, useState, type ReactNode } from 'react'
import { AccentBadge, Bouncy, Icon, Overline, PageHeading, PageTopBar, Panel, RowDivider, Slider, Stagger, Switch, TintBadge } from '../components/ui.tsx'
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
import { back } from '../lib/nav.ts'
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
    <div className="scroll">
      <PageTopBar onBack={() => back()} backLabel="Garage" />
      <div style={{ padding: '0 18px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Stagger index={0} style={{ padding: '0 2px' }}><PageHeading overline="Garage" title="Impostazioni" subtitle="Il tuo spazio, come piace a te." /></Stagger>
        <Group title="Aspetto" index={1}>
          <ThemePicker theme={settings.theme} onChange={(theme) => updateSettings({ theme })} />
        </Group>
        <Group title="Scadenze" index={2}>
          <SwitchRow icon="calendarNav" title="Notifiche" subtitle={pushSupported() ? 'Avvisami delle prossime scadenze' : 'Apri Garage in HTTPS e installala come app'}
            checked={settings.remindersEnabled} onChange={onNotifications} />
          {settings.remindersEnabled && <>
            <RowDivider />
            <div style={{ padding: '12px 16px 6px 72px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1, fontWeight: 500 }}>Preavviso</span>
                <span className="tnum" style={{ color: 'var(--primary)', fontWeight: 700 }}>{`${leadDays} ${leadDays === 1 ? 'giorno' : 'giorni'}`}</span>
              </div>
              <Slider value={leadDays} min={1} max={30} onChange={(v) => setLeadDays(Math.min(30, Math.max(1, Math.trunc(v))))} />
            </div>
          </>}
          <SaveLeadDays value={leadDays} saved={data.leadDays} />
        </Group>
        <Group title="Privacy e accesso" index={3} footer="Il blocco protegge l'accesso all'app; i backup esportati non sono cifrati.">
          <SwitchRow icon="shield" title="Proteggi Garage" subtitle="Richiedi il PIN all'apertura" checked={settings.protection} onChange={onProtection} />
          {settings.protection && <>
            <RowDivider />
            <SwitchRow icon="settingsNav" title="Biometria" subtitle={biometricAvailable ? 'Usa impronta o volto' : 'Non disponibile su questo dispositivo'}
              checked={!!settings.lockCredential} onChange={onBiometric} enabled={biometricAvailable && hasPin} />
            <RowDivider />
            <ActionRow icon="edit" title="Cambia PIN" onClick={() => setPinSetup({ enablesProtection: false })} />
            <RowDivider />
            <ActionRow icon="shield" title="Blocca adesso" onClick={lockNow} />
          </>}
        </Group>
        <Group title="I tuoi dati" index={4} footer="Il file include foto e documenti e non è cifrato. È lo stesso formato dell'app Android.">
          <ActionRow icon="share" title="Esporta backup" subtitle={backupStatus} onClick={exportBackup} />
          <RowDivider />
          <ActionRow icon="folder" title="Importa backup" subtitle="Sostituisce i dati di questo account" onClick={importBackup} />
        </Group>
        <Group title="Account" index={5}>
          <ActionRow icon="licensePlate" title="Cambia password" subtitle={`Sei entrato come ${loggedUser()}`} onClick={() => setAccount('password')} />
          <RowDivider />
          <ActionRow icon="arrowBack" title="Esci" onClick={async () => {
            await disablePush()
            await api('/api/logout', { method: 'POST' }).catch(() => {})
            location.reload()
          }} />
        </Group>
        <Group title="App" index={6}>
          <ActionRow icon="note" title="Rivedi l'introduzione" onClick={onOnboarding} />
          <RowDivider />
          <UpdateRow version={version} />
        </Group>
        <Group title="Zona pericolosa" index={7}>
          <ActionRow icon="delete" title="Elimina tutti i dati" subtitle="Auto, interventi e documenti" destructive onClick={() => setClearConfirm(true)} />
          <RowDivider />
          <ActionRow icon="delete" title="Elimina account" subtitle="L'account e tutti i suoi dati" destructive onClick={() => setAccount('delete')} />
        </Group>
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

function Group({ title, index, footer, children }: { title: string; index: number; footer?: string; children: ReactNode }) {
  return (
    <Stagger index={index}>
      <Overline text={title} style={{ padding: '0 4px 8px' }} />
      <Panel padding={0} style={{ overflow: 'hidden' }}>{children}</Panel>
      {footer && <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 12, lineHeight: '17px', padding: '8px 4px 0' }}>{footer}</div>}
    </Stagger>
  )
}

function ThemePicker({ theme, onChange }: { theme: ThemeMode; onChange: (t: ThemeMode) => void }) {
  const options: [ThemeMode, string][] = [['SYSTEM', 'Automatico'], ['LIGHT', 'Chiaro'], ['DARK', 'Scuro']]
  return (
    <div style={{ margin: 12, display: 'flex', gap: 4, borderRadius: 14, background: 'var(--surfaceContainerHigh)', padding: 4 }}>
      {options.map(([key, label]) => {
        const selected = theme === key
        return (
          <Bouncy key={key} role="radio" onClick={() => onChange(key)} ripple={selected ? 'var(--onAccent)' : 'currentColor'} style={{
            flex: 1, borderRadius: 11, padding: '11px 0', textAlign: 'center', fontSize: 13, fontWeight: selected ? 700 : 500,
            background: selected ? 'var(--primary)' : 'transparent', color: selected ? 'var(--onAccent)' : 'var(--onSurfaceVariant)', transition: 'background-color 220ms, color 220ms',
          }}>{label}</Bouncy>
        )
      })}
    </div>
  )
}

function SwitchRow({ icon, title, subtitle, checked, onChange, enabled = true }: { icon: IconName; title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void; enabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px' }}>
      <AccentBadge icon={icon} size={42} iconSize={20} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '18px' }}>{subtitle}</div>
      </div>
      <Switch checked={checked} onChange={onChange} enabled={enabled} />
    </div>
  )
}

function ActionRow({ icon, title, subtitle, onClick, destructive = false }: { icon: IconName; title: string; subtitle?: string; onClick: () => void; destructive?: boolean }) {
  return (
    <Bouncy onClick={onClick} label={title} pressed={0.985} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px' }}>
      {destructive ? <TintBadge icon={icon} tint="var(--error)" background="color-mix(in srgb, var(--error) 12%, transparent)" size={42} iconSize={20} /> : <AccentBadge icon={icon} size={42} iconSize={20} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: destructive ? 'var(--error)' : 'var(--onSurface)' }}>{title}</div>
        {subtitle && <div className="ellipsis" style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, lineHeight: '18px' }}>{subtitle}</div>}
      </div>
      <Icon name="chevronRight" size={18} color="var(--onSurfaceVariant)" />
    </Bouncy>
  )
}

/** Replaces the native in-app APK updater: the web app updates itself from the server. */
function UpdateRow({ version }: { version: string }) {
  const [status, setStatus] = useState('')
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const check = async () => {
    if (waiting) {
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload())
      waiting.postMessage('skipWaiting')
      return
    }
    setStatus('Controllo in corso…')
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (!registration) { setStatus('Garage si aggiorna da sola'); return }
      await registration.update()
      await new Promise((r) => setTimeout(r, 1500))
      if (registration.waiting) { setWaiting(registration.waiting); setStatus('Nuova versione disponibile: tocca per aggiornare') }
      else setStatus('Garage è aggiornata')
    } catch {
      setStatus('Server non raggiungibile')
    }
  }
  return <ActionRow icon="repeat" title={waiting ? 'Aggiorna adesso' : 'Controlla aggiornamenti'} subtitle={status || `Versione ${version || '—'} · aggiornata ogni notte dal server`} onClick={check} />
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
