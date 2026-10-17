import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {CM_PER_UNIT} from './body-surface.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,fixedShortKey,normalizeShortCode} from './fixed-sizes.mjs';
export const FIXED_SHORTS_VERSION='fixed-shorts-envelope/2.1';
/** Perimeter of an indexed triangle section; source torso membership excludes arms. */
export function horizontalPerimeter(geometry,y,base=null){
 const p=geometry.attributes.position,idx=geometry.index;let length=0;
 for(let f=0;f<idx.count;f+=3){
  const ids=[idx.getX(f),idx.getX(f+1),idx.getX(f+2)];if(base&&ids.some(i=>Math.abs(base[i*3])>=.205))continue;
  const hit=[];for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],ya=p.getY(a),yb=p.getY(b);if((ya<=y&&yb>y)||(yb<=y&&ya>y)){const t=(y-ya)/(yb-ya);hit.push([p.getX(a)+t*(p.getX(b)-p.getX(a)),p.getZ(a)+t*(p.getZ(b)-p.getZ(a))]);}}
  if(hit.length===2)length+=Math.hypot(hit[0][0]-hit[1][0],hit[0][1]-hit[1][1]);
 }
 return length*CM_PER_UNIT;
}
/** Normal view assumes an explicitly tied drawstring. It is a kinematic
 * boundary condition, not a measured elastic model. The rest pattern is fixed. */
export function shortSupport(body,pattern){
 const d=body.userData,waistY=d.waistY;
 if(!Number.isFinite(waistY)||!Number.isFinite(pattern.waistCm)||!Number.isFinite(pattern.hipCm))throw Error('Referencia de cintura inválida');
 const waist=horizontalPerimeter(body.geometry,waistY,d.base),hip=d.measurements.hipCm;
 const blocked=waist>pattern.waistCm+.4||hip>pattern.hipCm+.4;
 return {status:blocked?'too-small':'tied',blocked,waistCm:waist,hipCm:hip,
  startY:waistY,stopY:waistY,dropCm:0,kind:'tied-drawstring-constraint',
  excessWaistCm:Math.max(0,pattern.waistCm-waist),waistband:pattern.waistband,
  attachmentAssumed:true,elasticityModelled:false,clothSimulated:false};
}
/** Gather only the upper 12 cm. Y, rise, length and all lower vertices are
 * unchanged. Render vertices are a dressed state; templates stay immutable. */
export function gatherWaist(geometry,body,pattern){
 const base=body.userData.base,bodyGeometry=body.geometry;
 const source=new T.BufferGeometry();source.setAttribute('position',bodyGeometry.attributes.position.clone());
 const ids=[],index=bodyGeometry.index;
 for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
  if([a,b,c].every(j=>Math.abs(base[j*3])<.205&&base[j*3+1]>.86&&base[j*3+1]<1.24))ids.push(a,b,c);
 }
 source.setIndex(ids);const tree=new MeshBVH(source),ray=new T.Ray(new T.Vector3(),new T.Vector3());
 const p=geometry.attributes.position,waistY=body.userData.waistY,depthCm=12,ringSamples=128,rows=12;
 const radii=new Float32Array((rows+1)*ringSamples),clearance=.25/CM_PER_UNIT;
 let adjustedVertices=0,maxOffsetCm=0;
 try{
  // Rays begin in the torso and exit at the actual body, never the nearby arm.
  for(let row=0;row<=rows;row++)for(let col=0;col<ringSamples;col++){
   const angle=col*2*Math.PI/ringSamples;ray.origin.set(0,waistY-row*depthCm/rows/CM_PER_UNIT,0);ray.direction.set(Math.sin(angle),0,Math.cos(angle));
   const hit=tree.raycastFirst(ray,T.DoubleSide);if(!hit)throw Error('No se encuentra la superficie de cintura');
   radii[row*ringSamples+col]=Math.hypot(hit.point.x,hit.point.z);
  }
  for(let i=0;i<p.count;i++){
   const depth=-p.getY(i)*CM_PER_UNIT;if(depth<-.01||depth>=depthCm)continue;
   const x=p.getX(i),z=p.getZ(i),radius=Math.hypot(x,z);if(radius<1e-8)continue;
   const angle=(Math.atan2(x,z)+2*Math.PI)%(2*Math.PI),column=angle/(2*Math.PI)*ringSamples;
   const c=Math.floor(column)%ringSamples,u=column-Math.floor(column),c1=(c+1)%ringSamples;
   const rr=Math.max(0,depth/depthCm*rows),row=Math.min(rows-1,Math.floor(rr)),v=rr-row;
   const r0=radii[row*ringSamples+c]*(1-u)+radii[row*ringSamples+c1]*u;
   const r1=radii[(row+1)*ringSamples+c]*(1-u)+radii[(row+1)*ringSamples+c1]*u;
   const bodyRadius=r0*(1-v)+r1*v;
   const t=Math.min(1,Math.max(0,depth/depthCm)),weight=1-t*t*(3-2*t);
   const gathered=Math.min(radius,bodyRadius+clearance);
   const target=Math.max(bodyRadius+clearance,radius+(gathered-radius)*weight);
   if(Math.abs(target-radius)>1e-7){p.setX(i,x*target/radius);p.setZ(i,z*target/radius);adjustedVertices++;maxOffsetCm=Math.max(maxOffsetCm,Math.abs(target-radius)*CM_PER_UNIT);}
  }
 }finally{source.dispose();}
 p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {method:'local-tied-waist-gather',depthCm,clearanceCm:.25,adjustedVertices,maxOffsetCm,
  restPatternChanged:false,bodyChanged:false,lengthChanged:false,elasticityValidated:false};
}
/** Immutable authored templates, independently cloned and dressed for display. */
export function createFixedShortFactory(asset){
 if(asset?.version!==FIXED_SHORTS_VERSION||!asset.patterns)throw Error('Faltan patrones fijos del pantalón');
 const templates=new Map();
 for(const[size]of Object.entries(SHORT_SIZES))for(const length of SHORT_LENGTHS){
  const key=fixedShortKey(size,length),v=asset.patterns[key];
  if(!v||v.positions.length%3||v.indices.length%3||!v.positions.every(Number.isFinite)||!v.indices.every(i=>Number.isInteger(i)&&i>=0&&i<v.positions.length/3))throw Error('Patrón fijo no válido: '+key);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.positions,3));g.setIndex(v.indices);if(v.uvs)g.setAttribute('uv',new T.Float32BufferAttribute(v.uvs,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();for(const q of v.groups)g.addGroup(q.start,q.count,q.materialIndex);
  if(Math.abs((g.boundingBox.max.y-g.boundingBox.min.y)*CM_PER_UNIT-length)>.02)throw Error('Largo de patrón inconsistente');templates.set(key,{geometry:g,pattern:v.nominal});
 }
 return{
  create(body,{size='N1-2',lengthCm=42,base='#173e64',accent='#f8c12e'}={}){
   size=normalizeShortCode(size);const key=fixedShortKey(size,Number(lengthCm)),template=templates.get(key),pattern=template.pattern,support=shortSupport(body,pattern);
   if(support.blocked)throw Error('Pantalón '+size+' demasiado pequeño. El amarre no amplía el patrón; selecciona otra configuración.');
   const geometry=template.geometry.clone(),waistGather=gatherWaist(geometry,body,pattern),primary=new T.MeshStandardMaterial({color:base,roughness:.87,side:T.DoubleSide}),secondary=primary.clone();secondary.color.set(accent);
   // Smooth colour boundaries are independent of triangle resolution.
   const stripeColor={value:new T.Color(accent)};
   primary.onBeforeCompile=shader=>{
    shader.uniforms.shortStripeColor=stripeColor;
    shader.vertexShader='varying vec3 shortLocalPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshortLocalPosition=position;');
    shader.fragmentShader='varying vec3 shortLocalPosition;\nuniform vec3 shortStripeColor;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat shortStripe=(1.0-smoothstep(0.045,0.052,abs(shortLocalPosition.z)))*smoothstep(0.25,0.35,abs(shortLocalPosition.x));\ndiffuseColor.rgb=mix(diffuseColor.rgb,shortStripeColor,shortStripe);');
   };
   primary.customProgramCacheKey=()=>FIXED_SHORTS_VERSION+'-stripe';
   const mesh=new T.Mesh(geometry,[primary,secondary]);mesh.name='Pantalón fijo '+key;mesh.position.y=support.startY;
   return{mesh,version:FIXED_SHORTS_VERSION,fit:'fixed-size',lengthCm:pattern.lengthCm,requestedLengthCm:pattern.lengthCm,minLengthCm:34,maxLengthCm:50,kneeTop:body.userData.sourceToY(.53),pattern,support,
    coverage:{bodyHidden:false,bodyGeometryChanged:false,garmentAdaptedToBody:true,restPatternChanged:false,adaptation:"waistband-only"},clothSimulated:false,
    get top(){return mesh.position.y;},get bottom(){return mesh.position.y-pattern.lengthCm/CM_PER_UNIT;},get moving(){return false;},
    advance(){mesh.position.y=support.startY;return false;},
    settle(){mesh.position.y=support.startY;},
    snapshot:()=>({key,nominal:{...pattern},support:{...support},translationY:mesh.position.y,moving:false,restGeometryIndependent:true,waistGather:{...waistGather},clothSimulated:false}),
    colors(base,accent){primary.color.set(base);secondary.color.set(accent);stripeColor.value.set(accent);},destroy(){geometry.dispose();primary.dispose();secondary.dispose();}};
  },destroy(){for(const p of templates.values())p.geometry.dispose();templates.clear();}
 };
}
