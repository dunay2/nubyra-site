import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'artifacts/body-editor';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1540,height:1080}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot());
const ready=()=>page.waitForFunction(()=>{const s=window.lab.getLabSnapshot();const keys=['bodyHeightCm','bodyChestCm','bodyHipCm','activeConfiguration','garmentLengthCm','hipWidthPct','gluteProjectionCm','abdomenProjectionCm','thighWidthPct','chestProjectionCm','bodyBaseChestCm','bodyBaseHipCm'];return s.lastFrame&&keys.every(k=>s.state[k]===s.lastFrame.visibleState[k])&&!s.lastFrame.transition.pending&&!s.lastFrame.transition.error&&s.lastFrame.transition.requestedRevision===s.lastFrame.transition.presentedRevision;},null,{timeout:120000});
const shot=async name=>page.screenshot({path:dir+'/'+name+'.png',fullPage:true});
try{
 await page.goto(process.env.FIT_LAB_URL||'http://127.0.0.1:8170/fit-lab/');await page.waitForFunction(()=>document.querySelector('#render-status').textContent.includes('Malla humana'),null,{timeout:60000});await page.evaluate(async()=>window.lab=await import('./app.mjs'));await ready();
 let before=await snap();assert.ok(before.lastFrame.camera.pan);assert.equal(before.lastFrame.camera.maxZoom,5);
 const canvas=page.locator('#fit-canvas'),rect=await canvas.boundingBox(),cx=rect.x+rect.width*.45,cy=rect.y+rect.height*.45;
 await page.mouse.move(cx,cy);await page.mouse.down({button:'right'});await page.mouse.move(cx+90,cy+45,{steps:8});await page.mouse.up({button:'right'});await page.waitForTimeout(250);
 let after=await snap();assert.notDeepEqual(after.lastFrame.camera.target,before.lastFrame.camera.target);assert.equal(after.lastFrame.workerRevision,before.lastFrame.workerRevision);
 await page.mouse.move(cx,cy);await page.mouse.wheel(0,-400);await page.waitForTimeout(250);after=await snap();assert.ok(after.lastFrame.camera.zoom>1.1);
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+70,cy+85,{steps:8});await page.mouse.up();await page.waitForTimeout(300);after=await snap();assert.ok(Math.abs(after.lastFrame.camera.polarAngle-Math.PI/2)>.05);assert.equal(after.lastFrame.workerRevision,before.lastFrame.workerRevision);checks.push('Pan, zoom and vertical orbit use real input without changing the Worker revision');await shot('free-camera');
 await page.locator('[data-camera-action="fit"]').click();after=await snap();assert.equal(after.lastFrame.camera.zoom,1);checks.push('Fit restores a recoverable body framing');
 await page.locator('[data-garment="N1-2"]').click();await ready();
 await page.locator('#body-region-editor summary').click();await page.locator('#toggle-body-points').click();
 before=await snap();const spec=JSON.stringify(before.lastFrame.patternSpecifications.visibleJersey);
 await page.locator('#region-gluteProjectionCm').fill('-1.5');await page.locator('#region-gluteProjectionCm').press('Tab');await ready();after=await snap();
 assert.equal(after.state.gluteProjectionCm,-1.5);assert.equal(after.lastFrame.bodyRegions.values.gluteProjectionCm,-1.5);assert.ok(after.lastFrame.body.hipCm<before.lastFrame.body.hipCm-.1);assert.equal(JSON.stringify(after.lastFrame.patternSpecifications.visibleJersey),spec);assert.equal(after.lastFrame.workerRevision,before.lastFrame.workerRevision+1);checks.push('Regional commit changes the rear and measured hip without silently changing the manual shirt pattern');
 await page.locator('[data-view="front"]').click();await page.waitForTimeout(250);await canvas.scrollIntoViewIfNeeded();const h=page.locator('[data-body-handle="hipWidthPct"]'),hr=await h.boundingBox();before=await snap();
 await page.mouse.move(hr.x+15,hr.y+hr.height/2);await page.mouse.down();await page.mouse.move(hr.x+430,hr.y+hr.height/2,{steps:12});
 let during=await snap();assert.equal(during.lastFrame.bodyEditor.previewing,true);assert.equal(during.lastFrame.bodyEditor.draft.hipWidthPct,12);assert.equal(during.lastFrame.workerRevision,before.lastFrame.workerRevision);assert.equal(during.lastFrame.bodyEditor.clothRecalculatedDuringDrag,false);await shot('regional-draft-at-limit');
 await page.mouse.up();await ready();after=await snap();assert.equal(after.state.hipWidthPct,12);assert.equal(after.lastFrame.workerRevision,before.lastFrame.workerRevision+1);checks.push('Real handle drag clamps at the absolute +12% limit and sends only one physical update on release');
 // Cancel a live draft: neither the public body nor its physical revision changes.
 await page.locator('[data-view="front"]').click();await page.waitForTimeout(200);await canvas.scrollIntoViewIfNeeded();const r=await h.boundingBox();before=await snap();await page.mouse.move(r.x+15,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x-100,r.y+r.height/2,{steps:4});await page.keyboard.press('Escape');await page.mouse.up();after=await snap();assert.equal(after.state.hipWidthPct,before.state.hipWidthPct);assert.equal(after.lastFrame.workerRevision,before.lastFrame.workerRevision);checks.push('Escape cancels a draft without committing or recalculating cloth');
 await page.locator('#undo-body-region').click();await ready();after=await snap();assert.equal(after.state.hipWidthPct,0);assert.equal(after.state.gluteProjectionCm,-1.5);checks.push('Undo restores the preceding regional values');
 await page.locator('[data-view="side"]').click();await page.waitForTimeout(200);await shot('regional-editor-side');
 await page.locator('#region-abdomenProjectionCm').fill('200');await page.locator('#region-abdomenProjectionCm').press('Tab');await ready();after=await snap();assert.equal(after.state.abdomenProjectionCm,3);checks.push('Numeric input shares the same hard limit as the handle');
 await page.locator('#body-region-editor summary').click();await page.setViewportSize({width:390,height:900});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-camera-editor');checks.push('Mobile layout does not overflow horizontally');
 assert.deepEqual(errors,[]);assert.equal(after.lastFrame.transition.unclothedFrames,0);checks.push('No recorded JavaScript error or unclothed frame during tested edits');
 await writeFile(dir+'/body-editor-review.json',JSON.stringify({checks,errors,before,during,after,final:await snap()},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors}));
}catch(e){await shot('failure').catch(()=>{});await writeFile(dir+'/failure.json',JSON.stringify({error:e.message,checks,errors,snapshot:await snap().catch(()=>null)},null,2));throw e;}
finally{await browser.close();}
