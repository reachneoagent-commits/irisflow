import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera', 'microphone'] })).newPage()
await p.goto('http://localhost:5173'); await p.getByRole('button', { name: 'Start a meeting' }).click(); await p.waitForURL(/\/r\//)
await p.locator('#pj-name').fill('Host'); await p.getByRole('button', { name: 'Start now' }).click(); await p.locator('[data-lk-theme]').first().waitFor()
await p.getByRole('button', { name: /^Chat/ }).first().click()
const inp = p.locator('.chatpanel .lk-chat-form-input')
for (const t of ['hi', 'second message', 'third']) { await inp.fill(t); await inp.press('Enter') }
await p.waitForTimeout(500)
const r = await p.evaluate(() => { const g = (s) => document.querySelector(s).getBoundingClientRect(); const m = g('.chatpanel .lk-chat-messages'), pn = g('.chatpanel'), f = g('.chatpanel .lk-chat-form'); return { panel: pn.height, messages: m.height, formTop: f.top - pn.top, texts: [...document.querySelectorAll('.chatpanel .lk-chat-entry')].length } })
console.log(JSON.stringify(r), r.messages > r.panel * 0.6 ? 'PASS' : 'FAIL')
await p.screenshot({ path: '/tmp/chat.png' }); await b.close()
