import React, { useEffect, useState } from 'react'
import { useParticipants } from '@livekit/components-react'
import { X, Mic, MicOff, UserX, Hand, Check } from 'lucide-react'

const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

// Polls the lobby (host only). `onGrow` fires when someone new is waiting.
export function useLobby(room, grant, isHost, onGrow) {
  const [waiting, setWaiting] = useState([])
  useEffect(() => {
    if (!isHost) return
    let on = true
    const tick = async () => {
      try {
        const r = await fetch(`/api/lobby?room=${room}&hostGrant=${encodeURIComponent(grant)}`)
        if (r.ok && on) { const w = (await r.json()).waiting; setWaiting((prev) => { if (w.length > prev.length) onGrow?.(); return w }) }
      } catch { /* retry next tick */ }
    }
    tick()
    const t = setInterval(tick, 2500)
    return () => { on = false; clearInterval(t) }
  }, [isHost, room, grant])
  return [waiting, setWaiting]
}

// Side panel: who is waiting (host only) and who is in the meeting.
export default function People({ room, grant, isHost, waiting, setWaiting, onClose }) {
  const participants = useParticipants()
  const [confirm, setConfirm] = useState(null) // identity awaiting remove confirmation
  const decide = async (requestId, allow) => {
    await post('/api/lobby/decide', { room, hostGrant: grant, requestId, allow })
    setWaiting((w) => w.filter((x) => x.requestId !== requestId))
  }
  const admitAll = () => waiting.forEach((w) => decide(w.requestId, true))
  const mod = (action, identity) => post('/api/mod', { room, hostGrant: grant, action, identity })
  const initial = (p) => (p.name || p.identity || '?').trim().charAt(0).toUpperCase()

  return (
    <aside className="panel" aria-label="People">
      <div className="panel-head"><h3>People</h3><button className="ibtn sm" onClick={onClose} aria-label="Close panel" title="Close"><X size={18} /></button></div>
      <div className="panel-body">
        {isHost && (
          <section>
            <div className="sec-head"><span>Waiting to join · {waiting.length}</span>{waiting.length > 1 && <button className="btn btn-primary sm" onClick={admitAll}>Admit all</button>}</div>
            {waiting.length === 0 && <p className="muted small">No one is waiting.</p>}
            {waiting.map((w) => (
              <div className="person waiting" key={w.requestId}>
                <span className="avatar">{w.name.charAt(0).toUpperCase()}</span>
                <span className="pname">{w.name}</span>
                <button className="btn btn-primary sm" onClick={() => decide(w.requestId, true)}><Check size={14} /> Admit</button>
                <button className="btn btn-ghost sm" onClick={() => decide(w.requestId, false)}>Decline</button>
              </div>
            ))}
          </section>
        )}
        <section>
          <div className="sec-head"><span>In the meeting · {participants.length}</span></div>
          {participants.map((p) => (
            <div className="person" key={p.identity}>
              <span className="avatar">{initial(p)}</span>
              <span className="pname">{p.name || p.identity}{p.isLocal ? ' (You)' : ''}</span>
              {p.attributes?.hand && <Hand size={16} className="hand-ico" aria-label="Hand raised" />}
              <span className={`mic-state${p.isMicrophoneEnabled ? '' : ' off'}`} title={p.isMicrophoneEnabled ? 'Mic on' : 'Mic off'}>
                {p.isMicrophoneEnabled ? <Mic size={16} aria-label="Mic on" /> : <MicOff size={16} aria-label="Mic off" />}
              </span>
              {isHost && !p.isLocal && (confirm === p.identity ? (
                <span className="pact confirm">
                  <span className="small">Remove?</span>
                  <button className="btn btn-danger sm" onClick={() => { mod('remove', p.identity); setConfirm(null) }}>Remove</button>
                  <button className="btn btn-ghost sm" onClick={() => setConfirm(null)}>Cancel</button>
                </span>
              ) : (
                <span className="pact">
                  <button className="btn btn-ghost sm" disabled={!p.isMicrophoneEnabled} onClick={() => mod('mute', p.identity)} title={p.isMicrophoneEnabled ? `Mute ${p.name || ''}` : 'Already muted'} aria-label={`Mute ${p.name || p.identity}`}><MicOff size={14} /> Mute</button>
                  <button className="ibtn sm" onClick={() => setConfirm(p.identity)} title={`Remove ${p.name || ''} from meeting`} aria-label={`Remove ${p.name || p.identity} from meeting`}><UserX size={16} /></button>
                </span>
              ))}
            </div>
          ))}
        </section>
      </div>
    </aside>
  )
}
