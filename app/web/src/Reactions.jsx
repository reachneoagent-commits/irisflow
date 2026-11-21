import React, { useState, useCallback } from 'react'
import { Smile, Hand } from 'lucide-react'
import { IconBtn, ICON } from './ui.jsx'
import { useLocalParticipant, useParticipants, useDataChannel } from '@livekit/components-react'

const EMOJI = ['👍', '👏', '❤️', '😂', '🎉']
const enc = new TextEncoder(), dec = new TextDecoder()

// Raise hand (participant attribute) and emoji reactions (data channel).
export default function Reactions() {
  const { localParticipant } = useLocalParticipant()
  const participants = useParticipants()
  const [floats, setFloats] = useState([])
  const [open, setOpen] = useState(false)

  const show = useCallback((emoji, name) => {
    const id = Math.random().toString(36).slice(2)
    setFloats((f) => [...f.slice(-12), { id, emoji, name, left: 8 + Math.random() * 70 }])
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 3000)
  }, [])

  const { send } = useDataChannel('reaction', (msg) => {
    try {
      const { emoji } = JSON.parse(dec.decode(msg.payload))
      if (EMOJI.includes(emoji)) show(emoji, msg.from?.name || '')
    } catch { /* ignore malformed */ }
  })

  const react = (emoji) => {
    send(enc.encode(JSON.stringify({ emoji })), { reliable: true })
    show(emoji, 'You')
  }
  const handUp = !!localParticipant.attributes?.hand
  const toggleHand = () => localParticipant.setAttributes({ hand: handUp ? '' : '1' })
  const hands = participants.filter((p) => p.attributes?.hand)

  return (
    <>
      <div className="floats" aria-hidden="true">
        {floats.map((f) => (
          <div key={f.id} className="float" style={{ left: `${f.left}%` }}>
            <span className="emoji">{f.emoji}</span>
            <span className="who">{f.name}</span>
          </div>
        ))}
      </div>
      {hands.length > 0 && (
        <div className="hands" role="status">
          {hands.map((p) => <div key={p.identity}>✋ {p.isLocal ? 'You' : p.name || p.identity}</div>)}
        </div>
      )}
      <div className="react-wrap">
        {open && (
          <div className="react-bar" role="group" aria-label="Reactions">
            {EMOJI.map((e) => <button key={e} className="btn react" onClick={() => react(e)} title="React">{e}</button>)}
          </div>
        )}
        <IconBtn short="React" label="Send a reaction" active={open} onClick={() => setOpen(!open)} aria-expanded={open}><Smile {...ICON} /></IconBtn>
      </div>
      <IconBtn short={handUp ? 'Lower' : 'Raise'} label={handUp ? 'Lower hand' : 'Raise hand'} active={handUp} onClick={toggleHand}><Hand {...ICON} /></IconBtn>
    </>
  )
}
