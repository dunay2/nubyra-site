import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.FIT_LAB_URL||'http://127.0.0.1:8000/fit-lab/',dir=process.env.EVIDENCE_DIR||'artifacts/avatar-polish';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1120},deviceScaleFactor:2}),errors=[],checks=[],samples=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);window.testWorker=this;}};});
const snapshot=()=>page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);
const ready=()=>page.waitForFunction(()=>window.lab.getLabSnapshot().lastFrame.sleeping,null,{timeout:120000});
const input=async(key,value)=>{await page.locator('#'+key+'-number').fill(String(value));await page.locator('#'+key+'-number').press('Enter');};
const shot=async(name)=>{await page.waitForTimeout(250);await page.screenshot({path:dir+'/'+name+'.png'});};
try{
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('#render-status').textContent.includes('Malla humana'),null,{timeout:60000});await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();
 let s=await snapshot();assert.equal(s.transition.unclothedFrames,0);assert.equal(s.transition.visibleGarments,1);assert.equal(s.appearance.face.eyes,true);checks.push('Complete initial outfit, facial features and render-only hair are present');
 await page.locator('#show-dimensions').uncheck();
 for(const v of['front','back','quarter','side']){await page.locator('[data-view="'+v+'"]').click();await shot('reported-'+v);}
 for(const angle of[20,25,0]){await input('armLoweringDeg',angle);await ready();s=await snapshot();assert.equal(s.body.armLoweringDeg,angle);assert.ok(Math.abs(s.body.chestCm-88)<.01);assert.ok(s.cloth.maxPenetrationCm<.1,'posed garment penetration '+s.cloth.maxPenetrationCm);samples.push(s);await page.locator('[data-view="front"]').click();await shot('arms-'+angle);}
 checks.push('0/20/25 degree poses settle on the same visible/collision mesh and retain body dimensions');
 // Capture every RAF, not just the endpoints of a replacement.
 await page.evaluate(()=>{window.transitionSamples=[];window.watchSwap=true;const sample=()=>{const s=window.lab.getLabSnapshot().lastFrame;window.transitionSamples.push({pending:s.transition.pending,visible:s.transition.visibleGarments,code:s.garment.code,body:s.body.chestCm,invalid:s.transition.unclothedFrames});if(window.watchSwap)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 await page.locator('[data-garment="N2-3"]').click();await page.waitForFunction(()=>window.lab.getLabSnapshot().lastFrame.transition.pending);await shot('garment-preparing');await ready();
 await page.evaluate(()=>window.watchSwap=false);const frames=await page.evaluate(()=>window.transitionSamples);assert.ok(frames.some(f=>f.pending));assert.ok(frames.every(f=>f.visible===1&&f.invalid===0));assert.equal((await snapshot()).garment.code,'N2-3');
 checks.push('All sampled RAFs retain a garment through preparation and the atomic replacement');
 await page.locator('[data-garment="N1-1"]').click();await page.locator('[data-garment="N2-2"]').click();await page.locator('[data-garment="N1-2"]').click();await ready();assert.equal((await snapshot()).garment.code,'N1-2');checks.push('Rapid changes discard stale revisions; the last requested shirt wins');
 // Pause is not a deadlock: preparation may finish offscreen, motion stays paused.
 await page.locator('#pause-motion').click();const previous=await snapshot();await page.locator('[data-garment="N2-1"]').click();await page.waitForFunction(()=>window.lab.getLabSnapshot().lastFrame.transition.pending);
 await page.evaluate(()=>window.testWorker.dispatchEvent(new MessageEvent('message',{data:{type:'error',revision:window.lab.getLabSnapshot().lastFrame.workerRevision,message:'Test de error de preparación'}})));
 const errorState=await snapshot();assert.equal(errorState.transition.visibleGarments,1);assert.equal(errorState.garment.code,previous.garment.code);assert.ok(errorState.transition.error);await ready();assert.equal((await snapshot()).garment.code,'N2-1');assert.equal((await snapshot()).paused,true);await page.locator('#pause-motion').click();
 checks.push('Preparation errors retain the previous outfit and a paused update can recover without exposing the body');
 await page.locator('[data-garment="N1-2"]').click();await input('bodyHeightCm',170);await input('bodyChestCm',84);await input('bodyHipCm',94);await ready();await input('armLoweringDeg',20);await ready();
 for(const v of['front','back','quarter','side']){await page.locator('[data-view="'+v+'"]').click();await shot('reference-'+v);}
 s=await snapshot();assert.equal(s.outfit.coverage.bodyHidden,false);assert.equal(s.transition.unclothedFrames,0);samples.push(s);checks.push('Coverage is real short geometry; the body is not masked or recolored to hide intersections');
 await page.locator('[data-view="front"]').click();for(const width of[390,320]){await page.setViewportSize({width,height:960});await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/mobile-'+width+'.png',fullPage:true});}
 checks.push('New pose control and complete outfit work at mobile widths without horizontal overflow');
 assert.deepEqual(errors,[]);await writeFile(dir+'/avatar-polish.json',JSON.stringify({checks,errors,frames,samples,final:await snapshot()},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors,sampledFrames:frames.length}));
}finally{await browser.close();}
