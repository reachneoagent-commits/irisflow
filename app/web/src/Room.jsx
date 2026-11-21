import meetingArt from './art/meeting.svg'
import Credit from './Credit.jsx'
import { RotateCcw, Home, X } from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'
import { LiveKitRoom, PreJoin, RoomAudioRenderer } from '@livekit/components-react'
import Brand from './Brand.jsx'
import MeetingView from './MeetingView.jsx'
import { InviteCard } from './Invite.jsx'
import { getGrant } from './grant.js'

const LK_URL = import.meta.env.VITE_LIVEKIT_URL || `ws://${location.hostname}:7880`
const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export default function Room({ code, onLeave }) {
  const [stage, setStage] = useState('prejoin') // prejoin | waiting | denied | call | left
  const [choices, setChoices] = useState(null)
  const [token, setToken] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [err, setErr] = useState('')
  const poll = useRef(null)
  const grant = getGrant(code)

  useEffect(() => () => clearInterval(poll.current), [])
  // Opened a link to a meeting that doesn't exist (typo, expired, server restarted).
  useEffect(() => {
    const g = getGrant(code)
    fetch(`/api/rooms/exists?room=${encodeURIComponent(code)}${g ? `&hostGrant=${encodeURIComponent(g)}` : ''}`)
      .then((r) => r.json()).then((d) => { if (!d.exists) setStage('missing') }).catch(() => {})
  }, [code])

  async function join(c) {
    setErr(''); setChoices(c)
    try {
      const r = await post('/api/join', { room: code, name: c.username || 'Guest', hostGrant: grant })
      if (!r.ok) throw new Error()
      const d = await r.json()
      if (d.status === 'admitted') { setToken(d.token); setIsHost(d.host); setStage('call'); return }
      setStage('waiting')
      poll.current = setInterval(async () => {
        const s = await fetch(`/api/join/status?room=${code}&requestId=${d.requestId}`)
        const j = await s.json()
        if (j.status === 'admitted') { clearInterval(poll.current); setToken(j.token); setIsHost(false); setStage('call') }
        else if (j.status === 'denied' || j.status === 'gone') { clearInterval(poll.current); setStage('denied') }
      }, 2000)
    } catch {
      setErr('Could not join this meeting. Try again.')
    }
  }

  const cancelWait = () => { clearInterval(poll.current); setStage('prejoin') }

  if (stage === 'left') return (
    <div className="page"><div className="leave">
      <Brand />
      <h2>You left the meeting</h2>
      <div className="row">
        <button className="btn btn-primary" onClick={() => { setToken(null); setStage('prejoin') }}><RotateCcw size={18} /> Rejoin</button>
        <button className="btn btn-ghost" onClick={onLeave}><Home size={18} /> Home</button>
      </div>
    </div></div>
  )

  if (stage === 'missing') return (
    <div className="page"><div className="leave">
      <Brand />
      <h2>Meeting not found</h2>
      <p className="muted">Check the code or link, or ask the host for a new one.</p>
      <button className="btn btn-ghost" onClick={onLeave}><Home size={18} /> Home</button>
    </div></div>
  )

  if (stage === 'waiting') return (
    <div className="page"><div className="leave">
      <Brand />
      <h2>Asking to join…</h2>
      <p className="muted">The host will let you in soon.</p>
      <button className="btn btn-ghost" onClick={cancelWait}><X size={18} /> Cancel</button>
    </div></div>
  )

  if (stage === 'denied') return (
    <div className="page"><div className="leave">
      <Brand />
      <h2>You can't join this meeting</h2>
      <p className="muted">The host declined your request, or it expired.</p>
      <button className="btn btn-ghost" onClick={onLeave}><Home size={18} /> Home</button>
    </div></div>
  )

  if (stage === 'prejoin') return (
    <div className="page">
      <header><Brand /></header>
      <div className="center hero prejoin" data-lk-theme="default">
        <div className="card">
          {grant
            ? <InviteCard code={code} isHost />
            : <div className="guest-note">You're joining meeting <strong>{code}</strong>. The host will let you in.</div>}
          <h2 style={{ margin: '4px 0 0' }}>Ready to join?</h2>
          <PreJoin
            defaults={{ username: '', videoEnabled: true, audioEnabled: true }}
            onSubmit={join}
            onError={() => setErr('Camera or microphone is blocked. Allow access and reload.')}
            joinLabel={grant ? 'Join now' : 'Ask to join'}
            userLabel="Your name"
          />
          {err && <div className="error" role="alert">{err}</div>}
        </div>
        <img className="hero-art" src={meetingArt} alt="" />
      </div>
      <Credit />
    </div>
  )

  return (
    <LiveKitRoom
      data-lk-theme="default"
      serverUrl={LK_URL}
      token={token}
      connect
      video={choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false}
      audio={choices.audioEnabled ? { deviceId: choices.audioDeviceId } : false}
      style={{ height: '100vh', position: 'relative' }}
      onDisconnected={() => setStage('left')}
    >
      <MeetingView code={code} grant={grant} isHost={isHost} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}
