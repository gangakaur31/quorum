// Local visual checks only. No projects, provider calls or customer records are created.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.CHECK_URL || 'http://localhost:3002';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(), exceptions = [], layouts = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence, timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 12000);
  pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const wait = expression => evaluate(`new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(${expression}){clearInterval(timer);resolve(true)}else if(Date.now()-start>8000){clearInterval(timer);reject(new Error('Intro unavailable'))}},40)})`);
const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
const shot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(`artifacts/intro-cinematic/${name}.png`, Buffer.from(result.data, 'base64')); };
const freeze = async time => { await evaluate(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${time}})`); await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); };
const introReady = 'document.querySelector(".intro-letter")&&document.getAnimations().length>0';

await mkdir('artifacts/intro-cinematic', { recursive: true });
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await size(1440, 950); await send('Page.navigate', { url: base }); await wait(introReady);
  for (const [name, time] of [['gather', 450], ['converge', 1500], ['reveal', 3400]]) { await freeze(time); await shot('desktop-' + name); }
  for (const [width, height] of [[1440, 950], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await size(width, height); await send('Page.reload'); await wait(introReady); await freeze(3400);
    const result = await evaluate(`({width:innerWidth,height:innerHeight,overflowX:document.documentElement.scrollWidth-innerWidth,overflowY:document.documentElement.scrollHeight-innerHeight,escaped:[...document.querySelectorAll('.intro-hud,.intro-footer,.intro-title-block,.intro-perspective')].filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1}).map(e=>e.className),lettersVisible:[...document.querySelectorAll('.intro-letter')].every(e=>Number(getComputedStyle(e).opacity)===1)})`);
    layouts.push({ requestedWidth: width, ...result }); await shot(width + 'x' + height);
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await size(390, 844); await send('Page.reload'); await wait('document.querySelector(".intro-wordmark")');
  const reduced = await evaluate(`({animations:document.getAnimations().length,lettersVisible:[...document.querySelectorAll('.intro-letter')].every(e=>Number(getComputedStyle(e).opacity)===1),trailsHidden:getComputedStyle(document.querySelector('.intro-travel-signals')).display==='none'})`);
  await shot('reduced-motion');
  const report = { layouts, reduced, exceptions }; await writeFile('artifacts/intro-cinematic/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  assert.ok(layouts.every(l => Math.abs(l.width - l.requestedWidth) < 2 && l.overflowX <= 1 && l.overflowY <= 1 && l.escaped.length === 0 && l.lettersVisible));
  assert.equal(reduced.animations, 0); assert.ok(reduced.lettersVisible && reduced.trailsHidden); assert.deepEqual(exceptions, []);
} finally { socket.close(); }
