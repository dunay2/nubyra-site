import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'artifacts/reference-gallery';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1120}}),errors=[],checks=[],timings=[];
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);
const ready=()=>page.waitForFunction(()=>{const s=window.lab.getLabSnapshot();return s.lastFrame?.sleeping&&!s.lastFrame.sizeRejection&&!s.lastFrame.transition.pending&&Math.abs(s.lastFrame.body.heightCm-s.state.bodyHeightCm)<.01;},null,{timeout:120000});
const shot=name=>page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
try{
 const t=performance.now();await page.goto(process.env.FIT_LAB_URL||'http://127.0.0.1:8108/fit-lab/');
 await page.evaluate(async()=>window.lab=await import(new URL('./app.mjs',location.href)));await ready();
 await page.waitForFunction(()=>document.getElementById('reference-gallery').dataset.loaded==='true');
 timings.push({case:'first-outfit-and-gallery',ms:performance.now()-t});
 assert.equal(await page.locator('[data-reference-profile]').count(),8);
 assert.equal((await snap()).referenceSource.mode,'original');assert.ok(await page.locator('#full-reference-photo').isVisible());
 const positions=await page.evaluate(()=>Object.fromEntries(['measurements','fit-canvas','reference-photo-stage'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,w:r.width}];})));
 assert.ok(positions['fit-canvas'].x>positions.measurements.x);assert.ok(positions['reference-photo-stage'].x>=positions['fit-canvas'].x+positions['fit-canvas'].w-1);
 assert.ok(await page.evaluate(()=>{const right=document.querySelector('.editor').getBoundingClientRect().right;return [...document.querySelectorAll('#zone-assessment dd')].every(e=>e.getBoundingClientRect().right<=right+1);}),'zone report escapes the editor');await shot('original-photo-right-real-model-centre');checks.push('Original photo visible on right; existing WebGL model centred, controls left');
 const before=await snap();
 for(const id of['R01','R02','R03','R04','R05','R06','R07','R08']){
  const start=performance.now();await page.locator(`[data-reference-profile="${id}"]`).click();
  await page.waitForFunction(id=>document.getElementById('profile-reference-photo').dataset.profile===id,id);
  const s=await snap();assert.equal(s.referenceSource.profiles.selectedId,id);assert.equal(s.referenceSource.profiles.mode,'manual');
  assert.deepEqual(s.body,before.body);assert.deepEqual(s.patternSpecifications,before.patternSpecifications);assert.equal(s.workerRevision,before.workerRevision);
  assert.equal(s.transition.visibleGarments,1);assert.equal(s.transition.unclothedFrames,0);
  assert.ok(await page.locator('#profile-reference-photo').isVisible());assert.equal(await page.locator('#full-reference-photo').isVisible(),false);
  timings.push({case:id,ms:performance.now()-start});
 }
 await shot('eight-reference-types');checks.push('All 8 images switch without changing body, patterns, worker revision or garment visibility');
 // Last click wins; asynchronous decode cannot restore an older profile.
 await page.evaluate(()=>['R03','R08','R01'].forEach(id=>document.querySelector(`[data-reference-profile="${id}"]`).click()));
 await page.waitForFunction(()=>document.getElementById('profile-reference-photo').dataset.profile==='R01');
 assert.equal((await snap()).referenceSource.profiles.selectedId,'R01');checks.push('Rapid reference changes keep the last choice');
 await page.locator('#reference-profile-auto').check();
 await page.locator('#bodyHeightCm-number').fill('125');await page.locator('#bodyHeightCm-number').press('Enter');await ready();
 let s=await snap();assert.equal(s.referenceSource.profiles.mode,'auto');assert.equal(s.referenceSource.profiles.withinCoverage,false);
 assert.match(await page.locator('#reference-match-status').innerText(),/Fuera de cobertura/);
 assert.equal(s.transition.unclothedFrames,0);assert.equal(s.garment.restLengthCm,before.garment.restLengthCm);
 await shot('auto-reference-outside-coverage');checks.push('Auto follows visible measurements; out-of-range case disclosed; fixed shirt retained');
 const alignment=await page.evaluate(()=>{const a=document.getElementById('profile-reference-photo').getBoundingClientRect(),b=document.getElementById('profile-height-gauge').getBoundingClientRect();return {image:a.toJSON(),gauge:b.toJSON()};});
 assert.ok(alignment.image.height>100);assert.ok(alignment.gauge.height>100);
 await page.locator('[data-reference-mode="original"]').click();assert.equal((await snap()).referenceSource.mode,'original');assert.ok(await page.locator('#full-reference-photo').isVisible());
 await page.locator('[data-reference-mode="synthetic"]').click();assert.equal((await snap()).referenceSource.heightCm,170);assert.ok(await page.locator('#full-reference-canvas').isVisible());
 await page.locator('[data-reference-mode="original"]').click();checks.push('Original photo and metric 170cm comparator remain independently selectable');
 for(const width of[850,390,320]){
  await page.setViewportSize({width,height:1040});await page.waitForTimeout(180);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await page.locator('#fit-canvas').isVisible());assert.ok(await page.locator('#full-reference-photo').isVisible());
  await page.locator('[data-reference-profile="R04"]').click();await page.waitForFunction(()=>document.getElementById('profile-reference-photo').dataset.profile==='R04');
  await shot('mobile-'+width);await page.locator('[data-reference-mode="original"]').click();
 }
 checks.push('Original, selectors and central model work at 850/390/320px without horizontal overflow');
 assert.deepEqual(errors,[]);const result={checks,errors,timings,positions,alignment,final:await snap(),browser:await browser.version()};
 await writeFile(dir+'/review.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,errors,timings}));
}catch(error){await shot('failure').catch(()=>{});await writeFile(dir+'/failure.json',JSON.stringify({message:error.message,checks,errors,final:await snap().catch(()=>null)},null,2));throw error;}finally{await browser.close();}
