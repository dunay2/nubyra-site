/** Real application captures for the scoped torso/loose-shorts cut. */
import{chromium}from'playwright';import{createServer}from'node:http';import{readFile,writeFile,mkdir}from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';
let server,base=process.env.FIT_LAB_URL;const dir=process.env.EVIDENCE_DIR||'/tmp/hip-torso-review';await mkdir(dir,{recursive:true});
if(!base){const root=path.resolve('fit-dist');server=createServer(async(req,res)=>{try{let f=path.join(root,new URL(req.url,'http://local').pathname);if(f.endsWith('/'))f+='index.html';if(!f.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css'})[path.extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/fit-lab/`;}
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],records=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.goto(base);await page.waitForFunction(()=>document.querySelector('#render-status')?.textContent.includes('contacto activo'),null,{timeout:60000});await page.evaluate(async()=>window.lab=await import('./app.mjs'));
 const snap=()=>page.evaluate(()=>window.lab.getLabSnapshot());
 for(const [name,params]of [['standard',{}],['reported',{bodyChestCm:94,bodyHipCm:96,bodyHeightCm:166}],['extreme',{bodyChestCm:117,bodyHipCm:72,bodyHeightCm:143,desiredLengthCm:52}]]){
  await page.locator('#reset-all').click();await page.waitForFunction(()=>window.lab.getLabSnapshot().lastFrame.state.bodyChestCm===88,null,{timeout:45000});
  for(const [key,value]of Object.entries(params)){await page.locator('#'+key+'-number').fill(String(value));await page.locator('#'+key+'-number').press('Enter');await page.waitForFunction(({key,value})=>window.lab.getLabSnapshot().lastFrame.state[key]===value,{key,value},{timeout:45000});}
  if(name==='extreme')await page.locator('[data-garment="N1-1"]').click();
  await page.locator('#advanced').evaluate(e=>e.open=true);await page.locator('#settle-cloth').click();await page.locator('#advanced').evaluate(e=>e.open=false);
  await page.locator('#show-dimensions').uncheck();await page.locator('[data-framing="outfit"]').click();
  const before=await snap();
  for(const v of ['front','side','quarter','back']){await page.locator('[data-view="'+v+'"]').click();await page.waitForTimeout(250);await page.locator('#scene-wrapper').screenshot({path:dir+'/'+name+'-'+v+'-combined.png'});await page.locator('#show-garment').uncheck();await page.waitForTimeout(100);await page.locator('#scene-wrapper').screenshot({path:dir+'/'+name+'-'+v+'-body-shorts.png'});await page.locator('#show-garment').check();}
  if(name!=='extreme'){await page.locator('[data-framing="torso"]').click();await page.locator('#show-garment').uncheck();for(const v of ['front','side','quarter','back']){await page.locator('[data-view="'+v+'"]').click();await page.waitForTimeout(180);await page.locator('#scene-wrapper').screenshot({path:dir+'/'+name+'-'+v+'-torso.png'});}await page.locator('#show-garment').check();}
  const after=await snap();assert.equal(before.lastFrame.cloth.steps,after.lastFrame.cloth.steps);records.push({name,state:after.state,body:after.lastFrame.body,outfit:before.lastFrame.outfit,cloth:after.lastFrame.cloth,performance:after.lastFrame.performance});
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/review.json',JSON.stringify({errors,records},null,2));console.log(JSON.stringify({screenshots:32,errors}));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
