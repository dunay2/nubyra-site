import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {resolveState,transition} from '../configurador-3d/fit-lab/lab-model.mjs';
import {garmentForState,recommendPreviewConfiguration} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {REFERENCE_PROFILES} from '../configurador-3d/fit-lab/reference-profiles.mjs';
import {SHORT_RISES,SHORT_PATTERNS,JERSEY_LENGTHS,shortRiseKey} from '../configurador-3d/fit-lab/pattern-registry.mjs';
import {simulationKey} from '../configurador-3d/fit-lab/human-simulation.mjs';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createFixedShortFactory,shortSupport} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
import {createRestGarment,CM_PER_UNIT} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {buildFixedShorts} from '../scripts/build-fixed-shorts.mjs';
const digest=g=>{const h=createHash('sha256');g.traverse(m=>{if(m.isMesh)h.update(Buffer.from(m.geometry.attributes.position.array.buffer));});return h.digest('hex');};
const dispose=g=>g.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});
test('Desired length selects a distinct fixed rest geometry and cache key without changing contour',()=>{
 let s=resolveState({selectionMode:'manual',activeConfiguration:'N1-2'}),key=null;const hashes=[];
 for(const length of JERSEY_LENGTHS){s=transition(s,{type:'measure',key:'desiredLengthCm',value:length});const g=garmentForState(s),mesh=createRestGarment(T,g);
 assert.equal(g.lengthCm,length);assert.equal(g.chestCm,102);assert.equal(g.hipCm,110);assert.match(g.patternId,new RegExp('L'+length+'$'));assert.notEqual(simulationKey(s),key);key=simulationKey(s);hashes.push(digest(mesh));dispose(mesh);}
 assert.equal(new Set(hashes).size,JERSEY_LENGTHS.length);
 const small=resolveState({bodyChestCm:74,bodyHipCm:82}),large=resolveState({bodyChestCm:106,bodyHipCm:118});assert.notEqual(small.garmentChestCm,large.garmentChestCm);assert.notEqual(small.garmentHipCm,large.garmentHipCm);
});
test('Always propose a concrete cut without falsely declaring an impossible fit compatible',()=>{
 const r=recommendPreviewConfiguration({bodyHeightCm:134,bodyChestCm:65,bodyHipCm:70,desiredLengthCm:48});assert.equal(r.hasConfiguration,true);assert.equal(r.hasDemoCoverage,false);assert.equal(r.proposal.requiresReview,true);assert.equal(r.previewCode,'N1-1');assert.equal(r.proposedLengthCm,48);
 const impossible=recommendPreviewConfiguration({bodyHeightCm:210,bodyChestCm:150,bodyHipCm:180,desiredLengthCm:84});assert.equal(impossible.hasConfiguration,true);assert.equal(impossible.proposal.renderable,false);assert.equal(impossible.proposal.assessment.blocked,true);
});
test('All eight profiles have an actual short proposal at a fixed length, with no body edits and bounded contact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kit-'));try{
 await buildFixedShorts(join(dir,'shorts.json'));const asset=JSON.parse(await readFile(join(dir,'shorts.json'),'utf8')),factory=createFixedShortFactory(asset);
 const bytes=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url)),body=await loadHumanBody(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 for(const p of REFERENCE_PROFILES){const s=transition(resolveState({}),{type:'reference-profile',id:p.id});updateHumanBody(body,s,{collision:false});const before=body.geometry.attributes.position.array.slice();assert.equal(s.recommendation.proposal.renderable,true);
 let found=null;outer:for(const pattern of Object.values(SHORT_PATTERNS).sort((a,b)=>Math.abs(a.hipCm-p.hipCm-8)-Math.abs(b.hipCm-p.hipCm-8))){if(shortSupport(body,pattern).blocked)continue;
 for(const riseCm of SHORT_RISES){try{found=factory.create(body,{size:pattern.code,lengthCm:42,riseCm});break outer;}catch{/* Try a different identified pattern, never inflate the current one. */}}}
 assert.ok(found,p.id+' has no short proposal');const snap=found.snapshot();assert.equal(snap.surfaceContact.requiresReview,false);assert.ok(snap.surfaceContact.maxOffsetCm<=3.0001);assert.equal(found.mesh.position.y,body.userData.waistY);assert.equal(found.moving,false);assert.ok(Math.abs((found.top-found.bottom)*CM_PER_UNIT-42)<.0001);assert.deepEqual(body.geometry.attributes.position.array,before);
 const key=shortRiseKey(found.pattern.code,42,found.riseCm);assert.ok(asset.patterns[key]||asset.riseVariants[key]);assert.equal(found.pattern.hipCm,SHORT_PATTERNS[found.pattern.code].hipCm);found.destroy();}
 factory.destroy();body.geometry.dispose();body.material.dispose();
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Finite rise variants preserve nominal hip/waist, horizontal vertices and full length',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rises-'));try{await buildFixedShorts(join(dir,'shorts.json'));const a=JSON.parse(await readFile(join(dir,'shorts.json'),'utf8'));assert.equal(Object.keys(a.riseVariants).length,24);
 for(const v of Object.values(a.riseVariants)){const d=v.nominal,base=a.patterns[d.code+'-'+d.lengthCm];assert.ok(SHORT_RISES.includes(d.riseCm));assert.equal(d.measuredWaistCm,base.nominal.measuredWaistCm);assert.equal(d.measuredHipCm,base.nominal.measuredHipCm);for(let i=0;i<v.positions.length;i+=3){assert.equal(v.positions[i],base.positions[i]);assert.equal(v.positions[i+2],base.positions[i+2]);}const ys=v.positions.filter((_,i)=>i%3===1);assert.ok(Math.abs((Math.max(...ys)-Math.min(...ys))*CM_PER_UNIT-d.lengthCm)<.01);}
 }finally{await rm(dir,{recursive:true,force:true});}
});
