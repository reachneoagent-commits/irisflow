import React, { useState } from 'react'
import { Link2, Copy, Check } from 'lucide-react'
import { IconBtn, ICON, toast } from './ui.jsx'

const linkFor = (code) => `${location.origin}/r/${code}`
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text) } catch { toast(`Couldn't copy automatically. Link: ${text}`, 'error') }
}

// Bottom bar, right side: one tap copies the invite link.
export default function Invite({ code }) {
  const [done, setDone] = useState(false)
  const copy = async () => { await copyText(linkFor(code)); setDone(true); setTimeout(() => setDone(false), 2000) }
  return <IconBtn short={done ? 'Copied' : 'Invite'} label={done ? 'Link copied' : 'Copy invite link'} onClick={copy} active={done || undefined}>{done ? <Check {...ICON} /> : <Link2 {...ICON} />}</IconBtn>
}

// Bottom bar, left side: the meeting code, click to copy.
export function MeetingCode({ code }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="code-pill" title="Copy meeting link" aria-label={done ? 'Link copied' : `Meeting code ${code}. Copy meeting link`} onClick={async () => { await copyText(linkFor(code)); setDone(true); setTimeout(() => setDone(false), 2000) }}>
      <span>{code}</span>{done ? <Check size={16} /> : <Copy size={16} />}
    </button>
  )
}

// Big, brandable card on the pre-join screen: code plus a copyable link.
export function InviteCard({ code, isHost }) {
  const [done, setDone] = useState('')
  const link = linkFor(code)
  const copy = async (what, text) => { await copyText(text); setDone(what); setTimeout(() => setDone(''), 2000) }
  return (
    <div className="invite-card">
      <div className="invite-label">Meeting code{isHost ? ' · you are the host' : ''}</div>
      <div className="invite-row">
        <span className="invite-code">{code}</span>
        <button type="button" className="btn btn-ghost sm" onClick={() => copy('code', code)}>{done === 'code' ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy code</>}</button>
      </div>
      <div className="invite-link">
        <input className="field" readOnly value={link} aria-label="Meeting link" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-primary" onClick={() => copy('link', link)}>{done === 'link' ? <><Check size={18} /> Copied</> : <><Link2 size={18} /> Copy link</>}</button>
      </div>
    </div>
  )
}
