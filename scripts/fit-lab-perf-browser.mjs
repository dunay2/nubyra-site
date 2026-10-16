import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.EVIDENCE_DIR||'artifacts/performance';await mkdir(dir,{recursive:true});
const modes=[['reference',process.env.PERF_BEFORE_URL||'http://127.0.0.1:8091/before/fit-lab/'],['optimized',process.env.PERF_AFTER_URL||'http://127.0.0.1:8091/after/fit-lab/']];
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const [mode,url] of modes){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],timings=[];page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>{const {state,lastFrame:f}=window.lab.getLabSnapshot();return f&&f.transition.visibleGarments===1&&!f.transition.pending&&!f.transition.error&&f.garment.code===state.activeConfiguration&&['bodyHeightCm','bodyChestCm','bodyHipCm','armLoweringDeg','frontVolume','sideVolume','backVolume'].every(k=>f.visibleState[k]===state[k]);},null,{timeout:90000});
  const input=async(k,v)=>{await page.locator('#'+k+'-number').fill(String(v));await page.locator('#'+k+'-number').press('Enter');};
  const start=performance.now();await page.goto(url);await page.evaluate(async()=>window.lab=await import(new URL('./app.mjs',location.href)));await ready();
  timings.push({name:'first-outfit',ms:performance.now()-start});
  for(const [name,h,c,hip,arm]of [['reported-141',141,75,79,0],['reported-153',153,82,86,25]]){
   const t=performance.now();await input('bodyHeightCm',h);await input('bodyChestCm',c);await input('bodyHipCm',hip);await input('armLoweringDeg',arm);await ready();
   const f=await page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);timings.push({name,ms:performance.now()-t,workerTransitionMs:f.transition.lastMs,queries:f.contact});
   assert.equal(f.transition.unclothedFrames,0);assert.equal(f.garment.code,'N1-1');assert.ok(Math.abs(f.body.heightCm-h)<.01);
  }
  await page.locator('[data-view="front"]').click();await page.locator('.view-panel').screenshot({path:dir+'/'+mode+'-front.png'});
  const final=await page.evaluate(()=>window.lab.getLabSnapshot().lastFrame);assert.deepEqual(errors,[]);results.push({mode,timings,errors,final});
  await page.close();
 }
 await writeFile(dir+'/browser-benchmark.json',JSON.stringify({browser:await browser.version(),conditions:'same machine, browser, viewport, serial runs, cold per-page session cache',results},null,2));console.log(JSON.stringify(results.map(x=>({mode:x.mode,timings:x.timings,errors:x.errors}))));
}finally{await browser.close();}
