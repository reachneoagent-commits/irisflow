import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '@livekit/components-styles'
import './brand.css'
import Landing from './Landing.jsx'
import Room from './Room.jsx'
import { Toaster } from './ui.jsx'

function useRoute() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])
  const go = (p) => { history.pushState({}, '', p); setPath(p) }
  return [path, go]
}

function App() {
  const [path, go] = useRoute()
  const m = path.match(/^\/r\/([a-z0-9-]{3,64})$/i)
  document.title = m ? `Meeting · Irisflow` : 'Irisflow'
  return <>{m ? <Room code={m[1].toLowerCase()} onLeave={() => go('/')} /> : <Landing go={go} />}<Toaster /></>
}
createRoot(document.getElementById('root')).render(<App />)
