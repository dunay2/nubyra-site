import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {REFERENCE_PROFILES} from '../configurador-3d/fit-lab/reference-profiles.mjs';
const dir=process.env.EVIDENCE_DIR||'artifacts/quality-cut';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],checks=[];
async function review(url,name,isNew){
 const page=await browser.newPage({viewport:{width:1540,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot());
 const ready=()=>page.waitForFunction(()=>{const{state,lastFrame:f}=window.lab.getLabSnapshot();return f&&!f.transition.pending&&!f.transition.error&&f.sleeping&&['bodyHeightCm','bodyChestCm','bodyHipCm','activeConfiguration','garmentLengthCm'].every(k=>state[k]===f.visibleState[k]);},null,{timeout:180000});
 const shot=async label=>{await page.locator('#fit-canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.screenshot({path:dir+'/'+name+'-'+label+'.png'});};
 try{
  let t=performance.now();await page.goto(url);await page.waitForFunction(()=>document.querySelector('#render-status').textContent.includes('Malla humana'),null,{timeout:60000});await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();const initialMs=performance.now()-t;
  await page.locator('#show-dimensions').uncheck();await page.locator('[data-view="front"]').click();
  // Reproduce reported tiny avatar, then choose R08: explicit choice should refit.
  for(let i=0;i<5;i++)await page.locator('[data-camera-action="zoom-out"]').click();
  t=performance.now();await page.locator('[data-reference-profile="R08"]').click();await page.waitForFunction(()=>{const f=window.lab.getLabSnapshot().lastFrame;return f.visibleState.bodyHeightCm===180&&!f.transition.pending;},null,{timeout:60000});const firstFrameMs=performance.now()-t;await ready();const settledMs=performance.now()-t;
  await page.locator('#fit-canvas').hover();await page.keyboard.press('Escape');await page.locator('[data-view="front"]').click();await page.waitForTimeout(350);let s=await snap();
  if(!isNew)await page.locator('[data-camera-action="fit"]').click();
  const scale=await page.evaluate(()=>{const f=window.lab.getLabSnapshot().lastFrame,photo=document.querySelector('#profile-reference-photo');return{comparison:f.comparison,photo:{headPx:Number(photo.dataset.headPx),feetPx:Number(photo.dataset.feetPx)},zoom:f.camera.zoom,profile:photo.dataset.profile};});
  await shot('R08-front');await page.locator('[data-view="back"]').click();await shot('R08-back');await page.locator('[data-view="side"]').click();await shot('R08-side');
  results.push({name,initialMs,firstFrameMs,settledMs,scale,short:s.lastFrame.outfit.fixed.cloth,layer:s.lastFrame.layering,face:s.lastFrame.appearance.face,cacheHit:s.lastFrame.transition.cacheHit,errors});
  if(isNew){
   assert.equal(s.lastFrame.layering.method,'physical-surfaces-depth-test');assert.equal(s.lastFrame.layering.bodyMasked,false);assert.equal(s.lastFrame.outfit.fixed.cloth.waistDriftCm,0);checks.push('Pants render through depth with physical waist support; no silhouette/body mask');
   assert.equal(scale.zoom,1);assert.equal(scale.profile,'R08');assert.ok(Math.abs(scale.photo.feetPx-scale.comparison.floorPx)<.1);assert.ok(Math.abs(scale.photo.headPx-scale.comparison.headPx)<.1);checks.push('R08 photo shares the 180 cm projected height and ground; explicit choice resets tiny framing');
   assert.equal(s.lastFrame.transition.cacheHit,true);checks.push('Exact-profile result is verified and used without changing its pattern');
   const revision=s.lastFrame.workerRevision;await page.locator('[data-camera-action="zoom-in"]').click();await page.waitForTimeout(100);assert.ok((await snap()).lastFrame.camera.zoom>1);assert.equal((await snap()).lastFrame.workerRevision,revision);checks.push('Free camera is retained and does not start physics');
   for(const p of REFERENCE_PROFILES.slice(0,7)){const start=performance.now();await page.locator(`[data-reference-profile="${p.id}"]`).click();await ready();s=await snap();assert.equal(s.lastFrame.visibleState.bodyHeightCm,p.heightCm);assert.equal(s.lastFrame.transition.cacheHit,true);assert.equal(s.lastFrame.outfit.fixed.cloth.waistDriftCm,0);results.push({name:p.id,settledMs:performance.now()-start,cacheHit:true});}
   checks.push('All eight profile exact states settle with both garments and the same fixed waist');
   const before=await snap();await page.locator('[data-reference-profile="R02"]').hover();await page.waitForFunction(()=>document.querySelector('#profile-reference-photo').dataset.profile==='R02');assert.equal((await snap()).lastFrame.workerRevision,before.lastFrame.workerRevision);await page.keyboard.press('Escape');checks.push('Hover image preview never applies body measures or recalculates clothing');
   // A non-catalogue input must not restore a neighbouring profile seed.
   await page.locator('#bodyChestCm-number').fill('91');await page.locator('#bodyChestCm-number').press('Enter');await ready();s=await snap();assert.equal(s.lastFrame.visibleState.bodyChestCm,91);assert.equal(s.lastFrame.transition.cacheHit,false);checks.push('Custom measurement keeps its exact value and live simulation instead of a nearby cached body');
   await page.locator('[data-view="front"]').click();await page.locator('[data-camera-action="fit"]').click();await shot('final-desktop');
   for(const width of [390,320]){await page.setViewportSize({width,height:960});await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/mobile-'+width+'.png',fullPage:true});}
   checks.push('Comparison and free camera fit mobile widths');
   assert.equal(s.lastFrame.transition.unclothedFrames,0);
  }
  assert.deepEqual(errors,[]);
 }catch(e){await shot('failure').catch(()=>{});await writeFile(dir+'/failure-'+name+'.json',JSON.stringify({error:e.message,errors,results,snapshot:await snap().catch(()=>null)},null,2));throw e;}finally{await page.close();}
}
try{
 if(process.env.BASELINE_URL)await review(process.env.BASELINE_URL,'baseline',false);
 await review(process.env.FIT_LAB_URL||'http://127.0.0.1:8190/fit-lab/','updated',true);
 await writeFile(dir+'/review.json',JSON.stringify({checks,results},null,2));console.log(JSON.stringify({passed:checks.length,results}));
}finally{await browser.close();}
