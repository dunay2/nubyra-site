import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.EVIDENCE_DIR||'artifacts/hair-quality';await mkdir(dir,{recursive:true});
const hairModule=process.env.HAIR_MODULE||'human-appearance.mjs';
if(!/^[a-z0-9.-]+\.mjs$/.test(hairModule))throw Error('Invalid hair module');
const glb=(await readFile('configurador-3d/fit-lab/assets/human-female.glb')).toString('base64');
const code=`
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from './configurador-3d/fit-lab/human-body.mjs';
import {createHumanAppearance} from './configurador-3d/fit-lab/${hairModule}';
import {createHumanFace} from './configurador-3d/fit-lab/human-face.mjs';
import {resolveState} from './configurador-3d/fit-lab/lab-model.mjs';
const bytes=Uint8Array.from(atob(window.HEAD_GLB),c=>c.charCodeAt(0));
const state=resolveState({}),body=updateHumanBody(await loadHumanBody(bytes.buffer),state,{collision:false});
const scene=new T.Scene();scene.background=new T.Color('#f3f8fa');scene.add(body);
const appearance=createHumanAppearance(body),face=createHumanFace(body);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,800);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.appendChild(renderer.domElement);
scene.add(new T.HemisphereLight(0xf5fcff,0x365267,2.1));for(const [x,y,z,p]of[[-3,5,5,2.7],[4,1,-3,1.4]]){const light=new T.DirectionalLight(0xffffff,p);light.position.set(x,y,z);scene.add(light);}
const camera=new T.OrthographicCamera(-1,1,1,-1,.01,50);
window.inspectHead={setView({angle=0,pitch=0,height=170,full=false}){
 updateHumanBody(body,{...state,bodyHeightCm:height},{collision:false});appearance.update();face.update();
 const s=body.userData.scale/body.userData.unit,y=body.userData.sourceToY(full?1.10:1.597),span=(full?.92:.18)*s;
 camera.left=-span;camera.right=span;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();
 camera.position.set(Math.sin(angle)*8*Math.cos(pitch),y+8*Math.sin(pitch),Math.cos(angle)*8*Math.cos(pitch));camera.lookAt(0,y,0);renderer.render(scene,camera);
},appearance:appearance.snapshot(),face:face.snapshot(),calls:renderer.info.render.calls};window.inspectHead.setView({});
`;
const result=await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,minify:true});
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html='<html><head><style>html,body{margin:0}canvas{display:block}</style></head><body><script>window.HEAD_GLB='+JSON.stringify(glb)+';</script><script type="module">'+js+'</script></body></html>';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:800,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent(html);await page.waitForFunction(()=>window.inspectHead,null,{timeout:30000});
 const views=[['front',0,0],['quarter',.65,0],['side',Math.PI/2,0],['other-side',-Math.PI/2,0],['rear-quarter',2.5,0],['back',Math.PI,0],['crown',.5,.85]];
 for(const [name,angle,pitch]of views){await page.evaluate(v=>window.inspectHead.setView(v),{angle,pitch});await page.screenshot({path:dir+'/head-'+name+'.png'});}
 for(const height of[125,170,210]){await page.evaluate(v=>window.inspectHead.setView(v),{angle:Math.PI/2,height});await page.screenshot({path:dir+'/height-'+height+'-side.png'});}
 assert.deepEqual(errors,[]);const meta=await page.evaluate(()=>({appearance:window.inspectHead.appearance,face:window.inspectHead.face}));
 await writeFile(dir+'/review.json',JSON.stringify({commit:process.env.GITHUB_SHA||'local',source:hairModule,errors,views:10,...meta},null,2));console.log(JSON.stringify({passed:10,errors,...meta}));
}finally{await browser.close();}
