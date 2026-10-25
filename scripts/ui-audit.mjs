import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const base = process.env.CHECK_URL || 'http://localhost:3002';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'UI audit is local only.');
const pages = await (await fetch((process.env.QUORUM_BROWSER_DEBUG_URL||'http://127.0.0.1:9222')+'/json/list')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
const fixture = await require('./ui-audit-fixture.cjs')().catch(error => { socket.close(); throw error; });
let sequence = 0; const pending = new Map(), errors = [], checks = [], layouts = [];
socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); });
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => reject(new Error(`CDP timeout ${method}`)), 20000); pending.set(id, m => { clearTimeout(timer); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
// Subscribe before navigation so waits never attach to a disappearing old document.
const navigateLoaded = async (method, params = {}) => {
  let listener, timer;
  const loaded = new Promise((resolve, reject) => {
    listener = event => { if (JSON.parse(event.data).method === 'Page.loadEventFired') resolve(); };
    socket.addEventListener('message', listener);
    timer = setTimeout(() => reject(new Error('Page load timed out')), 15000);
  });
  try { await Promise.all([send(method, params), loaded]); }
  finally { clearTimeout(timer); socket.removeEventListener('message', listener); }
};
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).catch(error => { throw new Error(`${error.message}: ${expression.slice(0,160)}`); }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const wait = async expression => { const started=Date.now(); while(Date.now()-started<12000) { try { if(await evaluate("Boolean("+expression+")")) return true; } catch(error) { if(!/context|Cannot find/i.test(error.message)) throw error; } await new Promise(resolve=>setTimeout(resolve,70)); } throw new Error('Timed out: '+expression); };
const click = text => evaluate(`{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button)throw new Error('Missing button '+${JSON.stringify(text)});button.click()}`);
let requestedWidth=1440;
const size = async width => { requestedWidth=width; await send('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 600 }); };
const shot = async name => {
  if (await evaluate('!!document.querySelector("iframe")')) {
    let ready = false;
    for (let attempt = 0; attempt < 80 && !ready; attempt++) {
      const tree = await send('Page.getFrameTree');
      const frame = tree.frameTree.childFrames?.find(f => f.frame.url === 'about:srcdoc');
      if (frame) {
        const world = await send('Page.createIsolatedWorld', { frameId: frame.frame.id, worldName: 'quorum-visual-audit' });
        const content = await send('Runtime.evaluate', { contextId: world.executionContextId, expression: 'document.readyState==="complete"&&document.body?.textContent.includes("INTERNAL UI")', returnByValue: true });
        ready = content.result.value === true;
      } else {
        // Empty-sandbox previews use a separate renderer process in modern Chrome.
        const targets = await (await fetch((process.env.QUORUM_BROWSER_DEBUG_URL||'http://127.0.0.1:9222')+'/json/list')).json();
        const target = targets.find(t => t.type === 'iframe' && t.url === 'about:srcdoc');
        if (target) {
          const child = new WebSocket(target.webSocketDebuggerUrl);
          ready = await new Promise(resolve => {
            const timer = setTimeout(() => { child.close(); resolve(false); }, 3000);
            child.addEventListener('open', () => child.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'document.readyState==="complete"&&document.body?.textContent.includes("INTERNAL UI")', returnByValue: true } })), { once: true });
            child.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id === 1) { clearTimeout(timer); child.close(); resolve(m.result?.result.value === true); } });
            child.addEventListener('error', () => { clearTimeout(timer); child.close(); resolve(false); });
          });
        }
      }
      if (!ready) await new Promise(r => setTimeout(r, 60));
    }
    assert.ok(ready, `Sandboxed fixture did not render: ${name}`);
    if (name.includes('brief')) {
      await evaluate('document.querySelector("iframe").scrollIntoView({block:"center",behavior:"instant"})');
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const preview = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(`artifacts/ui-audit/${name}-preview.png`, Buffer.from(preview.data, 'base64'));
      await evaluate('window.scrollTo({top:0,behavior:"instant"})');
    }
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !name.startsWith('legal') }); await writeFile(`artifacts/ui-audit/${name}.png`, Buffer.from(data, 'base64'));
};
const layout = async name => { await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); const result = await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,escaped:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height||s.position==='absolute'||s.position==='fixed'||e.closest('.table-scroll,.terminal-log,.bot-field,.result-tabs,.workspace-nav,.persona-switcher')||e.tagName==='SVG'||e.closest('svg')||s.display==='none')return false;return r.right>innerWidth+2||r.left< -2}).slice(0,10).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,70)}))})`); layouts.push({ name, ...result }); assert.ok(Math.abs(result.width-requestedWidth)<2, `Layout viewport expanded for ${name}`); };
const command = async value => { await evaluate(`{const e=document.querySelector('.terminal-input');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))}`); await click('RUN'); };
async function enterWorkspace() { await wait('document.querySelector(".hero-actions")'); await click('Start your Quorum'); await wait('document.querySelector(".terminal-panel")'); }
async function install(context) { await evaluate(`localStorage.setItem('quorum-projects-v2',${JSON.stringify(JSON.stringify([context]))});localStorage.setItem('quorum-active-v2',${JSON.stringify(context.sessionId)})`); await navigateLoaded('Page.reload'); await enterWorkspace(); await evaluate(`{const select=document.querySelector('.app-nav select');select.value=${JSON.stringify(context.sessionId)};select.dispatchEvent(new Event('change',{bubbles:true}))}`); }
await mkdir('artifacts/ui-audit', { recursive: true });
try {
  await send('Page.enable'); await send('Runtime.enable'); await size(1440);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigateLoaded('Page.navigate', { url: base }); await wait('document.querySelector(".hero-actions button")||document.querySelector(".terminal-panel")');
  await evaluate("localStorage.removeItem('quorum-projects-v2');localStorage.removeItem('quorum-active-v2')"); await navigateLoaded('Page.reload'); await wait('document.querySelector(".hero-actions button")');
  await shot('hero-desktop'); await click('See how it works'); await wait('document.querySelector("#how-it-works")'); await layout('hero-expanded'); await shot('hero-expanded');
  await size(320); await layout('hero-320'); await shot('hero-320'); await click('Start your Quorum'); await wait('document.querySelector(".terminal-panel")'); await layout('empty-320'); await shot('empty-320');
  await size(1440); await evaluate('document.querySelector(".assumptions-panel").open=true'); await layout('assumptions-open'); await shot('assumptions-open');
  const terminal = await evaluate('({bottom:document.querySelector(".terminal-input-wrap").getBoundingClientRect().bottom,height:innerHeight})'); checks.push({ name: 'expanded assumptions leave command input reachable', passed: terminal.bottom <= terminal.height + 2 });
  console.error('Reviewing short viewport, empty workspaces and loading state.');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 650, deviceScaleFactor: 1, mobile: false });
  await layout('short-desktop');
  await evaluate('document.querySelector(".terminal-input").focus()');
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  checks.push({ name: 'short desktop terminal can scroll to the input', passed: await evaluate('document.querySelector(".terminal-input").getBoundingClientRect().bottom<=innerHeight+2') });
  await shot('short-desktop');
  await size(320);
  for (const workspace of ['discover', 'evidence', 'interviews', 'experiments', 'perspectives', 'decision', 'knowledge', 'legal', 'brief']) { await click('/' + workspace); await layout(`empty-${workspace}-320`); }
  // Pause the browser's outgoing request to inspect loading/cancellation without paid inference.
  let paused;
  const pausedListener = event => { const m = JSON.parse(event.data); if (m.method === 'Fetch.requestPaused') paused = m.params.requestId; };
  socket.addEventListener('message', pausedListener);
  await send('Fetch.enable', { patterns: [{ urlPattern: base + '/api/generate', requestStage: 'Request' }] });
  await click('/artifact'); await click('Show terminal'); await command('INTERNAL VISUAL TEST ONLY: cancellation preview');
  await wait('document.querySelector(".generation-progress")');
  checks.push({ name: 'mobile loading has a visible cancel action', passed: await evaluate('!!document.querySelector(".result-operation button")') });
  for (const width of [320, 1024, 1440]) { await size(width); await layout(`loading-${width}`); await shot(`loading-${width}`); }
  await click('Cancel operation'); if (paused) await send('Fetch.failRequest', { requestId: paused, errorReason: 'Aborted' }).catch(() => {});
  await send('Fetch.disable'); socket.removeEventListener('message', pausedListener); await wait('!document.querySelector(".generation-progress")');
  checks.push({ name: 'generation cancellation restores the empty state', passed: await evaluate('!!document.querySelector(".canvas-intro")') });
  await install(fixture.context);
  console.error('Reviewing populated workspaces at five widths.');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await size(width);
    for (const workspace of ['artifact', 'discover', 'evidence', 'interviews', 'experiments', 'perspectives', 'decision', 'knowledge', 'legal', 'brief']) {
      await click('/' + workspace); await wait(`document.querySelector('.workspace-nav [aria-current="page"]')?.textContent==='/${workspace}'`);
      await evaluate('window.scrollTo(0,0)'); await layout(`${workspace}-${width}`);
      if (width === 1440 || width === 390 || workspace === 'artifact' || workspace === 'brief') await shot(`${workspace}-${width}`);
    }
  }
  console.error('Reviewing focused results and saved output history.');
  for (const width of [1440,1024,768,390,320]) {
    await size(width); await click('/artifact');
    for (const tab of ['Reviews','Scorecard','Angles','Interview kit','Summary']) { await click(tab); await layout('focused-'+tab+'-'+width); if(width===1440||width===390) await shot('focused-'+tab.replaceAll(' ','-')+'-'+width); }
    await command('/history'); await layout('history-'+width); if(width===1440||width===390) await shot('history-'+width);
  }
  console.error('Verifying saved legal preparation, private notes, scope changes and recovery.');
  await size(1440); await click('/legal');
  await wait('document.querySelector("[data-legal-task=ai]")');
  await evaluate(`{const form=document.querySelector('[data-legal-task=privacy] form');form.querySelector('[name=status]').value='preparing';form.querySelector('[name=notes]').value='INTERNAL PRIVATE LEGAL UI NOTE';form.requestSubmit()}`);
  await wait('document.querySelector(".legal-overview")?.textContent.includes("1 marked preparing")');
  await navigateLoaded('Page.reload'); await enterWorkspace(); await evaluate(`{const select=document.querySelector('.app-nav select');select.value=${JSON.stringify(fixture.context.sessionId)};select.dispatchEvent(new Event('change',{bubbles:true}))}`); await command('/legal');
  await wait('document.querySelector(".legal-overview")?.textContent.includes("1 marked preparing")');
  checks.push({ name: 'legal notes and task progress survive reload', passed: await evaluate('document.querySelector("[data-legal-task=privacy] [name=notes]")?.value==="INTERNAL PRIVATE LEGAL UI NOTE"') });
  await size(390); await evaluate('document.querySelector("[data-legal-task=privacy] details").open=true;document.querySelector("[data-legal-task=privacy]").scrollIntoView({block:"start",behavior:"instant"})'); await shot('legal-privacy-390');
  await evaluate(`document.querySelector('.legal-profile [name=legalMarket][value=eu]').click()`);
  await wait('document.querySelector(".legal-scope-warning")');
  checks.push({ name: 'unsaved legal scope prevents task updates', passed: await evaluate('document.querySelector(".legal-progress button").disabled') });
  await click('Update preparation checklist');
  await wait('document.querySelector(".legal-overview")?.textContent.includes("0 marked preparing")&&!document.querySelector(".legal-scope-warning")');
  checks.push({ name: 'new legal scope resets earlier task progress', passed: await evaluate('document.querySelector("[data-legal-task=privacy] [name=notes]").value===""') });
  await evaluate(`document.querySelector('.legal-profile [name=legalMarket][value=eu]').click()`); await click('Update preparation checklist'); await wait('!document.querySelector(".legal-scope-warning")');
  await size(390); await click('/evidence'); await click('Edit'); await wait('document.querySelector(".workspace-form h2")?.textContent==="Update observation"');
  console.error('Reviewing editing, source details, keyboard navigation and sharing.');
  await layout('evidence-edit-390'); await shot('evidence-edit-390'); await click('Cancel edit');
  await click('/interviews'); await evaluate('document.querySelector("details").open=true'); await shot('interview-source-390');
  await click('/decision'); await evaluate('document.querySelectorAll("details").forEach(e=>e.open=true)'); await shot('decision-details-390');
  await click('/discover');
  await evaluate(`{const e=[...document.querySelectorAll('select')].find(e=>[...e.options].some(o=>o.value==='supplied'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'supplied');e.dispatchEvent(new Event('change',{bubbles:true}))}`);
  await wait('document.querySelector("[name=excerpt]")'); await layout('supplied-source-390'); await shot('supplied-source-390');
  await size(1440); await click('/artifact'); await click('Reviews');
  await evaluate('document.querySelector(".persona-switcher [aria-selected=true]").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
  checks.push({ name: 'reviewer keyboard navigation moves selection and focus', passed: await evaluate('document.activeElement?.id==="jury-tab-advocate"&&document.activeElement.getAttribute("aria-selected")==="true"') });
  for (const tab of await evaluate('[...document.querySelectorAll(".persona-switcher button")].map(b=>b.textContent.trim())')) { await click(tab); await wait(`document.querySelector('.persona-head')?.textContent.includes(${JSON.stringify(tab)})`); }
  await command('/inspect budget-conscious'); await wait('document.querySelector(".trace")'); await shot('inspection'); await command('/summary'); await wait('document.querySelector(".summary-body")'); await shot('summary');
  await click('Angles'); await click('Open run'); await wait('document.querySelector(".return-run")'); await shot('angle-run'); await click('Return to main reviews');
  await command('/share'); await wait('document.querySelector("[role=dialog]")'); await shot('share-desktop');
  checks.push({ name: 'share dialog receives focus', passed: await evaluate('!!document.activeElement.closest("[role=dialog]")') });
  await evaluate('[...document.querySelectorAll("[role=dialog] button")].at(-1).focus()'); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
  checks.push({ name: 'share dialog traps keyboard focus', passed: await evaluate('document.activeElement===document.querySelector("[role=dialog] button")') });
  await size(320); await layout('share-320'); await shot('share-320');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }); await wait('!document.querySelector("[role=dialog]")');
  await navigateLoaded('Page.navigate', { url: `${base}/brief/${fixture.shareId}` }); await wait('document.querySelector(".brief-hero")'); await layout('public-brief-320'); await shot('public-brief-320');
  await size(1440); await shot('public-brief-desktop');
  for (const route of ['/brief/missing', '/live/missing', '/missing-page']) { await navigateLoaded('Page.navigate', { url: base + route }); await wait('document.readyState==="complete"'); await layout(route); await shot(route.replaceAll('/', '-') + '-desktop'); }
  // Review a real failed/retry state without requesting inference.
  await navigateLoaded('Page.navigate', { url: base }); await wait('document.querySelector(".hero-actions")'); await click('Start your Quorum'); await wait('document.querySelector(".terminal-panel")');
  const failure = { ...fixture.context, jury: [], failures: [{ persona: 'skeptic', category: 'unavailable', retryable: true, error: 'INTERNAL TEST: provider unavailable; saved work is preserved.' }], scorecard: require('../lib/scorecard.ts').calculateScorecard([], ['skeptic']), confidenceGate: undefined };
  await install(failure); await click('Reviews'); await size(390); await layout('failed-review-390'); await shot('failed-review-390');
  assert.deepEqual(errors, []);
  const report = { checks, layouts, browserExceptions: errors };
  await writeFile('artifacts/ui-audit/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.ok(layouts.every(l => l.overflow <= 1 && l.escaped.length === 0), 'Clipped/overflowing component: inspect report.json');
  assert.ok(checks.every(c => c.passed), 'Component checks: inspect report.json');
} finally {
  await fixture.cleanup();
  await evaluate("localStorage.removeItem('quorum-projects-v2');localStorage.removeItem('quorum-active-v2')").catch(() => {});
  socket.close();
}
