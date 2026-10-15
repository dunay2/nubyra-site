import * as T from 'three';
import {CM_PER_UNIT} from './body-surface.mjs';
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
/** Clip the actual body topology at two horizontal planes; no disjoint pelvis cylinders. */
function patchGeometry(body,top,bottom,transform,accept=()=>true){
 const attr=body.geometry.attributes.position,index=body.geometry.index.array,positions=[],indices=[],lookup=new Map(),normals=body.geometry.attributes.normal;
 function clip(poly,level,above){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ina=above?a.y>=level:a.y<=level,inb=above?b.y>=level:b.y<=level;if(ina)out.push(a);if(ina!==inb){const t=(level-a.y)/(b.y-a.y);out.push({x:a.x+t*(b.x-a.x),y:level,z:a.z+t*(b.z-a.z)});}}return out;}
 for(let i=0;i<index.length;i+=3){let poly=[0,1,2].map(k=>({x:attr.getX(index[i+k]),y:attr.getY(index[i+k]),z:attr.getZ(index[i+k])}));if(!poly.every(accept))continue;poly=clip(clip(poly,top,false),bottom,true);if(poly.length<3)continue;const ids=poly.map(v=>{const p=transform(v),key=p.map(x=>Math.round(x*1e6)).join(',');if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...p);}return lookup.get(key);});for(let k=1;k<ids.length-1;k++)if(new Set([ids[0],ids[k],ids[k+1]]).size===3)indices.push(ids[0],ids[k],ids[k+1]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();return g;
}
export function createHumanOutfit(body,state,{lengthCm=40,base='#173e64',accent='#f8c12e'}={}){
 const d=body.userData,unit=d.unit,s=d.scale,top=d.sourceToY(1.065),bottom=top-lengthCm/CM_PER_UNIT,split=d.sourceToY(.785),hem=1.20-state.garmentLengthCm/CM_PER_UNIT;
 const geometry=patchGeometry(body,top,bottom,v=>{
  const below=smooth((split-v.y)/(.15*s/unit)),loose=smooth((hem+.02-v.y)/(.16*s/unit));
  const center=Math.sign(v.x)*.11*s/unit*Math.pow(d.hipFactor,.35),rx=v.x-center,rz=v.z-.003*s/unit;
  const r=Math.hypot(rx,rz)||1;
  const expansion=loose*(.017*s/unit+Math.max(0,.083*s/unit-r)*below);
  const nX=below?rx/r:v.x/Math.max(.02,Math.hypot(v.x,v.z)),nZ=below?rz/r:v.z/Math.max(.02,Math.hypot(v.x,v.z));
  const gap=.0015+expansion;return [v.x+nX*gap,v.y,v.z+nZ*gap];
 },v=>Math.abs(v.x)<.95);
 const a=geometry.attributes.position,main=[],stripe=[];
 for(let i=0;i<geometry.index.count;i+=3){const ids=[0,1,2].map(k=>geometry.index.getX(i+k)),x=ids.reduce((n,j)=>n+a.getX(j),0)/3,z=ids.reduce((n,j)=>n+a.getZ(j),0)/3;((Math.abs(z)<.043*s/unit&&Math.abs(x)>.13*s/unit)?stripe:main).push(...ids);}
 geometry.setIndex([...main,...stripe]);geometry.clearGroups();geometry.addGroup(0,main.length,0);geometry.addGroup(main.length,stripe.length,1);
 const primary=new T.MeshStandardMaterial({color:base,roughness:.87,side:T.DoubleSide}),second=primary.clone();second.color.set(accent);const mesh=new T.Mesh(geometry,[primary,second]);mesh.name='Pantalón · referencia con holgura';
 return {mesh,lengthCm,top,bottom,colors(base,accent){primary.color.set(base);second.color.set(accent);},destroy(){geometry.dispose();primary.dispose();second.dispose();}};
}
export function createHumanBustGuide(body){const d=body.userData,top=d.sourceToY(1.34),bottom=d.sourceToY(1.185),g=patchGeometry(body,top,bottom,v=>{const r=Math.hypot(v.x,v.z)||1;return [v.x+v.x/r*.009,v.y,v.z+v.z/r*.009];},v=>Math.abs(v.x)<.65);
 const m=new T.MeshStandardMaterial({color:0x354e6a,roughness:.9,side:T.DoubleSide}),mesh=new T.Mesh(g,m);mesh.name='Guía visual del busto · no prenda simulada';return {mesh,destroy(){g.dispose();m.dispose();}};
}
