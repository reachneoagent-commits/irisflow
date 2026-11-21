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
  const [needInvite, setNeedInvite] = useState(false)
  const [invite, setInvite] = useState('')
  const saveInvite = (v) => {
    setInvite(v)
    try { localStorage.setItem('irisflow-invite', v.trim()) } catch { /* private mode */ }
  }
  const create = async () => {
    setBusy(true); setErr('')
    try {
      let invite = ''
      try { invite = localStorage.getItem('irisflow-invite') || '' } catch { /* private mode */ }
      const r = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: invite }) })
      if (r.status === 401) {
        setNeedInvite(true); setBusy(false)
        setErr(invite ? 'That invite code was not accepted.' : 'Enter your invite code to start meetings.')
        return
      }
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
          {needInvite && <label className="flabel" htmlFor="invite">Invite code <em>required to start a meeting</em></label>}
          {needInvite && <input id="invite" className="field" type="password" aria-label="Invite code" placeholder="Invite code" autoComplete="off" value={invite} onChange={(e) => { saveInvite(e.target.value); setErr('') }} />}
          <button className="btn btn-primary" onClick={create} disabled={busy}><Video size={20} /> {busy ? 'Starting…' : 'New meeting'}</button>
          <div className="or">or join with a code</div>
          <label className="flabel" htmlFor="code">Meeting code or link</label>
          <form className="row" onSubmit={join}>
            <input id="code" className="field" aria-label="Meeting code or link" placeholder="abc-defg-hij" value={code} onChange={(e) => { setCode(e.target.value); setErr('') }} />
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
