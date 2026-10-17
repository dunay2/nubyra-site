import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.EVIDENCE_DIR||'artifacts/avatar-head';await mkdir(dir,{recursive:true});
const glb=(await readFile('configurador-3d/fit-lab/assets/human-female.glb')).toString('base64');
const code=`
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from './configurador-3d/fit-lab/human-body.mjs';
import {createHumanAppearance} from './configurador-3d/fit-lab/human-appearance.mjs';
import {createHumanFace} from './configurador-3d/fit-lab/human-face.mjs';
import {resolveState} from './configurador-3d/fit-lab/lab-model.mjs';
const bytes=Uint8Array.from(atob(window.HEAD_GLB),c=>c.charCodeAt(0));
const body=updateHumanBody(await loadHumanBody(bytes.buffer),resolveState({}),{collision:false});
const scene=new T.Scene();scene.background=new T.Color('#f3f8fa');scene.add(body);
const appearance=createHumanAppearance(body),face=createHumanFace(body);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,800);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.appendChild(renderer.domElement);
scene.add(new T.HemisphereLight(0xf5fcff,0x365267,2.1));for(const [x,y,z,p]of[[-3,5,5,2.7],[4,1,-3,1.4]]){const light=new T.DirectionalLight(0xffffff,p);light.position.set(x,y,z);scene.add(light);}
const s=body.userData.scale/body.userData.unit,y=body.userData.sourceToY(1.597);
const camera=new T.OrthographicCamera(-.145*s,.145*s,.145*s,-.145*s,.01,50);
window.inspectHead={setView(angle){camera.position.set(Math.sin(angle)*8,y,Math.cos(angle)*8);camera.lookAt(0,y,0);renderer.render(scene,camera);},appearance:appearance.snapshot(),face:face.snapshot()};window.inspectHead.setView(0);
`;
const result=await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,minify:true});
const js=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html='<html><head><style>html,body{margin:0}canvas{display:block}</style></head><body><script>window.HEAD_GLB='+JSON.stringify(glb)+';</script><script type="module">'+js+'</script></body></html>';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:800,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent(html);await page.waitForFunction(()=>window.inspectHead,null,{timeout:30000});
 for(const [name,angle]of[['front',0],['quarter',.52],['side',Math.PI/2],['back',Math.PI]]){
  await page.evaluate(a=>window.inspectHead.setView(a),angle);await page.screenshot({path:dir+'/head-'+name+'.png'});
 }
 assert.deepEqual(errors,[]);const meta=await page.evaluate(()=>({appearance:window.inspectHead.appearance,face:window.inspectHead.face}));
 await writeFile(dir+'/head-review.json',JSON.stringify({commit:process.env.GITHUB_SHA||'local',errors,...meta},null,2));console.log(JSON.stringify({passed:4,errors,...meta}));
}finally{await browser.close();}
