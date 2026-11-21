import React, { useEffect, useRef, useState } from 'react'

// Round icon button used across the meeting bar.
export function IconBtn({ label, short, active, danger, badge, children, ...rest }) {
  if (short) return (
    <button type="button" className={`bbtn${active ? ' on' : ''}`} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : !!active} {...rest}>
      <span className="bico">{children}{badge ? <span className="ibadge">{badge}</span> : null}</span>
      <span className="blabel">{short}</span>
    </button>
  )
  return (
    <button type="button" className={`ibtn${active ? ' on' : ''}${danger ? ' danger' : ''}`} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : !!active} {...rest}>
      {children}
      {badge ? <span className="ibadge">{badge}</span> : null}
    </button>
  )
}

export const ICON = { size: 22, strokeWidth: 2 }

// App-wide toast: call toast('text', 'error' | 'info') from anywhere; <Toaster /> renders it once.
export const toast = (text, kind = 'info') => window.dispatchEvent(new CustomEvent('iris-toast', { detail: { text, kind } }))
export function Toaster() {
  const [t, setT] = useState(null)
  const timer = useRef(0)
  useEffect(() => {
    const on = (e) => { clearTimeout(timer.current); setT(e.detail); timer.current = setTimeout(() => setT(null), e.detail.kind === 'error' ? 6000 : 4000) }
    window.addEventListener('iris-toast', on)
    return () => { window.removeEventListener('iris-toast', on); clearTimeout(timer.current) }
  }, [])
  if (!t) return null
  return (
    <div className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast-text">{t.text}</span>
      <button className="toast-x" onClick={() => setT(null)} aria-label="Dismiss">×</button>
    </div>
  )
}
