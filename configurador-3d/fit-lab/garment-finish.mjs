import * as T from 'three';
import {MeshBVH,SAH} from 'three-mesh-bvh';
import {createOptimizedHumanCollider} from './static-mesh-query.mjs';
import {createSurfaceNormalReconciler} from './surface-normals.mjs';
import {CM_PER_UNIT} from './body-surface.mjs';
export const GARMENT_FINISH_VERSION='continuous-garment-edges/1.0';
const mix=(a,b,t)=>({ids:[a,b],weights:[1-t,t]});
const single=id=>({ids:[id],weights:[1]});
/** Render finishing only. The simulated pattern, torso folds and body are not edited. */
export function createGarmentFinish(group,maps,body){
 const front=group.getObjectByName('NUBYRA_Test_Jersey_Front');
 const cols=front.geometry.userData.halfColumns,rows=front.geometry.userData.gridRows,stride=cols+1,halfSize=(rows+1)*stride;
 const panels={front:maps.NUBYRA_Test_Jersey_Front,back:maps.NUBYRA_Test_Jersey_Back};
 const at=(panel,half,row,col)=>panels[panel][half*halfSize+row*stride+col];
 const shoulder=half=>maps['NUBYRA_Test_Shoulder_'+(half?'Right':'Left')];
 const edge=(panel,half,q)=>{const r=Math.min(rows-1,Math.max(0,Math.floor(q)));return mix(at(panel,half,r,cols),at(panel,half,r+1,cols),q-r);};
 const underarm=(.39+1.22)/2.31*rows,replaced=name=>name.includes('armhole')||name.endsWith('-neck');
 const original=group.children.filter(m=>m.isMesh&&m.name.startsWith('trim-')&&replaced(m.name));
 const material=original[0].material.clone();material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;
 for(const mesh of original){group.remove(mesh);mesh.geometry.dispose();}
 const loops=[],seams=[],surfaces=[],rawMeshes=[];let lastSeamGap=0,maxContactOffset=0;
 const collisionGeometry=body.geometry.clone();collisionGeometry.boundsTree=body.geometry.boundsTree?MeshBVH.deserialize(MeshBVH.serialize(body.geometry.boundsTree),collisionGeometry):new MeshBVH(collisionGeometry,{strategy:SAH,maxLeafTris:10});
 const collider=createOptimizedHumanCollider({geometry:collisionGeometry,userData:body.userData});
 const ray=new T.Ray(new T.Vector3(),new T.Vector3());
 function projectPoint(p,orientation=0,margin=.018){
  const ox=p.x,oy=p.y,oz=p.z;
  for(let pass=0;pass<4;pass++){const hit=collider.project(p.x,p.y,p.z,margin);if(!hit)break;p.set(hit[0],hit[1],hit[2]);}
  if(collider.gap(p.x,p.y,p.z)<margin*.4){
   const sign=orientation||(p.z>=0?1:-1);ray.origin.set(p.x,p.y,sign*4);ray.direction.set(0,0,-sign);
   const hit=collisionGeometry.boundsTree.raycastFirst(ray,T.DoubleSide);if(hit&&(hit.point.z-p.z)*sign<.35)p.z=hit.point.z+sign*margin;
  }
  maxContactOffset=Math.max(maxContactOffset,Math.hypot(p.x-ox,p.y-oy,p.z-oz));return p;
 }
 const sample=(entry,positions,out)=>{out.set(0,0,0);for(let i=0;i<entry.ids.length;i++){const k=entry.ids[i]*3,w=entry.weights[i];out.x+=positions[k]*w;out.y+=positions[k+1]*w;out.z+=positions[k+2]*w;}return out;};
 function loop(name,bindings,radius){
  const segments=Math.max(96,bindings.length*4),radial=8,pos=new Float32Array((segments+1)*(radial+1)*3),indices=[];
  for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){const a=i*(radial+1)+j,b=a+radial+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));geometry.setIndex(indices);
  const mesh=new T.Mesh(geometry,material);mesh.name=name;group.add(mesh);loops.push({mesh,bindings,radius,segments,radial,points:bindings.map(()=>new T.Vector3())});
 }
 const neck=[];
 function neckHalf(panel,half,reverse){
  const mesh=group.getObjectByName('NUBYRA_Test_Jersey_'+(panel==='front'?'Front':'Back')),p=mesh.geometry.attributes.position;
  let start=rows;for(let r=0;r<=rows;r++)if(Math.abs(p.getX(half*halfSize+r*stride))>1e-6){start=Math.max(0,r-1);break;}
  const list=[];for(let r=start;r<=rows;r++)list.push({...single(at(panel,half,r,0)),orientation:panel==='front'?1:-1});return reverse?list.reverse():list;
 }
 neck.push(...neckHalf('front',0,true),...neckHalf('front',1,false).slice(1));
 for(let d=1;d<=6;d++)neck.push(single(shoulder(1)[d*stride]));
 neck.push(...neckHalf('back',1,true).slice(1),...neckHalf('back',0,false).slice(1));
 for(let d=5;d>=1;d--)neck.push(single(shoulder(0)[d*stride]));
 loop('trim-neck-continuous',neck,.007);
 for(let half=0;half<2;half++){
  const bindings=[{...edge('front',half,underarm),orientation:1}];
  for(let r=Math.ceil(underarm);r<=rows;r++)bindings.push({...single(at('front',half,r,cols)),orientation:1});
  for(let d=1;d<=6;d++)bindings.push(single(shoulder(half)[d*stride+cols]));
  for(let r=rows-1;r>=Math.ceil(underarm);r--)bindings.push({...single(at('back',half,r,cols)),orientation:-1});
  bindings.push({...edge('back',half,underarm),orientation:-1});
  const side=maps['NUBYRA_Test_Side_'+(half?'Right':'Left')];
  for(let c=4;c>=1;c--)bindings.push(single(side[14*6+c]));
  loop('trim-armhole-'+(half?'right':'left')+'-continuous',bindings,.007);
  for(const panel of['front','back']){
   const cuts=new Set([0,underarm]);for(let r=1;r<underarm;r++)cuts.add(r);for(let r=1;r<14;r++)cuts.add(underarm*r/14);
   const nodes=[...cuts].sort((a,b)=>a-b),pairs=nodes.map(q=>{const sr=q/underarm*14,r=Math.min(13,Math.floor(sr)),c=panel==='front'?0:5;return[edge(panel,half,q),mix(side[r*6+c],side[(r+1)*6+c],sr-r)];});
   const geometry=new T.BufferGeometry(),positions=new Float32Array(nodes.length*6),indices=[];
   for(let i=0;i<nodes.length-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
   geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setIndex(indices);
   const mesh=new T.Mesh(geometry,material);mesh.name='trim-side-join-'+half+'-'+panel;group.add(mesh);seams.push({mesh,pairs});
  }
 }
 for(const mesh of group.children.filter(m=>m.isMesh&&!m.name.startsWith('trim-'))){
  const source=mesh.geometry,p=source.attributes.position,uv=source.attributes.uv,idx=source.index.array,map=maps[mesh.name];
  const entries=[],coords=[],tex=[],ids=[];
  for(let k=0;k<idx.length;k+=3){
   const tri=[idx[k],idx[k+1],idx[k+2]],upper=tri.some(i=>p.getY(i)>.20),n=upper?4:1,local=[];
   for(let i=0;i<=n;i++){local[i]=[];for(let j=0;j<=n-i;j++){
    const weights=[1-(i+j)/n,i/n,j/n],id=entries.length;local[i][j]=id;entries.push({ids:tri.map(i=>map[i]),vertexIndices:tri,weights,upper});coords.push(0,0,0);
    tex.push(weights.reduce((v,w,t)=>v+w*uv.getX(tri[t]),0),weights.reduce((v,w,t)=>v+w*uv.getY(tri[t]),0));
   }}
   for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){ids.push(local[i][j],local[i+1][j],local[i][j+1]);if(j<n-i-1)ids.push(local[i+1][j],local[i+1][j+1],local[i][j+1]);}
  }
  const geometry=new T.BufferGeometry();geometry.userData={...source.userData};geometry.setAttribute('position',new T.Float32BufferAttribute(coords,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.Float32BufferAttribute(tex,2));geometry.setIndex(ids);mesh.geometry=geometry;
  const raw=new T.Mesh(source);raw.name=mesh.name;rawMeshes.push(raw);surfaces.push({mesh,entries,raw,map,orientation:mesh.name.endsWith('Front')?1:mesh.name.endsWith('Back')?-1:0});
 }
 const reconcile=createSurfaceNormalReconciler(rawMeshes,maps),tangent=new T.Vector3(),axis=new T.Vector3(),normal=new T.Vector3(),point=new T.Vector3(),linear=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();
 const expectedLength=(Math.max(...Object.values(maps).flat())+1)*3;
 function update(positions){
  if(!positions||positions.length!==expectedLength||!positions.every(Number.isFinite))throw Error('Invalid garment frame');maxContactOffset=0;
  for(const{raw,map}of surfaces){const out=raw.geometry.attributes.position;map.forEach((id,i)=>out.setXYZ(i,positions[id*3],positions[id*3+1],positions[id*3+2]));raw.geometry.computeVertexNormals();}reconcile();
  for(const{mesh,entries,raw,orientation}of surfaces){
   const out=mesh.geometry.attributes.position,normals=raw.geometry.attributes.normal;
   if(!mesh.geometry.attributes.normal)mesh.geometry.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(entries.length*3),3));const dest=mesh.geometry.attributes.normal;
   entries.forEach((e,i)=>{sample(e,positions,point);if(e.upper)projectPoint(point,orientation);out.setXYZ(i,point.x,point.y,point.z);normal.set(0,0,0);e.vertexIndices.forEach((id,j)=>normal.addScaledVector(a.fromBufferAttribute(normals,id),e.weights[j]));normal.normalize();dest.setXYZ(i,normal.x,normal.y,normal.z);});
   out.needsUpdate=true;dest.needsUpdate=true;mesh.geometry.computeBoundingSphere();
  }
  for(const item of loops){
   item.bindings.forEach((entry,i)=>projectPoint(sample(entry,positions,item.points[i]),entry.orientation||0));
   const curve=new T.CatmullRomCurve3(item.points,true,'centripetal'),out=item.mesh.geometry.attributes.position;
   for(let i=0;i<=item.segments;i++){
    const t=i/item.segments,q=t*item.points.length,j=Math.floor(q)%item.points.length,f=q-Math.floor(q);
    linear.copy(item.points[j]).lerp(item.points[(j+1)%item.points.length],f);curve.getPoint(t,point);a.subVectors(point,linear);if(a.length()>.012)point.copy(linear).addScaledVector(a,.012/a.length());projectPoint(point,item.bindings[j].orientation||0,item.radius+.018);
    curve.getTangent(t,tangent);axis.set(0,0,1);if(Math.abs(tangent.dot(axis))>.9)axis.set(1,0,0);normal.crossVectors(tangent,axis).normalize();axis.crossVectors(normal,tangent).normalize();
    for(let k=0;k<=item.radial;k++){const angle=k/item.radial*Math.PI*2,c=Math.cos(angle)*item.radius,s=Math.sin(angle)*item.radius;b.set(point.x+normal.x*c+axis.x*s,point.y+normal.y*c+axis.y*s,point.z+normal.z*c+axis.z*s);projectPoint(b,item.bindings[j].orientation||0,.012);out.setXYZ(i*(item.radial+1)+k,b.x,b.y,b.z);}
   }
   for(let k=0;k<=item.radial;k++)out.setXYZ(item.segments*(item.radial+1)+k,out.getX(k),out.getY(k),out.getZ(k));
   out.needsUpdate=true;item.mesh.geometry.computeVertexNormals();item.mesh.geometry.computeBoundingSphere();
  }
  lastSeamGap=0;for(const{mesh,pairs}of seams){const out=mesh.geometry.attributes.position;pairs.forEach(([left,right],i)=>{projectPoint(sample(left,positions,a));projectPoint(sample(right,positions,b));lastSeamGap=Math.max(lastSeamGap,a.distanceTo(b));out.setXYZ(i*2,a.x,a.y,a.z);out.setXYZ(i*2+1,b.x,b.y,b.z);});out.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
 }
 return{update,replaces:replaced,destroy(){collisionGeometry.dispose();for(const raw of rawMeshes)raw.geometry.dispose();},snapshot:()=>({version:GARMENT_FINISH_VERSION,continuousLoops:loops.length,maxContourOffsetCm:.012*CM_PER_UNIT,seamGapCm:lastSeamGap*CM_PER_UNIT,maxContactOffsetCm:maxContactOffset*CM_PER_UNIT,upperContactFinish:true,bodyChanged:false,torsoPanelsSmoothed:false})};
}
