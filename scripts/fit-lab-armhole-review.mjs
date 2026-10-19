/** Reproduce the reported side-panel entanglement with the actual solver and renderer. */
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createRestGarment} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {garmentForState} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {sidePanelCrossings} from '../tests/helpers/armhole-contact.mjs';
const dir=process.env.EVIDENCE_DIR||'artifacts/armhole/after';await mkdir(dir,{recursive:true});
const source=process.env.SIMULATION_MODULE||'../configurador-3d/fit-lab/human-simulation.mjs';
const {createHumanSimulation,SIMULATION_VERSION}=await import(new URL(source,import.meta.url));
const buffer=await readFile('configurador-3d/fit-lab/assets/human-female.glb');
const bytes=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
const shortAsset=JSON.parse(await readFile(process.env.SHORT_ASSET||'fit-dist/fit-lab/fixed-shorts.json','utf8'));
const state={...resolveState({bodyHeightCm:145,bodyChestCm:74,bodyHipCm:82,armLoweringDeg:25}),shortsSize:'N1-1',shortsLengthCm:42,shortsRiseCm:33.5};
const sim=await createHumanSimulation(bytes,{shortAsset});sim.prepare(state,1);while(sim.remaining)sim.step();
const frame=sim.frame(true),body=updateHumanBody(await loadHumanBody(bytes),state),garment=createRestGarment(T,garmentForState(state));
const crossings=sidePanelCrossings(body,garment,frame.maps,frame.positions);
if(!process.env.SIMULATION_MODULE)assert.deepEqual(crossings,{left:0,right:0});
const payload={state,positions:Array.from(frame.positions),maps:frame.maps,trims:frame.trims,shorts:{...frame.shorts,positions:Array.from(frame.shorts.positions)}};
const code=`
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from './configurador-3d/fit-lab/human-body.mjs';
import {createHumanAppearance} from './configurador-3d/fit-lab/human-appearance.mjs';
import {createHumanFace} from './configurador-3d/fit-lab/human-face.mjs';
import {createRestGarment} from './configurador-3d/fit-lab/fit-mesh.mjs';
import {garmentForState} from './configurador-3d/fit-lab/garment-catalog.mjs';
import {createGarmentFinish} from './configurador-3d/fit-lab/garment-finish.mjs';
import {createKitDesign} from './configurador-3d/fit-lab/kit-design.mjs';
import {createFixedShortFactory} from './configurador-3d/fit-lab/fixed-shorts.mjs';
import {syncSurfaceTrim} from './configurador-3d/fit-lab/surface-bindings.mjs';
const f=window.REVIEW_FRAME,bytes=Uint8Array.from(atob(window.REVIEW_GLB),c=>c.charCodeAt(0));
const body=updateHumanBody(await loadHumanBody(bytes.buffer),f.state,{collision:false});
const scene=new T.Scene();scene.background=new T.Color('#f3f8fa');scene.add(body);
createHumanAppearance(body);createHumanFace(body);
const garment=createRestGarment(T,garmentForState(f.state)),kit=createKitDesign(T);kit.attach(garment);
const finish=createGarmentFinish(garment,f.maps,body);finish.update(f.positions);
for(const edge of f.trims){const m=garment.getObjectByName(edge.name);if(m){syncSurfaceTrim(m.geometry.attributes.position,edge.bindings,f.positions);m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();}}
scene.add(garment);
const factory=createFixedShortFactory(window.REVIEW_SHORTS),shorts=factory.create(body,{size:f.state.shortsSize,lengthCm:f.state.shortsLengthCm,riseCm:f.state.shortsRiseCm,...kit.snapshot()});shorts.applyFrame(f.shorts);scene.add(shorts.mesh);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(700,900);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.appendChild(renderer.domElement);
scene.add(new T.HemisphereLight(0xf5fcff,0x365267,2.1));for(const[x,y,z,p]of[[-3,5,5,2.7],[4,1,-3,1.4]]){const light=new T.DirectionalLight(0xffffff,p);light.position.set(x,y,z);scene.add(light);}
const half=(body.userData.headTopY-body.userData.floorY)*.53,y=(body.userData.headTopY+body.userData.floorY)/2;
const camera=new T.OrthographicCamera(-half*700/900,half*700/900,half,-half,.01,50);
window.armholeReview={view(angle){camera.position.set(Math.sin(angle)*9,y,Math.cos(angle)*9);camera.lookAt(0,y,0);renderer.render(scene,camera);},snapshot:()=>({finish:finish.snapshot(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};window.armholeReview.view(0);
`;
const result=await build({stdin:{contents:code,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,minify:true});
const html='<html><head><style>body{margin:0}canvas{display:block}</style></head><body><script>window.REVIEW_GLB='+JSON.stringify(buffer.toString('base64'))+';window.REVIEW_FRAME='+JSON.stringify(payload)+';window.REVIEW_SHORTS='+JSON.stringify(shortAsset)+';</script><script type="module">'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';
const browser=await chromium.launch({headless:process.env.REVIEW_HEADED!=='1',...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:700,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent(html);await page.waitForFunction(()=>window.armholeReview,null,{timeout:60000});
 for(const[name,angle]of[['front',0],['right',Math.PI/2],['left',-Math.PI/2],['quarter',1.1]]){await page.evaluate(a=>window.armholeReview.view(a),angle);await page.screenshot({path:dir+'/'+name+'.png'});}
 assert.deepEqual(errors,[]);
 const report={commit:process.env.GITHUB_SHA||'local',simulationVersion:SIMULATION_VERSION,state,pattern:garmentForState(state),steps:frame.diagnostics.steps,pins:frame.diagnostics.pins,sidePanelCrossings:crossings,scope:'Both original side panels against the body; not a global cloth self-collision or physical fit certification',errors,render:await page.evaluate(()=>window.armholeReview.snapshot())};
 await writeFile(dir+'/review.json',JSON.stringify(report,null,2));console.log(JSON.stringify({version:SIMULATION_VERSION,crossings,errors}));
}finally{await browser.close();sim.destroy();body.geometry.dispose();body.material.dispose();garment.traverse(m=>{if(m.isMesh)m.geometry.dispose();});}
