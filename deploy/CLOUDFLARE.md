# Cloudflare Access setup

Irisflow sits behind Cloudflare Access (email one-time code). The home page and
starting a meeting need that sign-in. A shared meeting link must work for guests
without it. Guests are still admitted one by one by the host.

## Main application (Allow)

- Domain `iris.sdcloud.uk`, whole site.
- Policy: Allow, your email list.
- Covers `/`, `/api/rooms` (start a meeting), `/api/lobby`, `/api/lobby/decide`, `/api/mod`.

## Bypass applications

Add one self-hosted application per row. Domain `iris.sdcloud.uk`, policy
**Bypass**, include **Everyone**. The more specific path wins over the main app.

| Path | Why |
|---|---|
| `/s/*` | Share page and link preview |
| `/r/*` | Meeting page |
| `/og.png` | Preview image |
| `/assets/*`, `/fonts/*`, `/brand/*` | Page code, fonts, logo |
| `/favicon.svg` | Tab icon |
| `/api/rooms/exists` | Checks the meeting exists |
| `/api/join` | Ask to join |
| `/api/join/status` | Wait to be admitted |
| `/lk/*` | LiveKit signalling for the call |

`/api/join*` covers both join paths in one entry.

## Why this is safe

- Starting a meeting (`POST /api/rooms`) stays behind Access and also needs the invite code.
- Host controls need the host's secret grant, which guests never get.
- A guest can only enter after the host admits them; only then does the server issue a LiveKit token.

## Check

From any machine, each bypassed path should answer without a redirect to `cloudflareaccess.com`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://iris.sdcloud.uk/s/test
curl -s -o /dev/null -w "%{http_code}\n" https://iris.sdcloud.uk/og.png
curl -s -o /dev/null -w "%{http_code}\n" "https://iris.sdcloud.uk/api/rooms/exists?room=test"
```

Expect 200. The home page (`/`) should still redirect (302) to the sign-in.
WhatsApp caches previews, so test with a new meeting code.
