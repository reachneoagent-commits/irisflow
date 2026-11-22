import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useDataChannel, useLocalParticipant } from '@livekit/components-react'
import { createPortal } from 'react-dom'
import { Pencil } from 'lucide-react'
import { IconBtn, ICON, toast } from './ui.jsx'

// Presenter pen. Strokes are sent as normalised points (0..1 of the shared screen)
// on the "draw" data topic. Viewers render them over the shared-screen video and they fade out.
const enc = new TextEncoder(), dec = new TextDecoder()
const COLORS = ['#000000', '#ff4d4d', '#4da3ff', '#ffffff']
const NAMES = ['Black', 'Red', 'Blue', 'White']
const FADE_AFTER = 5000, FADE_FOR = 1200
const MAX_STROKES = 200, MAX_POINTS = 2000

// Where the shared screen is actually painted inside its <video> (object-fit: contain).
function contentRect(video, host) {
  const h = host.getBoundingClientRect(), v = video.getBoundingClientRect()
  const vw = video.videoWidth || v.width, vh = video.videoHeight || v.height
  const s = Math.min(v.width / vw, v.height / vh)
  const w = vw * s, hh = vh * s
  return { x: v.left - h.left + (v.width - w) / 2, y: v.top - h.top + (v.height - hh) / 2, w, h: hh }
}

export default function Draw({ hostRef, host, sharerId, canDraw }) {
  const canvas = useRef(null)
  const strokes = useRef(new Map())          // key -> { c, pts, last }
  const [on, setOn] = useState(false)
  const [color, setColor] = useState(COLORS[1])
  const { localParticipant, isScreenShareEnabled: sharing } = useLocalParticipant()
  const mine = useRef(null)
  const sharingRef = useRef(false)
  sharingRef.current = sharing

  const { send } = useDataChannel('draw', (msg) => {
    // Anyone in the call can mark up a screen that is being shared; nothing to draw on otherwise.
    if (!sharerId || !msg.from) return
    try {
      const m = JSON.parse(dec.decode(msg.payload))
      apply(msg.from.identity, m)
      // Desktop presenter: show other people's marks on the real screen too.
      if (window.__TAURI__?.event && sharingRef.current) window.__TAURI__.event.emit('iris-remote', { who: msg.from.identity, m })
    } catch { /* ignore */ }
  })

  const apply = (who, m) => {
    const M = strokes.current
    if (m.t === 'clear') { for (const k of [...M.keys()]) if (k.startsWith(who + ':')) M.delete(k); return }
    if (typeof m.id !== 'string' || !Array.isArray(m.p)) return
    const key = `${who}:${m.id}`
    let s = M.get(key)
    if (!s) {
      if (M.size >= MAX_STROKES) M.delete(M.keys().next().value)
      s = { c: COLORS.includes(m.c) ? m.c : COLORS[0], pts: [], last: 0 }
      M.set(key, s)
    }
    for (let i = 0; i + 1 < m.p.length && s.pts.length < MAX_POINTS; i += 2) {
      const x = +m.p[i], y = +m.p[i + 1]
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) s.pts.push([x, y])
    }
    s.last = performance.now()
  }

  // Paint loop.
  useEffect(() => {
    let raf
    const loop = () => {
      const host = hostRef.current, cv = canvas.current
      if (host && cv) {
        const r = host.getBoundingClientRect()
        if (cv.width !== r.width * devicePixelRatio) { cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio }
        const g = cv.getContext('2d')
        g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
        g.clearRect(0, 0, r.width, r.height)
        const video = host.querySelector('[data-lk-source="screen_share"] video')
        if (video) {
          const cr = contentRect(video, host), now = performance.now()
          g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(3, cr.w / 280)
          for (const [k, s] of strokes.current) {
            const age = now - s.last - FADE_AFTER
            if (age > FADE_FOR) { strokes.current.delete(k); continue }
            g.globalAlpha = age > 0 ? 1 - age / FADE_FOR : 1
            const path = () => {
              g.beginPath()
              s.pts.forEach(([x, y], i) => (i ? g.lineTo(cr.x + x * cr.w, cr.y + y * cr.h) : g.moveTo(cr.x + x * cr.w, cr.y + y * cr.h)))
              if (s.pts.length === 1) g.lineTo(cr.x + s.pts[0][0] * cr.w + 0.1, cr.y + s.pts[0][1] * cr.h)
            }
            if (s.c === '#000000' || s.c === '#ffffff') { // outline so black and white show on any background
              const w = g.lineWidth; g.lineWidth = w + 3; g.strokeStyle = s.c === '#000000' ? '#ffffff' : '#000000'; path(); g.stroke(); g.lineWidth = w
            }
            g.strokeStyle = s.c; path(); g.stroke()
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [hostRef])

  const emit = useCallback((m) => send(enc.encode(JSON.stringify(m)), { reliable: false }), [send])
  // Desktop app: the pen is a transparent window over the real screen; it hands us strokes to publish.
  const T = typeof window !== 'undefined' ? window.__TAURI__ : null
  const [overlay, setOverlay] = useState(false) // the presenter's pen is on (desktop)
  useEffect(() => {
    if (!T?.event) return
    let un
    T.event.listen('iris-pen-state', (e) => setOverlay(!!e.payload)).then((f) => { un = f })
    return () => un && un()
  }, [T])
  // Desktop: while this person shares their screen, shrink to a control window and open the marks layer.
  useEffect(() => {
    if (!T?.core) return
    T.core.invoke('share_mode', { on: !!sharing }).catch(() => {})
    return () => { if (sharing) T.core.invoke('share_mode', { on: false }).catch(() => {}) }
  }, [T, sharing])
  const say = (text, kind) => toast(text, kind)
  const toggle = async () => {
    if (!sharerId && !sharing) return // button is disabled in this state
    if (!T?.core || !sharing) { setOn(!on); return }
    try { await T.core.invoke('overlay_pen', { on: !overlay }) }
    catch (e) { say('Could not open the drawing layer: ' + (e?.message || e), 'error') }
  }
  const pending = useRef([])
  useEffect(() => {
    const t = setInterval(() => {
      const cur = mine.current
      if (cur && pending.current.length) { emit({ t: 's', id: cur, c: color, p: pending.current }); pending.current = [] }
    }, 40)
    return () => clearInterval(t)
  }, [emit, color])

  const pos = (e) => {
    const host = hostRef.current, video = host?.querySelector('[data-lk-source="screen_share"] video')
    if (!video) return null
    const cr = contentRect(video, host), h = host.getBoundingClientRect()
    const x = (e.clientX - h.left - cr.x) / cr.w, y = (e.clientY - h.top - cr.y) / cr.h
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? [x, y] : null
  }
  const down = (e) => {
    const p = pos(e); if (!p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    mine.current = Math.random().toString(36).slice(2, 8)
    add(p)
  }
  const add = (p) => {
    pending.current.push(+p[0].toFixed(4), +p[1].toFixed(4))
    apply(localParticipant.identity, { t: 's', id: mine.current, c: color, p: [p[0], p[1]] })
  }
  const move = (e) => { if (mine.current) { const p = pos(e); if (p) add(p) } }
  const up = () => { mine.current = null }
  const clear = () => { emit({ t: 'clear' }); apply(localParticipant.identity, { t: 'clear' }) }

  // Available while anyone is sharing. Local strokes are keyed by the local identity.
  const canUse = !!(sharing || sharerId)
  const showPen = canDraw && canUse
  useEffect(() => { if (!showPen) setOn(false) }, [showPen])

  const surface = host && createPortal(
    <canvas ref={canvas} className="draw-canvas" style={{ pointerEvents: on ? 'auto' : 'none', cursor: on ? 'crosshair' : 'default' }}
      onPointerDown={on ? down : undefined} onPointerMove={on ? move : undefined} onPointerUp={on ? up : undefined} />, host)
  return (
    <>
      {surface}
      <div className="draw-tools">
        {(on || overlay) && showPen && (
          <div className="draw-pop">
            {COLORS.map((c, i) => <button key={c} type="button" className={`swatch${c === color ? ' sel' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Pen ${NAMES[i]}`} aria-pressed={c === color} title={NAMES[i]} />)}
            <span className="pen-name">{NAMES[COLORS.indexOf(color)]}</span>
            <button className="btn btn-ghost sm" onClick={clear}>Clear</button>
          </div>
        )}
        <IconBtn short="Draw" label={canUse ? 'Draw on the shared screen' : 'Draw (available once a screen is shared)'} active={on || overlay} disabled={!canUse} onClick={toggle}><Pencil {...ICON} />{(on || overlay) && <span className="pen-dot" style={{ background: color }} />}</IconBtn>
      </div>
    </>
  )
}
