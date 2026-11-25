import React, { useEffect, useRef, useState } from 'react'
import { Track, RoomEvent } from 'livekit-client'
import {
  CarouselLayout, Chat, ConnectionStateToast, DisconnectButton, FocusLayout,
  FocusLayoutContainer, GridLayout, LayoutContextProvider, ParticipantTile,
  StartMediaButton, TrackToggle, isTrackReference, useMaybeTrackRefContext, useCreateLayoutContext, usePinnedTracks, useTracks,
  useChat,
} from '@livekit/components-react'
import { Users, MessageSquare, PhoneOff, X } from 'lucide-react'
import { IconBtn, ICON } from './ui.jsx'
import { MeetingCode } from './Invite.jsx'
import Reactions from './Reactions.jsx'
import People, { useLobby } from './People.jsx'
import Draw from './Draw.jsx'
import DeviceMenu from './DeviceMenu.jsx'
import MoreMenu, { useMedia } from './MoreMenu.jsx'
import { shareCaptureOptions, useShareAdapt, ShareQuality } from './perf.jsx'

// Camera-off tiles show the first letter of the person's name (styled in brand.css).
function Tile(props) {
  const ref = useMaybeTrackRefContext() || props.trackRef
  const name = (ref?.participant?.name || ref?.participant?.identity || '').trim()
  const letter = name ? Array.from(name)[0].toUpperCase() : ''
  return <ParticipantTile {...props} style={{ position: 'relative', '--initial': JSON.stringify(letter) }} />
}

const same = (a, b) => a && b && a.participant.identity === b.participant.identity && a.source === b.source

// Same layout as LiveKit's VideoConference, but with our buttons inside the bottom control bar.
export default function MeetingView({ code, grant, isHost }) {
  const [panel, setPanel] = useState(null) // 'people' | 'chat' | null
  const toggle = (p) => setPanel((cur) => (cur === p ? null : p))
  const [waiting, setWaiting] = useLobby(code, grant, isHost, () => setPanel('people'))
  const { chatMessages } = useChat()
  const seen = useRef(0)
  useEffect(() => { if (panel === 'chat') seen.current = chatMessages.length }, [panel, chatMessages.length])
  // LiveKit's tile focus button has no accessible name; label it.
  useEffect(() => {
    const label = () => document.querySelectorAll('.lk-focus-toggle-button:not([aria-label])').forEach((b) => { b.setAttribute('aria-label', 'Focus on this tile'); b.title = 'Focus on this tile' })
    label()
    const mo = new MutationObserver(label)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
  // Escape closes the side panel; opening chat focuses its input.
  useEffect(() => {
    if (!panel) return
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.dev-pop')) setPanel(null) }
    document.addEventListener('keydown', onKey)
    if (panel === 'chat') setTimeout(() => document.querySelector('.chatpanel .lk-chat-form-input')?.focus(), 50)
    return () => document.removeEventListener('keydown', onKey)
  }, [panel])
  const compact = useMedia('(max-width: 900px)')
  const unread = panel === 'chat' ? 0 : Math.max(0, chatMessages.length - seen.current)
  const [host, setHost] = useState(null)
  const hostRef = useRef(null)
  const setHostEl = (el) => { hostRef.current = el; setHost(el) }
  const lastShare = useRef(null)
  const layout = useCreateLayoutContext()
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  )
  const focus = usePinnedTracks(layout)?.[0]
  const carousel = tracks.filter((t) => !same(t, focus))
  const shares = tracks.filter(isTrackReference).filter((t) => t.publication.source === Track.Source.ScreenShare)

  useEffect(() => {
    const live = shares.find((t) => t.publication.isSubscribed)
    if (live && !lastShare.current) {
      layout.pin.dispatch?.({ msg: 'set_pin', trackReference: live }); lastShare.current = live
    } else if (lastShare.current && !shares.some((t) => t.publication.trackSid === lastShare.current.publication?.trackSid)) {
      layout.pin.dispatch?.({ msg: 'clear_pin' }); lastShare.current = null
    }
  }, [shares.map((t) => `${t.publication.trackSid}_${t.publication.isSubscribed}`).join(), tracks])

  // Phones can't capture the screen from a browser (no getDisplayMedia), so hide the dead button.
  useShareAdapt()
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
  const share = !canShare ? null : <div className="lk-button-group"><TrackToggle source={Track.Source.ScreenShare} captureOptions={shareCaptureOptions()} showIcon={true}>Share</TrackToggle><ShareQuality /></div>
  const leave = <DisconnectButton className="leave-btn" aria-label="Leave meeting" title="Leave meeting"><PhoneOff {...ICON} /><span className="blabel">Leave</span></DisconnectButton>
  const draw = <Draw hostRef={hostRef} host={host} sharerId={shares[0]?.participant.identity} canDraw />
  const people = <IconBtn short="People" label="People" active={panel === 'people'} badge={isHost && waiting.length ? waiting.length : 0} onClick={() => toggle('people')}><Users {...ICON} /></IconBtn>
  const chat = <IconBtn short="Chat" label="Chat" active={panel === 'chat'} badge={unread} onClick={() => toggle('chat')}><MessageSquare {...ICON} /></IconBtn>
  const secondary = <><div className="more-code"><MeetingCode code={code} /></div>{share}<Reactions />{draw}{people}{chat}<StartMediaButton /></>

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider value={layout}>
        <div className="lk-video-conference-inner">
          <div className="draw-host" ref={setHostEl}>
          {!focus ? (
            <div className="lk-grid-layout-wrapper"><GridLayout tracks={tracks}><Tile /></GridLayout></div>
          ) : (
            <div className="lk-focus-layout-wrapper">
              <FocusLayoutContainer>
                <CarouselLayout tracks={carousel}><Tile /></CarouselLayout>
                <FocusLayout trackRef={focus} style={{ '--initial': JSON.stringify(Array.from((focus.participant.name || focus.participant.identity || '').trim())[0]?.toUpperCase() || '') }} />
              </FocusLayoutContainer>
            </div>
          )}
          </div>
          <div className="meet-bar">
            {!compact && <div className="bar-left"><MeetingCode code={code} /></div>}
            <div className="bar-center">
              <div className="lk-button-group">
                <TrackToggle source={Track.Source.Microphone} showIcon>Mic</TrackToggle>
                <DeviceMenu kind="audioinput" label="Microphone" />
              </div>
              <div className="lk-button-group">
                <TrackToggle source={Track.Source.Camera} showIcon>Camera</TrackToggle>
                <DeviceMenu kind="videoinput" label="Camera" />
              </div>
              {compact ? (
                <>
                  <MoreMenu badge={(isHost ? waiting.length : 0) + unread}>{secondary}</MoreMenu>
                  {leave}
                </>
              ) : (
                <>{share}<Reactions />{leave}</>
              )}
            </div>
            {!compact && <div className="bar-right">{draw}{people}{chat}<StartMediaButton /></div>}
          </div>
        </div>
        {panel === 'people' && <People room={code} grant={grant} isHost={isHost} waiting={waiting} setWaiting={setWaiting} onClose={() => setPanel(null)} />}
        <div className="panel chatpanel" style={{ display: panel === 'chat' ? 'flex' : 'none' }}>
          <div className="panel-head"><h3>Chat</h3><button className="ibtn sm" onClick={() => setPanel(null)} aria-label="Close panel" title="Close"><X size={18} /></button></div>
          <Chat />
        </div>
      </LayoutContextProvider>
      <ConnectionStateToast />
    </div>
  )
}
