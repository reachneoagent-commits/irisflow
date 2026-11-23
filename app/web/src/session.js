// Cloudflare Access sessions expire (30 min), and the desktop app can lose its sign-in cookie.
// API calls then get redirected to the sign-in page and fail. Detect that and reload so the
// person is asked to sign in again instead of seeing a dead end.
export async function reloginIfExpired() {
  if (location.protocol !== 'https:') return false
  try {
    const r = await fetch('/', { redirect: 'manual', cache: 'no-store' })
    if (r.type === 'opaqueredirect' || r.status === 401 || r.status === 403) { location.reload(); return true }
  } catch {
    // The redirect to the sign-in page was blocked: that is also an expired session, unless offline.
    if (navigator.onLine) { location.reload(); return true }
  }
  return false
}

// Last-resort fix when the app is stuck: forget everything this app saved (cached files, settings),
// then sign out of Cloudflare, which also removes its sign-in cookie. The person signs in again.
export async function clearSavedData() {
  try { localStorage.clear(); sessionStorage.clear() } catch { /* blocked: carry on */ }
  try { for (const k of await caches.keys()) await caches.delete(k) } catch { /* no cache API */ }
  try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister() } catch { /* none */ }
  await signOut()
}

// Cloudflare's own logout works but ends on a page that says "Failed to log out" until refreshed.
// So run it in a hidden frame, show our own "Signed out" message, then reload into the login page.
export async function signOut() {
  const msg = document.createElement('div')
  msg.setAttribute('role', 'status')
  msg.textContent = 'Signing you out…'
  msg.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#0b0b0d;color:#fff;font:600 18px system-ui,sans-serif'
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0'
  frame.src = '/cdn-cgi/access/logout'
  msg.appendChild(frame)
  document.body.appendChild(msg)
  await new Promise((r) => setTimeout(r, 2500))
  msg.firstChild.textContent = 'Signed out'
  await new Promise((r) => setTimeout(r, 800))
  location.replace('/')
}
