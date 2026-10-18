import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.EVIDENCE_DIR||'artifacts/face-portrait';await mkdir(dir,{recursive:true});
const faceModule=process.env.FACE_MODULE||'./configurador-3d/fit-lab/human-face.mjs';
const glb=(await readFile('configurador-3d/fit-lab/assets/human-female.glb')).toString('base64');
const code=`
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from './configurador-3d/fit-lab/human-body.mjs';
import {createHumanAppearance} from './configurador-3d/fit-lab/human-appearance.mjs';
import {createHumanFace} from '${faceModule}';
import {resolveState} from './configurador-3d/fit-lab/lab-model.mjs';
const b=Uint8Array.from(atob(window.HEAD_GLB),c=>c.charCodeAt(0));
const body=updateHumanBody(await loadHumanBody(b.buffer),resolveState({}),{collision:false});
const scene=new T.Scene();scene.background=new T.Color('#f3f8fa');scene.add(body);
const t=performance.now(),appearance=createHumanAppearance(body),face=createHumanFace(body),buildMs=performance.now()-t;
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,900);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.appendChild(renderer.domElement);
scene.add(new T.HemisphereLight(0xf5fcff,0x365267,2.1));for(const [x,y,z,p]of[[-3,5,5,2.7],[4,1,-3,1.4]]){const light=new T.DirectionalLight(0xffffff,p);light.position.set(x,y,z);scene.add(light);}
const s=body.userData.scale/body.userData.unit,y=body.userData.sourceToY(1.593);
const camera=new T.OrthographicCamera(-.15*s,.15*s,.15*s,-.15*s,.01,50);
window.inspectHead={setView(angle){camera.position.set(Math.sin(angle)*8,y,Math.cos(angle)*8);camera.lookAt(0,y,0);renderer.render(scene,camera);},snapshot(){return {appearance:appearance.snapshot(),face:face.snapshot(),buildMs,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}};window.inspectHead.setView(0);
`;
const result=await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,minify:true});
const html='<html><head><style>html,body{margin:0}canvas{display:block}</style></head><body><script>window.HEAD_GLB='+JSON.stringify(glb)+';</script><script type="module">'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.setContent(html);await page.waitForFunction(()=>window.inspectHead,null,{timeout:30000});
 for(const [name,angle]of[['front',0],['quarter',.52],['left',-.52],['side',Math.PI/2]]){await page.evaluate(a=>window.inspectHead.setView(a),angle);await page.screenshot({path:dir+'/face-'+name+'.png'});}
 assert.deepEqual(errors,[]);const meta=await page.evaluate(()=>window.inspectHead.snapshot());
 await writeFile(dir+'/face-review.json',JSON.stringify({commit:process.env.GITHUB_SHA||'local',errors,...meta},null,2));console.log(JSON.stringify({passed:4,errors,...meta}));
}finally{await browser.close();}
