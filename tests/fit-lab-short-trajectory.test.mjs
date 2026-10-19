import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ShortTrajectoryCache,shortTrajectoryKey} from '../configurador-3d/fit-lab/short-trajectory.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createHumanSimulation} from '../configurador-3d/fit-lab/human-simulation.mjs';
import {buildFixedShorts} from '../scripts/build-fixed-shorts.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('Trajectory key includes every body/pose/short input and excludes only jersey choices',()=>{
 const state={...resolveState({}),shortsSize:'N1-2',shortsLengthCm:42,shortsRiseCm:33.5};
 assert.equal(shortTrajectoryKey(state),shortTrajectoryKey({...state,activeConfiguration:'N2-3',garmentLengthCm:80}));
 for(const field of ['bodyHeightCm','bodyChestCm','bodyHipCm','bodyBaseChestCm','bodyBaseHipCm','armLoweringDeg','frontVolume','sideVolume','backVolume','hipWidthPct','gluteProjectionCm','abdomenProjectionCm','thighWidthPct','chestProjectionCm','shortsLengthCm','shortsRiseCm'])assert.notEqual(shortTrajectoryKey(state),shortTrajectoryKey({...state,[field]:(state[field]??0)+1}),field);
 assert.notEqual(shortTrajectoryKey(state),shortTrajectoryKey({...state,shortsSize:'N1-1'}));
});
test('Trajectory cache has byte/entry bounds, detects changed initial geometry and never interpolates frames',()=>{
 const initial=Float64Array.of(1,2,3),cache=new ShortTrajectoryCache({maxBytes:20000,maxEntries:2});
 const a=cache.acquire('a',initial),b=cache.acquire('b',initial);assert.equal(cache.acquire('a',initial),a);cache.acquire('c',initial);assert.equal(cache.entries.has('b'),false);assert.ok(cache.bytes<=cache.maxBytes);
 a.record(1,Float64Array.of(2,4,6));assert.throws(()=>a.record(1,Float64Array.of(3,4,6)),/diverged/);
 const solver={positions:initial.slice(),previous:new Float64Array(3),velocity:new Float64Array(3),steps:0,h:.25,time:0};
 assert.equal(a.replay(solver),true);assert.deepEqual([...solver.positions],[2,4,6]);assert.deepEqual([...solver.previous],[1,2,3]);assert.deepEqual([...solver.velocity],[4,8,12]);assert.equal(solver.time,.25);assert.equal(a.replay(solver),false);
 const replacement=cache.acquire('a',Float64Array.of(9,2,3));assert.notEqual(replacement,a);assert.equal(replacement.valid[1],0);cache.clear();assert.equal(cache.bytes,0);
 assert.equal(new ShortTrajectoryCache({maxBytes:10}).acquire('x',initial),null);
});
test('All Float64 positions and diagnostics match serial physics after jersey changes and wind',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nubyra-trajectory-'));let optimized,reference;
 try{
  await buildFixedShorts(join(dir,'shorts.json'));const shortAsset=JSON.parse(await readFile(join(dir,'shorts.json'),'utf8'));
  const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));const bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  optimized=await createHumanSimulation(bytes,{shortAsset});reference=await createHumanSimulation(bytes,{shortAsset,reuseShortTrajectory:false});
  let revision=0;
  for(const desiredLengthCm of [64,72]){
   const state={...resolveState({bodyHeightCm:145,bodyChestCm:74,bodyHipCm:82,armLoweringDeg:25,desiredLengthCm}),shortsSize:'N1-1',shortsLengthCm:42,shortsRiseCm:33.5};
   optimized.prepare(state,++revision);reference.prepare(state,revision);
   for(let step=0;step<360;step++){optimized.step();reference.step();if(step%40===39)assert.deepEqual(optimized.cacheEntry(),reference.cacheEntry());}
   assert.deepEqual(optimized.frame().diagnostics,reference.frame().diagnostics);assert.deepEqual(optimized.frame().shorts.diagnostics,reference.frame().shorts.diagnostics);
   assert.equal(optimized.frame().acceleration.shortStepsReused,desiredLengthCm===64?0:360);
   assert.equal(optimized.acceptShortFrames({revision:revision-1,key:'stale'}),false);
   for(let i=0;i<12;i++){optimized.step(true);reference.step(true);}assert.deepEqual(optimized.cacheEntry(),reference.cacheEntry());
  }
 }finally{optimized?.destroy();reference?.destroy();await rm(dir,{recursive:true,force:true});}
});
