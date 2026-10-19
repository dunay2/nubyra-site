/** Exercise the bundled nested Worker, cancellation and exact jersey-only reuse. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('fit-dist'),dir=process.env.EVIDENCE_DIR||'artifacts/performance-browser';await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{let p=path.join(root,new URL(req.url,'http://local').pathname);if(p.endsWith('/'))p+='index.html';if(!p.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.mjs':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary','.json':'application/json'})[path.extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1040}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.physicsFrames=[];const Native=window.Worker;
 window.Worker=class extends Native{
  constructor(...args){super(...args);this.addEventListener('message',({data:m})=>{if(m.type==='frame')window.physicsFrames.push({revision:m.revision,requested:m.state.armLoweringDeg,actual:m.dressing?.armAngle,ready:m.dressing?.ready,setup:Boolean(m.maps),shorts:Boolean(m.shorts),remaining:m.remaining,acceleration:m.acceleration});});}
  // Exercise the parallel path even on a small CI runner; this is not a CPU claim.
  postMessage(m,transfer=[]){super.postMessage(m.type==='init'?{...m,hardwareConcurrency:8}:m,transfer);}
 };
});
const ready=()=>page.waitForFunction(()=>{const{state,lastFrame:f}=window.lab.getLabSnapshot();return f.sleeping&&!f.transition.pending&&!f.transition.error&&f.body.armLoweringDeg===state.armLoweringDeg&&['bodyHeightCm','bodyChestCm','bodyHipCm','activeConfiguration','armLoweringDeg','garmentLengthCm'].every(k=>f.visibleState[k]===state[k]);},null,{timeout:120000});
const input=async(k,v)=>{await page.locator('#'+k+'-number').fill(String(v));await page.locator('#'+k+'-number').press('Enter');};
const snapshot=()=>page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/fit-lab/');
 await page.waitForFunction(()=>document.querySelector('#render-status')?.textContent.includes('Malla humana'),null,{timeout:60000});
 await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();
 await page.locator('[data-reference-profile="R01"]').click();await ready();
 await page.evaluate(()=>{window.performanceSamples=[];window.sampling=true;const tick=()=>{const f=window.lab.getLabSnapshot().lastFrame;window.performanceSamples.push({visible:f.transition.visibleGarments,unclothed:f.transition.unclothedFrames,bodyPose:f.body.armLoweringDeg,garmentPose:f.visibleState.armLoweringDeg,pending:f.transition.pending});if(window.sampling)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 const start=Date.now();await input('armLoweringDeg',25);await ready();const cold=await snapshot(),coldMs=Date.now()-start;
 assert.equal(cold.contact.acceleration.parallelEnabled,true);assert.equal(cold.contact.acceleration.parallelFailure,null);assert.ok(cold.contact.acceleration.shortStepsReused>0);
 const change=Date.now();await input('desiredLengthCm',72);await ready();const reused=await snapshot(),jerseyChangeMs=Date.now()-change;
 assert.equal(reused.contact.acceleration.shortStepsReused,360);assert.equal(reused.contact.acceleration.shortStepsComputed,0);assert.deepEqual(reused.body,cold.body);
 assert.ok(reused.contact.acceleration.trajectoryCache.bytes<=24*1024*1024);assert.ok(reused.contact.acceleration.trajectoryCache.entries<=2);
 // Interrupt an in-flight producer with another pose; the last request must win.
 await input('armLoweringDeg',10);await page.waitForTimeout(180);await input('armLoweringDeg',20);await ready();const interrupted=await snapshot();assert.equal(interrupted.body.armLoweringDeg,20);assert.equal(interrupted.contact.acceleration.parallelFailure,null);
 await input('armLoweringDeg',25);await ready();const warm=await snapshot();assert.equal(warm.transition.cacheHit,true);
 await page.evaluate(()=>window.sampling=false);
 await page.locator('#show-dimensions').uncheck();await page.locator('[data-framing="outfit"]').click();
 for(const view of ['front','side','back']){await page.locator('[data-view="'+view+'"]').click();await page.locator('#fit-canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(300);await page.locator('#fit-canvas').screenshot({path:dir+'/'+view+'.png'});}
 const frames=await page.evaluate(()=>window.physicsFrames),samples=await page.evaluate(()=>window.performanceSamples);
 assert.ok(frames.every(f=>f.ready===true&&f.actual===f.requested&&f.shorts));const revisions=new Set();for(const f of frames){if(!revisions.has(f.revision))assert.equal(f.setup,true);revisions.add(f.revision);}
 assert.ok(samples.some(s=>s.pending));assert.ok(samples.every(s=>s.visible===1&&s.unclothed===0&&s.bodyPose===s.garmentPose));assert.deepEqual(errors,[]);
 await writeFile(dir+'/browser.json',JSON.stringify({passed:true,errors,coldMs,jerseyChangeMs,forcedParallelPath:true,cold,reused,interrupted,warm,frames,samples},null,2));console.log(JSON.stringify({passed:true,coldMs,jerseyChangeMs,reuse:reused.contact.acceleration,errors}));
}catch(error){await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,errors,last:await snapshot().catch(()=>null)},null,2));throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
