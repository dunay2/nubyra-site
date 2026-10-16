import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const url=process.env.FIT_LAB_URL||'http://127.0.0.1:8096/fit-lab/',dir=process.env.EVIDENCE_DIR||'artifacts/live-drape';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);
const settle=()=>page.waitForFunction(()=>{const s=window.lab.getLabSnapshot();return s.lastFrame.sleeping&&!s.lastFrame.transition.pending&&s.lastFrame.garment.code===s.state.activeConfiguration;},null,{timeout:90000});
async function input(key,value){await page.locator('#'+key+'-number').fill(String(value));await page.locator('#'+key+'-number').press('Enter');}
try{
 await page.goto(url);await page.evaluate(async()=>window.lab=await import('./app.mjs'));await settle();assert.equal((await snapshot()).transition.visibleGarments,1);
 await page.evaluate(()=>{window.samples=[];window.watching=true;function tick(){const f=window.lab.getLabSnapshot().lastFrame;window.samples.push({code:f.garment.code,remaining:f.settling.remaining,visible:f.transition.visibleGarments,bare:f.transition.unclothedFrames});if(window.watching)requestAnimationFrame(tick);}tick();});
 for(const [name,code,h,c,hip,arm]of[['reported','N1-1',153,82,86,25],['oversize','N2-3',137,84,89,25]]){
  await input('bodyHeightCm',h);await input('bodyChestCm',c);await input('bodyHipCm',hip);await input('armLoweringDeg',arm);const start=performance.now();await page.locator('[data-garment="'+code+'"]').click();
  await page.waitForFunction(({code,h})=>{const f=window.lab.getLabSnapshot().lastFrame;return f.garment.code===code&&f.body.heightCm>h-.02&&f.body.heightCm<h+.02&&!f.transition.pending;},{code,h},{timeout:10000});
  const first=await snapshot();assert.ok(first.settling.remaining>0,'The garment was hidden until settled');assert.equal(first.transition.visibleGarments,1);
  await page.locator('.view-panel').screenshot({path:dir+'/'+name+'-first-frame.png'});const firstMs=performance.now()-start;
  await settle();const final=await snapshot();assert.equal(final.transition.unclothedFrames,0);assert.ok(final.transition.liveFrames>3);assert.equal(final.finish.continuousLoops,3);
  for(const view of['front','side','quarter','back']){await page.locator('[data-view="'+view+'"]').click();await page.waitForTimeout(150);await page.locator('.view-panel').screenshot({path:dir+'/'+name+'-'+view+'.png'});}
  results.push({name,firstMs,first,final});
 }
 await page.evaluate(()=>window.watching=false);const samples=await page.evaluate(()=>window.samples);assert.ok(samples.every(f=>f.visible===1&&f.bare===0));assert.ok(samples.some(f=>f.remaining>0&&f.remaining<356));
 for(const width of[390,320]){await page.setViewportSize({width,height:960});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.view-panel').screenshot({path:dir+'/mobile-'+width+'.png'});}
 assert.deepEqual(errors,[]);await writeFile(dir+'/review.json',JSON.stringify({results,errors,sampledFrames:samples.length,samples},null,2));console.log(JSON.stringify({results:results.map(r=>({name:r.name,firstMs:r.firstMs,completeMs:r.final.transition.lastSettleMs})),errors,sampledFrames:samples.length}));
}catch(e){await page.screenshot({path:dir+'/failure.png'}).catch(()=>{});await writeFile(dir+'/failure.json',JSON.stringify({message:e.message,errors,results,snapshot:await snapshot().catch(()=>null)},null,2));throw e;}finally{await browser.close();}
