import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {BODY_REGION_LIMITS,REGION_KEYS,boundedRegions} from '../configurador-3d/fit-lab/body-regions.mjs';
import {resolveState,transition} from '../configurador-3d/fit-lab/lab-model.mjs';
import {simulationKey} from '../configurador-3d/fit-lab/human-simulation.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const initial=resolveState({bodyHeightCm:170,bodyChestCm:88,bodyHipCm:96});
const clean=b=>{b.geometry.dispose();b.material.dispose();};
test('Regional technical limits are enforced in both state and geometry paths',async()=>{
 const b=await loadHumanBody(bytes);try{
  const s=resolveState({...initial,hipWidthPct:500,gluteProjectionCm:-500});assert.equal(s.hipWidthPct,12);assert.equal(s.gluteProjectionCm,-3);
  assert.throws(()=>boundedRegions({...initial,gluteProjectionCm:NaN}));
  updateHumanBody(b,{...initial,hipWidthPct:999},{collision:false});const p=b.geometry.attributes.position.array.slice();
  updateHumanBody(b,{...initial,hipWidthPct:12},{collision:false});assert.deepEqual(p,b.geometry.attributes.position.array);
 }finally{clean(b);}
});
test('Reducing the rear does not inflate front, move head or feet, or silently preserve perimeter',async()=>{
 const b=await loadHumanBody(bytes);try{
  updateHumanBody(b,initial,{collision:false});const before=b.geometry.attributes.position.array.slice(),hip=b.userData.measurements.hipCm;
  updateHumanBody(b,{...initial,gluteProjectionCm:-3},{collision:false});const after=b.geometry.attributes.position.array,base=b.userData.base;
  let changed=0;for(let i=0;i<before.length;i+=3){assert.equal(before[i+1],after[i+1]);if(before[i+2]>=0||base[i+1]>1.5||base[i+1]<.6){assert.deepEqual([...before.slice(i,i+3)],[...after.slice(i,i+3)]);}if(after[i+2]!==before[i+2])changed++;}
  assert.ok(changed>100);assert.ok(b.userData.measurements.hipCm<hip-.2);assert.equal(b.userData.regions.perimeterCompensated,false);
 }finally{clean(b);}
});
test('64 combined endpoint/neutral cases keep positive local orientation and bounded edge ratios',async()=>{
 const b=await loadHumanBody(bytes);try{
  for(const height of[145,170])for(let mask=0;mask<32;mask++){
   const s={...initial,bodyHeightCm:height};REGION_KEYS.forEach((k,i)=>s[k]=(mask&(1<<i))?BODY_REGION_LIMITS[k].max:BODY_REGION_LIMITS[k].min);
   updateHumanBody(b,s,{collision:false});assert.ok(b.userData.regions.guard.valid);
  }
 }finally{clean(b);}
});
test('Edit values are absolute and repeated evaluation has no cumulative deformation',async()=>{
 const b=await loadHumanBody(bytes);try{const s={...initial,hipWidthPct:-8,abdomenProjectionCm:-1,thighWidthPct:10};updateHumanBody(b,s,{collision:false});const a=b.geometry.attributes.position.array.slice();
  for(let i=0;i<10;i++)updateHumanBody(b,s,{collision:false});assert.deepEqual(a,b.geometry.attributes.position.array);
 }finally{clean(b);}
});
test('Region edits have distinct cache keys and preserve manual garment selection',()=>{
 const s=resolveState({...initial,selectionMode:'manual',activeConfiguration:'N1-2'});
 for(const k of REGION_KEYS){const n=transition(s,{type:'body-shape',patch:{[k]:1}});assert.notEqual(simulationKey(s),simulationKey(n));assert.equal(n.activeConfiguration,'N1-2');assert.equal(n.garmentLengthCm,s.garmentLengthCm);}
 const s2=transition(s,{type:'body-shape',patch:{hipWidthPct:5,bodyBaseHipCm:96}}),r=transition(s2,{type:'reference-profile',id:'R04'});assert.equal(r.hipWidthPct,0);assert.equal(r.bodyBaseHipCm,undefined);
});
