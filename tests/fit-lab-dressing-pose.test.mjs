import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as T from 'three';
import {dressingArmAngle,DRESSING_POSE} from '../configurador-3d/fit-lab/dressing-pose.mjs';
import {createHumanSimulation,SIMULATION_VERSION,SETTLE_STEPS,simulationKey} from '../configurador-3d/fit-lab/human-simulation.mjs';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createRestGarment} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {garmentForState} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {buildFixedShorts} from '../scripts/build-fixed-shorts.mjs';
import {sidePanelCrossings} from './helpers/armhole-contact.mjs';

test('Dressing pose is bounded, monotone and finishes before the physical settle',()=>{
 assert.ok(DRESSING_POSE.endStep<SETTLE_STEPS);
 for(const target of [0,12.5,25]){
  let previous=0;
  for(let step=0;step<=SETTLE_STEPS;step++){
   const angle=dressingArmAngle(target,step);
   assert.ok(angle>=previous&&angle<=target);previous=angle;
   if(step<=DRESSING_POSE.startStep)assert.equal(angle,0);
   if(step>=DRESSING_POSE.endStep)assert.equal(angle,target);
  }
 }
 for(const angle of [-1,26,NaN,Infinity])assert.throws(()=>dressingArmAngle(angle,0));
 assert.throws(()=>dressingArmAngle(25,-1));
});

test('Small profile, lowered arms: both side panels stay outside the actual body; cached and cold poses agree',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nubyra-armhole-'));
 let sim,body,garment;
 try{
  const assetPath=join(dir,'shorts.json');await buildFixedShorts(assetPath);
  const shortAsset=JSON.parse(await readFile(assetPath,'utf8'));
  const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
  const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const state={...resolveState({bodyHeightCm:145,bodyChestCm:74,bodyHipCm:82,armLoweringDeg:25}),shortsSize:'N1-1',shortsLengthCm:42,shortsRiseCm:33.5};
  sim=await createHumanSimulation(bytes,{shortAsset});sim.prepare(state,1);
  assert.equal(sim.readyToPresent,false);
  assert.throws(()=>sim.frame(true),/dressing pose/);
  assert.equal(sim.progress().phase,'dressing');
  while(sim.remaining)sim.step();
  const frame=sim.frame(true),cached=sim.cacheEntry();
  assert.equal(frame.remaining,0);assert.equal(frame.diagnostics.steps,SETTLE_STEPS);
  assert.equal(frame.dressing.armAngle,25);assert.equal(frame.diagnostics.pins,0);
  assert.ok(Array.from(frame.positions).every(Number.isFinite));
  body=updateHumanBody(await loadHumanBody(bytes),state);garment=createRestGarment(T,garmentForState(state));
  assert.deepEqual(sidePanelCrossings(body,garment,frame.maps,frame.positions),{left:0,right:0});
  assert.ok(Math.abs(body.userData.measurements.chestCm-state.bodyChestCm)<.03);
  assert.equal(garmentForState(state).lengthCm,64);
  sim.prepare(state,2,cached);
  assert.equal(sim.remaining,0);assert.equal(sim.readyToPresent,true);
  assert.equal(sim.frame().cacheHit,true);assert.equal(sim.frame().dressing.armAngle,25);
  assert.deepEqual(sim.cacheEntry(),cached);
  const old={...cached,key:cached.key.replace(SIMULATION_VERSION,'human-simulation/2.0-two-garments')};
  sim.prepare(state,3,old);assert.equal(sim.readyToPresent,false);assert.equal(sim.remaining,SETTLE_STEPS);
  const openArms={...state,armLoweringDeg:0};sim.prepare(openArms,4,cached);
  assert.equal(sim.readyToPresent,true);assert.notEqual(simulationKey(openArms),cached.key);
  for(let n=0;n<4;n++)sim.step();assert.equal(sim.frame(true).dressing.armAngle,0);
 }finally{
  sim?.destroy();body?.geometry.dispose();body?.material.dispose();
  garment?.traverse(m=>{if(m.isMesh)m.geometry.dispose();});await rm(dir,{recursive:true,force:true});
 }
});
