import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBody,updateBody,createRestGarment,createClothAdapter,CM_PER_UNIT,ringPerimeter} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {MAX_TRIM_OFFSET} from '../configurador-3d/fit-lab/surface-bindings.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';
const reported={bodyChestCm:72,bodyHipCm:74,desiredLengthCm:84,frontVolume:1,sideVolume:6,backVolume:0,selectionMode:'manual',activeConfiguration:'N2-3'};
function setup(input={}){const state=resolveState({...reported,...input}),body=updateBody(createBody(THREE),state),garment=createRestGarment(THREE,GARMENT_CATALOG[state.activeConfiguration]);return {state,body,garment,...createClothAdapter(garment,body)};}
function checkBindings(adapter){
 const positions=adapter.solver.positions;
 for(const {mesh,bindings} of adapter.trims){
  const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<bindings.length;i++){
   const b=bindings[i];assert.ok(b.weights.every(w=>w>=0&&w<=1));assert.ok(Math.abs(b.weights.reduce((a,w)=>a+w,0)-1)<1e-12);
   const anchor=[0,1,2].map(axis=>b.ids.reduce((sum,id,j)=>sum+b.weights[j]*positions[id*3+axis],0));
   assert.ok(Math.hypot(p.getX(i)-anchor[0],p.getY(i)-anchor[1],p.getZ(i)-anchor[2])<=MAX_TRIM_OFFSET+2e-6,mesh.name+' must stay on the panel');
  }
 }
}
function checkSupports(adapter){
 const pins=new Map(adapter.solver.pins.map(p=>[p.id,p.position]));
 for(const [a,b] of adapter.supportGroups){const r=adapter.solver.rest,expected=Math.hypot(...[0,1,2].map(i=>r[a*3+i]-r[b*3+i])),actual=Math.hypot(...pins.get(a).map((v,i)=>v-pins.get(b)[i]));assert.ok(Math.abs(actual-expected)<1e-12,'support must not shorten authored fabric');}
}
test('reported 72/74 N2-3: neckline stays attached after settling and impulse',()=>{
 const a=setup(),rest=a.solver.rest.slice();a.solver.settle(160);a.sync();checkBindings(a);checkSupports(a);
 assert.equal(a.solver.pins.length,8);assert.equal(a.state.activeConfiguration,'N2-3');assert.equal(a.state.garmentChestCm,124);assert.deepEqual(a.solver.rest,rest);
 const d=a.solver.diagnostics();assert.ok(d.p95Strain<.1);assert.ok(d.maxPenetrationUnits*CM_PER_UNIT<.01);assert.ok(d.maxTrianglePenetrationUnits*CM_PER_UNIT<.1);
 a.solver.impulse(.8);for(let step=0;step<160;step++){a.solver.substep();if(step%40===0){a.sync();checkBindings(a);}}a.sync();checkBindings(a);
});
test('body edits retarget support patches without compressing rest lengths',()=>{
 const a=setup(),rest=a.solver.rest.slice();for(const values of [{bodyChestCm:120,bodyHipCm:130,bodyHeightCm:190},{bodyChestCm:72,bodyHipCm:74,bodyHeightCm:125},reported]){
  updateBody(a.body,resolveState({...reported,...values}));a.retarget(a.body);checkSupports(a);a.solver.settle(30);a.sync();checkBindings(a);assert.deepEqual(a.solver.rest,rest);
 }
});
test('all six garment variants keep trims bound with combinable body shapes',()=>{
 for(const activeConfiguration of Object.keys(GARMENT_CATALOG)){
  const a=setup({activeConfiguration,frontVolume:10,sideVolume:0,backVolume:10});a.solver.settle(20);a.sync();checkBindings(a);checkSupports(a);
  assert.ok(Math.abs(ringPerimeter(a.body,29)-72)<.001);assert.ok(Math.abs(ringPerimeter(a.body,4)-74)<.001);
 }
});
test('trim binding construction does not depend on the selected body',()=>{
 const a=setup(),b=setup({bodyChestCm:120,bodyHipCm:130});
 assert.deepEqual(a.trims.map(t=>t.bindings),b.trims.map(t=>t.bindings));
});
