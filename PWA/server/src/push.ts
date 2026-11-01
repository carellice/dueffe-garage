import webpush from 'web-push'
import { getServerMeta, setServerMeta, userIds } from './accounts.ts'
import { db, getMeta, leadDays, setMeta, state, withUser } from './db.ts'
import { dueReminders, maintenanceLabel } from '../../shared/logic.ts'

// Web Push replaces the native notifications: the server decides when to send them, like a
// WorkManager job / BGTask did on the phone.

// One pair of keys for the whole server; each account keeps the subscriptions of its own devices.
let keys = { publicKey: getServerMeta('vapid_public') ?? '', privateKey: getServerMeta('vapid_private') ?? '' }
if (!keys.publicKey || !keys.privateKey) {
  keys = webpush.generateVAPIDKeys()
  setServerMeta('vapid_public', keys.publicKey)
  setServerMeta('vapid_private', keys.privateKey)
}
webpush.setVapidDetails('https://github.com/carellice/dueffe-garage', keys.publicKey, keys.privateKey)

export const vapidPublicKey = keys.publicKey

type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } }

/** Subscribes a device of the current account. A phone moved to another account stops getting the old one's notifications. */
export function subscribe(subscription: Subscription, reminders: boolean, userId: number) {
  for (const other of userIds()) {
    if (other !== userId) withUser(other, () => unsubscribe(subscription.endpoint))
  }
  db.prepare('INSERT INTO push_subs (endpoint, json, reminders) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET json = excluded.json, reminders = excluded.reminders')
    .run(subscription.endpoint, JSON.stringify(subscription), reminders ? 1 : 0)
}

export function unsubscribe(endpoint: string) {
  db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(endpoint)
}

/** url: where a tap on the notification opens the app (a deep link like "/?route=..."). tag: replaces older ones with the same tag. */
export type Payload = { title: string; body: string; url: string; tag: string }

/** Sends to every device of the current account. */
export async function send(payload: Payload) {
  const rows = db.prepare('SELECT endpoint, json FROM push_subs WHERE reminders = 1').all() as { endpoint: string; json: string }[]
  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification(JSON.parse(row.json), JSON.stringify(payload), { TTL: 60 * 60 * 24 })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // The browser dropped the subscription: forget it.
      if (status === 404 || status === 410) unsubscribe(row.endpoint)
      else console.warn('Push non inviata:', (e as Error).message)
    }
  }))
}

/**
 * ReminderWorker: a notification for each deadline within the notice days (or km threshold reached),
 * once per version of the reminder. Nothing is marked as sent while no device can receive it.
 */
export async function runJobs() {
  try {
    const devices = db.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE reminders = 1').get() as { n: number }
    if (Number(devices.n) === 0) return
    const lead = leadDays()
    for (const item of dueReminders(state())) {
      const relevant = (item.days != null && item.days >= 0 && item.days <= lead) || (item.kmLeft != null && item.kmLeft <= 0)
      const key = `${item.reminder.dueDate}:${item.reminder.mileageThreshold}:${item.reminder.updatedAt}`
      if (!relevant || getMeta(`notified:${item.reminder.id}`) === key) continue
      const body = item.kmLeft != null && item.kmLeft <= 0 ? 'Soglia chilometrica raggiunta' : item.days === 0 ? 'Scade oggi' : `Tra ${item.days} giorni`
      await send({ title: `${item.vehicle.name} · ${maintenanceLabel(item.maintenance)}`, body, url: '/?route=scadenze', tag: `reminder-${item.reminder.id}` })
      setMeta(`notified:${item.reminder.id}`, key)
    }
  } catch (e) {
    console.error('Lavoro periodico non riuscito:', e)
  }
}

/** The same for every account, every hour. */
export async function runJobsForAll() {
  for (const id of userIds()) await withUser(id, runJobs)
}
