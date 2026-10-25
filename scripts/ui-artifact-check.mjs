// Inspect a real generated static artifact, never a fixture presented as inference.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const directory = path.resolve('artifacts/demo-polish');
const generated = JSON.parse(await readFile(path.join(directory, 'live-artifact.json'), 'utf8'));
const tabs = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0; const pending = new Map(), errors = [], layouts = [];
socket.addEventListener('message', event => { const item = JSON.parse(event.data); if (item.id) { pending.get(item.id)?.(item); pending.delete(item.id); } if (item.method === 'Runtime.exceptionThrown') errors.push(item.params.exceptionDetails.text); });
const send = (method, params = {}) => new Promise((resolve, reject) => { const sequence = ++id, timer = setTimeout(() => reject(new Error(method + ' timed out')), 15000); pending.set(sequence, item => { clearTimeout(timer); item.error ? reject(new Error(item.error.message)) : resolve(item.result); }); socket.send(JSON.stringify({ id: sequence, method, params })); });
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); assert.ok(!result.exceptionDetails); return result.result.value; };
try {
  await send('Page.enable'); await send('Runtime.enable');
  for (const width of [1440, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Page.navigate', { url: pathToFileURL(path.join(directory, 'live-artifact.html')).href });
    await evaluate('new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.readyState==="complete"&&document.querySelector("h1")){clearInterval(timer);resolve(true)}else if(++tries>100){clearInterval(timer);reject(new Error("Artifact not ready"))}},40)})');
    const result = await evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,headline:document.querySelector("h1").textContent,sections:document.querySelectorAll("section").length,emDash:document.body.innerText.includes(String.fromCharCode(8212)),external:document.querySelectorAll("script,iframe,img[src^=http],link[href^=http]").length,cta:!!document.getElementById("artifact-cta"),workflow:!!document.getElementById("workflow")})');
    assert.ok(result.overflow <= 1 && !result.emDash && result.external === 0 && result.cta && result.workflow);
    layouts.push(result);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(path.join(directory, `live-artifact-${width}.png`), Buffer.from(screenshot.data, 'base64'));
  }
  assert.deepEqual(errors, []);
  const report = { provider: generated.metadata.provider, model: generated.metadata.model, fallback: generated.metadata.fallbackUsed, layouts, browserExceptions: errors };
  await writeFile(path.join(directory, 'artifact-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { socket.close(); }
