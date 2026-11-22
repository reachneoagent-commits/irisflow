// Accepts a bare code or a full meeting link, with stray spaces, capitals or a trailing slash/query.
export function parseCode(v) {
  const s = String(v ?? '').trim().toLowerCase().split(/[?#]/)[0].replace(/\/+$/, '')
  const m = s.match(/([a-z0-9]+(?:-[a-z0-9]+)+)$/)
  return m ? m[1] : s.replace(/[^a-z0-9-]/g, '')
}
