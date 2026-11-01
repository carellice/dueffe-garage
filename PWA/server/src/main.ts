import { createServer as createHttp, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import * as data from './db.ts'
import * as accounts from './accounts.ts'
import { runJobs, runJobsForAll, subscribe, unsubscribe, vapidPublicKey } from './push.ts'

const PORT = Number(process.env.PORT ?? 8080)
const publicDir = process.env.PUBLIC_DIR ?? join(import.meta.dirname, '..', 'public')
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

/** Account mistakes and invalid data reach the user as they are. */
function dataCall<T>(work: () => T): T {
  try {
    return work()
  } catch (e) {
    if (e instanceof data.DataError) throw new HttpError(400, e.message)
    throw e
  }
}

/** A file sent inside the JSON body as a data URL (the editors upload photos and documents this way). */
function bytesOf(value: unknown, limit: number): Uint8Array | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const bytes = dataCall(() => data.decodeDataUrl(String(value)))
  if (bytes.length > limit) throw new HttpError(413, 'File troppo grande')
  return bytes
}

type Body = Record<string, unknown>

route('POST', '/api/vehicles', async (req, res) => {
  const body = await readJson<{ vehicle?: Body; photo?: string | null }>(req)
  const photo = bytesOf(body.photo, 15 * 1024 * 1024)
  json(res, 200, dataCall(() => data.saveVehicle(body.vehicle ?? {}, photo)))
  await runJobs()
})

route('DELETE', '/api/vehicles/:id', (_req, res, [id]) => {
  data.deleteVehicle(decodeURIComponent(id))
  json(res, 200, { ok: true })
})

route('POST', '/api/maintenances', async (req, res) => {
  const body = await readJson<{ maintenance?: Body; reminder?: Body | null }>(req)
  json(res, 200, dataCall(() => data.saveMaintenance(body.maintenance ?? {}, body.reminder ?? null)))
  await runJobs()
})

route('DELETE', '/api/maintenances/:id', (_req, res, [id]) => {
  data.deleteMaintenance(decodeURIComponent(id))
  json(res, 200, { ok: true })
})

route('DELETE', '/api/reminders/:id', (_req, res, [id]) => {
  data.deleteReminder(decodeURIComponent(id))
  json(res, 200, { ok: true })
})

route('POST', '/api/documents', async (req, res) => {
  const body = await readJson<{ document?: Body; data?: string }>(req)
  const bytes = bytesOf(body.data, 10 * 1024 * 1024) ?? undefined
  json(res, 200, dataCall(() => data.saveDocument(body.document ?? {}, bytes)))
})

route('DELETE', '/api/documents/:id', (_req, res, [id]) => {
  data.deleteDocument(decodeURIComponent(id))
  json(res, 200, { ok: true })
})

route('POST', '/api/clear', (_req, res) => {
  data.clear()
  json(res, 200, { ok: true })
})

route('POST', '/api/settings', async (req, res) => {
  const { leadDays } = await readJson<{ leadDays?: number }>(req)
  if (leadDays != null) data.setLeadDays(Number(leadDays) || 7)
  json(res, 200, { ok: true })
  await runJobs()
})

/** The vehicle photo or the document file: /api/files/vehicle/<id> or /api/files/document/<id>. */
route('GET', '/api/files/:kind/:id', (req, res, [kind, id], url) => {
  if (kind !== 'vehicle' && kind !== 'document') throw new HttpError(404, 'Non trovato')
  const found = data.file(kind, decodeURIComponent(id))
  if (!found) throw new HttpError(404, 'File non trovato')
  const headers: Record<string, string | number> = {
    'Content-Type': found.mime,
    'Content-Length': found.bytes.length,
    // The URL carries updatedAt (?v=), so a changed file gets a new address.
    'Cache-Control': url.searchParams.has('v') ? 'private, max-age=31536000, immutable' : 'private, no-cache',
  }
  if (url.searchParams.has('download')) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(found.name)}`
  res.writeHead(200, headers)
  res.end(req.method === 'HEAD' ? undefined : found.bytes)
})

// The same JSON backup as the Android app, photos and documents included.
route('GET', '/api/backup', (_req, res) => {
  const text = data.exportBackup()
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(text)
})

route('POST', '/api/backup', async (req, res) => {
  const body = await readBody(req, 250 * 1024 * 1024)
  json(res, 200, dataCall(() => data.importBackup(body.toString('utf8'))))
  await runJobs()
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
    serveStatic(req, res, path)
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    if (status === 500) console.error(e)
    if (!res.headersSent) json(res, status, { error: e instanceof HttpError ? e.message : 'Errore del server' })
    else res.end()
  }
}

await runJobsForAll()
// Like WorkManager's periodic job: background work of every account, every hour.
setInterval(runJobsForAll, 60 * 60 * 1000)

// Phones reach it in HTTPS through Tailscale (tailscale serve), in front of this plain HTTP port.
createHttp(handle).listen(PORT, () => console.log(`Garage ${VERSION} su http://0.0.0.0:${PORT}`))
