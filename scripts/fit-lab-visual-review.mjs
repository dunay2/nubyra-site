/** Browser screenshots of the actual fit meshes, not generated illustrations. */
import{chromium}from'playwright';import{createServer}from'node:http';import{mkdir,readFile,writeFile}from'node:fs/promises';import path from'node:path';
const root=path.resolve(process.env.FIT_DIST||'fit-dist'),directory=process.env.EVIDENCE_DIR||'/tmp/fit-visual';await mkdir(directory,{recursive:true});let server,url=process.env.FIT_LAB_URL;
if(!url){server=createServer(async(req,res)=>{try{let file=path.join(root,new URL(req.url,'http://local').pathname);if(file.endsWith('/'))file+='index.html';if(!file.startsWith(root+path.sep))throw Error('Outside root');res.setHeader('content-type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port+'/fit-lab/';}
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[],evidence=[];page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(async()=>(await import('./app.mjs')).getLabSnapshot());
const cases=[['A',{},'N1-2'],['U1',{bodyChestCm:79,bodyHipCm:88,desiredLengthCm:55,frontVolume:4,sideVolume:4,backVolume:10},'N1-1'],['U2',{bodyChestCm:113,bodyHipCm:130,desiredLengthCm:64,frontVolume:3,sideVolume:5,backVolume:5},'N2-3']];
try{
 await page.goto(url);await page.waitForFunction(()=>document.getElementById('render-status').textContent.includes('contacto activo'),null,{timeout:30000});
 for(const [label,values,code]of cases){
  await page.locator('#reset-all').click();for(const [key,value]of Object.entries(values))await page.locator('#'+key+'-range').evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},value);
  await page.locator('[data-garment="'+code+'"]').click();await page.locator('#advanced').evaluate(e=>e.open=true);await page.locator('#settle-cloth').click();await page.locator('#advanced').evaluate(e=>e.open=false);
  if(await page.locator('#pause-motion').getAttribute('aria-pressed')!=='true')await page.locator('#pause-motion').click();await page.locator('#show-dimensions').uncheck();
  for(const view of ['front','side','quarter','back']){
   await page.locator('[data-view="'+view+'"]').click();
   for(const mode of ['combined','body','shirt','transparent']){
    await page.locator('#show-body').check();await page.locator('#show-garment').check();await page.locator('#transparent-garment').setChecked(mode==='transparent');
    if(mode==='body')await page.locator('#show-garment').uncheck();if(mode==='shirt')await page.locator('#show-body').uncheck();await page.waitForTimeout(120);
    const filename=label+'-'+view+'-'+mode+'.png';await page.locator('#fit-canvas').screenshot({path:directory+'/'+filename});evidence.push(filename);
   }
  }
  await writeFile(directory+'/'+label+'-snapshot.json',JSON.stringify(await snapshot(),null,2));
 }
 await page.locator('#show-body').check();await page.locator('#show-garment').check();await page.locator('#transparent-garment').uncheck();await page.locator('#show-dimensions').check();await page.locator('[data-view="quarter"]').click();await page.screenshot({path:directory+'/panel-desktop.png',fullPage:true});
 await writeFile(directory+'/visual-manifest.json',JSON.stringify({source:url,captures:evidence,errors,note:'Chromium screenshots; synthetic torso and experimental cloth; not an anatomical or textile certification'},null,2));if(errors.length)throw Error(errors.join(';'));console.log(JSON.stringify({screenshots:evidence.length,errors}));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
