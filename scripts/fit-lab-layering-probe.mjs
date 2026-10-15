import * as T from 'three';
import {createBody,updateBody,createRestGarment,createClothAdapter,CM_PER_UNIT} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {createOutfitReference} from '../configurador-3d/fit-lab/outfit-reference.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
export function garmentSection(meshes,y){
 const segments=[];
 for(const mesh of meshes){const a=mesh.geometry.attributes.position.array,index=mesh.geometry.index.array;
  for(let i=0;i<index.length;i+=3){const pts=[];
   for(let e=0;e<3;e++){const u=index[i+e]*3,v=index[i+(e+1)%3]*3,dy=a[v+1]-a[u+1];if(Math.abs(dy)<1e-9)continue;const t=(y-a[u+1])/dy;if(t<0||t>1)continue;pts.push([a[u]+t*(a[v]-a[u]),a[u+2]+t*(a[v+2]-a[u+2])]);}
   if(pts.length>=2)segments.push([pts[0],pts[1]]);
  }
 }
 return (x,z)=>{const r=Math.hypot(x,z);if(r<1e-8)return Infinity;const c=x/r,s=z/r;let out=Infinity;
  for(const [a,b] of segments){const dx=b[0]-a[0],dz=b[1]-a[1],den=c*dz-s*dx;if(Math.abs(den)<1e-9)continue;const d=(a[0]*dz-a[1]*dx)/den,t=(a[0]*s-a[1]*c)/den;if(d>0&&t>=0&&t<=1)out=Math.min(out,d);}
  return out;
 };
}
export function measureLayers(outfit,adapter,body=null){let overlap=0,worst=0,samples=0,addedWorst=0,bodyIntersectionSamples=0;const rows=[],cache=new Map();
 for(const m of outfit.shortsMeshes){const p=m.geometry.attributes.position,{rows:count,around}=m.geometry.userData,used=new Set(m.geometry.index?.array??Array.from({length:p.count},(_,i)=>i));
  for(let r=0;r<=count;r++){const y=p.getY(r*(around+1));let n=0,bad=0,max=0;
   for(let a=0;a<around;a++){const i=r*(around+1)+a;if(!used.has(i))continue;const sy=p.getY(i),key=sy.toFixed(7);if(!cache.has(key))cache.set(key,[garmentSection(adapter.surfaces,sy),body?garmentSection([body],sy):null]);const [section,bodySection]=cache.get(key);const x=p.getX(i),z=p.getZ(i),shirt=section(x,z);if(!Number.isFinite(shirt))continue;const excess=(Math.hypot(x,z)-shirt)*CM_PER_UNIT;const bodyRadius=bodySection?.(x,z),existing=Number.isFinite(bodyRadius)?Math.max(0,bodyRadius-shirt)*CM_PER_UNIT:0;if(existing>0)bodyIntersectionSamples++;addedWorst=Math.max(addedWorst,excess-existing);if(excess>0){bad++;overlap++;max=Math.max(max,excess);worst=Math.max(worst,excess);}n++;samples++;}
   if(bad)rows.push({name:m.name,r,y:+y.toFixed(3),bad,n,maxCm:+max.toFixed(3)});
  }
 }
 return {samples,overlap,worstCm:+worst.toFixed(3),addedProtrusionCm:+addedWorst.toFixed(3),bodyIntersectionSamples,rows};
}
if(import.meta.url===`file://${process.argv[1]}`){const report=[];
 for(const [name,params] of [['default',{}],['reported',{bodyChestCm:117,bodyHipCm:72,desiredLengthCm:52,bodyHeightCm:143,selectionMode:'manual',activeConfiguration:'N1-1'}],['large',{bodyChestCm:113,bodyHipCm:130,desiredLengthCm:64}],['loose',{bodyChestCm:72,bodyHipCm:74,selectionMode:'manual',activeConfiguration:'N2-3'}]]){
  const s=resolveState(params),body=updateBody(createBody(T),s),shirt=createRestGarment(T,GARMENT_CATALOG[s.activeConfiguration]),adapter=createClothAdapter(shirt,body);adapter.solver.settle(90);adapter.sync();const outfit=createOutfitReference(T,body,s),measure=measureLayers(outfit,adapter,body);
  report.push({name,state:s,layering:measure});console.log(JSON.stringify({name,code:s.activeConfiguration,layout:outfit.layout,...measure}));
 }
 if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});writeFileSync(process.env.EVIDENCE_DIR+'/layering.json',JSON.stringify(report,null,2));}
}
