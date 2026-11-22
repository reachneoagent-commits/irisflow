import leftArt from './art/left.svg'
import Credit from './Credit.jsx'
import { RotateCcw, Home, X, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'
import { LiveKitRoom, usePreviewTracks, RoomAudioRenderer } from '@livekit/components-react'
import Brand from './Brand.jsx'
import MeetingView from './MeetingView.jsx'
import { copyText } from './Invite.jsx'
import { getGrant } from './grant.js'

const LK_URL = import.meta.env.VITE_LIVEKIT_URL
  || (location.protocol === 'https:' ? `wss://${location.host}/lk` : `ws://${location.hostname}:7880`)
function PreJoinPanel({ code, isHost, onSubmit, onBack, err, setErr }) {
  const [name, setName] = useState('')
  const [nameErr, setNameErr] = useState(false)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [copied, setCopied] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const videoRef = useRef(null)
  const tracks = usePreviewTracks({ audio: mic, video: cam }, () => { setBlocked(true); setMic(false); setCam(false); setErr('Camera or microphone is blocked. Allow access in your browser, then reload.') })
  const vt = tracks?.find((t) => t.kind === 'video')
  const at = tracks?.find((t) => t.kind === 'audio')
  useEffect(() => {
    const el = videoRef.current
    if (!vt || !el) return
    vt.attach(el)
    // The desktop app's webview (WKWebView) can leave the preview paused; start it explicitly.
    const start = () => { el.play().catch(() => {}) }
    start()
    el.addEventListener('loadedmetadata', start)
    return () => { el.removeEventListener('loadedmetadata', start); vt.detach(el) }
  }, [vt])
  const link = `${location.origin}/r/${code}`
  const copy = async () => { await copyText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) { setNameErr(true); return }
    setBusy(true)
    onSubmit({
      username: name.trim(), videoEnabled: cam && !blocked, audioEnabled: mic && !blocked,
      videoDeviceId: vt?.mediaStreamTrack.getSettings().deviceId, audioDeviceId: at?.mediaStreamTrack.getSettings().deviceId,
    })
  }
  const initial = (name.trim()[0] || '?').toUpperCase()
  return (
    <form className="pre" onSubmit={submit} noValidate>
      <div>
        <div className="pre-video">
          <video ref={videoRef} muted playsInline autoPlay style={{ display: cam && vt ? 'block' : 'none' }} />
          {!(cam && vt) && <div className="off"><div className="avatar">{initial}</div></div>}
        </div>
        <div className="tgrow">
          <button type="button" className={`tg${mic ? '' : ' off'}`} aria-pressed={mic} onClick={() => { setMic(!mic); setBlocked(false); setErr('') }}>
            {mic ? <Mic size={20} /> : <MicOff size={20} />}<span>Microphone<small>{mic ? 'On' : 'Off'}</small></span>
          </button>
          <button type="button" className={`tg${cam ? '' : ' off'}`} aria-pressed={cam} onClick={() => { setCam(!cam); setBlocked(false); setErr('') }}>
            {cam ? <Video size={20} /> : <VideoOff size={20} />}<span>Camera<small>{cam ? 'On' : 'Off'}</small></span>
          </button>
        </div>
      </div>
      <div className="pre-side">
        <h1>{isHost ? 'Ready to start?' : 'Ready to join?'}</h1>
        <p className="lead">{isHost ? 'Check how you look and sound, then start.' : 'Check how you look and sound, then ask to join.'}</p>
        {isHost
          ? <div className="code-card"><div className="k">Meeting code</div><div className="r"><span className="v">{code}</span><button type="button" className="btn btn-secondary" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button></div></div>
          : <div className="gnote">You're joining <strong>{code}</strong>. The host will let you in.</div>}
        <label className="flabel" htmlFor="pj-name">Your name</label>
        <input id="pj-name" className={`field${nameErr ? ' bad' : ''}`} placeholder="Enter your name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setNameErr(false); setErr('') }} />
        {nameErr && <div className="error" role="alert">Enter your name so others know who you are.</div>}
        {err && <div className="error" role="alert">{err}</div>}
        <div className="acts">
          <button className="btn btn-primary" disabled={busy && !err}>{busy && !err ? 'Please wait…' : isHost ? 'Start now' : 'Ask to join'}</button>
          <button type="button" className="btn btn-link" onClick={onBack}>Back</button>
        </div>
      </div>
    </form>
  )
}

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
    <div className="page">
      <header><Brand /></header>
      <div className="center hero left-hero">
        <div className="card">
          <h1>You left the meeting</h1>
          <p>Left by mistake? Jump back in, or head home to start something new.</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => { setToken(null); setStage('prejoin') }}><RotateCcw size={18} /> Rejoin</button>
            <button className="btn btn-ghost" onClick={onLeave}><Home size={18} /> Home</button>
          </div>
        </div>
        <img className="hero-art" src={leftArt} alt="" />
      </div>
      <Credit />
    </div>
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
      <div className="center">
        <PreJoinPanel code={code} isHost={!!grant} onSubmit={join} onBack={onLeave} err={err} setErr={setErr} />
      </div>
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
      className="room-root"
      onDisconnected={() => setStage('left')}
    >
      <MeetingView code={code} grant={grant} isHost={isHost} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}
