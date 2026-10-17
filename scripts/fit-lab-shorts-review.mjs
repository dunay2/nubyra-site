import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.env.REVIEW_ROOT||path.resolve('fit-dist'),dir=process.env.EVIDENCE_DIR||'artifacts/relaxed-shorts',legacy=process.env.BASELINE==='1';await mkdir(dir,{recursive:true});let server,url=process.env.FIT_LAB_URL;
if(!url){server=createServer(async(req,res)=>{try{let file=path.join(root,new URL(req.url,'http://local').pathname);if(file.endsWith('/'))file+='index.html';if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.mjs':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port+'/fit-lab/';}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot());
try{
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('#render-status').textContent.includes('Malla humana'),null,{timeout:60000});await page.evaluate(async()=>window.lab=await import('./app.mjs'));
 for(const [key,val]of [['bodyChestCm',84],['bodyHipCm',94],['bodyHeightCm',170]]){await page.locator('#'+key+'-number').fill(String(val));await page.locator('#'+key+'-number').press('Enter');await page.waitForFunction(({key,val})=>window.lab.getLabSnapshot().lastFrame.state[key]===val,{key,val});}
 await page.waitForFunction(()=>window.lab.getLabSnapshot().lastFrame.sleeping,null,{timeout:100000});await page.locator('#show-dimensions').uncheck();await page.locator('#kit-panel').evaluate(e=>e.open=true);
 const before=await snap();const metrics=[];const fixed=await page.locator('#shorts-length').evaluate(e=>e.tagName==='SELECT');
 for(const length of (fixed?[34,42,50]:[40,45])){
  if(fixed)await page.locator('#shorts-length').selectOption(String(length));else{await page.locator('#shorts-length').fill(String(length));await page.locator('#shorts-length').press('Enter');}await page.waitForTimeout(120);const current=await snap();metrics.push({length,outfit:current.lastFrame.outfit,performance:current.lastFrame.performance});
  assert.equal(current.lastFrame.cloth.steps,before.lastFrame.cloth.steps);assert.equal(current.lastFrame.performance.counts.bodyBuilds,before.lastFrame.performance.counts.bodyBuilds);assert.equal(current.lastFrame.performance.counts.garmentBuilds,before.lastFrame.performance.counts.garmentBuilds);assert.equal(current.lastFrame.workerRevision,before.lastFrame.workerRevision);
  if(fixed){assert.equal(current.lastFrame.outfit.shortsLengthCm,length);assert.equal(current.lastFrame.outfit.fixed.restGeometryIndependent,true);}else if(!legacy){assert.equal(current.lastFrame.outfit.shortsFit,'relaxed');assert.ok(current.lastFrame.outfit.shortsAboveKneeCm>=3);assert.equal(current.lastFrame.outfit.shortsLengthCm,length);}
  for(const view of ['front','side','quarter']){await page.locator('[data-view="'+view+'"]').click();await page.waitForTimeout(180);await page.locator('.view-panel').screenshot({path:dir+'/'+length+'-'+view+'-combined.png'});await page.locator('#show-garment').uncheck();await page.waitForTimeout(80);await page.locator('.view-panel').screenshot({path:dir+'/'+length+'-'+view+'-shorts.png'});await page.locator('#show-garment').check();}
 }
 checks.push(fixed?'34/42/50 cm fixed patterns: three actual WebGL views, with and without jersey':'40/45 cm legacy reference: three actual WebGL views, with and without jersey');checks.push('Changing only shorts leaves body, jersey and worker revision unchanged');
 if(fixed){
  const prior=await snap();await page.locator('[data-garment="'+prior.state.activeConfiguration+'"]').click();await page.locator('#bodyHeightCm-number').fill('145');await page.locator('#bodyHeightCm-number').press('Enter');
  await page.waitForFunction(()=>{const f=window.lab.getLabSnapshot().lastFrame;return Math.abs(f.body.heightCm-145)<.01&&f.sleeping&&!f.transition.pending;},null,{timeout:120000});
  const after=await snap();assert.equal(after.lastFrame.outfit.shortsLengthCm,50);assert.deepEqual(after.lastFrame.outfit.fixed.nominal,prior.lastFrame.outfit.fixed.nominal);
  assert.deepEqual(await page.locator('#shorts-length option').evaluateAll(es=>es.map(e=>e.value)),['34','42','50']);checks.push('Fixed lengths are never clamped to knee height; catalog rejects unlisted lengths');
 }else if(!legacy){
  // Body height controls the permitted hem. The renderer and the panel must agree.
  await page.locator('#bodyHeightCm-number').fill('125');await page.locator('#bodyHeightCm-number').press('Enter');await page.waitForFunction(()=>window.lab.getLabSnapshot().lastFrame.state.bodyHeightCm===125);await page.waitForTimeout(120);let small=await snap();assert.ok(small.lastFrame.outfit.shortsAboveKneeCm>=3*125/170);assert.equal(await page.locator('#shorts-length').getAttribute('max'),String(small.lastFrame.outfit.shortsMaxLengthCm));assert.equal(Number(await page.locator('#shorts-length').inputValue()),small.lastFrame.outfit.shortsLengthCm);
  await page.locator('#shorts-length').fill('60');await page.locator('#shorts-length').press('Enter');assert.equal((await snap()).lastFrame.outfit.shortsLengthCm,small.lastFrame.outfit.shortsLengthCm);assert.equal(await page.locator('#shorts-length').getAttribute('aria-invalid'),'true');checks.push('Short body limits maximum length above knee and rejects an invalid 60 cm input');
 }
 for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:960});await page.waitForTimeout(120);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('.editor').evaluate(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)),false);}
 checks.push('No new horizontal or nested scroll at four widths');assert.deepEqual(errors,[]);await writeFile(dir+'/shorts-browser.json',JSON.stringify({passed:checks.length,checks,metrics,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors}));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
