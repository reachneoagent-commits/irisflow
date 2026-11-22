// Plays the viewer for a manual desktop-app test: starts a meeting, admits the app, then when the app
// shares, draws a blue stroke on it and reports what it sees. Prints the code first.
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = 'http://localhost:5173'
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/desktop-host.log', m + '\n') }
const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const c = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera', 'microphone'] })
const h = await c.newPage()
await h.goto(BASE); await h.getByRole('button', { name: 'Start a meeting' }).click(); await h.waitForURL(/\/r\//)
const code = h.url().split('/r/')[1].split(/[?#]/)[0]
await h.locator('#pj-name').fill('Viewer'); await h.getByRole('button', { name: 'Start now' }).click()
await h.locator('[data-lk-theme]').first().waitFor()
log('CODE ' + code)
setInterval(async () => { try { await h.getByRole('button', { name: /admit|allow/i }).first().click({ timeout: 500 }); log('admitted someone') } catch {} }, 1500)
let drew = false
setInterval(async () => {
  try {
    const n = await h.locator('[data-lk-source="screen_share"] video').count()
    if (n && !drew) {
      drew = true; log('viewer sees the shared screen')
      await h.getByRole('button', { name: /Draw/ }).first().click()
      await h.getByRole('button', { name: 'Pen Blue' }).click()
      const v = h.locator('[data-lk-source="screen_share"] video').first(); const r = await v.boundingBox()
      await h.mouse.move(r.x + r.width * .3, r.y + r.height * .5); await h.mouse.down()
      await h.mouse.move(r.x + r.width * .7, r.y + r.height * .5, { steps: 20 }); await h.mouse.up()
      log('viewer drawing every 3s')
      globalThis.__loop = setInterval(async () => { try { await h.mouse.move(r.x + r.width * .3, r.y + r.height * .5); await h.mouse.down(); await h.mouse.move(r.x + r.width * .7, r.y + r.height * .5, { steps: 20 }); await h.mouse.up() } catch {} }, 3000)
    }
    if (!n && drew) { drew = false; clearInterval(globalThis.__loop); log('share ended') }
  } catch (e) { log('err ' + e.message.split('\n')[0]) }
}, 1500)
await new Promise(() => {})
