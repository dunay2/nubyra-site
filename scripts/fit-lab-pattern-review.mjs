import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.EVIDENCE_DIR||'artifacts/pattern-review';await mkdir(dir,{recursive:true});
const url=process.env.FIT_LAB_URL||'http://127.0.0.1:8098/fit-lab/';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1500,height:1080}}),errors=[],checks=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);
const ready=()=>page.waitForFunction(()=>{const {state,lastFrame:f}=window.lab.getLabSnapshot();return f?.sleeping&&!f.sizeRejection&&!f.transition.pending&&['bodyChestCm','bodyHipCm','bodyHeightCm','armLoweringDeg','activeConfiguration'].every(k=>f.visibleState[k]===state[k]);},null,{timeout:120000});
const shot=async(name)=>{await page.waitForTimeout(100);await page.locator('.view-panel').screenshot({path:`${dir}/${name}.png`});};
try{
 const started=performance.now();await page.goto(url);await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();const initialMs=performance.now()-started;
 assert.equal((await snapshot()).referenceSource.mode,'original');assert.ok(await page.locator('#full-reference-photo').isVisible());await shot('original-photo-retained');checks.push('Original supplied girl is visible by default; not replaced by another image or by the synthetic comparator');
 await page.locator('[data-reference-mode="synthetic"]').click();assert.equal((await snapshot()).referenceSource.heightCm,170);
 await page.locator('[data-garment="N1-2"]').click();await ready();
 await page.locator('#kit-panel').evaluate(e=>e.open=true);await page.locator('#shorts-size').selectOption('N1-2');await page.locator('#shorts-length').selectOption('42');await page.locator('#kit-panel').evaluate(e=>e.open=false);
 const spec=(await snapshot()).patternSpecifications;await page.locator('#show-dimensions').uncheck();
 for(const height of[145,170,200]){
  await page.evaluate(()=>{window.rafEvidence=[];window.trackFrames=true;const sample=()=>{const s=window.lab.getLabSnapshot().lastFrame;window.rafEvidence.push({visible:s.transition.visibleGarments,unclothed:s.transition.unclothedFrames,remaining:s.settling.remaining,body:s.body.heightCm});if(window.trackFrames)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  const t=performance.now();await page.locator(`[data-trial-height="${height}"]`).click();await page.waitForFunction(h=>Math.abs(window.lab.getLabSnapshot().lastFrame.body.heightCm-h)<.01,height,{timeout:15000});const firstMs=performance.now()-t;
  await ready();await page.evaluate(()=>window.trackFrames=false);const frames=await page.evaluate(()=>window.rafEvidence);assert.ok(frames.every(f=>f.visible===1&&f.unclothed===0));assert.ok(frames.some(f=>f.remaining>0));
  const s=await snapshot();assert.deepEqual(s.patternSpecifications.visibleJersey,spec.visibleJersey);assert.deepEqual(s.patternSpecifications.visibleShorts,spec.visibleShorts);assert.equal(s.garment.restLengthCm,64);assert.equal(s.outfit.shortsLengthCm,42);assert.equal(s.referenceSource.heightCm,170);
  await page.locator('[data-view="front"]').click();await shot(`same-pattern-${height}-front`);await page.locator('[data-view="side"]').click();await shot(`same-pattern-${height}-side`);
  cases.push({height,firstMs,sampledFrames:frames.length,body:s.body,fit:s.sizeAssessment,lowerContact:s.lowerContact,specifications:s.patternSpecifications,garment:s.garment,shorts:s.outfit.fixed});
 }
 checks.push('The identical selected shirt and shorts remain fixed over 145/170/200cm bodies; settled and intermediate frames stay clothed');
 await page.locator('#desiredLengthCm-number').fill('84');await page.locator('#desiredLengthCm-number').press('Enter');await page.locator('[data-selection-mode="auto"]').click();await page.waitForFunction(()=>window.lab.getLabSnapshot().state.recommendation.status==='no-configuration');assert.match(await page.locator('#selection-status').innerText(),/Sin configuración/);assert.equal((await snapshot()).transition.visibleGarments,1);await shot('no-configuration-length');checks.push('No available length is explained without silently selecting a wider shirt');
 await page.locator('[data-garment="N1-2"]').click();await ready();
 await page.locator('[data-reference-mode="original"]').click();await page.locator('[data-view="quarter"]').click();await shot('final-quarter');
 for(const width of[390,320]){await page.setViewportSize({width,height:1050});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.locator('#full-reference-photo').isVisible());await shot(`mobile-${width}`);}
 checks.push('Photograph and measurement controls remain available at 390px and 320px without horizontal overflow');
 assert.deepEqual(errors,[]);await writeFile(`${dir}/review.json`,JSON.stringify({checks,errors,initialMs,cases,final:await snapshot()},null,2));console.log(JSON.stringify({passed:checks.length,errors,initialMs,cases:cases.map(c=>({height:c.height,firstMs:c.firstMs,frames:c.sampledFrames,contact:c.lowerContact}))}));
}catch(error){await page.screenshot({path:`${dir}/failure.png`}).catch(()=>{});await writeFile(`${dir}/failure.json`,JSON.stringify({message:error.message,errors,checks,cases,final:await snapshot().catch(()=>null)},null,2));throw error;}finally{await browser.close();}
