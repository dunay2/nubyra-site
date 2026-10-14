import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createBody,updateBody,createRestGarment,createClothAdapter,ringPerimeter,CM_PER_UNIT} from './fit-mesh.mjs';
import {GARMENT_CATALOG} from './garment-catalog.mjs';
export function createFitViewer(canvas,initial,onFrame=()=>{}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xeefaff,0x283c51,2.2));
 for(const [x,y,z,power] of [[-3,5,4,3],[4,1,-4,1.8]]){const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(x,y,z);scene.add(light);}
 const body=updateBody(createBody(THREE),initial);scene.add(body);let garment,adapter,state=initial,flags={body:true,garment:true,transparent:false,dimensions:true,motion:false};
 const camera=new THREE.OrthographicCamera(-1.8,1.8,1.8,-1.8,.1,40);camera.position.set(3,0,6);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,-.15,0);controls.enablePan=false;controls.enableDamping=true;controls.minZoom=.65;controls.maxZoom=1.7;controls.minPolarAngle=.8;controls.maxPolarAngle=2.3;
 const dimensions=new THREE.Group();scene.add(dimensions);const dimensionMaterial=new THREE.LineBasicMaterial({color:0x4a8297,transparent:true,opacity:.65,depthTest:false});
 const rulerPoints=[];for(let cm=0;cm<=80;cm+=10){const y=1.2-cm/CM_PER_UNIT;rulerPoints.push(new THREE.Vector3(-1.12,y,0),new THREE.Vector3(-1.17,y,0));}rulerPoints.push(new THREE.Vector3(-1.12,1.2,0),new THREE.Vector3(-1.12,1.2-80/CM_PER_UNIT,0));
 dimensions.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rulerPoints),dimensionMaterial));
 const ringLines=[];for(let n=0;n<2;n++){const line=new THREE.LineLoop(new THREE.BufferGeometry(),dimensionMaterial);dimensions.add(line);ringLines.push(line);}
 let disposed=false,raf=0,lastTime=null,frames=0,quietFrames=0,paused=false,lastEmit=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function disposeGarment(){if(!garment)return;scene.remove(garment);const mats=new Set();garment.traverse(m=>{if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>mats.add(v));}});mats.forEach(m=>m.dispose());}
 function updateRings(){const p=body.geometry.getAttribute('position');[29,4].forEach((row,n)=>{const points=[];for(let a=0;a<56;a++){const i=row*57+a;points.push(new THREE.Vector3(p.getX(i)*1.016,p.getY(i),p.getZ(i)*1.016));}ringLines[n].geometry.dispose();ringLines[n].geometry=new THREE.BufferGeometry().setFromPoints(points);});}
 function visual(){body.visible=flags.body;garment.visible=flags.garment;dimensions.visible=flags.dimensions;garment.traverse(m=>{if(!m.isMesh)return;const materials=Array.isArray(m.material)?m.material:[m.material];for(const mat of materials){mat.transparent=flags.transparent;mat.opacity=flags.transparent?.5:1;mat.depthWrite=!flags.transparent;mat.needsUpdate=true;}});adapter.solver.wind=flags.motion&&!reduced.matches;}
 function update(next){
  state=next;updateBody(body,state);updateRings();
  if(!adapter||garment.userData.configuration!==state.activeConfiguration){
   disposeGarment();garment=createRestGarment(THREE,GARMENT_CATALOG[state.activeConfiguration]);garment.userData.configuration=state.activeConfiguration;scene.add(garment);adapter=createClothAdapter(garment,body);adapter.solver.settle(55);
  }else{
   adapter.retarget(body);if(reduced.matches)adapter.solver.settle(40);
  }
  quietFrames=0;adapter.sync();visual();onFrame(snapshot());
 }
 function snapshot(){
  const d=adapter.solver.diagnostics(),p=adapter.solver.positions;let minY=Infinity,maxY=-Infinity;for(let i=1;i<p.length;i+=3){minY=Math.min(minY,p[i]);maxY=Math.max(maxY,p[i]);}
  const bp=body.geometry.getAttribute('position'),xs=[],zs=[];for(let i=29*57;i<30*57;i++){xs.push(bp.getX(i));zs.push(bp.getZ(i));}
  return {state:{...state},cloth:{...d,maxPenetrationCm:Math.max(d.maxPenetrationUnits,d.maxTrianglePenetrationUnits)*CM_PER_UNIT,meanGapCm:d.meanGapUnits*CM_PER_UNIT,meanDropCm:d.meanDropUnits*CM_PER_UNIT},body:{surfaceVersion:body.userData.version,shoulderWidthCm:2*body.userData.shoulderHalfWidth*CM_PER_UNIT,neckBaseY:body.userData.neckBaseY,shoulderY:body.userData.shoulderY,chestCm:ringPerimeter(body,29),hipCm:ringPerimeter(body,4),widthCm:(Math.max(...xs)-Math.min(...xs))*CM_PER_UNIT,frontDepthCm:Math.max(...zs)*CM_PER_UNIT,backDepthCm:-Math.min(...zs)*CM_PER_UNIT},garment:{code:state.activeConfiguration,restLengthCm:state.garmentLengthCm,hangingHeightCm:(maxY-minY)*CM_PER_UNIT},cmPerUnit:CM_PER_UNIT,paused,frames};
 }
 function outline(meshes,axis,center){
  const points=[],coord=axis==='x'?0:2;let top=-Infinity,bottom=Infinity;
  for(const m of meshes){const a=m.geometry.getAttribute('position').array;for(let i=1;i<a.length;i+=3){top=Math.max(top,a[i]);bottom=Math.min(bottom,a[i]);}}
  for(let row=0;row<=40;row++){
   const y=top-.00001-(top-bottom-.00002)*row/40;let min=Infinity,max=-Infinity;
   for(const m of meshes){const a=m.geometry.getAttribute('position').array,index=m.geometry.index.array;
    for(let i=0;i<index.length;i+=3)for(let e=0;e<3;e++){
     const u=index[i+e]*3,v=index[i+(e+1)%3]*3,y0=a[u+1],y1=a[v+1];if((y-y0)*(y-y1)>0||Math.abs(y1-y0)<1e-9)continue;
     const value=a[u+coord]+(a[v+coord]-a[u+coord])*(y-y0)/(y1-y0);min=Math.min(min,value);max=Math.max(max,value);
    }
   }if(Number.isFinite(min))points.push({y,min,max});
  }
  const f=(v,y)=>`${(center+v*45).toFixed(1)},${(25+(1.2-y)*45).toFixed(1)}`;
  return points.length?'M'+points.map(b=>f(b.min,b.y)).join(' L')+' L'+points.reverse().map(b=>f(b.max,b.y)).join(' L')+'Z':'';
 }
 function reference(){return {bodyFront:outline([body],'x',57),bodySide:outline([body],'z',157),shirtFront:outline(adapter.surfaces,'x',57),shirtSide:outline(adapter.surfaces,'z',157)};}
 function resize(){const {clientWidth:w,clientHeight:h}=canvas.parentElement;if(!w||!h)return;renderer.setSize(w,h,false);const half=2.05;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
 function emitLabels(){
  const labels=[['ruler-label',-1.12,-.22,0],['length-label',.9,-1.25,.05]];
  for(const [id,x,y,z] of labels){const el=document.getElementById(id);if(!el)continue;const p=new THREE.Vector3(x,y,z).project(camera);el.style.left=Math.max(12,Math.min(88,(p.x+1)*50))+'%';el.style.top=(1-p.y)*50+'%';el.hidden=!flags.dimensions||p.z>1;}
 }
 function tick(time){
  if(disposed)return;const dt=lastTime===null?0:Math.min((time-lastTime)/1000,1/30);lastTime=time;
  if(!document.hidden&&!paused&&!reduced.matches&&(adapter.solver.wind||quietFrames<160)){
   adapter.solver.advance(dt);adapter.sync();quietFrames=adapter.solver.maxVelocity<.02?quietFrames+1:0;
  }
  controls.update();emitLabels();renderer.render(scene,camera);frames++;
  if(time-lastEmit>350){onFrame(snapshot());lastEmit=time;}
  raf=requestAnimationFrame(tick);
 }
 const visibility=()=>{lastTime=null;};document.addEventListener('visibilitychange',visibility);
 const preference=()=>{adapter.solver.wind=flags.motion&&!reduced.matches;if(reduced.matches){adapter.solver.settle(30);adapter.sync();}lastTime=null;onFrame(snapshot());};reduced.addEventListener('change',preference);
 update(initial);controls.update();raf=requestAnimationFrame(tick);
 return {update,snapshot,reference,setVisual(next){Object.assign(flags,next);if(!flags.body&&!flags.garment)flags.garment=true;visual();quietFrames=0;},view(name){const v={front:[0,0,6],side:[6,0,0],back:[0,0,-6],quarter:[3,0,6]}[name]||[3,0,6];camera.position.set(...v);controls.update();},impulse(){if(!reduced.matches){adapter.solver.impulse();quietFrames=0;}},settle(){adapter.solver.settle(60);adapter.sync();quietFrames=160;onFrame(snapshot());},pause(value){paused=Boolean(value);lastTime=null;},destroy(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);disposeGarment();body.geometry.dispose();body.material.dispose();dimensions.children.forEach(x=>x.geometry.dispose());dimensionMaterial.dispose();renderer.dispose();}};
}
