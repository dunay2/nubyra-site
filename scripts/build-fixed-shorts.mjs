import * as T from 'three';
import {writeFile} from 'node:fs/promises';
import {SHORT_RISES,shortRiseKey} from '../configurador-3d/fit-lab/pattern-registry.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,fixedShortKey} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {FIXED_SHORTS_VERSION,horizontalPerimeter} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
const mix=(a,b,t)=>a+(b-a)*t,clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const ellipseRadius=(circ,k)=>circ/(Math.PI*(3*(1+k)-Math.sqrt((3+k)*(1+3*k))));
/** Fixed four-panel short: one waist opening, two free hems; no avatar input. */
export function authorShortPattern(size,lengthCm,riseCm=33.5){
 const hipDepth=19,waistRx=ellipseRadius(size.waistCm,.70),hipRx=ellipseRadius(size.hipCm,.64),hipRz=hipRx*.64;
 const depths=[...new Set([0,...Array.from({length:16},(_,i)=>(i+1)*riseCm/16),hipDepth,...Array.from({length:6},(_,i)=>riseCm+(i+1)*(lengthCm-riseCm)/6)])].sort((a,b)=>a-b);
 const cols=12,positions=[],indices=[],lookup=new Map();
 for(const side of[-1,1])for(const front of[-1,1]){const grid=[];
  for(const d of depths){const upper=smooth(d/hipDepth),split=smooth((d-hipDepth)/(riseCm-hipDepth)),outer=mix(waistRx,hipRx,upper),angle=mix(Math.PI/2,Math.PI,split);let rx=outer/(1-Math.cos(angle)),cx=outer-rx,rz=mix(mix(waistRx*.70,hipRz,upper),hipRz*.86,split);
   if(d>riseCm){const t=clamp((d-riseCm)/(lengthCm-riseCm)),gap=.6*smooth(t/.3);rx=(hipRx-gap)/2+.20*t;cx=gap+rx;rz=hipRz*.86+.15*t;}
   const row=[];for(let j=0;j<=cols;j++){const theta=angle*(1-j/cols),xyz=[side*(cx+rx*Math.cos(theta))/CM_PER_UNIT,-d/CM_PER_UNIT,front*rz*Math.sin(theta)/CM_PER_UNIT];if(j===cols)xyz[2]=0;if(j===0&&d<=riseCm)xyz[0]=0;if(j===0&&d>=riseCm)xyz[2]=0;const key=xyz.map(v=>Math.round(v*1e7)).join(':');if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...xyz);}row.push(lookup.get(key));}grid.push(row);
  }
  for(let i=0;i<grid.length-1;i++)for(let j=0;j<cols;j++){const a=grid[i][j],b=grid[i][j+1],c=grid[i+1][j],d=grid[i+1][j+1];for(const tri of [[a,b,c],[b,d,c]])if(new Set(tri).size===3){if(side*front>0)tri.reverse();indices.push(...tri);}}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);
 for(let pass=0;pass<3;pass++){const wr=size.waistCm/horizontalPerimeter(g,-.00001),hr=size.hipCm/horizontalPerimeter(g,-hipDepth/CM_PER_UNIT+.000001),p=g.attributes.position;for(let i=0;i<p.count;i++){const t=smooth(-p.getY(i)*CM_PER_UNIT/hipDepth),scale=mix(wr,hr,t);p.setX(i,p.getX(i)*scale);p.setZ(i,p.getZ(i)*scale);}}
 const result={positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array),groups:[{start:0,count:g.index.count,materialIndex:0}],nominal:{...size,patternId:`shorts/${size.code}/L${lengthCm}/R${riseCm}`,patternVersion:'4.0',lengthCm,riseCm,riseReferenceCm:riseCm,measuredWaistCm:horizontalPerimeter(g,-.00001),measuredHipCm:horizontalPerimeter(g,-hipDepth/CM_PER_UNIT+.000001),geometrySource:'authored-four-panel-short',riseIndependentOfLength:true,bodyDerived:false}};g.dispose();return result;
}
export async function buildFixedShorts(destination){const patterns={},riseVariants={};for(const size of Object.values(SHORT_SIZES))for(const length of SHORT_LENGTHS)for(const rise of SHORT_RISES.filter(r=>r<=length-.5)){const key=shortRiseKey(size.code,length,rise),result=authorShortPattern(size,length,rise);if(rise===33.5)patterns[fixedShortKey(size.code,length)]=result;else riseVariants[key]=result;}await writeFile(destination,JSON.stringify({version:FIXED_SHORTS_VERSION,industrialApproved:false,patterns,riseVariants}));}
