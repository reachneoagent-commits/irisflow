// Two-sided meeting test: a host and a guest in real browsers, with fake camera, mic and screen.
// Needs the local stack: livekit-server --dev, the token server (8787) and the site on 5173.
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'http://localhost:5173'
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  ' + x}`) }
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--auto-select-desktop-capture-source=Entire screen', '--enable-usermedia-screen-capturing', '--auto-accept-this-tab-capture']
const browser = await chromium.launch({ channel: 'chrome', headless: false, args })
const mk = async (name) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera', 'microphone'] }); const p = await ctx.newPage(); p.on('pageerror', (e) => console.log(`  [${name} page error] ${e.message}`)); return p }
const step = async (n, fn) => { try { await fn() } catch (e) { ok(n, false, String(e.message).split('\n')[0]) } }
const host = await mk('host'), guest = await mk('guest')

let code
await step('host starts a meeting', async () => {
  await host.goto(BASE)
  await host.getByRole('button', { name: 'Start a meeting' }).click()
  await host.waitForURL(/\/r\//)
  code = host.url().split('/r/')[1].split(/[?#]/)[0]
  ok('host starts a meeting', /^[a-z]+-[a-z]+-[a-z]+$/.test(code))
  await host.locator('#pj-name').fill('Host')
  await host.getByRole('button', { name: 'Start now' }).click()
  await host.locator('.lk-room-container, [data-lk-theme]').first().waitFor({ timeout: 15000 })
  ok('host is in the call', true)
})
await step('guest joins by code', async () => {
  await guest.goto(BASE)
  await guest.getByRole('button', { name: 'Join a meeting' }).click()
  await guest.locator('#code').fill(code)
  await guest.getByRole('button', { name: 'Continue' }).click()
  await guest.locator('#pj-name').fill('Guest')
  await guest.getByRole('button', { name: 'Ask to join' }).click()
  ok('guest is waiting for the host', await guest.getByText(/waiting|host/i).first().isVisible())
})
await step('host admits the guest', async () => {
  await host.getByRole('button', { name: /admit|allow/i }).first().click({ timeout: 15000 })
  await guest.locator('[data-lk-theme]').first().waitFor({ timeout: 15000 })
  ok('guest is in the call', true)
})
await step('guest starts sharing', async () => {
  await guest.getByRole('button', { name: /^Share/ }).first().click()
  await guest.waitForTimeout(3000)
  ok('host sees the shared screen', await host.locator('[data-lk-source="screen_share"] video').count() > 0)
})
await step('viewer picks colors', async () => {
  await host.getByRole('button', { name: /Draw/ }).first().click()
  const labels = await host.locator('.swatch').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  ok('colors are Black, Red, Blue, White (no yellow)', JSON.stringify(labels) === JSON.stringify(['Pen Black', 'Pen Red', 'Pen Blue', 'Pen White']), JSON.stringify(labels))
  await host.getByRole('button', { name: 'Pen Blue' }).click()
  ok('choosing a color selects it', (await host.getByRole('button', { name: 'Pen Blue' }).getAttribute('aria-pressed')) === 'true')
})
await step('viewer draws and sharer sees it', async () => {
  const v = host.locator('[data-lk-source="screen_share"] video').first(); const b = await v.boundingBox()
  await host.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3); await host.mouse.down()
  for (let i = 1; i <= 10; i++) await host.mouse.move(b.x + b.width * (0.3 + i * 0.03), b.y + b.height * (0.3 + i * 0.02))
  await host.mouse.up(); await host.waitForTimeout(800)
  const px = (pg) => pg.locator('.draw-canvas').first().evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n })
  ok('viewer sees own stroke', (await px(host)) > 50)
  ok('sharer receives the stroke', (await px(guest)) > 50, `pixels ${await px(guest)}`)
  await host.getByRole('button', { name: 'Clear' }).click(); await host.waitForTimeout(500)
  ok('Clear removes it for the viewer', (await px(host)) === 0)
  ok('Clear removes it for the sharer', (await px(guest)) === 0)
})
await step('sharer can stop sharing', async () => {
  ok('Stop sharing button is visible to the sharer', await guest.getByRole('button', { name: 'Stop sharing' }).isVisible())
  await guest.getByRole('button', { name: 'Stop sharing' }).click()
  await guest.waitForTimeout(2000)
  ok('host no longer sees a shared screen', await host.locator('[data-lk-source="screen_share"] video').count() === 0)
})
await step('guest leaves cleanly', async () => {
  await guest.getByRole('button', { name: 'Leave meeting' }).click()
  ok('guest sees the left page', await guest.getByText('You left the meeting').waitFor({timeout:8000}).then(()=>true,()=>false))
})
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
