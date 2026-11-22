// Cloudflare Access sessions expire (30 min). When that happens API calls are redirected to the
// sign-in page and fail. Detect it and reload so the person is asked to sign in again.
export async function reloginIfExpired() {
  if (location.protocol !== 'https:') return false
  try {
    const r = await fetch('/', { redirect: 'manual', cache: 'no-store' })
    if (r.type === 'opaqueredirect') { location.reload(); return true }
  } catch { /* offline: leave the normal error showing */ }
  return false
}
