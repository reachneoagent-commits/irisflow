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
