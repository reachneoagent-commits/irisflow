import React, { useState } from 'react'
import { Video, LogIn } from 'lucide-react'
import Brand from './Brand.jsx'
import { setGrant } from './grant.js'
import { reloginIfExpired } from './session.js'

// Accepts a bare code or a full meeting link.
function parseCode(v) {
  const s = v.trim().toLowerCase()
  const m = s.match(/([a-z0-9]+(?:-[a-z0-9]+)+)\/?$/)
  return m ? m[1] : s.replace(/[^a-z0-9-]/g, '')
}

export default function Landing({ go }) {
  const [view, setView] = useState('home') // home | join
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
    } catch {
      if (await reloginIfExpired()) return
      setErr('Could not start a meeting. Try again.'); setBusy(false)
    }
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
  const show = (v) => { setView(v); setErr('') }

  return (
    <div className="page">
      <header className="landing-head">
        <Brand />
        {location.protocol === 'https:' && <a className="btn btn-link" href={`/cdn-cgi/access/logout?returnTo=${encodeURIComponent(location.origin + '/')}`} onClick={async (e) => { e.preventDefault(); if (await reloginIfExpired()) return; location.href = e.currentTarget.href }}>Sign out</a>}
      </header>
      <div className="center">
        {view === 'home' ? (
          <div className="home-wrap">
            <h1>What would you like to do?</h1>
            <p className="lead">Start a new meeting, or join one you've been invited to.</p>
            {needInvite && <>
              <label className="flabel" htmlFor="invite">Invite code <em>required to start a meeting</em></label>
              <input id="invite" className="field" type="password" aria-label="Invite code" placeholder="Invite code" autoComplete="off" value={invite} onChange={(e) => { saveInvite(e.target.value); setErr('') }} />
            </>}
            <div className="home-cards">
              <div className="hcard">
                <div className="tile solid"><Video size={24} /></div>
                <h2>Start a meeting</h2>
                <p>Get a meeting code and link to share with friends and family.</p>
                <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? 'Starting…' : 'Start a meeting'}</button>
              </div>
              <div className="hcard">
                <div className="tile line"><LogIn size={24} /></div>
                <h2>Join a meeting</h2>
                <p>Have a code or link? Enter it to ask to join.</p>
                <button className="btn btn-secondary" onClick={() => show('join')} disabled={busy}>Join a meeting</button>
              </div>
            </div>
            {err && <div className="error" role="alert">{err}</div>}
          </div>
        ) : (
          <form className="narrow" onSubmit={join} noValidate>
            <h1>Join a meeting</h1>
            <p className="lead">Paste the meeting link or type the code the host gave you.</p>
            <label className="flabel" htmlFor="code">Meeting code or link</label>
            <input id="code" className={`field${err ? ' bad' : ''}`} placeholder="abc-defg-hij" autoComplete="off" autoFocus value={code} onChange={(e) => { setCode(e.target.value); setErr('') }} />
            {err && <div className="error" role="alert">{err}</div>}
            <div className="acts">
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
              <button type="button" className="btn btn-link" onClick={() => show('home')}>Back</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
