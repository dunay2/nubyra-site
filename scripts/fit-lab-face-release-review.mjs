import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('fit-dist'),baseline=process.env.BASELINE_DIST?path.resolve(process.env.BASELINE_DIST):null;
const dir=process.env.EVIDENCE_DIR||'artifacts/face-release/browser';await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local'),isBase=u.pathname.startsWith('/baseline/'),r=isBase?baseline:root;if(!r)throw Error('No baseline');
 let file=path.resolve(r,'.'+(isBase?u.pathname.slice('/baseline'.length):u.pathname));if(file===r||u.pathname.endsWith('/'))file=path.join(file,'index.html');
 if(!file.startsWith(r+path.sep))throw Error('Path');
 const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.glb':'model/gltf-binary'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const launchPage=()=>browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[],performanceCases=[];
let page;
const ready=async p=>p.waitForFunction(()=>{const s=window.lab?.getLabSnapshot(),f=s?.lastFrame;return f&&!f.transition.pending&&!f.transition.error&&f.transition.visibleGarments===1&&['bodyHeightCm','bodyChestCm','bodyHipCm','activeConfiguration','garmentLengthCm'].every(k=>s.state[k]===f.visibleState[k]);},null,{timeout:120000});
const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot());
const settled=()=>page.waitForFunction(()=>{const f=window.lab.getLabSnapshot().lastFrame;return f.sleeping&&!f.transition.pending&&!f.transition.error;},null,{timeout:180000});
async function load(p,url){const started=performance.now();await p.goto(url,{waitUntil:'domcontentloaded'});await p.evaluate(async()=>window.lab=await import('./app.mjs'));await ready(p);return {ms:performance.now()-started,snapshot:await p.evaluate(()=>window.lab.getLabSnapshot()),resources:await p.evaluate(()=>performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,start:r.startTime,end:r.responseEnd,bytes:r.transferSize}))) };}
try{
 for(let i=0;i<3;i++)for(const kind of(baseline?['baseline','updated']:['updated'])){
  const p=await launchPage();p.on('pageerror',e=>errors.push(kind+': '+e.message));const result=await load(p,origin+(kind==='baseline'?'/baseline':'')+'/fit-lab/');
  performanceCases.push({kind,run:i,...result,snapshot:undefined,face:result.snapshot.lastFrame.appearance.face.version,assets:result.snapshot.lastFrame.performance.assetLoadMs,shortTemplates:result.snapshot.lastFrame.performance.shortTemplates});await p.close();
 }
 page=await launchPage();page.on('pageerror',e=>errors.push(e.message));await load(page,origin+'/fit-lab/');await settled();
 let s=await snap();assert.equal(s.lastFrame.appearance.face.rimFitted,true);assert.ok(s.lastFrame.appearance.face.maxEyeLiftMm<=1);assert.equal(s.lastFrame.performance.shortTemplates.lazy,true);assert.ok(s.lastFrame.performance.shortTemplates.allocatedTemplates<10);assert.equal(s.lastFrame.layering.method,'physical-depth-test');
 assert.equal(await page.locator('#lab-release').count(),1);checks.push('Actual Lab loads the versioned rim-fitted face, lazy templates and depth-tested garments');
 const records=[];await page.evaluate(()=>{window.guardFrames=[];window.guardActive=true;const f=()=>{const t=window.lab.getLabSnapshot().lastFrame.transition;window.guardFrames.push({visible:t.visibleGarments,unclothed:t.unclothedFrames});if(window.guardActive)requestAnimationFrame(f);};requestAnimationFrame(f);});
 for(const id of['R01','R04','R08','R05']){const start=performance.now();await page.locator(`[data-reference-profile="${id}"]`).click();await ready(page);await settled();s=await snap();assert.equal(s.lastFrame.kitProposal.shorts.renderable,true);assert.equal(s.lastFrame.outfit.fixed.cloth.waistDriftCm,0);records.push({id,ms:performance.now()-start,body:s.lastFrame.body,shorts:s.lastFrame.outfit.fixed.cloth});}
 checks.push('Four distributed profiles preserve exact body inputs and supported physical shorts');
 const before=await snap();await page.locator('[data-reference-profile="R03"]').hover();await page.waitForFunction(()=>document.querySelector('#profile-reference-photo').dataset.profile==='R03');assert.deepEqual((await snap()).state,before.state);assert.equal((await snap()).lastFrame.workerRevision,before.lastFrame.workerRevision);await page.locator('h1').hover();checks.push('Hover changes only the illustration, with no body/cloth update');
 await page.locator('[data-view="front"]').click();await page.waitForTimeout(200);
 await page.screenshot({path:dir+'/lab-outfit-front.png',fullPage:true});
 const viewBefore=await snap();for(const name of['side','back','quarter','front']){await page.locator(`[data-view="${name}"]`).click();await page.waitForTimeout(200);assert.equal((await snap()).lastFrame.workerRevision,viewBefore.lastFrame.workerRevision);}
 checks.push('Camera views do not start a new physics revision');
 // Focus the actual head with the public camera controls, not an alternative renderer.
 let f=(await snap()).lastFrame,b=await page.locator('#fit-canvas').boundingBox();const headY=f.comparison.floorPx-(f.body.heightCm-10)*f.comparison.pxPerCm;
 await page.mouse.dblclick(b.x+b.width/2,b.y+Math.max(10,Math.min(b.height-10,headY)));for(let i=0;i<5;i++)await page.locator('[data-camera-action="zoom-in"]').click();
 for(const name of['front','quarter','side']){await page.locator(`[data-view="${name}"]`).click();await page.waitForTimeout(300);await page.screenshot({path:dir+'/lab-face-'+name+'.png'});}
 await page.locator('[data-camera-action="fit"]').click();await page.locator('[data-view="front"]').click();
 for(const width of[390,320]){await page.setViewportSize({width,height:960});await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/mobile-'+width+'.png',fullPage:true});}
 checks.push('Face captured in three actual Lab views; 390/320px layouts have no horizontal overflow');
 await page.evaluate(()=>window.guardActive=false);const frames=await page.evaluate(()=>window.guardFrames);assert.ok(frames.length>20&&frames.every(x=>x.visible===1&&x.unclothed===0));assert.deepEqual(errors,[]);checks.push('No observed unclothed frames and no JavaScript errors');
 await writeFile(dir+'/review.json',JSON.stringify({checks,errors,performanceCases,profiles:records,sampledFrames:frames.length,final:await snap(),environment:'GitHub Actions Chromium SwiftShader, local HTTP, uncached contexts; not end-user network timing'},null,2));console.log(JSON.stringify({passed:checks.length,errors,sampledFrames:frames.length,timings:performanceCases.map(({kind,run,ms})=>({kind,run,ms}))}));
}catch(error){if(page){await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,errors,checks,snapshot:await snap().catch(()=>null)},null,2));}throw error;}
finally{await page?.close();await browser.close();await new Promise(r=>server.close(r));}
