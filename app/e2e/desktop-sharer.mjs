// Plays the sharer for a manual desktop-app test: starts a meeting, admits the app, shares a screen,
// and reports every few seconds whether it sees marks drawn by the app's user.
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = 'http://localhost:5173'
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/desktop-sharer.log', m + '\n') }
const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-select-desktop-capture-source=Entire screen', '--enable-usermedia-screen-capturing'] })
const c = await b.newContext({ viewport: { width: 1000, height: 700 }, permissions: ['camera', 'microphone'] })
const h = await c.newPage()
await h.goto(BASE); await h.getByRole('button', { name: 'Start a meeting' }).click(); await h.waitForURL(/\/r\//)
const code = h.url().split('/r/')[1].split(/[?#]/)[0]
await h.locator('#pj-name').fill('Sharer'); await h.getByRole('button', { name: 'Start now' }).click()
await h.locator('[data-lk-theme]').first().waitFor()
log('CODE ' + code)
let shared = false
setInterval(async () => {
  try {
    await h.getByRole('button', { name: /admit|allow/i }).first().click({ timeout: 400 }).then(() => log('admitted someone'), () => {})
    if (!shared && (await h.getByText(/Viewer|Guest|joined/i).count().catch(() => 0)) >= 0) {
      const people = await h.evaluate(() => document.querySelectorAll('[data-lk-participant-name]').length)
      if (people >= 2) { shared = true; await h.getByRole('button', { name: /^Share/ }).first().click(); log('sharing a screen') }
    }
    if (shared) {
      const n = await h.evaluate(() => { const c = document.querySelector('.draw-canvas'); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) k++; return k })
      log('marks on the shared screen: ' + (n > 0 ? 'YES (' + n + ' px)' : n === 0 ? 'none' : 'no canvas'))
    }
  } catch (e) { log('err ' + e.message.split('\n')[0]) }
}, 2500)
await new Promise(() => {})
