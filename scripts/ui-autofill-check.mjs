// Uses only the isolated QA origin/store. AI transport failures are controlled in this browser,
// while draft edits and deterministic saves exercise the actual application and storage routes.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url); require('./test-register.cjs');
assert.equal(path.resolve(process.env.QUORUM_UI_TEST_DATA_DIR || ''), path.resolve('artifacts/ui-test-data'));
process.env.QUORUM_DATA_DIR = process.env.QUORUM_UI_TEST_DATA_DIR; delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
const { DEMO_SCENARIO, demoCommandForms, demoOffer } = require('../lib/demo-scenario.ts');
const store = require('../lib/context-store.ts');
const base = process.env.CHECK_URL || 'http://localhost:3002'; assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const tabs = await (await fetch((process.env.QUORUM_BROWSER_DEBUG_URL||'http://127.0.0.1:9222')+'/json/list')).json();
const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0; const pending = new Map(), checks = [], layouts = [], errors = [], projects = [];
socket.addEventListener('message', event => { const m=JSON.parse(event.data); if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);} if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text); if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description||'').join(' ')); });
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(new Error('CDP timeout '+method)),15000);pending.set(n,m=>{clearTimeout(timer);m.error?reject(new Error(m.error.message)):resolve(m.result)});socket.send(JSON.stringify({id:n,method,params}));});
const navigateLoaded=async(method,params={})=>{let listener,timer;const loaded=new Promise((resolve,reject)=>{listener=event=>{if(JSON.parse(event.data).method==='Page.loadEventFired')resolve()};socket.addEventListener('message',listener);timer=setTimeout(()=>reject(new Error('Page load timed out')),15000)});try{await Promise.all([send(method,params),loaded])}finally{clearTimeout(timer);socket.removeEventListener('message',listener)}};
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}).catch(error=>{throw new Error(error.message+': '+expression.slice(0,180))});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait = async expression => { const started=Date.now(); while(Date.now()-started<12000) { try { if(await evaluate("Boolean("+expression+")")) return true; } catch(error) { if(!/context|Cannot find/i.test(error.message)) throw error; } await new Promise(resolve=>setTimeout(resolve,70)); } throw new Error('Timed out: '+expression); };
const click=text=>evaluate(`{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Missing '+${JSON.stringify(text)});b.click()}`);
const fill=(selector,value)=>evaluate(`{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});if(e.type==='checkbox'){if(e.checked!==${JSON.stringify(value)})e.click()}else if(e.tagName==='SELECT'){e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))}else{Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))}}`);
const check=(name,passed)=>{checks.push({name,passed});console.error((passed?"PASS ":"FAIL ")+name);assert.ok(passed,name);};
const count=()=>evaluate('(window.__autofillRequests||[]).length');
const state=selector=>evaluate(`Object.fromEntries([...new FormData(document.querySelector(${JSON.stringify(selector)})).entries()])`);
const navigate=async command=>{await click(command);await wait(`document.querySelector('.workspace-nav [aria-current="page"]')?.textContent===${JSON.stringify(command)}`);};
const installTransport=()=>evaluate(`window.__autofillRequests=[];window.__originalAutofillFetch=window.fetch.bind(window);window.fetch=(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);let body={};try{body=JSON.parse(options.body||'{}')}catch{};window.__autofillRequests.push({path:url.pathname,body});if(['/api/generate','/api/discover','/api/jury','/api/marketing','/api/confidence','/api/interview'].includes(url.pathname)||(url.pathname==='/api/knowledge'&&body.operation==='ask'))return Promise.resolve(Response.json({error:'INTERNAL QA: controlled AI transport failure; no inference claimed.'},{status:503}));return window.__originalAutofillFetch(input,options)}`);
const autofill=async name=>{const before=await count();await click('Demo Autofill');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');check(name+' has one autofill control and makes zero API calls',await evaluate('document.querySelectorAll(".demo-autofill-button").length===1')&&await count()===before);};
const snapshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('artifacts/ui-autofill/'+name+'.png',Buffer.from(r.data,'base64'));};
await mkdir('artifacts/ui-autofill',{recursive:true});
try {
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigateLoaded('Page.navigate',{url:base});await wait('document.querySelector(".hero-actions")');
  await evaluate("localStorage.removeItem('quorum-projects-v2');localStorage.removeItem('quorum-active-v2')");
  await click('Start your Quorum');await wait('document.querySelector(".demo-autofill-button:not(:disabled)")');await installTransport();

  await navigate('/discover');await wait('document.querySelector("[name=domain]")');
  check('Discover starts with empty constraints and normal mode defaults',await evaluate('document.querySelector("[name=domain]").value===""&&document.querySelector("[name=customer]").value===""&&document.querySelector("[name=sourceMode]").value==="live"'));
  await autofill('Discover');const discovery=await state('.workspace-form');
  for(const [key,value] of Object.entries(demoCommandForms('discover',{}).discover))if(!['title','url','publishedAt','excerpt'].includes(key))assert.equal(discovery[key],value,key);
  check('Discover control is the first input-form action',await evaluate('document.querySelector(".workspace-form").querySelector("button,input,select,textarea").classList.contains("demo-autofill-button")'));
  await autofill('Identical repeated Discover fill');await click('Undo fill');
  check('An identical repeated fill preserves the original Undo snapshot',await evaluate('document.querySelector("[name=domain]").value===""'));
  await autofill('Discover refill');
  await fill('[name=domain]','INTERNAL QA edited market');await autofill('Repeated Discover fill');await click('Undo fill');
  check('Undo restores an edited user draft',await evaluate('document.querySelector("[name=domain]").value==="INTERNAL QA edited market"'));
  await click('Research opportunities');await wait('document.querySelector(".workspace-error")');
  check('Discover normal primary action makes the request and displays honest error',await evaluate('window.__autofillRequests.some(r=>r.path==="/api/discover"&&r.body.constraints.domain==="INTERNAL QA edited market")&&document.querySelector(".workspace-error").textContent.includes("controlled")'));

  await navigate('/artifact');check('Discover fill does not populate the offer command',await evaluate('document.querySelector(".terminal-input").value===""&&[...document.querySelectorAll(".assumptions-fields input")].every(e=>e.value==="")'));
  await autofill('Offer');check('Offer fills idea plus all four optional assumptions',await evaluate(`document.querySelector('.terminal-input').value===${JSON.stringify(demoOffer().input)}&&[...document.querySelectorAll('.assumptions-fields input')].every(e=>e.value.length>0)`));
  await fill('.terminal-input',demoOffer().input+'\nINTERNAL QA edit');await click('RUN');await wait('document.querySelector(".terminal-log").textContent.includes("controlled")');
  check('Offer primary action is separate and submits edited values',await evaluate('window.__autofillRequests.some(r=>r.path==="/api/generate"&&r.body.idea.includes("INTERNAL QA edit"))'));

  await navigate('/evidence');await wait('document.querySelector("[name=claim]")');
  check('Evidence starts with empty draft inputs',await evaluate('document.querySelector("[name=claim]").value===""&&document.querySelector("[name=summary]").value===""'));
  await autofill('Evidence');
  check('Evidence fills every observation box with explicitly fictional source material',await evaluate('[...document.querySelectorAll("[name=source],[name=excerpt],[name=sampleSize],[name=collectedAt],[name=summary],[name=limitations]")].every(e=>e.value.length>0)&&document.querySelector("[name=direction]").value==="contradicts"&&document.querySelector("[name=demo]").value==="true"'));
  await fill('[name=claim]',DEMO_SCENARIO.assumption+' INTERNAL QA EDIT');await click('Add assumption');await wait('document.querySelector(".hypothesis-line")?.textContent.includes("INTERNAL QA EDIT")');
  const identity=await evaluate("JSON.parse(localStorage.getItem('quorum-projects-v2')).find(p=>p.sessionId===localStorage.getItem('quorum-active-v2'))");projects.push(identity);
  let stored=await store.getContext(identity.sessionId);check('Original evidence primary action saves the edited hypothesis only',stored.hypotheses.length===1&&!(stored.evidence?.length));
  await autofill('Repeated evidence fill');stored=await store.getContext(identity.sessionId);check('Repeated fill creates no persisted duplicates',stored.hypotheses.length===1&&!(stored.evidence?.length));
  check('Saving the filled assumption automatically selects it for the already-filled observation',await evaluate('document.querySelector("[name=hypothesisId]").value.length>0'));
  await click('Save observation');await wait('!!document.querySelector(".demo-record-label")');stored=await store.getContext(identity.sessionId);check('Normal observation action persists its Demo classification',stored.evidence?.length===1&&stored.evidence[0].demo===true);

  // A static, labelled internal offer enables existing-project inputs; it is not an AI response.
  await store.updateContext(identity.sessionId,{idea:demoOffer().input,assumptions:demoOffer().assumptions,artifact:{title:'INTERNAL QA STATIC OFFER : NOT INFERENCE',headline:'Internal input-state verification',html:'<!doctype html><html><body><h1>INTERNAL QA ONLY</h1><p>No actual customer offer or model result.</p></body></html>',keyClaims:['Internal fixture only']}});
  await navigateLoaded('Page.reload');await wait('document.querySelector(".hero-actions")');await click('Start your Quorum');await wait('document.querySelector(".terminal-panel")');await evaluate(`{const select=document.querySelector('.app-nav select');select.value=${JSON.stringify(identity.sessionId)};select.dispatchEvent(new Event('change',{bubbles:true}))}`);await wait('document.querySelector("iframe")');await installTransport();

  await navigate('/perspectives');await autofill('Customer profile');check('Customer profile fills every actual field',await evaluate('document.querySelector("[name=name]").value.includes("ScopeSignal")&&document.querySelector("[name=role]").value==="budget-conscious"&&document.querySelector("[name=profile]").value.includes("12-person")'));
  await click('Save simulated customer profile');await wait('document.querySelector(".research-result h2")?.textContent.includes("One focused")&&document.querySelectorAll(".research-result").length>1');
  await wait('document.querySelector(".workspace-feedback").textContent.includes("Saved")');stored=await store.getContext(identity.sessionId);check('Profile primary action stores the actual editable simulation',stored.customReviewers?.[0].profile===DEMO_SCENARIO.profile);

  await navigate('/interviews');await autofill('Interviews');
  check('Interview autofill supplies every note, date and permission box',await evaluate('[...document.querySelectorAll("[name=participant],[name=transcript],[name=collectedAt]")].every(e=>e.value.length>0)&&document.querySelector("[name=consent]").checked'));
  await click('Save interview source');await wait('!![...document.querySelectorAll("button")].find(b=>b.textContent==="Synthesize notes with AI")');
  stored=await store.getContext(identity.sessionId);check('Normal source action stores the scripted transcript and Demo marker',stored.interviews?.length===1&&stored.interviews[0].demo===true&&stored.interviews[0].transcript===DEMO_SCENARIO.interview&&!stored.interviews[0].findings);

  await navigate('/experiments');await autofill('Experiments including Live draft');
  check('Experiment fill includes the eight-owner/four-example plan and demo publication draft',await evaluate('document.querySelector("[name=minimumSample]").value==="8"&&document.querySelector("[name=target]").value==="4"&&document.querySelector("[name=method]").value.includes("previous 30 days")&&document.querySelector("[name=confirmPublic]").checked&&document.querySelector("[name=disclosure]").value.includes("HACKATHON DEMONSTRATION ONLY")'));
  await click('Save experiment plan');await wait('document.querySelector("[name=successes]")');stored=await store.getContext(identity.sessionId);check('Original experiment action saves locked criteria, never fabricated results',stored.experiments?.length===1&&stored.experiments[0].minimumSample===8&&stored.experiments[0].target===4&&stored.experiments[0].successes===undefined);
  await autofill('Experiment result replay');check('Autofill fills every scripted outcome box',await evaluate('document.querySelector("[name=successes]").value==="3"&&document.querySelector("[name=sampleSize]").value==="8"&&document.querySelector("[name=observedAt]").value.length>0&&document.querySelector("[name=successes]").form.querySelector("[name=limitations]").value.includes("[DEMO]")'));
  await click('Save reported result');await wait('document.querySelector(".workspace-feedback").textContent.includes("Saved")');stored=await store.getContext(identity.sessionId);check('Normal result action saves fictional counts with a Demo marker',stored.experiments[0].status==='recorded'&&stored.experiments[0].successes===3&&stored.experiments[0].demo===true);

  await click('Publish offer experiment');await wait('[...document.querySelectorAll("a")].some(a=>a.getAttribute("href")?.startsWith("/live/"))');
  const publicPath=await evaluate('[...document.querySelectorAll("a")].find(a=>a.getAttribute("href")?.startsWith("/live/")).getAttribute("href")');
  // The existing public endpoint intentionally rejects HeadlessChrome user agents.
  // Match the isolated internal QA setup used by ui-smoke; production guards stay intact.
  await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 QuorumInternalDemoVerification'});
  await navigateLoaded('Page.navigate',{url:base+publicPath});await wait('!!document.querySelector("[name=email]")');await installTransport();
  check('A public demo contact starts empty and requires its own fill action',await evaluate('document.querySelector("[name=email]").value===""&&!document.querySelector("[name=consent]").checked'));
  await autofill('Public demo contact');check('Public demo fills synthetic contact and consent while leaving the bot trap empty',await evaluate('document.querySelector("[name=email]").value==="scopesignal-demo@example.invalid"&&document.querySelector("[name=consent]").checked&&document.querySelector("[name=website]").value===""'));
  await evaluate('new Promise(resolve=>setTimeout(resolve,2100))');await click('Request an interview');await wait('document.body.textContent.includes("Your email was saved")');
  const publicId=publicPath.split('/').at(-1),capture=await store.getLiveDocument(publicId);
  check('Normal public action saves one actual synthetic-address submission',capture.leads.length===1&&capture.leads[0].email==='scopesignal-demo@example.invalid');
  const handoff=await fetch(base+'/api/live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context:{sessionId:identity.sessionId,accessToken:identity.accessToken},operation:'evidence',publicId})});
  check('Public demo ledger handoff keeps the Demo classification',handoff.ok&&(await handoff.json()).context.evidence.some(record=>record.id===publicId&&record.demo===true));
  await navigateLoaded('Page.navigate',{url:base});await wait('!!document.querySelector(".hero-actions")');await click('Start your Quorum');await wait('!!document.querySelector(".terminal-panel")');await evaluate(`{const select=document.querySelector('.app-nav select');select.value=${JSON.stringify(identity.sessionId)};select.dispatchEvent(new Event('change',{bubbles:true}))}`);await wait('!!document.querySelector("iframe")');await installTransport();

  await navigate('/knowledge');await wait('document.querySelector(".knowledge-import-form")');check('Knowledge starts without sample questions or documents',await evaluate('document.querySelector("[name=question]").value===""&&document.querySelector("[name=title]").value===""&&document.querySelector("[name=content]").value===""'));
  await autofill('Knowledge question and source draft');check('Knowledge fills question and every authored demo source field',await evaluate('document.querySelector("[name=question]").value.includes("ScopeSignal")&&document.querySelector("[name=title]").value.includes("ScopeSignal")&&document.querySelector("[name=content]").value.includes("SCRIPTED INTERVIEW")&&document.querySelector("[name=url]").value.includes("example.com")&&document.querySelector("[name=consent]").checked'));
  await fill('.knowledge-import-form [name=consent]',true);await click('Import source');await wait('document.querySelector("[data-knowledge-source]")');
  stored=await store.getContext(identity.sessionId);check('Normal import action stores the authored hypothesis with actual permission',stored.knowledgeDocuments?.length===1&&stored.knowledgeDocuments[0].provenance==='manual_import');

  await navigate('/legal');await wait('document.querySelector("[name=legalProduct]")');const legalBefore=await state('.legal-profile');await autofill('Legal preparation');
  check('Legal fills the concrete fictional India-based product scope',await evaluate('document.querySelector("[name=legalHome]").value==="india"&&document.querySelector("[name=legalLocationDetails]").value.includes("Karnataka")&&document.querySelector("[name=legalMarket][value=india]").checked&&document.querySelectorAll("[name=legalActivity]:checked").length===4'));
  await click('Undo fill');const legalRestored=await state('.legal-profile');check('Undo restores original controlled legal fields and checkbox selections',JSON.stringify(legalBefore)===JSON.stringify(legalRestored));
  await autofill('Legal repeat');await click('Create preparation checklist');await wait('document.querySelector(".legal-overview")');
  stored=await store.getContext(identity.sessionId);check('Legal primary action saves preparation without adviser claims',stored.legalPreparation.profile.home==='india'&&Object.keys(stored.legalPreparation.progress).length===0);
  await autofill('Legal task drafts');check('Existing legal task drafts populate as preparing, never discussed',await evaluate('[...document.querySelectorAll(".legal-progress [name=status]")].every(e=>e.value==="preparing")&&[...document.querySelectorAll(".legal-progress [name=notes]")].every(e=>e.value.includes("No adviser discussion"))'));

  for(const [width,height] of [[1440,1000],[768,1000],[390,844],[320,844]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    for(const command of ['/discover','/evidence','/knowledge','/legal']){
      await navigate(command);await wait('document.querySelector(".demo-autofill-button")');await autofill(command+' '+width);
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const layout=await evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,buttons:document.querySelectorAll(".demo-autofill-button").length})');layouts.push({command,requestedWidth:width,...layout});assert.ok(Math.abs(layout.width-width)<2&&layout.overflow<=1&&layout.buttons===1);check(command+' visible copy and form values have no em dashes',await evaluate('!document.body.innerText.includes(String.fromCharCode(8212))&&![...document.querySelectorAll("input,textarea")].some(e=>e.value.includes(String.fromCharCode(8212)))'));await snapshot(command.slice(1)+'-'+width);
    }
  }
  await navigate('/decision');check('Demo replay illustrates PIVOT while real validation excludes scripted records',await evaluate('document.querySelector(".decision-result h2").textContent==="TEST"&&document.querySelector(".demo-rehearsal h3").textContent==="PIVOT"'));check('Read-only views have no invented autofill control',await evaluate('document.querySelectorAll(".demo-autofill-button").length===0'));
  await click('NEW PROJECT');await wait('document.querySelector(".terminal-input")');check('New projects do not inherit scenario drafts',await evaluate('document.querySelector(".terminal-input").value===""&&[...document.querySelectorAll(".assumptions-fields input")].every(e=>e.value==="")'));
  await autofill('Fresh project offer before switching');
  await fill('.app-nav select',identity.sessionId);await wait('!!document.querySelector("iframe")');
  check('Project switching clears the previous unsent offer draft and Undo',await evaluate('document.querySelector(".terminal-input").value===""&&!document.querySelector(".demo-undo")'));
  await click('NEW PROJECT');await wait('!!document.querySelector(".assumptions-fields")');
  check('A new empty project never restores an earlier autofilled draft',await evaluate('document.querySelector(".terminal-input").value===""&&[...document.querySelectorAll(".assumptions-fields input")].every(e=>e.value==="")'));
  stored=await store.getContext(identity.sessionId);check('New-project action preserves the prior saved project and records',stored.hypotheses.length===1&&stored.experiments.length===1&&stored.interviews.length===1&&stored.knowledgeDocuments.length===1);
  assert.deepEqual(errors,[]);const report={checks,layouts,browserExceptions:errors,externalAI:'Controlled browser transport failures only; actual Claude/Groq probes and API-route contracts are verified separately.'};await writeFile('artifacts/ui-autofill/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {
  for(const project of projects)await store.deleteContext(project.sessionId,project.accessToken);
  await evaluate("if(window.__originalAutofillFetch)window.fetch=window.__originalAutofillFetch;localStorage.removeItem('quorum-projects-v2');localStorage.removeItem('quorum-active-v2')").catch(()=>{});
  socket.close();assert.deepEqual(await readdir('artifacts/ui-test-data'),[]);
}
