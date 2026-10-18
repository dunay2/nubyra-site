import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.env.EVIDENCE_DIR||'artifacts/gravity-inspection';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1024}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.FIT_LAB_URL||'http://127.0.0.1:8180/fit-lab/');
 await page.waitForFunction(()=>document.querySelector('#render-status').textContent.includes('Malla humana'),null,{timeout:60000});await page.evaluate(async()=>window.lab=await import('./app.mjs'));
 await page.waitForFunction(()=>{const f=window.lab.getLabSnapshot().lastFrame;return !f.transition.pending&&!f.transition.error&&f.sleeping&&f.outfit.fixed.clothSimulated;},null,{timeout:180000});
 await page.locator('#wind').uncheck();await page.locator('#show-dimensions').uncheck();
 const before=await page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);assert.equal(before.outfit.fixed.cloth.waistDriftCm,0);
 await page.locator('#show-garment').uncheck();await page.locator('[data-camera-action="focus"]').click();for(let i=0;i<3;i++)await page.locator('[data-camera-action="zoom-in"]').click();
 for(const view of ['front','side','back']){await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(250);await page.locator('#scene-wrapper').screenshot({path:dir+'/short-inspection-'+view+'.png'});}
 await page.locator('#show-garment').check();await page.locator('[data-camera-action="fit"]').click();await page.locator('[data-view="quarter"]').click();await page.waitForTimeout(250);await page.locator('.viewer-card').screenshot({path:dir+'/outfit-final.png'});
 const s=await page.evaluate(()=>window.lab.getLabSnapshot());assert.equal(s.lastFrame.workerRevision,before.workerRevision);assert.equal(s.lastFrame.outfit.fixed.cloth.steps,before.outfit.fixed.cloth.steps);
 assert.match(await page.locator('#fixed-shorts-status').innerText(),/Caída vertical visible/);
 await page.locator('[data-view="back"]').click();await page.waitForTimeout(300);assert.match(await page.locator('#reference-kind-label').innerText(),/trasera no disponible/);
 for(const width of [390,320]){await page.setViewportSize({width,height:960});await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/mobile-'+width+'.png',fullPage:true});}
 assert.deepEqual(errors,[]);await writeFile(dir+'/inspection.json',JSON.stringify({commit:process.env.GITHUB_SHA||'local',errors,checks:['Short front/side/back inspected without shirt masking','Fixed cut and vertical drape measurements are distinct','Camera/visibility inspection does not advance physics','Absent reference directions are labelled','390/320px layouts remain contained'],snapshot:s},null,2));
 console.log(JSON.stringify({passed:5,errors}));
}catch(error){await page.screenshot({path:dir+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(dir+'/failure.json',JSON.stringify({error:error.message,errors,snapshot:await page.evaluate(()=>window.lab?.getLabSnapshot()).catch(()=>null)},null,2));throw error;}finally{await browser.close();}
