/** Metric synthetic bodies, fixed garment rest shapes and stitched cloth topology. */
import {createFreeTestJersey} from '../free-test-jersey.mjs';
import {ClothSolver} from './cloth-solver.mjs';
import {DEMO_CLOTH} from './cloth-material.mjs';
import {bindTrimToSurface,syncSurfaceTrim} from './surface-bindings.mjs';
import {CM_PER_UNIT,createCollider} from './body-surface.mjs';
export {CM_PER_UNIT,createBody,updateBody,createCollider,ringPerimeter} from './body-surface.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const ellipseA=(c,k=.58)=>c/(Math.PI*(3*(1+k)-Math.sqrt((3+k)*(1+3*k))))/CM_PER_UNIT;
/**
 * Two physical shoulder bridges: they share both upper edge loops of the
 * sampled front/back meshes, not a solver-only invisible triangle shortcut.
 * Their material rest shape is independent of the current body.
 */
function appendShoulderBridges(T,garment){
 const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
 const back=garment.getObjectByName('NUBYRA_Test_Jersey_Back');
 const {gridRows:rows,halfColumns:cols}=front.geometry.userData;
 const f=front.geometry.getAttribute('position'),b=back.geometry.getAttribute('position');
 const depthRows=6,verticesPerHalf=(rows+1)*(cols+1);
 for(let half=0;half<2;half++){
  const pos=[],uv=[],indices=[];
  const sourceOffset=half*verticesPerHalf+rows*(cols+1);
  for(let depth=0;depth<=depthRows;depth++){
   const t=depth/depthRows;
   for(let col=0;col<=cols;col++){
    const id=sourceOffset+col;
    const x=lerp(f.getX(id),b.getX(id),t);
    const y=lerp(f.getY(id),b.getY(id),t)+.045*Math.sin(Math.PI*t);
    const z=lerp(f.getZ(id),b.getZ(id),t);
    pos.push(x,y,z);uv.push(col/cols,t);
   }
  }
  for(let depth=0;depth<depthRows;depth++)for(let col=0;col<cols;col++){
   const a=depth*(cols+1)+col,d=a+cols+1;
   if(half===1)indices.push(a,a+1,d,a+1,d+1,d);
   else indices.push(a,d,a+1,a+1,d,d+1);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,front.material);
  mesh.name=half===0?'NUBYRA_Test_Shoulder_Left':'NUBYRA_Test_Shoulder_Right';
  mesh.userData={kind:'shoulder-fabric',half,depthRows,columns:cols};
  garment.add(mesh);
 }
}
export function createRestGarment(T,configuration){
 const garment=createFreeTestJersey(T);
 // Resolution budget: retain the authored topology, sample a regular simulation grid.
 for(const mesh of garment.children.filter(m=>!m.name.startsWith('trim-'))){
  const panel=mesh.name.includes('Jersey_'),front=mesh.name.endsWith('Front'),oldRows=panel?48:28,oldCols=panel?15:10,rows=panel?24:14,cols=panel?8:5,halves=panel?2:1;
  const old=mesh.geometry,p=old.getAttribute('position'),uv=old.getAttribute('uv'),pos=[],tex=[],index=[];
  for(let half=0;half<halves;half++){
   const start=pos.length/3;
   for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
    const i=half*(oldRows+1)*(oldCols+1)+Math.round(r*oldRows/rows)*(oldCols+1)+Math.round(c*oldCols/cols);
    pos.push(p.getX(i),p.getY(i),p.getZ(i));tex.push(uv.getX(i),uv.getY(i));
   }
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=start+r*(cols+1)+c,b=a+cols+1;
    if(!panel||front===(half===1))index.push(a,a+1,b,a+1,b+1,b);else index.push(a,b,a+1,a+1,b,b+1);
   }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(tex,2));g.setIndex(index);g.userData={gridRows:rows,halfColumns:cols};g.computeVertexNormals();mesh.geometry=g;old.dispose();
 }
 garment.traverse(mesh=>{
  if(!mesh.isMesh)return;const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y0=p.getY(i),z=p.getZ(i),t=clamp((y0+.98)/1.25);
   const c=lerp(configuration.hipCm,configuration.chestCm,t)*(1-.05*Math.pow(Math.sin(Math.PI*t),2));
   const upper=1-.16*clamp((y0-.39)/.81),a=ellipseA(c)*upper,angle=Math.atan2(z,x);
   // Upper pattern proportions are not an elliptical circumference: the
   // old radial remap enlarged the neck opening to the shoulder girth.
   const tUpper=clamp((y0-.50)/.60),blend=tUpper*tUpper*(3-2*tUpper);
   const grade=Math.pow(configuration.chestCm/102,.25);
   const upperX=x*1.25*grade,upperZ=z*.95*grade;
   p.setXYZ(i,lerp(a*Math.cos(angle),upperX,blend),1.20-(1.20-y0)*configuration.lengthCm/64,lerp(a*.58*Math.sin(angle),upperZ,blend));
  }
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
 });appendShoulderBridges(T,garment);garment.userData.patternVersion='neck-shoulder-pattern-v3';return garment;
}
/** Initial dressing only: lift shoulder cloth above its collider; no permanent supports. */
function dressingTranslation(rest,ids,collider){
 let lift=0;
 for(const id of ids){const k=id*3;lift=Math.max(lift,collider.surfaceHeight(rest[k],rest[k+2])+.04-rest[k+1]);}
 return [0,lift,0];
}
export function createClothAdapter(garment,body,{colliderFactory=createCollider,material=DEMO_CLOTH,clearance=.007}={}){
 const positions=[],lookup=new Map(),maps=new Map(),edges=new Map(),opposites=new Map(),seams=[],triangles=[];
 const surfaces=garment.children.filter(m=>m.isMesh&&!m.name.startsWith('trim-'));
 for(const mesh of surfaces){
  const p=mesh.geometry.getAttribute('position'),map=[];
  for(let i=0;i<p.count;i++){
   const xyz=[p.getX(i),p.getY(i),p.getZ(i)],key=xyz.map(v=>Math.round(v*1e5)).join(',');
   if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...xyz);}map.push(lookup.get(key));
  }maps.set(mesh.name,map);
  const index=mesh.geometry.index.array;
  for(let k=0;k<index.length;k+=3){const tri=[map[index[k]],map[index[k+1]],map[index[k+2]]];triangles.push(tri);
   for(let a=0;a<3;a++){const i=tri[a],j=tri[(a+1)%3],key=i<j?i+':'+j:j+':'+i;if(i===j)continue;edges.set(key,[i,j]);const opp=opposites.get(key)||[];opp.push(tri[(a+2)%3]);opposites.set(key,opp);}
  }
 }
 for(const side of ['Left','Right'])for(const front of [true,false]){
  const sideMap=maps.get('NUBYRA_Test_Side_'+side),panel=maps.get('NUBYRA_Test_Jersey_'+(front?'Front':'Back')),offset=side==='Left'?0:25*9;
  for(let row=0;row<=14;row++){
   const y=-1.22+1.61*row/14,q=(y+1.22)/2.31*24,k=Math.min(23,Math.floor(q));
   const s=sideMap[row*6+(front?0:5)],a=panel[offset+k*9+8],b=panel[offset+(k+1)*9+8];if(s!==a&&s!==b)seams.push({s,a,b,t:q-k});
  }
 }
 const shoulderIds=new Set(garment.children.filter(m=>m.userData.kind==='shoulder-fabric').flatMap(m=>maps.get(m.name)));
 const collider=colliderFactory(body);
 const bends=[...opposites.values()].filter(v=>v.length===2&&v[0]!==v[1]).map(v=>[v[0],v[1],shoulderIds.has(v[0])||shoulderIds.has(v[1]) ? material.shoulderBendDistanceComplianceMPerN : material.bendDistanceComplianceMPerN]);
 const initialTranslation=dressingTranslation(positions,shoulderIds,collider);
 const solver=new ClothSolver({positions,triangles,edges:[...edges.values()],bends,seams,pins:[],collider,initialTranslation,material,clearance});
 const trims=[];
 for(const mesh of garment.children.filter(m=>m.isMesh&&m.name.startsWith('trim-'))){
  const panel=garment.getObjectByName('NUBYRA_Test_Jersey_'+(mesh.name.includes('front')?'Front':'Back'));
  trims.push({mesh,bindings:bindTrimToSurface(mesh,panel,maps.get(panel.name),positions)});
 }
 // Precompute welded normal incidence once; reuse the geometry buffers during motion.
 const incidence=new Map();
 for(const mesh of surfaces){const n=mesh.geometry.getAttribute('normal'),map=maps.get(mesh.name);for(let i=0;i<map.length;i++){if(!incidence.has(map[i]))incidence.set(map[i],[]);incidence.get(map[i]).push({n,i});}}
 const weldedNormals=[...incidence.values()].filter(group=>group.length>1);
 function reconcileSurfaceNormals(){
  for(const group of weldedNormals){let nx=0,ny=0,nz=0;for(const {n,i} of group){nx+=n.getX(i);ny+=n.getY(i);nz+=n.getZ(i);}const length=Math.hypot(nx,ny,nz)||1;for(const {n,i} of group)n.setXYZ(i,nx/length,ny/length,nz/length);}
  for(const mesh of surfaces)mesh.geometry.getAttribute('normal').needsUpdate=true;
 }
 function sync(){
  const s=solver.positions;
  for(const mesh of surfaces){const p=mesh.geometry.getAttribute('position'),map=maps.get(mesh.name);for(let i=0;i<map.length;i++){const k=map[i]*3;p.setXYZ(i,s[k],s[k+1],s[k+2]);}p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
  reconcileSurfaceNormals();
  for(const {mesh,bindings} of trims){syncSurfaceTrim(mesh.geometry.getAttribute('position'),bindings,s);mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
 }
 return {solver,sync,maps,surfaces,trims,
  retarget(nextBody){const nextCollider=colliderFactory(nextBody);solver.setCollider(nextCollider,[]);solver.resetRestPose(dressingTranslation(solver.rest,shoulderIds,nextCollider));}
 };
}
