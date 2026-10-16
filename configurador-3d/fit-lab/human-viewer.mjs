import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadHumanBody,updateHumanBody,humanSection,HUMAN_VERSION} from './human-body.mjs';
import {createSurfaceNormalReconciler} from './surface-normals.mjs';
import {createHumanAppearance} from './human-appearance.mjs';
import {createHumanFace} from './human-face.mjs';
import {createHumanOutfit,createHumanBustGuide} from './human-outfit.mjs';
import {createRestGarment,CM_PER_UNIT} from './fit-mesh.mjs';
import {syncSurfaceTrim} from './surface-bindings.mjs';
import {createKitDesign} from './kit-design.mjs';
import {GARMENT_CATALOG} from './garment-catalog.mjs';
/** Full human model, one visible geometry and the same indexed geometry in the worker collider. */
export async function createHumanViewer(canvas,initial,onFrame=()=>{}){
 const assetURL=new URL('./assets/human-female.glb',import.meta.url),response=await fetch(assetURL);if(!response.ok)throw Error('No se pudo cargar la base humana');const bytes=await response.arrayBuffer();
 const body=updateHumanBody(await loadHumanBody(bytes),initial,{collision:false}),scene=new T.Scene();scene.add(body);const appearance=createHumanAppearance(body),face=createHumanFace(body);
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 scene.add(new T.HemisphereLight(0xf5fcff,0x365267,2.1));for(const [x,y,z,p]of[[-3,5,5,2.7],[4,1,-3,1.4]]){const l=new T.DirectionalLight(0xffffff,p);l.position.set(x,y,z);scene.add(l);}
 const camera=new T.OrthographicCamera(-2,2,3,-3,.1,50),controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=true;controls.minZoom=.7;controls.maxZoom=1.8;camera.position.set(3,-1,8);controls.target.set(0,-1,0);
 const kit=createKitDesign(T),worker=new Worker(new URL('./human-cloth-worker.mjs',import.meta.url),{type:'module'});let state=initial,revision=1,garment=null,maps=null,trims=null,shorts=null,guide=null,fullView=true,showShorts=true,shortsLengthCm=40,showGuide=false,editing=false,paused=false,disposed=false,contextLost=false;
 let reconcileSurfaceNormals=()=>{},presentedRevision=0,pendingSetup=null,pendingFrame=null,visibleState=initial,unclothedFrames=0,swaps=0;
 let transitionError=null;
 let frameData=null,frames=0,raf=0,dirty=true,lastPhysicsState=null,bodyKey='',outfitKey='',svgCache=null,lastSVGStep=-1,lastSVG=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let flags={body:true,garment:true,transparent:false,dimensions:true,motion:false};
 const counts={bodyBuilds:1,garmentBuilds:0,physicalUpdates:1,outfitBuilds:0,bodyProjections:0,garmentProjections:0,shortsProjections:0,bustGuideBuilds:0},times={body:[],update:[],render:[],sync:[]};
 const diagnostics={maxPenetrationUnits:0,maxTrianglePenetrationUnits:0,contactVertices:0,p95Strain:0,maxStrain:0,particles:0,seams:0,steps:0,maxVelocity:0,pins:0,supportMode:'body-contact',materialCalibrated:false,selfCollision:false};
 const lines=new T.Group(),lineMaterial=new T.LineBasicMaterial({color:0x6ba2b4,transparent:true,opacity:.65});scene.add(lines);
 function record(k,start){const a=times[k];if(a.length>60)a.shift();a.push(performance.now()-start);}
 function invalidate(){dirty=true;if(!raf&&!disposed&&!contextLost&&!document.hidden)raf=requestAnimationFrame(render);}
 function frame(){const d=body.userData,target=fullView?(d.headTopY+d.floorY)/2:(d.shoulderY+d.hipY)/2,offset=camera.position.clone().sub(controls.target);controls.target.set(0,target,0);camera.position.copy(controls.target).add(offset);camera.zoom=1;resize();controls.update();}
 function rebuildLines(){for(const m of [...lines.children]){m.geometry.dispose();lines.remove(m);}const d=body.userData,top=fullView?d.headTopY:d.shoulderY+.2,bottom=fullView?d.floorY:d.hipY-.3,points=[new T.Vector3(-1.12,bottom,0),new T.Vector3(-1.12,top,0)];for(let y=bottom;y<=top;y+=10/CM_PER_UNIT)points.push(new T.Vector3(-1.12,y,0),new T.Vector3(-1.18,y,0));lines.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points),lineMaterial));for(const name of['chest','hip'])lines.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(humanSection(body,name)),lineMaterial));}
 function rebuildOutfit(){const key=JSON.stringify([bodyKey,shortsLengthCm]);if(key===outfitKey&&shorts)return;
  const next=createHumanOutfit(body,visibleState,{lengthCm:shortsLengthCm,...kit.snapshot()});
  const previous=shorts;shorts=next;scene.add(next.mesh);if(previous){scene.remove(previous.mesh);previous.destroy();}
  outfitKey=key;counts.outfitBuilds++;svgCache=null;
 }
 function visual(){body.visible=flags.body&&Boolean(garment);lines.visible=flags.dimensions;shorts.mesh.visible=showShorts&&Boolean(garment);if(guide)guide.mesh.visible=showGuide&&flags.body;if(garment){garment.visible=flags.garment;garment.traverse(m=>{if(!m.isMesh)return;const mat=m.material;mat.transparent=flags.transparent;mat.opacity=flags.transparent?.5:1;mat.depthWrite=!flags.transparent;});}invalidate();}
 function keyOf(s){return JSON.stringify(['bodyChestCm','bodyHipCm','bodyHeightCm','frontVolume','sideVolume','backVolume','armLoweringDeg'].map(k=>s[k]));}
 bodyKey=keyOf(state);
 function update(next){const start=performance.now();counts.physicalUpdates++;
  const changed=keyOf(next)!==keyOf(state)||state.activeConfiguration!==next.activeConfiguration;state=next;
  if(changed){revision++;pendingSetup=null;pendingFrame=null;transitionError=null;worker.postMessage({type:'update',revision,state});}
  // The previous body AND garment remain visible until the replacement is ready.
  visual();record('update',start);onFrame(snapshot());
 }
 function disposeGarment(group=garment){if(!group)return;const materials=new Set();group.traverse(m=>{if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>materials.add(v));}});materials.forEach(m=>m.dispose());}
 function syncGarment(group,frame,bindings,edges,reconcile){
  if(!frame.positions?.length||!Array.from(frame.positions).every(Number.isFinite))throw Error('La nueva camiseta contiene coordenadas no válidas');
  for(const mesh of group.children.filter(x=>x.isMesh&&!x.name.startsWith('trim-'))){
    const p=mesh.geometry.attributes.position,map=bindings[mesh.name];
    if(!map||map.length!==p.count)throw Error('Mapa de camiseta incompleto');
    for(let i=0;i<map.length;i++){const k=map[i]*3;if(k+2>=frame.positions.length)throw Error('Partícula de camiseta fuera de rango');p.setXYZ(i,frame.positions[k],frame.positions[k+1],frame.positions[k+2]);}
    p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
  }
  reconcile();
  for(const {name,bindings:trimBindings}of edges){const mesh=group.getObjectByName(name);if(!mesh)throw Error('Ribete de camiseta incompleto');syncSurfaceTrim(mesh.geometry.attributes.position,trimBindings,frame.positions);mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
 }
 function presentPrepared(frame){
  if(!pendingSetup)throw Error('La camiseta no tiene mapas de preparación');
  const next=createRestGarment(T,GARMENT_CATALOG[frame.state.activeConfiguration]);
  const nextMaps=pendingSetup.maps,nextTrims=pendingSetup.trims;
  const reconcile=createSurfaceNormalReconciler(next.children.filter(x=>x.isMesh&&!x.name.startsWith('trim-')),nextMaps);
  const changed=keyOf(frame.state)!==bodyKey,height=visibleState.bodyHeightCm!==frame.state.bodyHeightCm;
  let stagedBody=null,nextShorts=null,nextGuide=null,committed=false;
  try{
    kit.attach(next,{active:false});syncGarment(next,frame,nextMaps,nextTrims,reconcile);
    // Prepare all fallible construction against a separate body, before touching the scene.
    if(changed){stagedBody=new T.Mesh(body.geometry.clone(),body.material);stagedBody.userData={...body.userData};updateHumanBody(stagedBody,frame.state,{collision:false});}
    const nextKey=JSON.stringify([keyOf(frame.state),shortsLengthCm]);
    if(nextKey!==outfitKey)nextShorts=createHumanOutfit(stagedBody||body,frame.state,{lengthCm:shortsLengthCm,...kit.snapshot()});
    if(changed&&guide)nextGuide=createHumanBustGuide(stagedBody);
    renderer.compile(next,camera,scene);
    // Publish in one JS task: no animation callback can observe an incomplete outfit.
    if(stagedBody){const t=performance.now(),g=body.geometry,sg=stagedBody.geometry;
      g.attributes.position.copy(sg.attributes.position);g.attributes.position.needsUpdate=true;
      g.attributes.normal.copy(sg.attributes.normal);g.attributes.normal.needsUpdate=true;
      g.boundingBox=sg.boundingBox.clone();g.boundingSphere=sg.boundingSphere.clone();body.userData=stagedBody.userData;
      appearance.update();face.update();counts.bodyBuilds++;record('body',t);
    }
    visibleState=frame.state;bodyKey=keyOf(visibleState);
    if(nextShorts){const previous=shorts;shorts=nextShorts;scene.add(shorts.mesh);scene.remove(previous.mesh);previous.destroy();outfitKey=nextKey;counts.outfitBuilds++;}
    if(nextGuide){scene.remove(guide.mesh);guide.destroy();guide=nextGuide;scene.add(guide.mesh);counts.bustGuideBuilds++;}
    if(changed)rebuildLines();
    const previous=garment;garment=next;maps=nextMaps;trims=nextTrims;reconcileSurfaceNormals=reconcile;
    kit.activate(next);scene.add(next);if(previous){scene.remove(previous);disposeGarment(previous);swaps++;}
    committed=true;counts.garmentBuilds++;presentedRevision=revision;pendingSetup=null;pendingFrame=null;svgCache=null;
    if(height)frameCamera();
  }catch(error){if(!committed){disposeGarment(next);if(nextShorts!==shorts)nextShorts?.destroy();if(nextGuide!==guide)nextGuide?.destroy();}throw error;}
  finally{stagedBody?.geometry.dispose();}
 }
 // Alias avoids shadowing the camera framing helper with a Worker frame parameter.
 const frameCamera=frame;
 worker.onmessage=({data:m})=>{if(disposed||m.revision!==revision)return;
  if(m.type==='error'){transitionError=m.message;const e=document.getElementById('scene-error');e.hidden=false;e.textContent=m.message+' Se conserva la última equipación válida.';onFrame(snapshot());return;}
  if(m.type!=='frame')return;const start=performance.now();
  try{
    if(presentedRevision!==revision){
      if(m.maps)pendingSetup={maps:m.maps,trims:m.trims};pendingFrame=m;
      // Do not expose the rest pattern jumping/falling into place during a change.
      if(m.remaining>0){onFrame(snapshot());return;}
      presentPrepared(m);
    }else syncGarment(garment,m,maps,trims,reconcileSurfaceNormals);
    frameData=m;lastPhysicsState=m.state;transitionError=null;document.getElementById('scene-error').hidden=true;record('sync',start);visual();onFrame(snapshot());
  }catch(error){transitionError=error.message;const e=document.getElementById('scene-error');e.hidden=false;e.textContent=error.message+' Se conserva la última equipación válida.';onFrame(snapshot());}
 };
 worker.onerror=e=>{transitionError=e.message;const el=document.getElementById('scene-error');el.hidden=false;el.textContent='Error en la simulación: '+e.message+'. Se conserva la última equipación válida.';onFrame(snapshot());};
 function performanceSnapshot(){const result={};for(const[k,a]of Object.entries(times)){const b=[...a].sort((a,b)=>a-b);result[k]={samples:a.length,meanMs:a.reduce((s,x)=>s+x,0)/(a.length||1),p95Ms:b[Math.floor((b.length-1)*.95)]||0};}return {...result,counts:{...counts},geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,physicsThread:'worker',workerTriangles:body.geometry.index.count/3};}
 function snapshot(){const d=frameData?.diagnostics??diagnostics,m=body.userData.measurements;let min=Infinity,max=-Infinity;if(frameData)for(let i=1;i<frameData.positions.length;i+=3){min=Math.min(min,frameData.positions[i]);max=Math.max(max,frameData.positions[i]);}
  return {state:{...state},appearance:{...appearance.snapshot(),face:face.snapshot()},transition:{pending:presentedRevision!==revision&&!transitionError,presentedRevision,requestedRevision:revision,visibleGarments:garment?1:0,unclothedFrames,swaps,error:transitionError},cloth:{...d,maxPenetrationCm:Math.max(d.maxPenetrationUnits,d.maxTrianglePenetrationUnits)*CM_PER_UNIT,meanGapCm:(d.meanGapUnits||0)*CM_PER_UNIT,meanDropCm:(d.meanDropUnits||0)*CM_PER_UNIT},body:{surfaceVersion:HUMAN_VERSION,armLoweringDeg:body.userData.armLoweringDeg??0,chestCm:m.chestCm,hipCm:m.hipCm,heightCm:m.heightCm,vertices:body.geometry.attributes.position.count,source:'MakeHuman/MPFB CC0',adultReference:true,anthropometryValidated:false,shapeWithinPreset:body.userData.shapeWithinPreset},garment:{code:visibleState.activeConfiguration,restLengthCm:visibleState.garmentLengthCm,hangingHeightCm:frameData?(max-min)*CM_PER_UNIT:state.garmentLengthCm},cmPerUnit:CM_PER_UNIT,frames,paused,editing,sleeping:presentedRevision===revision&&(frameData?.sleeping??false),settling:{active:!transitionError&&(presentedRevision!==revision||!frameData||frameData.remaining>0),remaining:pendingFrame?.remaining??frameData?.remaining??360,total:pendingFrame?.total??frameData?.total??360},design:kit.snapshot(),color:kit.snapshot().base,fullView,outfit:{mode:'human-surface-reference',heightCm:state.bodyHeightCm,shortsLengthCm:shorts.lengthCm,shortsRequestedLengthCm:shorts.requestedLengthCm,shortsMaxLengthCm:shorts.maxLengthCm,shortsMinLengthCm:shorts.minLengthCm,shortsAboveKneeCm:(shorts.bottom-shorts.kneeTop)*CM_PER_UNIT,shortsFit:shorts.fit,shortsVersion:shorts.version,coverage:shorts.coverage,clothSimulated:false,anthropometryValidated:false,floorY:body.userData.floorY,headTopY:body.userData.headTopY},bustGuide:{visible:showGuide,calibrated:false},contact:frameData?.bodyContact??{kind:'same-mesh-bvh'},performance:performanceSnapshot(),workerRevision:revision};
 }
 // Lightweight 2D projection from current render buffers. No raycasts or texture rebuilds per frame.
 function outline(meshes,axis,cx){const top=body.userData.headTopY,bottom=body.userData.floorY,lo=new Float64Array(80).fill(Infinity),hi=new Float64Array(80).fill(-Infinity);for(const mesh of meshes){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);if(!fullView&&(y>1.8||y<body.userData.hipY-.3))continue;const r=Math.max(0,Math.min(79,Math.floor((top-y)/(top-bottom)*80))),x=axis==='x'?a.getX(i):a.getZ(i);lo[r]=Math.min(lo[r],x);hi[r]=Math.max(hi[r],x);}}
  const k=fullView?24:45,start=fullView?top:1.8,left=[],right=[];for(let i=0;i<80;i++)if(Number.isFinite(lo[i])){const y=top-i/80*(top-bottom),yy=(15+(start-y)*k).toFixed(1);left.push((cx+lo[i]*k).toFixed(1)+','+yy);right.push((cx+hi[i]*k).toFixed(1)+','+yy);}return left.length?'M'+left.join('L')+'L'+right.reverse().join('L')+'Z':'';}
 function reference(){const step=frameData?.diagnostics.steps??0;if(svgCache&&step===lastSVGStep)return svgCache;if(svgCache&&performance.now()-lastSVG<600)return svgCache;const shirts=garment?garment.children.filter(m=>m.isMesh&&!m.name.startsWith('trim-')):[];svgCache={bodyFront:outline([body],'x',57),bodySide:outline([body],'z',157),shirtFront:outline(shirts,'x',57),shirtSide:outline(shirts,'z',157),shortsFront:showShorts?outline([shorts.mesh],'x',57):'',shortsSide:showShorts?outline([shorts.mesh],'z',157):''};lastSVGStep=step;lastSVG=performance.now();counts.bodyProjections++;counts.garmentProjections++;return svgCache;}
 function labels(){const d=body.userData;for(const[id,x,y]of[['ruler-label',-1.12,(d.hipY+d.shoulderY)/2],['length-label',.8,d.shoulderY-visibleState.garmentLengthCm/CM_PER_UNIT]]){const el=document.getElementById(id);if(!el)continue;const p=new T.Vector3(x,y,0).project(camera);el.hidden=!flags.dimensions;el.style.left=Math.min(88,Math.max(12,(p.x+1)*50))+'%';el.style.top=((1-p.y)*50)+'%';}}
 function render(){raf=0;if(disposed||contextLost||document.hidden)return;const changed=controls.update();if(dirty||changed){const t=performance.now();labels();if(presentedRevision>0&&flags.garment&&(!garment||!garment.visible))unclothedFrames++;renderer.render(scene,camera);record('render',t);frames++;dirty=false;}if(changed)invalidate();}
 function resize(){const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const half=fullView?visibleState.bodyHeightCm/CM_PER_UNIT*.58:1.65;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();invalidate();}
 function setOutfit(next){if(next.fullView!==undefined)fullView=next.fullView;if(next.showShorts!==undefined)showShorts=next.showShorts;if(next.shortsLengthCm!==undefined)shortsLengthCm=next.shortsLengthCm;rebuildOutfit();rebuildLines();svgCache=null;frame();visual();onFrame(snapshot());}
 function pauseWorker(){worker.postMessage({type:'pause',value:paused||editing||document.hidden||contextLost});}
 const visibility=()=>{pauseWorker();invalidate();};document.addEventListener('visibilitychange',visibility);const preference=()=>{flags.motion=false;worker.postMessage({type:'wind',value:false});};reduced.addEventListener('change',preference);
 const lost=e=>{e.preventDefault();contextLost=true;pauseWorker();},restored=()=>{contextLost=false;pauseWorker();invalidate();};canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
 const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);controls.addEventListener('change',invalidate);
 rebuildOutfit();rebuildLines();frame();visual();worker.postMessage({type:'init',bytes,state,revision},[bytes]);
 return {update,snapshot,reference,setOutfit,setBustGuide(value){showGuide=value;if(value&&!guide){guide=createHumanBustGuide(body);scene.add(guide.mesh);counts.bustGuideBuilds++;}visual();onFrame(snapshot());},setEditing(value){editing=value;pauseWorker();invalidate();},setDesign(value){kit.update(value);shorts.colors(kit.snapshot().base,kit.snapshot().accent);invalidate();},setColor(base){kit.update({base});shorts.colors(base,kit.snapshot().accent);invalidate();},setVisual(next){Object.assign(flags,next);worker.postMessage({type:'wind',value:flags.motion&&!reduced.matches});visual();onFrame(snapshot());},view(name){const v={front:[0,0,8],side:[8,0,0],back:[0,0,-8],quarter:[4,0,8]}[name]||[4,0,8];camera.position.set(v[0],controls.target.y+v[1],v[2]);controls.update();invalidate();},impulse(){worker.postMessage({type:'impulse'});},settle(){worker.postMessage({type:'settle'});},pause(value){paused=value;pauseWorker();onFrame(snapshot());},destroy(){disposed=true;worker.terminate();observer.disconnect();cancelAnimationFrame(raf);controls.dispose();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);disposeGarment();kit.destroy();shorts.destroy();guide?.destroy();appearance.destroy();face.destroy();body.geometry.dispose();body.material.dispose();for(const l of lines.children)l.geometry.dispose();lineMaterial.dispose();renderer.dispose();}};
}
