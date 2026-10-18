import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'artifacts/coverage-scale';await mkdir(dir,{recursive:true});
const assets=JSON.parse(await readFile('configurador-3d/fit-lab/assets/reference-profiles.json','utf8')).assets;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[],checks=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot());
const ready=()=>page.waitForFunction(()=>{const {state,lastFrame:f}=window.lab.getLabSnapshot();return f.sleeping&&!f.transition.pending&&!f.transition.error&&['bodyHeightCm','bodyChestCm','bodyHipCm','activeConfiguration'].every(k=>f.visibleState[k]===state[k]);},null,{timeout:180000});
const shot=async(name)=>{await page.waitForTimeout(200);await page.screenshot({path:dir+'/'+name+'.png',fullPage:false});};
try{
 const t=performance.now();await page.goto(process.env.FIT_LAB_URL||'http://127.0.0.1:8230/fit-lab/');await page.waitForFunction(()=>document.querySelector('#render-status')?.textContent.includes('Malla humana'),null,{timeout:45000});await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();samples.push({case:'initial',readyMs:performance.now()-t});
 await page.locator('#show-dimensions').uncheck();
 for(const id of ['R03','R08']){
  const t=performance.now();await page.locator(`[data-reference-profile="${id}"]`).click();await page.waitForFunction(()=>!window.lab.getLabSnapshot().lastFrame.transition.pending,null,{timeout:60000});const firstMs=performance.now()-t;await ready();
  const s=await snap();assert.equal(s.lastFrame.layering.method,'depth-tested-physical-layers');assert.equal(s.lastFrame.layering.enabled,false);assert.equal(s.lastFrame.outfit.fixed.cloth.waistDriftCm,0);assert.ok(s.lastFrame.outfit.fixed.cloth.hemDifferenceCm<.5,'Unequal hem levels');assert.ok(s.lastFrame.outfit.fixed.cloth.maxPenetrationUnits*s.lastFrame.cmPerUnit<.15);
  samples.push({case:id,firstMs,totalMs:performance.now()-t,short:s.lastFrame.outfit.fixed.cloth,performance:s.lastFrame.performance});
  await page.locator('[data-camera-action="fit"]').click();
  for(const view of ['front','back','side','quarter']){await page.locator(`[data-view="${view}"]`).click();await shot(id+'-'+view);}
  await page.locator('[data-view="front"]').click();await page.waitForTimeout(300);
  // Actual image head/feet markers must coincide with the central projected metric frame.
  const measure=()=>page.evaluate(a=>{const f=window.lab.getLabSnapshot().lastFrame,photo=document.querySelector('#profile-reference-photo').getBoundingClientRect(),canvas=document.querySelector('#scene-wrapper canvas').getBoundingClientRect();return {feet:photo.y+photo.height*a.feet,head:photo.y+photo.height*a.head,floor:canvas.y+f.comparison.floorPx,targetHead:canvas.y+f.comparison.floorPx-f.visibleState.bodyHeightCm*f.comparison.pxPerCm,scale:f.comparison.pxPerCm};},assets[id]);
  let m=await measure();assert.ok(Math.abs(m.feet-m.floor)<1.5);assert.ok(Math.abs(m.head-m.targetHead)<1.5);samples.push({case:id+'-comparison',...m});
  const revision=(await snap()).lastFrame.workerRevision;for(let i=0;i<3;i++)await page.locator('[data-camera-action="zoom-out"]').click();await page.waitForTimeout(200);m=await measure();assert.ok(Math.abs(m.feet-m.floor)<1.5);assert.ok(Math.abs(m.head-m.targetHead)<1.5);assert.equal((await snap()).lastFrame.workerRevision,revision);await shot(id+'-linked-zoom');await page.locator('[data-camera-action="fit"]').click();
 }
 checks.push('No silhouette clipping; waist support and level hems on R03/R08; projected photo head/feet and zoom stay linked');
 const before=await snap();await page.locator('[data-reference-profile="R04"]').hover();await page.waitForFunction(()=>document.querySelector('#profile-reference-photo').dataset.profile==='R04');assert.equal((await snap()).lastFrame.workerRevision,before.lastFrame.workerRevision);await page.mouse.move(5,5);await page.waitForTimeout(250);checks.push('Hover is visual only; no body/cloth recalculation');
 await page.locator('#show-dimensions').check();
 for(const width of [390,320]){await page.setViewportSize({width,height:930});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/mobile-'+width+'.png',fullPage:true});}checks.push('Mobile has no horizontal overflow');
 const final=await snap();assert.equal(final.lastFrame.appearance.face.centredIrises,true);assert.equal(final.lastFrame.transition.unclothedFrames,0);assert.deepEqual(errors,[]);
 await writeFile(dir+'/review.json',JSON.stringify({checks,errors,samples,final},null,2));console.log(JSON.stringify({passed:checks.length,errors,samples:samples.map(s=>({case:s.case,firstMs:s.firstMs,totalMs:s.totalMs}))}));
}catch(e){await page.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(dir+'/failure.json',JSON.stringify({error:e.message,checks,errors,samples,last:await snap().catch(()=>null)},null,2));throw e;}finally{await browser.close();}
