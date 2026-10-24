// Atomic reminder helper (Cloudflare Worker, free plan).
// It stores only: a phone's push address, its time zone, and the minutes to wake it.
// Every minute it sends an empty "wake up" push to phones that have a reminder now;
// the phone itself decides which habit notifications to show.

interface Env {
  DB: D1Database
  VAPID_PUBLIC_KEY: string // base64url, uncompressed P-256 point
  VAPID_PRIVATE_JWK: string // secret: the private key as JSON
  VAPID_SUBJECT: string // contact: a mailto: address or the app's web address
  ALLOWED_ORIGIN: string
}

interface Row {
  endpoint: string
  tz: string
  times: string
  skip_date: string | null
  skip_times: string | null
}

const cors = (env: Env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
})

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) })
    if (request.method !== 'POST') return new Response('Atomic reminders', { headers: cors(env) })
    const path = new URL(request.url).pathname
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return new Response('bad json', { status: 400, headers: cors(env) })
    }
    const endpoint = String(body.endpoint ?? '')
    if (!endpoint.startsWith('https://')) return new Response('bad endpoint', { status: 400, headers: cors(env) })

    if (path === '/unsubscribe') {
      await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(endpoint).run()
      return new Response('ok', { headers: cors(env) })
    }
    if (path === '/subscribe') {
      const times = (Array.isArray(body.times) ? body.times : []).filter((t): t is string => typeof t === 'string' && /^\d\d:\d\d$/.test(t)).slice(0, 48)
      const skip = (Array.isArray(body.skip_times) ? body.skip_times : []).filter((t): t is string => typeof t === 'string').slice(0, 48)
      const tz = typeof body.tz === 'string' && body.tz.length < 64 ? body.tz : 'UTC'
      const skipDate = typeof body.skip_date === 'string' ? body.skip_date.slice(0, 10) : null
      await env.DB.prepare(
        `INSERT INTO subs (endpoint, tz, times, skip_date, skip_times, updated) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET tz = excluded.tz, times = excluded.times, skip_date = excluded.skip_date,
         skip_times = excluded.skip_times, updated = excluded.updated`,
      ).bind(endpoint, tz, JSON.stringify(times), skipDate, JSON.stringify(skip), Date.now()).run()
      return new Response('ok', { headers: cors(env) })
    }
    return new Response('not found', { status: 404, headers: cors(env) })
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const { results } = await env.DB.prepare('SELECT endpoint, tz, times, skip_date, skip_times FROM subs').all<Row>()
    const now = new Date()
    const sends: Promise<void>[] = []
    for (const row of results) {
      const { date, time } = localNow(now, row.tz)
      const times: string[] = JSON.parse(row.times)
      if (!times.includes(time)) continue
      if (row.skip_date === date && (JSON.parse(row.skip_times ?? '[]') as string[]).includes(time)) continue
      sends.push(wake(row.endpoint, env))
    }
    ctx.waitUntil(Promise.all(sends))
  },
}

function localNow(now: Date, tz: string) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(now).map((p) => [p.type, p.value]),
    )
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
  } catch {
    return { date: now.toISOString().slice(0, 10), time: now.toISOString().slice(11, 16) }
  }
}

/** Sends an empty push. A push with no message needs only a signed VAPID token, no encryption. */
async function wake(endpoint: string, env: Env) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${await vapidToken(new URL(endpoint).origin, env)}, k=${env.VAPID_PUBLIC_KEY}`,
      TTL: '300',
      Urgency: 'high',
      'Content-Length': '0',
    },
  })
  // The phone unsubscribed or the address expired: forget it.
  if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?').bind(endpoint).run()
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

let signingKey: CryptoKey | undefined

async function vapidToken(audience: string, env: Env) {
  signingKey ??= await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const enc = new TextEncoder()
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64url(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT })))
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, enc.encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64url(signature)}`
}
