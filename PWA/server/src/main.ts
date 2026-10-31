import { createServer as createHttp, type IncomingMessage, type ServerResponse } from 'node:http'
import { createServer as createHttps } from 'node:https'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import * as data from './db.ts'
import * as accounts from './accounts.ts'
import { runJobs, runJobsForAll, subscribe, unsubscribe, vapidPublicKey } from './push.ts'
import { backupDefaults, type GarageDocument, type Maintenance, type Reminder } from '../../shared/model.ts'

const PORT = Number(process.env.PORT ?? 8080)
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 8443)
const publicDir = process.env.PUBLIC_DIR ?? join(import.meta.dirname, '..', 'public')
const certDir = join(data.dataDir, 'certs')
// The version the updater compares with GitHub: bump it in package.json to release.
const VERSION = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).version as string

// Node runs this file with type stripping: no enums, namespaces or parameter properties.
class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// --- helpers ---------------------------------------------------------------------------------

function json(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(text)
}

async function readBody(req: IncomingMessage, limit = 25 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new HttpError(413, 'File troppo grande')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const body = await readBody(req)
  try {
    return JSON.parse(body.toString('utf8')) as T
  } catch {
    throw new HttpError(400, 'Richiesta non valida')
  }
}

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) out[k] = decodeURIComponent(v.join('='))
  }
  return out
}

const secure = (req: IncomingMessage) =>
  (req.socket as { encrypted?: boolean }).encrypted === true || req.headers['x-forwarded-proto'] === 'https'

// --- auth: one account per person, each with its own data -----------------------------------

const SESSION = 'garage_session'

const sessionUser = (req: IncomingMessage) => accounts.sessionUser(cookies(req)[SESSION])

function startSession(req: IncomingMessage, res: ServerResponse, userId: number) {
  const token = accounts.startSession(userId)
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}${secure(req) ? '; Secure' : ''}`
  res.setHeader('Set-Cookie', `${SESSION}=${token}; ${flags}`)
}

function clearSession(res: ServerResponse) {
  res.setHeader('Set-Cookie', `${SESSION}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

/** Account mistakes (name taken, short password...) reach the user as they are. */
function accountCall(work: () => void) {
  try {
    work()
  } catch (e) {
    if (e instanceof accounts.AccountError) throw new HttpError(400, e.message)
    throw e
  }
}

// --- static files ----------------------------------------------------------------------------

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.crt': 'application/x-x509-ca-cert', '.txt': 'text/plain; charset=utf-8',
}

function sendFile(req: IncomingMessage, res: ServerResponse, file: string, cache: string) {
  const stat = statSync(file)
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304)
    res.end()
    return
  }
  res.writeHead(200, {
    'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': cache,
    ETag: etag,
  })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
}

function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
  const clean = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '')
  const file = join(publicDir, clean)
  if (file.startsWith(publicDir) && clean && existsSync(file) && statSync(file).isFile()) {
    const immutable = clean.startsWith('assets')
    sendFile(req, res, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
    return
  }
  // Single page app: every other path gets the shell.
  sendFile(req, res, join(publicDir, 'index.html'), 'no-cache')
}

// --- API -------------------------------------------------------------------------------------

type Handler = (req: IncomingMessage, res: ServerResponse, params: string[], url: URL, user: accounts.User) => Promise<void> | void
const routes: [string, RegExp, Handler][] = []
const route = (method: string, pattern: string, handler: Handler) =>
  routes.push([method, new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), handler])

route('GET', '/api/session', (req, res) => {
  const user = sessionUser(req)
  json(res, 200, { loggedIn: user != null, username: user?.username ?? null, version: VERSION })
})

route('POST', '/api/register', async (req, res) => {
  const { username, password } = await readJson<{ username?: string; password?: string }>(req)
  accountCall(() => {
    const user = accounts.register(String(username ?? ''), String(password ?? ''))
    startSession(req, res, user.id)
    json(res, 200, { username: user.username })
  })
})

route('POST', '/api/login', async (req, res) => {
  const { username, password } = await readJson<{ username?: string; password?: string }>(req)
  const user = accounts.login(String(username ?? ''), String(password ?? ''))
  if (!user) {
    await new Promise((r) => setTimeout(r, 800))
    throw new HttpError(401, 'Nome utente o password sbagliati')
  }
  startSession(req, res, user.id)
  json(res, 200, { username: user.username })
})

route('POST', '/api/logout', (req, res) => {
  const token = cookies(req)[SESSION]
  if (token) accounts.endSession(token)
  clearSession(res)
  json(res, 200, { ok: true })
})

route('POST', '/api/account/password', async (req, res, _p, _u, user) => {
  const { current, password } = await readJson<{ current?: string; password?: string }>(req)
  accountCall(() => accounts.changePassword(user.id, String(current ?? ''), String(password ?? '')))
  json(res, 200, { ok: true })
})

route('POST', '/api/account/delete', async (req, res, _p, _u, user) => {
  const { password } = await readJson<{ password?: string }>(req)
  accountCall(() => accounts.deleteAccount(user.id, String(password ?? '')))
  clearSession(res)
  json(res, 200, { ok: true })
})

/** Everything the app shows; "unchanged" when the client already has this revision (polling every 30 s). */
route('GET', '/api/state', (_req, res, _p, url) => {
  const rev = data.revision()
  if (url.searchParams.get('since') === String(rev)) {
    json(res, 200, { revision: rev, unchanged: true })
    return
  }
  json(res, 200, { revision: rev, ...data.state() })
})

// --- Garage data: the writes of GarageRepository, one route each ----------------------------

/** Files travel as data URLs ("data:<mime>;base64,..."), like inside the backup. */
function fileBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !value.startsWith('data:') || !value.includes(',')) throw new HttpError(400, 'File non leggibile')
  const bytes = Buffer.from(value.slice(value.indexOf(',') + 1), 'base64')
  if (bytes.length === 0) throw new HttpError(400, 'File vuoto')
  return bytes
}

route('POST', '/api/vehicles', async (req, res) => {
  const body = await readJson<{ vehicle: Record<string, unknown>; photo?: string | null }>(req)
  const vehicle = backupDefaults.vehicle(body.vehicle ?? {})
  if (!vehicle.id.trim() || !vehicle.name.trim() || !vehicle.make.trim() || !vehicle.plate.trim()) {
    throw new HttpError(400, 'Controlla nome, marca, targa, anno e chilometri')
  }
  const photo = body.photo === undefined ? undefined : body.photo === null ? null : fileBytes(body.photo)
  if (photo && photo.length > 15 * 1024 * 1024) throw new HttpError(413, 'File troppo grande')
  data.saveVehicle(vehicle, photo)
  await runJobs()
  json(res, 200, { ok: true })
})

route('POST', '/api/maintenances', async (req, res) => {
  const body = await readJson<{ maintenance: Record<string, unknown>; reminder: Record<string, unknown> | null }>(req)
  const maintenance: Maintenance = backupDefaults.maintenance(body.maintenance ?? {})
  const reminder: Reminder | null = body.reminder ? backupDefaults.reminder(body.reminder) : null
  if (!maintenance.id.trim() || !data.state().vehicles.some((v) => v.id === maintenance.vehicleId)) throw new HttpError(400, 'Auto non disponibile')
  if (reminder && (!reminder.id.trim() || reminder.maintenanceId !== maintenance.id)) throw new HttpError(400, 'Promemoria non valido')
  data.saveMaintenance(maintenance, reminder)
  await runJobs()
  json(res, 200, { ok: true })
})

route('POST', '/api/documents', async (req, res) => {
  const body = await readJson<{ document: Record<string, unknown>; data?: string }>(req)
  const bytes = body.data === undefined ? undefined : fileBytes(body.data)
  if (bytes && bytes.length > 10 * 1024 * 1024) throw new HttpError(413, 'File troppo grande')
  const current = data.state()
  const previous = current.documents.find((d) => d.id === String(body.document?.id ?? ''))
  const document: GarageDocument = backupDefaults.document(body.document ?? {}, bytes?.length ?? previous?.size ?? 0)
  document.size = bytes?.length ?? previous?.size ?? 0
  if (!document.id.trim() || !document.name.trim() || !current.vehicles.some((v) => v.id === document.vehicleId)) throw new HttpError(400, 'Scegli un file e inserisci il nome')
  if (!bytes && !previous) throw new HttpError(400, 'Scegli un file e inserisci il nome')
  if (document.maintenanceId != null && !current.maintenances.some((m) => m.id === document.maintenanceId && m.vehicleId === document.vehicleId)) {
    throw new HttpError(400, 'Intervento non disponibile')
  }
  data.saveDocument(document, bytes)
  json(res, 200, { ok: true })
})

route('DELETE', '/api/vehicles/:id', (_req, res, [id]) => { data.deleteVehicle(decodeURIComponent(id)); json(res, 200, { ok: true }) })
route('DELETE', '/api/maintenances/:id', (_req, res, [id]) => { data.deleteMaintenance(decodeURIComponent(id)); json(res, 200, { ok: true }) })
route('DELETE', '/api/reminders/:id', (_req, res, [id]) => { data.deleteReminder(decodeURIComponent(id)); json(res, 200, { ok: true }) })
route('DELETE', '/api/documents/:id', (_req, res, [id]) => { data.deleteDocument(decodeURIComponent(id)); json(res, 200, { ok: true }) })
route('POST', '/api/clear', (_req, res) => { data.clear(); json(res, 200, { ok: true }) })

/** Preavviso of the notifications: per account, since the server sends them. */
route('POST', '/api/settings', async (req, res) => {
  const body = await readJson<{ leadDays?: number }>(req)
  if (typeof body.leadDays === 'number' && Number.isFinite(body.leadDays)) data.setLeadDays(body.leadDays)
  await runJobs()
  json(res, 200, { ok: true })
})

// Backup: the same JSON file as the Android app, photos and documents included.
route('GET', '/api/backup', (_req, res) => {
  const body = data.exportBackup()
  data.markExported()
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
})

route('POST', '/api/backup', async (req, res) => {
  const body = await readBody(req, 250 * 1024 * 1024)
  try {
    data.importBackup(body.toString('utf8'))
  } catch (e) {
    if (e instanceof data.BackupError) throw new HttpError(400, e.message)
    throw e
  }
  json(res, 200, { ok: true })
})

// Push
route('GET', '/api/push/key', (_req, res) => json(res, 200, { key: vapidPublicKey }))
route('POST', '/api/push/subscribe', async (req, res, _p, _u, user) => {
  const { subscription, reminders } = await readJson<{ subscription: Parameters<typeof subscribe>[0]; reminders: boolean }>(req)
  if (!subscription?.endpoint) throw new HttpError(400, 'Iscrizione non valida')
  subscribe(subscription, reminders !== false, user.id)
  json(res, 200, { ok: true })
})
route('POST', '/api/push/unsubscribe', async (req, res) => {
  const { endpoint } = await readJson<{ endpoint: string }>(req)
  if (endpoint) unsubscribe(endpoint)
  json(res, 200, { ok: true })
})

// --- server ----------------------------------------------------------------------------------

const open = new Set(['/api/session', '/api/register', '/api/login', '/api/logout'])

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  try {
    if (path === '/certificato' || path === '/garage-ca.crt') {
      const ca = join(certDir, 'garage-ca.crt')
      if (!existsSync(ca)) throw new HttpError(404, 'HTTPS locale non attivo')
      if (path === '/garage-ca.crt') sendFile(req, res, ca, 'no-cache')
      else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(certificatePage(req))
      }
      return
    }
    if (path.startsWith('/api/')) {
      const user = sessionUser(req)
      if (!open.has(path) && !user) throw new HttpError(401, 'Accesso richiesto')
      for (const [method, pattern, handler] of routes) {
        const match = pattern.exec(path)
        if (match && method === req.method) {
          // Everything the handler reads or writes belongs to the logged in account.
          if (user) await data.withUser(user.id, () => handler(req, res, match.slice(1), url, user))
          else await handler(req, res, match.slice(1), url, { id: 0, username: '' })
          return
        }
      }
      throw new HttpError(404, 'Non trovato')
    }
    if (path.startsWith('/files/')) {
      // Vehicle photos and documents, only for the account they belong to.
      const user = sessionUser(req)
      if (!user) throw new HttpError(401, 'Accesso richiesto')
      const match = /^\/files\/(vehicle|document)\/([\w-]+)$/.exec(path)
      const found = match ? data.withUser(user.id, () => {
        const bytes = data.binary(match[1] as 'vehicle' | 'document', match[2])
        const doc = match[1] === 'document' ? data.state().documents.find((d) => d.id === match[2]) : undefined
        return bytes ? { bytes, mime: doc?.mimeType || sniff(bytes), name: doc?.name } : null
      }) : null
      if (!found) throw new HttpError(404, 'File non trovato')
      const headers: Record<string, string | number> = {
        'Content-Type': found.mime, 'Content-Length': found.bytes.length, 'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      }
      if (found.name) headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(found.name)}`
      res.writeHead(200, headers)
      res.end(req.method === 'HEAD' ? undefined : Buffer.from(found.bytes))
      return
    }
    serveStatic(req, res, path)
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    if (status === 500) console.error(e)
    if (!res.headersSent) json(res, status, { error: e instanceof HttpError ? e.message : 'Errore del server' })
    else res.end()
  }
}

/** The type of a stored photo, from its first bytes. */
function sniff(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return 'application/octet-stream'
}

/** How to trust the local certificate authority, for the "HTTPS in casa" mode. */
function certificatePage(req: IncomingMessage): string {
  const host = (req.headers.host ?? '').split(':')[0]
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Garage · certificato</title><style>body{font-family:system-ui,sans-serif;background:#F7F3EA;color:#15121F;max-width:560px;margin:auto;padding:24px;line-height:1.5}
a.b{display:inline-block;background:#B8A6FF;color:#15121F;padding:14px 22px;border-radius:99px;text-decoration:none;font-weight:600}li{margin:6px 0}</style></head><body>
<h1>Installa il certificato di Garage</h1><p>Serve una volta sola per telefono: dopo, Garage si apre in HTTPS e si può installare come app.</p>
<p><a class="b" href="/garage-ca.crt">Scarica il certificato</a></p>
<h3>Android</h3><ol><li>Scarica il file qui sopra.</li><li>Impostazioni → Sicurezza e privacy → Altre impostazioni di sicurezza → Installa da memoria → <b>Certificato CA</b>.</li><li>Scegli <i>garage-ca.crt</i> e conferma.</li></ol>
<h3>iPhone</h3><ol><li>Apri questa pagina con Safari e scarica il file.</li><li>Impostazioni → Profilo scaricato → Installa.</li><li>Impostazioni → Generali → Info → Impostazioni attendibilità certificati → attiva <i>Garage CA</i>.</li></ol>
<p>Poi apri <b>https://${host}:${HTTPS_PORT}</b></p></body></html>`
}

await runJobsForAll()
// Like WorkManager's periodic job: background work of every account, every hour.
setInterval(runJobsForAll, 60 * 60 * 1000)

createHttp(handle).listen(PORT, () => console.log(`Garage ${VERSION} su http://0.0.0.0:${PORT}`))

const cert = join(certDir, 'server.crt')
const key = join(certDir, 'server.key')
if (existsSync(cert) && existsSync(key)) {
  createHttps({ cert: readFileSync(cert), key: readFileSync(key) }, handle)
    .listen(HTTPS_PORT, () => console.log(`Garage in HTTPS su https://0.0.0.0:${HTTPS_PORT}`))
}
