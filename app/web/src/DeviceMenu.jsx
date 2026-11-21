import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMediaDeviceSelect } from '@livekit/components-react'
import { Check } from 'lucide-react'

// Chevron + popup listing devices. The popup is portaled to <body> and positioned from the
// chevron's rect, so no ancestor can clip it. It flips below if there is no room above,
// closes on Escape / outside press, and returns focus to the chevron.
export default function DeviceMenu({ kind, label }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const pop = useRef(null)
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: open })

  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return
    const a = btn.current.getBoundingClientRect()
    const h = pop.current.offsetHeight, w = pop.current.offsetWidth
    const above = a.top - h - 8 >= 8
    const top = above ? a.top - h - 8 : Math.min(a.bottom + 8, innerHeight - h - 8)
    const left = Math.max(8, Math.min(a.left, innerWidth - w - 8))
    setPos({ top, left })
  }, [open, devices.length])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (e.type === 'keydown') { if (e.key !== 'Escape') return; btn.current?.focus() }
      else if (btn.current?.contains(e.target) || pop.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const real = devices.filter((d) => d.deviceId)
  return (
    <>
      <button ref={btn} type="button" className="chev-btn" aria-label={`${label} settings`} title={`${label} settings`}
        aria-haspopup="menu" aria-expanded={open} data-open={open} onClick={() => { setPos(null); setOpen(!open) }} />
      {open && createPortal(
        <div ref={pop} className="dev-pop" role="menu" aria-label={label}
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}>
          <div className="dev-title">{label}</div>
          {real.length === 0 && <div className="dev-empty">No {kind === 'audioinput' ? 'microphone' : 'camera'} found, or access is blocked.</div>}
          {real.map((d) => (
            <button key={d.deviceId} type="button" role="menuitemradio" aria-checked={d.deviceId === activeDeviceId}
              className="dev-item" onClick={() => { setActiveMediaDevice(d.deviceId); setOpen(false); btn.current?.focus() }}>
              <span className="dev-check">{d.deviceId === activeDeviceId && <Check size={16} strokeWidth={2.5} />}</span>
              <span className="dev-name">{d.label || 'Default'}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
