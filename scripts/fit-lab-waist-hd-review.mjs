import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'artifacts/waist-hd';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1560,height:1080}}),errors=[],checks=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);
const ready=()=>page.waitForFunction(()=>{const s=window.lab.getLabSnapshot(),f=s.lastFrame;return f?.sleeping&&!f.sizeRejection&&!f.transition.pending&&f.visibleState.bodyHeightCm===s.state.bodyHeightCm;},null,{timeout:120000});
const shot=async(name)=>page.locator('.view-panel').screenshot({path:dir+'/'+name+'.png'});
try{
 await page.goto(process.env.FIT_LAB_URL||'http://127.0.0.1:8131/fit-lab/');await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();
 await page.locator('#show-dimensions').uncheck();await page.locator('[data-view="back"]').click();
 await page.locator('#kit-panel').evaluate(e=>e.open=true);
 for(const height of[145,170,200]){
  await page.locator('[data-trial-height="'+height+'"]').click();await ready();
  for(const size of ['N1-2','N2-3']){
   await page.locator('#shorts-size').selectOption(size);
   for(const length of [34,42,50]){
    await page.locator('#shorts-length').selectOption(String(length));await page.waitForTimeout(50);
    const s=await snap();assert.equal(s.outfit.fixed.support.kind,'tied-drawstring-constraint');
    assert.equal(s.outfit.fixed.support.dropCm,0);assert.equal(s.outfit.fixed.moving,false);
    assert.equal(s.outfit.fixed.translationY,s.outfit.fixed.support.startY);
    assert.equal(s.outfit.shortsLengthCm,length);assert.equal(s.transition.visibleGarments,1);assert.equal(s.transition.unclothedFrames,0);
    cases.push({height,size,length,waist:s.outfit.fixed.support,waistGather:s.outfit.fixed.waistGather,lowerContact:s.lowerContact});
   }
  }
 }
 checks.push('18 height/size/length combinations: waist tied and lengths fixed, no automatic falling');
 await page.locator('[data-trial-height="170"]').click();await ready();await page.locator('#shorts-size').selectOption('N1-2');await page.locator('#shorts-length').selectOption('42');
 const start=await snap();await page.waitForTimeout(2000);assert.equal((await snap()).outfit.fixed.translationY,start.outfit.fixed.translationY);
 await page.locator('#kit-panel').evaluate(e=>e.open=false);await page.locator('#show-garment').uncheck();
 for(const view of ['front','back','side','quarter']){await page.locator('[data-view="'+view+'"]').click();await page.waitForTimeout(180);await shot('waist-'+view);}
 await page.locator('#show-garment').check();await page.locator('[data-view="quarter"]').click();await page.waitForTimeout(180);await shot('outfit-tied');
 checks.push('Waist stable after idle, front/back/side/quarter views with shirt on and off captured');
 const before=await snap(),downloads=[];page.on('response',r=>{if(r.url().includes('references-hd-v2/')&&!r.url().includes('thumb'))downloads.push(r.url());});
 for(const id of ['R01','R02','R03','R04','R05','R06','R07','R08']){
  const t=performance.now();await page.locator('[data-reference-profile="'+id+'"]').click();await page.waitForFunction(id=>document.getElementById('profile-reference-photo').dataset.profile===id,id);
  const natural=await page.locator('#profile-reference-photo').evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight}));assert.ok(natural.width>=1000&&natural.height>=1400);
  const s=await snap();assert.equal(s.workerRevision,before.workerRevision);assert.deepEqual(s.body,before.body);assert.deepEqual(s.patternSpecifications,before.patternSpecifications);
  cases.push({reference:id,natural,swapMs:performance.now()-t});
 }
 checks.push('Eight individual HD portraits decoded; switching never mutates body, fixed patterns or worker revision');
 await page.locator('[data-reference-profile="R02"]').click();await page.waitForTimeout(180);await shot('hd-reference-in-lab');
 await page.locator('[data-reference-mode="original"]').click();assert.ok(await page.locator('#full-reference-photo').isVisible());checks.push('Original photo is retained and separately selectable');
 for(const width of[390,320]){await page.setViewportSize({width,height:1040});await page.waitForTimeout(180);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/mobile-'+width+'.png',fullPage:true});}
 assert.deepEqual(errors,[]);await writeFile(dir+'/waist-hd-review.json',JSON.stringify({checks,cases,errors,downloads,final:await snap()},null,2));console.log(JSON.stringify({passed:checks.length,errors,cases:cases.length}));
}catch(error){await page.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,checks,errors,last:await snap().catch(()=>null)},null,2));throw error;}finally{await browser.close();}
