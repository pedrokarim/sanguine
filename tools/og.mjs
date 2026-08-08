#!/usr/bin/env node
/**
 * Photographie l'image de partage.
 *
 * La composition vit dans `src/og.ts` et se construit avec `pnpm planche`. Ce script ouvre
 * la page à 1200 × 630 exactement, laisse le sang du logo couler quelques instants, puis
 * capture. Le résultat va dans `docs/og.png` et sert de `og:image` aux deux sites.
 *
 *   node tools/og.mjs <url> <sortie>
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const PORT = 10099;
const chrome = spawn('/usr/bin/google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/sanguine-og', '--no-first-run', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1200,630', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill('SIGKILL'); } catch { /* déjà mort */ } });

let wsUrl = null;
for (let i = 0; i < 80; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; break; }
  catch { await sleep(250); }
}
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id !== undefined) { const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (me, pa = {}, s) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method: me, params: pa, sessionId: s }));
});
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride',
  { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false }, sessionId);
await send('Page.navigate', { url: process.argv[2] }, sessionId);
// Le sang met environ deux secondes à couler jusqu'au bas des lettres.
await sleep(4000);
const { data } = await send('Page.captureScreenshot',
  { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } }, sessionId);
writeFileSync(process.argv[3], Buffer.from(data, 'base64'));
console.log(`image de partage écrite : ${process.argv[3]}`);
process.exit(0);
