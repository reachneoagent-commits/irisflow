import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { ICON } from './ui.jsx'

// True while the viewport matches the query (used to switch the bar to its compact layout).
export function useMedia(query) {
  const get = () => typeof matchMedia !== 'undefined' && matchMedia(query).matches
  const [m, setM] = useState(get)
  useEffect(() => {
    const mq = matchMedia(query), on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

// Compact bar: one "More" button opens a sheet above the bar holding the secondary controls.
// Children stay mounted while closed (hidden) so reactions, drawing and chat keep working.
export default function MoreMenu({ badge = 0, children }) {
  const [open, setOpen] = useState(false)
  const [bottom, setBottom] = useState(80)
  const btn = useRef(null)
  const pop = useRef(null)

  useLayoutEffect(() => {
    if (!open) return
    const bar = btn.current?.closest('.meet-bar')
    if (bar) setBottom(innerHeight - bar.getBoundingClientRect().top + 8)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (e.type === 'keydown') { if (e.key !== 'Escape') return; e.stopPropagation(); btn.current?.focus() }
      else if (btn.current?.contains(e.target) || pop.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  // Picking an action closes the sheet; the reaction toggle keeps it open so an emoji can be chosen.
  const onPick = (e) => {
    const b = e.target.closest('.bbtn, .lk-button')
    if (b && b.getAttribute('aria-label') !== 'Send a reaction') setOpen(false)
  }

  return (
    <div className="more-wrap">
      <button ref={btn} type="button" className={`bbtn${open ? ' on' : ''}`} title="More" aria-label="More options"
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="bico"><MoreVertical {...ICON} />{badge ? <span className="ibadge">{badge}</span> : null}</span>
        <span className="blabel">More</span>
      </button>
      <div ref={pop} className="more-pop" role="menu" aria-label="More options" data-open={open ? '' : undefined} style={{ bottom }} onClick={onPick}>
        {children}
      </div>
    </div>
  )
}
