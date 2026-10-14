/** Reproduce the reported lower-body defect on the real Lab, not an idealized render. */
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=process.env.EVIDENCE_DIR||'/tmp/cut-a-review';await mkdir(dir,{recursive:true});
let server,base=process.env.FIT_LAB_URL;
if(!base){const root=path.resolve('fit-dist');server=createServer(async(req,res)=>{try{let file=path.join(root,new URL(req.url,'http://local').pathname);if(file.endsWith('/'))file+='index.html';if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/fit-lab/';}
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],evidence=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);await page.waitForFunction(()=>document.getElementById('render-status')?.textContent.includes('contacto activo'),null,{timeout:60000});await page.evaluate(async()=>{window.lab=await import('./app.mjs');});
 const set=async(key,v)=>{await page.locator('#'+key+'-number').fill(String(v));await page.locator('#'+key+'-number').press('Enter');await page.waitForFunction(({key,v})=>window.lab.getLabSnapshot().lastFrame.state[key]===v,{key,v},{timeout:45000});};
 for(const [name,params] of [['standard',{}],['reported',{bodyChestCm:94,bodyHipCm:96,desiredLengthCm:64,bodyHeightCm:166}]]){
  await page.locator('#reset-all').click();await page.waitForFunction(()=>window.lab.getLabSnapshot().lastFrame.state.bodyChestCm===88);
  for(const [key,value] of Object.entries(params))await set(key,value);

  await page.locator('#advanced').evaluate(e=>e.open=true);await page.locator('#settle-cloth').click();await page.locator('#advanced').evaluate(e=>e.open=false);
  await page.locator('[data-framing="outfit"]').click();
  await page.locator('#kit-panel').evaluate(e=>e.open=true);
  for(const [key,value] of [['team','TELDE'],['surname','NOMBRE'],['number','10']]){await page.locator('#kit-'+key).fill(value);await page.locator('#kit-'+key).press('Enter');}
  for(const [key,value] of [['base','#b52840'],['accent','#123a9c']])await page.locator('#kit-'+key).evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));},value);
  await page.locator('#kit-panel').evaluate(e=>e.open=false);
  const before=await page.evaluate(()=>window.lab.getLabSnapshot());
  for(const view of ['front','side','quarter','back']){
   await page.locator('[data-view="'+view+'"]').click();await page.waitForTimeout(350);await page.locator('#scene-wrapper').screenshot({path:dir+'/'+name+'-'+view+'-combined.png'});
   await page.locator('#show-garment').uncheck();await page.waitForTimeout(150);await page.locator('#scene-wrapper').screenshot({path:dir+'/'+name+'-'+view+'-shorts.png'});await page.locator('#show-shorts').evaluate(e=>{e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));});await page.waitForTimeout(150);await page.locator('#scene-wrapper').screenshot({path:dir+'/'+name+'-'+view+'-body.png'});await page.locator('#show-shorts').evaluate(e=>{e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#show-garment').check();
  }
  const after=await page.evaluate(()=>window.lab.getLabSnapshot());
  assert.equal(after.lastFrame.cloth.steps,before.lastFrame.cloth.steps,'view/visibility must not restart settled physics');
  assert.equal(after.lastFrame.outfit.clothSimulated,false);
  evidence.push({case:name,state:after.state,outfit:after.lastFrame.outfit,performance:after.lastFrame.performance});
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/review.json',JSON.stringify({errors,evidence},null,2));console.log(JSON.stringify({screenshots:24,errors}));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
