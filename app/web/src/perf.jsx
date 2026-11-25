import React from 'react'
import { useEffect, useState } from 'react'
import { useLocalParticipant } from '@livekit/components-react'
import { Track } from 'livekit-client'

// Screen-share quality picked from what the machine can handle. Tiers go from lightest (0) to best (2).
const TIERS = [
  { name: 'low', width: 1280, height: 720, fps: 10, bitrate: 1_200_000 },
  { name: 'mid', width: 1920, height: 1080, fps: 15, bitrate: 2_500_000 },
  { name: 'high', width: 1920, height: 1080, fps: 30, bitrate: 5_000_000 },
]
const KEY = 'irisflow.shareQuality' // auto | smooth | sharp

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_GPU || ext.UNMASKED_RENDERER_WEBGL)) : ''
  } catch { return '' }
}

// What this computer looks like to the page: cores, rough memory, and the graphics card the browser really uses.
export function detectSystem() {
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 8 // the browser caps this at 8
  const gpu = gpuName()
  const strong = /nvidia|geforce|rtx|gtx|quadro|radeon (rx|pro)|apple m\d|apple gpu/i.test(gpu)
  const weak = /swiftshader|software|llvmpipe|basic render/i.test(gpu)
  let tier = 1
  if (weak || mem <= 4 || cores <= 4) tier = 0
  else if (strong && cores >= 6 && mem >= 8) tier = 2
  return { cores, mem, gpu, tier }
}

let sys
export function system() {
  if (!sys) { sys = detectSystem(); console.info('[irisflow] system', JSON.stringify(sys)) }
  return sys
}

export function getQuality() { try { return localStorage.getItem(KEY) || 'auto' } catch { return 'auto' } }
export function setQuality(v) { try { localStorage.setItem(KEY, v) } catch {} }

// Smooth = more frames (video), Sharp = more detail (documents). Auto follows the machine.
export function startTier() {
  const q = getQuality()
  const t = system().tier
  if (q === 'smooth') return { ...TIERS[Math.max(t, 1)], fps: 30 }
  if (q === 'sharp') return { ...TIERS[Math.max(t, 1)], fps: 10, bitrate: 4_000_000 }
  return TIERS[t]
}

function h264Ok() {
  try { return !!RTCRtpSender.getCapabilities?.('video')?.codecs.some((c) => /h264/i.test(c.mimeType)) } catch { return false }
}

// Room-wide publish settings: one quality layer for the screen (no extra copies to encode), hardware H.264 when it exists.
export function roomOptions() {
  const t = startTier()
  return {
    publishDefaults: {
      ...(h264Ok() ? { videoCodec: 'h264' } : {}),
      screenShareEncoding: { maxBitrate: t.bitrate, maxFramerate: t.fps },
      screenShareSimulcastLayers: [],
    },
  }
}

export function shareCaptureOptions() {
  const t = startTier()
  return {
    audio: true,
    selfBrowserSurface: 'include',
    resolution: { width: t.width, height: t.height, frameRate: t.fps },
    contentHint: t.fps <= 15 ? 'detail' : 'motion',
  }
}

// While sharing: if the encoder reports CPU strain, lower the capture rate; creep back up after a calm minute.
export function useShareAdapt() {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant()
  useEffect(() => {
    if (!isScreenShareEnabled || getQuality() !== 'auto') return
    let level = system().tier, strain = 0, calm = 0
    const max = level
    const id = setInterval(async () => {
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShare)
      const track = pub?.track
      if (!track) return
      let limited = false
      try {
        const stats = await track.getSenderStats?.()
        limited = stats?.qualityLimitationReason === 'cpu'
      } catch {}
      strain = limited ? strain + 1 : 0
      calm = limited ? 0 : calm + 1
      let next = level
      if (strain >= 2 && level > 0) next = level - 1
      else if (calm >= 12 && level < max) next = level + 1
      if (next === level) return
      level = next; strain = 0; calm = 0
      const t = TIERS[level]
      console.info('[irisflow] share tier ->', t.name)
      try { await track.mediaStreamTrack.applyConstraints({ width: t.width, height: t.height, frameRate: t.fps }) } catch {}
    }, 5000)
    return () => clearInterval(id)
  }, [isScreenShareEnabled, localParticipant])
}

// Small picker in the share menu: Auto / Smooth / Sharp. Applies to the next share.
export function ShareQuality() {
  const [q, setQ] = useState(getQuality)
  return (
    <label className="share-quality" title="Auto adapts to this computer. Smooth favours video, Sharp favours text. Applies to your next share.">
      <span className="blabel">Quality</span>
      <select value={q} onChange={(e) => { setQ(e.target.value); setQuality(e.target.value) }} aria-label="Screen share quality">
        <option value="auto">Auto</option>
        <option value="smooth">Smooth</option>
        <option value="sharp">Sharp</option>
      </select>
    </label>
  )
}
