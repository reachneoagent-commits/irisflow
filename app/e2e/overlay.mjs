// Tests the desktop drawing layer (overlay.html) with a fake Tauri bridge.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
const page_url = new URL('../desktop/ui/overlay.html', import.meta.url)
let pass = 0, fail = 0
const ok = (n, c) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n); c ? pass++ : fail++ }
const b = await chromium.launch({ channel: 'chrome', headless: true })
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
await p.addInitScript(() => {
  const L = {}; window.__sent = []; window.__invoked = []
  window.__fire = (n, payload) => (L[n] || []).forEach((f) => f({ payload }))
  window.__TAURI__ = {
    event: { listen: async (n, f) => { (L[n] = L[n] || []).push(f); return () => {} }, emit: async (n, m) => { window.__sent.push([n, m]) } },
    core: { invoke: async (c, a) => { window.__invoked.push([c, a]) } },
  }
})
await p.goto(page_url.href)
const px = (x, y) => p.evaluate(([x, y]) => { const d = document.getElementById('c').getContext('2d').getImageData(x * devicePixelRatio, y * devicePixelRatio, 1, 1).data; return d[3] }, [x, y])
await p.waitForTimeout(200)
ok('bar hidden when pen is off', !(await p.locator('#bar').isVisible()))
await p.evaluate(() => __fire('iris-remote', { who: 'v', m: { t: 's', id: 'a', c: '#4da3ff', p: [0.1, 0.5, 0.5, 0.5, 0.9, 0.5] } }))
await p.waitForTimeout(150)
ok("viewer's stroke is drawn on the layer", (await px(400, 250)) > 200)
await p.evaluate(() => __fire('iris-remote', { who: 'v', m: { t: 'clear' } }))
await p.waitForTimeout(150)
ok("viewer's Clear removes it", (await px(400, 250)) === 0)
await p.evaluate(() => __fire('iris-pen-state', true))
ok('bar shows when pen is on', await p.locator('#bar').isVisible())
await p.getByRole('button', { name: 'Pen Blue' }).click()
ok('choosing a color works', (await p.locator('.sw').nth(2).evaluate((e) => e.style.outline)).includes('229'))
await p.mouse.move(100, 300); await p.mouse.down(); await p.mouse.move(400, 300, { steps: 8 }); await p.mouse.up()
await p.waitForTimeout(200)
ok('own stroke drawn', (await px(250, 300)) > 200)
const strokes = await p.evaluate(() => __sent.filter((s) => s[0] === 'iris-draw' && s[1].t === 's'))
ok('own stroke sent to the meeting', strokes.length > 0 && strokes[0][1].c === '#4da3ff')
await p.evaluate(() => __fire('iris-color', '#ff4d4d'))
ok('color set from the meeting window', (await p.locator('.sw').nth(1).evaluate((e) => e.style.outline)).includes('229'))
await p.evaluate(() => __fire('iris-clear', true))
await p.waitForTimeout(150)
ok('Clear from the meeting window removes own stroke', (await px(250, 300)) === 0)
await p.mouse.move(100, 300); await p.mouse.down(); await p.mouse.move(300, 300, { steps: 5 }); await p.mouse.up()
await p.getByRole('button', { name: 'Clear' }).click()
await p.waitForTimeout(150)
ok('Clear button works', (await px(200, 300)) === 0 && (await p.evaluate(() => __sent.some((s) => s[1].t === 'clear'))))
await p.evaluate(() => __fire('iris-remote', { who: 'v', m: { t: 's', id: 'z', c: '#4da3ff', p: [0.1, 0.8, 0.9, 0.8] } }))
await p.waitForTimeout(150)
await p.getByRole('button', { name: 'Clear' }).click()
await p.waitForTimeout(150)
ok('Clear also removes what viewers drew', (await px(400, 400)) === 0)
await p.getByRole('button', { name: 'Stop sharing' }).click()
ok('Stop sharing is on the drawing layer and ends the share', await p.evaluate(() => __sent.some((s) => s[0] === 'iris-stop-share') && __invoked.some((i) => i[0] === 'overlay_pen' && i[1].on === false)))
await p.getByRole('button', { name: 'Done' }).click()
ok('Done turns the pen off', await p.evaluate(() => __invoked.some((i) => i[0] === 'overlay_pen' && i[1].on === false)))
console.log(`\n${pass} passed, ${fail} failed`)
await b.close(); process.exit(fail ? 1 : 0)
