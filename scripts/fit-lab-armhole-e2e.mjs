/** Full browser/Worker regression for the reported small-profile armhole defect. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('fit-dist'),dir=process.env.EVIDENCE_DIR||'artifacts/armhole/lab';await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{let p=path.join(root,new URL(req.url,'http://local').pathname);if(p.endsWith('/'))p+='index.html';if(!p.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.mjs':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary','.json':'application/json'})[path.extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1040}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.armholeFrames=[];const Native=window.Worker;window.Worker=class extends Native{constructor(...args){super(...args);this.addEventListener('message',({data:m})=>{if(m.type==='frame')window.armholeFrames.push({revision:m.revision,requested:m.state.armLoweringDeg,actual:m.dressing?.armAngle,ready:m.dressing?.ready,setup:Boolean(m.maps),shorts:Boolean(m.shorts),remaining:m.remaining});});}};});
const ready=()=>page.waitForFunction(()=>{const{state,lastFrame:f}=window.lab.getLabSnapshot();return f.sleeping&&!f.transition.pending&&!f.transition.error&&f.body.armLoweringDeg===state.armLoweringDeg&&['bodyHeightCm','bodyChestCm','bodyHipCm','activeConfiguration','armLoweringDeg'].every(k=>f.visibleState[k]===state[k]);},null,{timeout:120000});
const input=async(k,v)=>{await page.locator('#'+k+'-number').fill(String(v));await page.locator('#'+k+'-number').press('Enter');};
const snapshot=()=>page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);
try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/fit-lab/');
 await page.waitForFunction(()=>document.querySelector('#render-status')?.textContent.includes('Malla humana'),null,{timeout:60000});
 await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();
 await page.locator('[data-reference-profile="R01"]').click();await ready();
 assert.ok(Math.abs((await snapshot()).body.heightCm-145)<.02);
 await page.locator('#show-dimensions').uncheck();
 await page.locator('[data-framing="outfit"]').click();
 await page.evaluate(()=>{window.armholeSamples=[];window.sampleArmhole=true;const tick=()=>{const f=window.lab.getLabSnapshot().lastFrame;window.armholeSamples.push({visible:f.transition.visibleGarments,unclothed:f.transition.unclothedFrames,bodyPose:f.body.armLoweringDeg,garmentPose:f.visibleState.armLoweringDeg,pending:f.transition.pending});if(window.sampleArmhole)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await input('armLoweringDeg',25);await ready();
 await page.evaluate(()=>window.sampleArmhole=false);
 const after=await snapshot();assert.equal(after.body.armLoweringDeg,25);assert.equal(after.transition.unclothedFrames,0);assert.equal(after.transition.visibleGarments,1);assert.equal(after.cloth.pins,0);
 const canvas=page.locator('#fit-canvas');
 for(const view of ['front','side','quarter','back']){await page.locator('[data-view="'+view+'"]').click();await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(300);await canvas.screenshot({path:dir+'/'+view+'.png'});}
 // A warm cache must restore the posed collider, not the initial dressing pose.
 await input('armLoweringDeg',0);await ready();await input('armLoweringDeg',25);await ready();const warm=await snapshot();assert.equal(warm.body.armLoweringDeg,25);assert.equal(warm.transition.cacheHit,true);
 const messages=await page.evaluate(()=>window.armholeFrames),samples=await page.evaluate(()=>window.armholeSamples);
 assert.ok(messages.some(m=>m.requested===25));assert.ok(messages.every(m=>m.ready===true&&m.requested===m.actual&&m.shorts));
 const seen=new Set();for(const m of messages){if(!seen.has(m.revision))assert.equal(m.setup,true,'first visible frame must contain the maps');seen.add(m.revision);}
 assert.ok(samples.some(s=>s.pending));assert.ok(samples.every(s=>s.visible===1&&s.unclothed===0&&s.bodyPose===s.garmentPose));assert.deepEqual(errors,[]);
 await writeFile(dir+'/browser.json',JSON.stringify({passed:true,errors,messages,samples,after,warm},null,2));console.log(JSON.stringify({passed:true,errors,workerFrames:messages.length,animationFrames:samples.length}));
}catch(error){await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,errors,last:await snapshot().catch(()=>null)},null,2));throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
