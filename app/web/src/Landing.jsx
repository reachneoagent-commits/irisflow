import React, { useState } from 'react'
import { Video, LogIn } from 'lucide-react'
import Brand from './Brand.jsx'
import { setGrant } from './grant.js'
import welcome from './art/welcome.svg'
import Credit from './Credit.jsx'

// Accepts a bare code or a full meeting link.
function parseCode(v) {
  const s = v.trim().toLowerCase()
  const m = s.match(/([a-z0-9]+(?:-[a-z0-9]+)+)\/?$/)
  return m ? m[1] : s.replace(/[^a-z0-9-]/g, '')
}

export default function Landing({ go }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/rooms', { method: 'POST' })
      if (!r.ok) throw new Error()
      const { room, hostGrant } = await r.json()
      setGrant(room, hostGrant)
      go(`/r/${room}`)
    } catch { setErr('Could not start a meeting. Try again.'); setBusy(false) }
  }
  const join = async (e) => {
    e.preventDefault()
    const c = parseCode(code)
    if (c.length < 3) { setErr('Enter a meeting code or link.'); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/rooms/exists?room=${encodeURIComponent(c)}`)
      const { exists } = await r.json()
      if (!exists) { setErr('Meeting not found. Check the code or ask the host for the link.'); setBusy(false); return }
    } catch { /* server unreachable: let the meeting page report it */ }
    setBusy(false)
    go(`/r/${c}`)
  }
  return (
    <div className="page">
      <header><Brand /></header>
      <div className="center hero">
        <div className="card">
          <h1>Video meetings, free and open.</h1>
          <p>Start a meeting and share the link. Guests join from the browser with nothing to install.</p>
          <button className="btn btn-primary" onClick={create} disabled={busy}><Video size={20} /> {busy ? 'Starting…' : 'New meeting'}</button>
          <div className="or">or join with a code</div>
          <form className="row" onSubmit={join}>
            <input className="field" aria-label="Meeting code or link" placeholder="abc-defg-hij" value={code} onChange={(e) => { setCode(e.target.value); setErr('') }} />
            <button className="btn btn-ghost" disabled={busy}><LogIn size={18} /> Join</button>
          </form>
          {err && <div className="error" role="alert">{err}</div>}
        </div>
        <img className="hero-art" src={welcome} alt="" />
      </div>
      <Credit />
    </div>
  )
}
