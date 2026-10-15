import * as T from 'three';
import {CM_PER_UNIT} from './body-surface.mjs';
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
/** Clip the actual body topology at two horizontal planes; no disjoint pelvis cylinders. */
function patchGeometry(body,top,bottom,transform,accept=()=>true){
 const attr=body.geometry.attributes.position,index=body.geometry.index.array,positions=[],indices=[],lookup=new Map();
 function clip(poly,level,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ina=above?a.y>=level:a.y<=level,inb=above?b.y>=level:b.y<=level;if(ina)out.push(a);if(ina!==inb){const t=(level-a.y)/(b.y-a.y);out.push({x:a.x+t*(b.x-a.x),y:level,z:a.z+t*(b.z-a.z)});}}return out;}
 for(let i=0;i<index.length;i+=3){let poly=[0,1,2].map(k=>({x:attr.getX(index[i+k]),y:attr.getY(index[i+k]),z:attr.getZ(index[i+k])}));if(!poly.every(accept))continue;poly=clip(clip(poly,top,false),bottom,true);if(poly.length<3)continue;const ids=poly.map(v=>{const p=transform(v),key=p.map(x=>Math.round(x*1e6)).join(',');if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...p);}return lookup.get(key);});for(let k=1;k<ids.length-1;k++)if(new Set([ids[0],ids[k],ids[k+1]]).size===3)indices.push(ids[0],ids[k],ids[k+1]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();return g;
}
// Landmark on the approved adult mesh, not an inferred measurement of the user.
const KNEE_TOP_SOURCE_Y=.53,THIGH_SOURCE_Y=.70;
export const SHORTS_REFERENCE_VERSION='human-relaxed-shorts/1.1';
export function humanShortsLength(body,requested=40){
 const d=body.userData,top=d.sourceToY(1.065),kneeTop=d.sourceToY(KNEE_TOP_SOURCE_Y);
 const clearanceCm=3*d.scale;
 const maxLengthCm=Math.min(60,Math.floor((top-kneeTop)*CM_PER_UNIT-clearanceCm));
 const minLengthCm=Math.min(25,maxLengthCm);
 const requestedLengthCm=Number.isFinite(requested)?requested:40;
 const lengthCm=Math.max(minLengthCm,Math.min(maxLengthCm,requestedLengthCm));
 return {top,bottom:top-lengthCm/CM_PER_UNIT,kneeTop,clearanceCm,minLengthCm,maxLengthCm,requestedLengthCm,lengthCm,clamped:lengthCm!==requestedLengthCm};
}
/** Measure one thigh section; use its envelope down the leg rather than copying muscle taper. */
function thighEnvelope(body,side){
 const d=body.userData,p=body.geometry.attributes.position.array,index=body.geometry.index.array,y=d.sourceToY(THIGH_SOURCE_Y);
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){
  const a=3*index[i+k],b=3*index[i+(k+1)%3],ya=p[a+1],yb=p[b+1];
  if((y-ya)*(y-yb)>=0)continue;
  const t=(y-ya)/(yb-ya),x=side*(p[a]+t*(p[b]-p[a]));if(x<=0)continue;
  const z=p[a+2]+t*(p[b+2]-p[a+2]);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
 }
 if(!Number.isFinite(minX)||maxX<=minX)throw Error('No se encuentra la sección del muslo');
 const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,rx=(maxX-minX)/2,rz=(maxZ-minZ)/2;
 // Design ease, not textile calibration. Keep an inner gap instead of widening the anatomy.
 const ease=1.4*d.scale/CM_PER_UNIT,outerRx=Math.min(rx+ease,cx-.4*d.scale/CM_PER_UNIT);
 return {cx,cz,rx,rz,outerRx,outerRz:rz+ease,easeCm:ease*CM_PER_UNIT};
}
export function createHumanOutfit(body,state,{lengthCm=40,base='#173e64',accent='#f8c12e'}={}){
 const d=body.userData,unit=d.unit,s=d.scale,fit=humanShortsLength(body,lengthCm),{top,bottom}=fit;
 // Release from the upper thigh using a body landmark, independent of the jersey hem.
 const releaseY=d.sourceToY(.785),envelopes={1:thighEnvelope(body,1),'-1':thighEnvelope(body,-1)};
 const geometry=patchGeometry(body,top,bottom,v=>{
  const side=v.x<0?-1:1,e=envelopes[side],drape=smooth((d.sourceToY(.765)-v.y)/(.095*s/unit));
  const loose=smooth((releaseY+.02-v.y)/(.16*s/unit)),r=Math.hypot(v.x,v.z)||1,gap=.0015+loose*.010*s/unit;
  const upperX=v.x+v.x/r*gap,upperZ=v.z+v.z/r*gap;
  const theta=Math.atan2((v.z-e.cz)/e.rz,(side*v.x-e.cx)/e.rx);
  const hangingX=side*(e.cx+e.outerRx*Math.cos(theta)),hangingZ=e.cz+e.outerRz*Math.sin(theta);
  return [upperX+(hangingX-upperX)*drape,v.y,upperZ+(hangingZ-upperZ)*drape];
 },v=>Math.abs(v.x)<.95);
 const a=geometry.attributes.position,main=[],stripe=[];
 for(let i=0;i<geometry.index.count;i+=3){const ids=[0,1,2].map(k=>geometry.index.getX(i+k)),x=ids.reduce((n,j)=>n+a.getX(j),0)/3,z=ids.reduce((n,j)=>n+a.getZ(j),0)/3;((Math.abs(z)<.043*s/unit&&Math.abs(x)>.13*s/unit)?stripe:main).push(...ids);}
 geometry.setIndex([...main,...stripe]);geometry.clearGroups();geometry.addGroup(0,main.length,0);geometry.addGroup(main.length,stripe.length,1);
 const primary=new T.MeshStandardMaterial({color:base,roughness:.87,side:T.DoubleSide}),second=primary.clone();second.color.set(accent);const mesh=new T.Mesh(geometry,[primary,second]);mesh.name='Pantalón · referencia con holgura';
 return {mesh,...fit,version:SHORTS_REFERENCE_VERSION,fit:'relaxed',envelopes,clothSimulated:false,colors(base,accent){primary.color.set(base);second.color.set(accent);},destroy(){geometry.dispose();primary.dispose();second.dispose();}};
}
export function createHumanBustGuide(body){const d=body.userData,top=d.sourceToY(1.34),bottom=d.sourceToY(1.185),g=patchGeometry(body,top,bottom,v=>{const r=Math.hypot(v.x,v.z)||1;return [v.x+v.x/r*.009,v.y,v.z+v.z/r*.009];},v=>Math.abs(v.x)<.65);
 const m=new T.MeshStandardMaterial({color:0x354e6a,roughness:.9,side:T.DoubleSide}),mesh=new T.Mesh(g,m);mesh.name='Guía visual del busto · no prenda simulada';return {mesh,destroy(){g.dispose();m.dispose();}};
}
