import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {SKIN_COLOR} from './human-appearance.mjs';

export const FACE_VERSION='human-face/2.2-relaxed-rims';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};

/** Appearance-only details on the approved head. No body/collider vertex is edited. */
export function createHumanFace(body){
 const base=body.userData.base,index=body.geometry.index;
 if(!base||!index||!body.geometry.attributes.position)throw Error('La cara necesita la base humana indexada');
 const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(base.slice(),3));
 const ids=[];let anchor=-1;
 for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(tri.every(j=>base[j*3+1]>1.49))ids.push(...tri);}
 for(let i=0;i<base.length;i+=3)if(base[i+1]>1.65){anchor=i/3;break;}
 if(anchor<0)throw Error('No se encuentra la referencia de la cabeza');
 source.setIndex(ids);source.computeVertexNormals();
 const tree=new MeshBVH(source,{maxLeafTris:8}),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
 const positions=[],colors=[],indices=[],eyeCoords=[],groups=[],eyeVertexRanges=[];
 const skin=new T.Color(SKIN_COLOR),warmSkin=skin.clone().lerp(new T.Color('#b87867'),.12);
 const brown=new T.Color('#3c2c23'),sclera=new T.Color('#cbc3b7'),iris=new T.Color('#64432d'),pupil=new T.Color('#131510');
 const pointCache=new Map();let sampleQueries=0;
 function sample(x,y){
  const key=x.toFixed(7)+':'+y.toFixed(7);if(pointCache.has(key))return pointCache.get(key).clone();
  ray.origin.set(x,y,.5);const hit=tree.raycastFirst(ray,T.DoubleSide);sampleQueries++;
  if(!hit)throw Error('Detalle facial fuera de la cabeza');
  pointCache.set(key,hit.point.clone());return hit.point.clone();
 }
 // One draw group for skin details, one for the optical eye surface. Positions
 // in eyeCoord are millimetric source offsets, independent of grid resolution.
 function grid(nx,ny,point,color,kind=0,center=null){
  const start=positions.length/3,indexStart=indices.length;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   const u=-1+2*i/nx,v=j/ny,p=point(u,v),c=color(u,v,p);
   positions.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);
   eyeCoords.push(center?p.x-center.x:0,center?p.y-center.y:0);
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=start+j*(nx+1)+i,b=a+nx+1;indices.push(a,a+1,b,a+1,b+1,b);}
  groups.push({start:indexStart,count:indices.length-indexStart,materialIndex:kind});
  return {start,count:positions.length/3-start};
 }
 let eyeVertices=0,browHairs=0;
 try{
  for(const side of[-1,1]){
   const cx=.0315*side,cy=1.5895,halfWidth=.0125;
   // Fixed outer samples sit on the actual skin, outside the empty socket.
   // Never use a stepped depth search per vertex: it produced vertical stripes.
   const bounds=u=>{const arch=Math.max(0,1-u*u)**.66,tilt=side*u*.00065;return {bottom:cy-.0032*arch+tilt,top:cy+.0031*arch+tilt,arch};};
   const rimCache=new Map();
   function rimAt(u){
    if(rimCache.has(u))return rimCache.get(u);
    const x=cx+u*halfWidth,{bottom,top,arch}=bounds(u);
    const lower=sample(x,cy-.0075),upper=sample(x,cy+.0075);
    // Endpoints converge at the canthi; central lid depth remains continuous.
    const end=u<0?-1:1;const corner=sample(cx+end*halfWidth,cy+side*end*.00065);
    const endBlend=smooth((Math.abs(u)-.4)/.6);
    const lowerZ=lower.z+(corner.z-lower.z)*endBlend;
    const upperZ=upper.z+(corner.z-upper.z)*endBlend;
    const value={x,bottom,top,arch,lower,upper,lowerZ,upperZ};rimCache.set(u,value);return value;
   }
   function ocularPoint(u,v){const q=rimAt(u);return new T.Vector3(q.x,q.bottom+(q.top-q.bottom)*v,q.lowerZ+(q.upperZ-q.lowerZ)*v+.00085*q.arch*Math.sin(Math.PI*v)+.00040);}
   const eye=grid(48,12,ocularPoint,(_,v,p)=>{
    const r=Math.hypot(p.x-cx,p.y-cy),c=r<.00185?pupil.clone():r<.0051?iris.clone():sclera.clone();
    return c.multiplyScalar(1-.16*smooth((v-.56)/.44));
   },1,{x:cx,y:cy});eyeVertexRanges.push(eye);eyeVertices+=eye.count;
   // Upper/lower lids meet the ocular cap, then blend into the real rim. They
   // cover only the socket boundary: neither larger eyes nor a face decal.
   for(const upper of[false,true])grid(48,6,(u,v)=>{
    const q=rimAt(u),edge=ocularPoint(u,upper?1:0),outer=upper?q.upper:q.lower;
    const p=edge.clone().lerp(outer,v);p.y=edge.y+(outer.y-edge.y)*v*q.arch;p.z+=.00025*Math.sin(Math.PI*v)*q.arch+.00015;
    return p;
   },(u,v)=>warmSkin.clone().lerp(skin,smooth(v)).multiplyScalar(1-.11*(1-v)*Math.max(0,1-u*u)));
   // Individual tapered brow strokes instead of the old dark polygonal stripe.
   for(let i=0;i<54;i++){
    const t=(i+.5)/54,phase=i*2.399,arch=Math.sin(Math.PI*t)**.5;
    const x=side*(.014+.036*t),y=1.602+.0038*Math.sin(Math.PI*t)-.0014*t;
    const length=(.0020+.0012*Math.sin(phase)**2)*arch;
    grid(2,3,(u,v)=>sample(x+side*(.0006*v+u*.00027*arch*(1-v)),y+(v-.4)*length).add(new T.Vector3(0,0,.00055)),
     (_,v)=>brown.clone().lerp(skin,smooth((v-.70)/.30)*.45+(1-arch)*.16));browHairs++;
   }
  }
  // Relaxed mouth. The two lips converge on a narrow, curved neutral seam;
  // no open black wedge, hard contour or artificial permanent smile.
  const mouthCache=new Map();
  function mouth(u){
   if(mouthCache.has(u))return mouthCache.get(u);
   const x=u*.022,arch=Math.max(0,1-u*u),centre=1.523+.0012*u*u;
   const upperY=centre+.0105*arch**.7-.0025*Math.exp(-((u/.20)**2));
   const lowerY=centre-.0110*arch**.7;
   const top=sample(x,upperY),bottom=sample(x,lowerY);
   const contactZ=(sample(x,centre+.0015).z+sample(x,centre-.0015).z)/2+.00065;
   const value={x,arch,centre,upperY,lowerY,top,bottom,contactZ};mouthCache.set(u,value);return value;
  }
  for(const upper of[false,true])grid(48,8,(u,v)=>{
   const q=mouth(u),outer=upper?q.top:q.bottom,edgeY=upper?q.upperY:q.lowerY;
   const innerY=q.centre+(upper?.00018:-.00018)*q.arch;
   const y=innerY+(edgeY-innerY)*v,p=sample(q.x,y);
   const bridge=q.contactZ+(outer.z-q.contactZ)*smooth(v)+.0006*Math.sin(Math.PI*v)*q.arch;
   p.z=Math.max(p.z+.00045,bridge);return p;
  },(u,v)=>{
   const pigment=new T.Color(upper?'#ae7e71':'#ba8b7c'),boundary=smooth((v-.68)/.32);
   return pigment.lerp(skin,boundary*.94).multiplyScalar(1-.055*(1-v)*Math.max(0,1-u*u));
  });
  grid(48,2,(u,v)=>{const q=mouth(u);return new T.Vector3(q.x,q.centre+(v-.5)*.00040*q.arch,q.contactZ-.00008);},
   u=>new T.Color('#78584b').lerp(skin,Math.abs(u)**7));
 }finally{source.dispose();pointCache.clear();}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('eyeCoord',new T.Float32BufferAttribute(eyeCoords,2));
 const batched=[],drawGroups=[];for(const kind of[0,1]){const start=batched.length;for(const g of groups)if(g.materialIndex===kind)for(let i=g.start;i<g.start+g.count;i++)batched.push(indices[i]);drawGroups.push({start,count:batched.length-start,materialIndex:kind});}
 geometry.setIndex(batched);geometry.userData.eyeVertexRanges=eyeVertexRanges;geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.80,metalness:0,side:T.DoubleSide});
 const ocular=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.27,metalness:0,clearcoat:.28,clearcoatRoughness:.22,side:T.DoubleSide});
 // Continuous fragment pigment avoids faceted/pixelated pupils when zooming.
 ocular.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec2 eyeCoord; varying vec2 vEyeCoord;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeCoord=eyeCoord;');
  shader.fragmentShader='varying vec2 vEyeCoord;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float r=length(vEyeCoord),a=atan(vEyeCoord.y,vEyeCoord.x),aa=max(fwidth(r),0.000025);
   float irisMask=1.0-smoothstep(0.0049-aa,0.0049+aa,r);
   float pupilMask=1.0-smoothstep(0.00185-aa,0.00185+aa,r);
   float limbus=1.0-smoothstep(0.00515-aa,0.00515+aa,r);
   float fibres=0.91+0.065*sin(a*43.0+r*4800.0)+0.025*sin(a*79.0-r*6500.0);
   vec3 eyeWhite=vec3(0.597,0.546,0.474);
   vec3 irisPigment=mix(vec3(0.16,0.087,0.040),vec3(0.088,0.044,0.019),smoothstep(0.002,0.0049,r))*fibres;
   vec3 pigment=mix(eyeWhite,vec3(0.034,0.023,0.016),limbus);
   pigment=mix(pigment,irisPigment,irisMask);
   pigment=mix(pigment,vec3(0.006,0.007,0.005),pupilMask);
   pigment*=1.0-0.16*smoothstep(0.0008,0.0037,vEyeCoord.y);
   diffuseColor.rgb=diffuse* pigment;
  `);
 };
 ocular.customProgramCacheKey=()=>FACE_VERSION+'-continuous-iris';
 for(const g of drawGroups)geometry.addGroup(g.start,g.count,g.materialIndex);
 const mesh=new T.Mesh(geometry,[material,ocular]);mesh.name='avatar-facial-details';
 const group=new T.Group();group.name='avatar-face';group.add(mesh);body.add(group);let destroyed=false;
 // Very restrained skin variation, only on the face; no texture download or
 // per-frame geometry work. The original material hooks are restored on dispose.
 const previousCompile=body.material.onBeforeCompile,previousKey=body.material.customProgramCacheKey;
 const localScale={value:1},localOffset={value:new T.Vector3()};
 const skinCompile=function(shader,renderer){
  previousCompile.call(this,shader,renderer);
  shader.uniforms.faceSourceScale=localScale;shader.uniforms.faceSourceOffset=localOffset;
  shader.vertexShader='uniform float faceSourceScale; uniform vec3 faceSourceOffset; varying vec3 vFaceSource;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFaceSource=(position-faceSourceOffset)/faceSourceScale;');
  shader.fragmentShader='varying vec3 vFaceSource;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float faceMask=smoothstep(1.49,1.53,vFaceSource.y)*(1.0-smoothstep(1.64,1.67,vFaceSource.y))*smoothstep(0.045,0.085,vFaceSource.z);
   float cheek=exp(-pow((abs(vFaceSource.x)-0.048)/0.022,2.0)-pow((vFaceSource.y-1.564)/0.024,2.0));
   diffuseColor.rgb*=mix(vec3(1.0),vec3(1.022,0.986,0.983),faceMask*cheek);
  `);
 };
 body.material.onBeforeCompile=skinCompile;body.material.customProgramCacheKey=function(){return previousKey.call(this)+'-'+FACE_VERSION;};body.material.needsUpdate=true;
 function update(){
  if(destroyed)return;const scale=body.userData.scale/body.userData.unit,p=body.geometry.attributes.position,i=anchor*3;
  if(!Number.isFinite(scale)||scale<=0)throw Error('Escala facial inválida');
  group.scale.setScalar(scale);group.position.set(p.getX(anchor)-base[i]*scale,p.getY(anchor)-base[i+1]*scale,p.getZ(anchor)-base[i+2]*scale);group.updateMatrix();
  localScale.value=scale;localOffset.value.copy(group.position);
 }
 update();return {group,update,snapshot:()=>({version:FACE_VERSION,eyes:true,eyebrows:true,lips:true,eyeSurface:'eyelid-rim-cap',eyeVertices,
  gaze:'parallel-forward',irisRadiusMm:4.9,pupilRadiusMm:1.85,eyelids:true,orbitalRimVerified:true,browHairs,expression:'relaxed-neutral',continuousEyePigment:true,continuousRims:true,depthSearchSteps:0,constructionVertices:positions.length/3,drawBatches:2,
  extraTextureRequests:0,sampleQueries,bodyGeometryChanged:false,bodyMeasurementsChanged:false,clothChanged:false}),destroy(){
  if(destroyed)return;destroyed=true;body.remove(group);geometry.dispose();material.dispose();ocular.dispose();
  if(body.material.onBeforeCompile===skinCompile){body.material.onBeforeCompile=previousCompile;body.material.customProgramCacheKey=previousKey;body.material.needsUpdate=true;}
 }};
}
