// Irisflow token service. Join by link, no accounts, no database (state is in memory).
//
// Host model: creating a meeting returns a host grant (HMAC of the room code). Whoever
// presents a valid grant is host. Everyone else is a guest and waits in the lobby until
// a host admits them. A guest's LiveKit token is only ever created after approval.
import http from 'node:http'
import crypto from 'node:crypto'
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk'

const KEY = process.env.LIVEKIT_API_KEY || 'devkey'
const SECRET = process.env.LIVEKIT_API_SECRET || 'secret'
const LK_HTTP = process.env.LIVEKIT_HTTP_URL || 'http://localhost:7880'
const PORT = Number(process.env.PORT || 8787)
const PENDING_TTL_MS = 10 * 60 * 1000
const MAX_PENDING_PER_ROOM = 50

const rooms = new RoomServiceClient(LK_HTTP, KEY, SECRET)

// room -> Map(requestId -> { name, status, token?, created })
const lobby = new Map()

// Meetings created through this server (code -> expiry). Lost on restart, so a room that
// LiveKit still reports as live also counts as existing.
const KNOWN_TTL_MS = 24 * 60 * 60 * 1000
const known = new Map()
async function roomExists(room, grant) {
  if (!validRoom(room)) return false
  if (validGrant(room, grant)) { known.set(room, Date.now() + KNOWN_TTL_MS); return true }
  if ((known.get(room) ?? 0) > Date.now()) return true
  try { return (await rooms.listRooms([room])).length > 0 } catch { return false }
}

const grantFor = (room) => crypto.createHmac('sha256', SECRET).update(`host:${room}`).digest('base64url')
const validGrant = (room, grant) => {
  if (typeof grant !== 'string') return false
  const a = Buffer.from(grant), b = Buffer.from(grantFor(room))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
const validRoom = (r) => typeof r === 'string' && /^[a-z0-9-]{3,64}$/.test(r)
const cleanName = (n) => String(n || 'Guest').trim().slice(0, 40) || 'Guest'
const rid = () => crypto.randomBytes(12).toString('base64url')
const code = () => {
  const L = 'abcdefghijkmnpqrstuvwxyz'
  const p = (n) => Array.from({ length: n }, () => L[crypto.randomInt(L.length)]).join('')
  return `${p(3)}-${p(4)}-${p(3)}`
}

async function mint(room, name, host) {
  const at = new AccessToken(KEY, SECRET, {
    identity: `${name.replace(/[^\w -]/g, '')}-${rid().slice(0, 6)}`,
    name,
    ttl: '4h',
  })
  at.addGrant({
    room, roomJoin: true, canPublish: true, canSubscribe: true,
    canPublishData: true, canUpdateOwnMetadata: true,
    ...(host ? { roomAdmin: true } : {}),
  })
  return at.toJwt()
}

function sweep() {
  const now = Date.now()
  for (const [room, m] of lobby) {
    for (const [id, r] of m) if (now - r.created > PENDING_TTL_MS) m.delete(id)
    if (!m.size) lobby.delete(room)
  }
}
setInterval(sweep, 60_000).unref()

const send = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
const readBody = (req) => new Promise((resolve) => {
  let s = ''
  req.on('data', (c) => { s += c; if (s.length > 10_000) req.destroy() })
  req.on('end', () => { try { resolve(JSON.parse(s || '{}')) } catch { resolve({}) } })
})

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x')
    const q = url.searchParams
    const body = req.method === 'POST' ? await readBody(req) : {}
    const path = url.pathname

    // Create a meeting. The caller becomes its host.
    if (path === '/api/rooms' && req.method === 'POST') {
      const room = code()
      known.set(room, Date.now() + KNOWN_TTL_MS)
      return send(res, 200, { room, hostGrant: grantFor(room) })
    }

    // Does this meeting exist? Used by the home page and the join link.
    if (path === '/api/rooms/exists' && req.method === 'GET') {
      return send(res, 200, { exists: await roomExists(q.get('room'), q.get('hostGrant')) })
    }

    // Join. Host grant -> token now. Otherwise -> lobby request.
    if (path === '/api/join' && req.method === 'POST') {
      const { room, name, hostGrant } = body
      if (!validRoom(room)) return send(res, 400, { error: 'bad room' })
      const n = cleanName(name)
      if (!(await roomExists(room, hostGrant))) return send(res, 404, { error: 'not found' })
      if (validGrant(room, hostGrant)) {
        return send(res, 200, { status: 'admitted', host: true, token: await mint(room, n, true) })
      }
      let m = lobby.get(room)
      if (!m) lobby.set(room, (m = new Map()))
      if (m.size >= MAX_PENDING_PER_ROOM) return send(res, 429, { error: 'too many requests' })
      const requestId = rid()
      m.set(requestId, { name: n, status: 'waiting', created: Date.now() })
      return send(res, 200, { status: 'waiting', requestId })
    }

    // Guest polls their own request. Token is released here, only once approved.
    if (path === '/api/join/status' && req.method === 'GET') {
      const room = q.get('room'), id = q.get('requestId')
      const r = validRoom(room) && lobby.get(room)?.get(id)
      if (!r) return send(res, 404, { status: 'gone' })
      if (r.status === 'admitted') {
        lobby.get(room).delete(id)
        return send(res, 200, { status: 'admitted', host: false, token: await mint(room, r.name, false) })
      }
      if (r.status === 'denied') { lobby.get(room).delete(id); return send(res, 200, { status: 'denied' }) }
      return send(res, 200, { status: 'waiting' })
    }

    // Everything below needs the host grant.
    const room = body.room ?? q.get('room')
    const grant = body.hostGrant ?? q.get('hostGrant')
    const hostOnly = path === '/api/lobby' || path === '/api/lobby/decide' || path === '/api/mod'
    if (hostOnly && (!validRoom(room) || !validGrant(room, grant))) return send(res, 403, { error: 'not host' })

    if (path === '/api/lobby' && req.method === 'GET') {
      const list = [...(lobby.get(room) ?? [])]
        .filter(([, r]) => r.status === 'waiting')
        .map(([requestId, r]) => ({ requestId, name: r.name }))
      return send(res, 200, { waiting: list })
    }

    if (path === '/api/lobby/decide' && req.method === 'POST') {
      const r = lobby.get(room)?.get(body.requestId)
      if (!r) return send(res, 404, { error: 'gone' })
      r.status = body.allow ? 'admitted' : 'denied'
      return send(res, 200, { ok: true })
    }

    if (path === '/api/mod' && req.method === 'POST') {
      const { action, identity } = body
      if (typeof identity !== 'string') return send(res, 400, { error: 'identity required' })
      if (action !== 'remove' && action !== 'mute') return send(res, 400, { error: 'bad action' })
      try {
        if (action === 'remove') {
          await rooms.removeParticipant(room, identity)
        } else {
          const p = await rooms.getParticipant(room, identity)
          for (const t of p.tracks) if (t.source === TrackSource.MICROPHONE && !t.muted) await rooms.mutePublishedTrack(room, identity, t.sid, true)
        }
      } catch {
        return send(res, 404, { error: 'participant not found' })
      }
      return send(res, 200, { ok: true })
    }

    send(res, 404, { error: 'not found' })
  } catch (e) {
    console.error(e)
    send(res, 500, { error: 'server error' })
  }
}).listen(PORT, () => console.log(`irisflow server on :${PORT}`))
