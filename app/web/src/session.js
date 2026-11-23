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
  location.href = logoutUrl()
}

// Ending only the app cookie lets Access sign straight back in from the team-domain session,
// so chain through the team logout too (lands on Cloudflare's "logged out" page).
export const ACCESS_TEAM = 'https://sdprox.cloudflareaccess.com'
export function logoutUrl() {
  return `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(ACCESS_TEAM + '/cdn-cgi/access/logout')}`
}
