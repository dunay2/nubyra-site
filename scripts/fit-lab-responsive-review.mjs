import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.FIT_LAB_URL||'http://127.0.0.1:8010/fit-lab/',dir=process.env.EVIDENCE_DIR||'artifacts/responsive-review';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[],timings=[],snapshots=[];
page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>window.lab.getLabSnapshot());
const ready=()=>page.waitForFunction(()=>{const {state,lastFrame:f}=window.lab.getLabSnapshot();return f&&f.transition.visibleGarments===1&&!f.transition.pending&&!f.transition.error&&f.garment.code===state.activeConfiguration&&['bodyHeightCm','bodyChestCm','bodyHipCm','armLoweringDeg','frontVolume','sideVolume','backVolume'].every(k=>f.visibleState[k]===state[k]);},null,{timeout:60000});
async function input(key,value){await page.locator('#'+key+'-number').fill(String(value));await page.locator('#'+key+'-number').press('Enter');}
async function shot(name){await page.locator('.view-panel').screenshot({path:dir+'/'+name+'.png'});}
try{
 const start=performance.now();await page.goto(url);await page.waitForFunction(()=>document.querySelector('#render-status').textContent.includes('Malla humana'));await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();
 timings.push({name:'first-complete-outfit',ms:performance.now()-start});let f=(await snapshot()).lastFrame;assert.equal(f.transition.bootstrapVisible,true);await page.waitForFunction(()=>document.getElementById('reference-photo').dataset.annotationRemoved==='true');checks.push('Red annotation is removed locally while keeping the original bitmap dimensions');checks.push('A settled initial outfit is visible without waiting for 360 live steps');
 await page.locator('[data-view="front"]').click();await shot('initial');
 await page.locator('#show-motion').check();
 // User-reported quick edits, including smaller bodies and relaxed arms, with wind enabled.
 for(const [name,h,c,hip,arm]of [['reported-141',141,75,79,0],['reported-153',153,82,86,25],['reference-170',170,84,94,25],['tall-190',190,102,114,0]]){
  const t=performance.now();await input('bodyHeightCm',h);await input('bodyChestCm',c);await input('bodyHipCm',hip);await input('armLoweringDeg',arm);await ready();
  timings.push({name,ms:performance.now()-t});const s=await snapshot();snapshots.push(s);f=s.lastFrame;
  assert.equal(f.transition.visibleGarments,1);assert.equal(f.transition.unclothedFrames,0);assert.ok(Math.abs(f.body.heightCm-h)<.05);assert.ok(Math.abs(f.body.chestCm-c)<.05);
  const layout=await page.evaluate(()=>{const a=document.getElementById('reference-photo').getBoundingClientRect(),b=document.getElementById('scene-wrapper').getBoundingClientRect(),f=window.lab.getLabSnapshot().lastFrame;return {ratio:a.width/a.height,floorDifference:a.bottom-b.top-f.comparison.floorPx,headTop:f.comparison.floorPx-f.body.heightCm*f.comparison.pxPerCm,canvasH:b.height,referenceBar:document.querySelector('.reference-height-gauge').getBoundingClientRect().height,px:f.comparison.pxPerCm};});
  assert.ok(Math.abs(layout.ratio-300/332)<.002);assert.ok(Math.abs(layout.floorDifference)<2);assert.ok(layout.headTop>=4,JSON.stringify(layout));assert.ok(Math.abs(layout.referenceBar-170*layout.px)<1);
  await shot(name);
 }
 checks.push('Reported 141/75/79 and 153/82/86 inputs finish, as do 170/190 cm bodies; no blank frame');checks.push('Fixed comparison scale, preserved image aspect ratio, floor alignment and no full-body clipping');
 // Per-RAF visibility while requesting several variants. Wind is deliberately on.
 await page.evaluate(()=>{window.samples=[];window.watch=true;const tick=()=>{const f=window.lab.getLabSnapshot().lastFrame;window.samples.push({pending:f.transition.pending,visible:f.transition.visibleGarments,unclothed:f.transition.unclothedFrames,code:f.garment.code});if(window.watch)requestAnimationFrame(tick);};tick();});
 await input('bodyHeightCm',153);await input('bodyChestCm',82);await input('bodyHipCm',86);await input('armLoweringDeg',25);await ready();
 for(const code of['N1-1','N1-2','N1-3']){await page.locator('[data-garment="'+code+'"]').click();}
 await ready();assert.equal((await snapshot()).lastFrame.garment.code,'N1-3');await page.evaluate(()=>window.watch=false);
 const frames=await page.evaluate(()=>window.samples);assert.ok(frames.every(f=>f.visible===1&&f.unclothed===0));checks.push('Rapid variant selection and wind keep one complete outfit visible; latest request wins');
 await page.locator('#show-motion').uncheck();await page.locator('#pause-motion').click();
 await page.locator('[data-garment="N1-1"]').click();await ready();assert.equal((await snapshot()).lastFrame.paused,true);checks.push('Updates finish while paused');
 for(const v of['front','side','back','quarter']){await page.locator('[data-view="'+v+'"]').click();await shot('layer-'+v);}
 f=(await snapshot()).lastFrame;assert.equal(f.layering.enabled,true);assert.equal(f.layering.shirtGeometryChanged,false);assert.equal(f.layering.bodyMasked,false);checks.push('The outer shirt uses its live silhouette to occlude only the covered part of the unsimulated short');
 await page.locator('#transparent-garment').check();assert.equal((await snapshot()).lastFrame.layering.enabled,false);await page.locator('#transparent-garment').uncheck();
 await page.locator('#show-garment').uncheck();assert.equal((await snapshot()).lastFrame.layering.enabled,false);await page.locator('#show-garment').check();
 await page.locator('[data-view="front"]').click();
 for(const width of [390,320]){await page.setViewportSize({width,height:960});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-'+width);}
 checks.push('Mobile comparison remains side-by-side without horizontal overflow');
 assert.deepEqual(errors,[]);await writeFile(dir+'/review.json',JSON.stringify({checks,errors,timings,snapshots,sampledFrames:frames.length,final:await snapshot()},null,2));console.log(JSON.stringify({checks,errors,timings,sampledFrames:frames.length}));
}catch(error){await writeFile(dir+'/failure.json',JSON.stringify({message:error.message,errors,checks,timings,last:await snapshot().catch(()=>null)},null,2));throw error;}
finally{await browser.close();}
