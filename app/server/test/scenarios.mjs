// Plays host and guest against the token server and checks every join scenario.
//   node test/scenarios.mjs              starts local servers and runs the app scenarios
//   BASE=https://iris.sdcloud.uk node test/scenarios.mjs public   checks guest paths through Cloudflare
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseCode } from '../../web/src/code.js'

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`) }
const j = async (base, path, opts = {}) => {
  const r = await fetch(base + path, { redirect: 'manual', ...opts, headers: { 'content-type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined })
  let data = null; try { data = await r.json() } catch { /* not json */ }
  return { s: r.status, d: data, redirected: r.status >= 300 && r.status < 400 }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (process.argv[2] === 'public') {
  const base = process.env.BASE || 'https://iris.sdcloud.uk'
  console.log(`Guest paths on ${base} (signed out). Each must answer, not redirect to sign-in.`)
  for (const [m, p] of [['GET', '/s/abc-defg-hij'], ['GET', '/r/abc-defg-hij'], ['GET', '/og.png'], ['GET', '/favicon.svg'], ['GET', '/api/rooms/exists?room=abc-defg-hij'], ['POST', '/api/join'], ['GET', '/api/join/status?room=abc-defg-hij&requestId=x'], ['GET', '/lk/']]) {
    const r = await j(base, p, { method: m, body: m === 'POST' ? { room: 'abc-defg-hij', name: 't' } : undefined })
    ok(`guest can reach ${m} ${p}`, !r.redirected, `got ${r.s} (sent to sign-in)`)
  }
  for (const [m, p] of [['GET', '/'], ['POST', '/api/rooms'], ['GET', '/api/lobby?room=abc-defg-hij']]) {
    const r = await j(base, p, { method: m, body: m === 'POST' ? {} : undefined })
    ok(`${m} ${p} stays behind sign-in`, r.redirected || r.s === 401 || r.s === 403, `got ${r.s}`)
  }
} else {
  const start = (port, env) => { const c = spawn('node', ['index.js'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, PORT: port, LIVEKIT_HTTP_URL: 'http://127.0.0.1:1', ...env }, stdio: 'ignore' }); return c }
  const A = start('8791', { INVITE_CODES: '' }), B = start('8792', { INVITE_CODES: 'secret1,secret2' })
  await sleep(1200)
  const a = 'http://127.0.0.1:8791', b = 'http://127.0.0.1:8792'
  try {
    // Start a meeting
    const c = await j(a, '/api/rooms', { method: 'POST', body: {} })
    ok('host can start a meeting', c.s === 200 && /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(c.d?.room) && c.d?.hostGrant)
    const { room, hostGrant } = c.d
    ok('guest sees the meeting exists by code', (await j(a, `/api/rooms/exists?room=${room}`)).d?.exists === true)
    ok('unknown meeting is reported not found', (await j(a, '/api/rooms/exists?room=zzz-zzzz-zzz')).d?.exists === false)
    for (const bad of ['', 'AB', 'a b', '../etc', 'x'.repeat(80)]) ok(`odd code "${bad.slice(0, 12)}" is handled, not a crash`, (await j(a, `/api/rooms/exists?room=${encodeURIComponent(bad)}`)).s === 200)

    // Guest joins, host admits
    ok('joining an unknown meeting says not found', (await j(a, '/api/join', { method: 'POST', body: { room: 'zzz-zzzz-zzz', name: 'G' } })).s === 404)
    ok('joining with a bad code says bad request', (await j(a, '/api/join', { method: 'POST', body: { room: '!!', name: 'G' } })).s === 400)
    const g = await j(a, '/api/join', { method: 'POST', body: { room, name: 'Guest One' } })
    ok('guest waits in the lobby', g.s === 200 && g.d?.status === 'waiting' && g.d?.requestId && !g.d?.token)
    ok('guest status is waiting before the host decides', (await j(a, `/api/join/status?room=${room}&requestId=${g.d.requestId}`)).d?.status === 'waiting')
    ok('guest cannot read the lobby', (await j(a, `/api/lobby?room=${room}`)).s === 403)
    ok('guest cannot admit themselves', (await j(a, '/api/lobby/decide', { method: 'POST', body: { room, requestId: g.d.requestId, allow: true } })).s === 403)
    ok('wrong host grant is treated as guest', (await j(a, `/api/lobby?room=${room}&hostGrant=nope`)).s === 403)
    const lob = await j(a, `/api/lobby?room=${room}&hostGrant=${encodeURIComponent(hostGrant)}`)
    ok('host sees the waiting guest', lob.d?.waiting?.length === 1 && lob.d.waiting[0].name === 'Guest One')
    ok('host admits the guest', (await j(a, '/api/lobby/decide', { method: 'POST', body: { room, hostGrant, requestId: g.d.requestId, allow: true } })).s === 200)
    const adm = await j(a, `/api/join/status?room=${room}&requestId=${g.d.requestId}`)
    ok('admitted guest gets a token', adm.d?.status === 'admitted' && !!adm.d?.token && adm.d?.host === false)
    ok('the token works only once', (await j(a, `/api/join/status?room=${room}&requestId=${g.d.requestId}`)).d?.status === 'gone')

    // Deny, and a second guest
    const g2 = await j(a, '/api/join', { method: 'POST', body: { room, name: 'Guest Two' } })
    await j(a, '/api/lobby/decide', { method: 'POST', body: { room, hostGrant, requestId: g2.d.requestId, allow: false } })
    const den = await j(a, `/api/join/status?room=${room}&requestId=${g2.d.requestId}`)
    ok('denied guest is told no and gets no token', den.d?.status === 'denied' && !den.d?.token)

    // Host joins directly
    const h = await j(a, '/api/join', { method: 'POST', body: { room, name: 'Host', hostGrant } })
    ok('host with the grant joins straight in', h.d?.status === 'admitted' && h.d?.host === true && !!h.d?.token)
    ok('stale status request says gone', (await j(a, `/api/join/status?room=${room}&requestId=nope`)).d?.status === 'gone')

    // Names
    const long = await j(a, '/api/join', { method: 'POST', body: { room, name: '  ' } })
    ok('empty name becomes Guest', long.s === 200)

    // Invite codes (legacy gate)
    ok('with invite codes on, no code is refused', (await j(b, '/api/rooms', { method: 'POST', body: {} })).s === 401)
    ok('with invite codes on, a wrong code is refused', (await j(b, '/api/rooms', { method: 'POST', body: { code: 'x' } })).s === 401)
    ok('with invite codes on, the right code works', (await j(b, '/api/rooms', { method: 'POST', body: { code: 'secret2' } })).s === 200)

    // Pasted codes and links
    const link = `https://iris.sdcloud.uk/r/${room}`
    for (const [label, v] of [['bare code', room], ['capitals', room.toUpperCase()], ['spaces', `  ${room}  `], ['full link', link], ['link with slash', `${link}/`], ['share link', `https://iris.sdcloud.uk/s/${room}`], ['link with query', `${link}?app=0.2.6`], ['link with spaces', ` ${link} `]]) ok(`code box accepts ${label}`, parseCode(v) === room, `got "${parseCode(v)}"`)
  } finally { A.kill(); B.kill() }
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
