import test from 'node:test';
import assert from 'node:assert/strict';
import {ClothSolver} from '../configurador-3d/fit-lab/cloth-solver.mjs';
import {lumpedMasses,DEMO_CLOTH} from '../configurador-3d/fit-lab/cloth-material.mjs';
import {fixture,measure} from '../scripts/fit-lab-contact-report.mjs';
const unit=64/242;
const requests=[
 {bodyChestCm:79,bodyHipCm:88,desiredLengthCm:55,frontVolume:4,sideVolume:4,backVolume:10,selectionMode:'manual',activeConfiguration:'N1-1'},
 {bodyChestCm:113,bodyHipCm:130,desiredLengthCm:64,frontVolume:3,sideVolume:5,backVolume:5}
];
test('SI areal density conserves total mass when a triangle is subdivided',()=>{
 const coarse=lumpedMasses([0,0,0,1,0,0,0,1,0],[[0,1,2]],1,.18);
 const fine=lumpedMasses([0,0,0,1,0,0,0,1,0,.5,0,0,.5,.5,0,0,.5,0],[[0,3,5],[3,1,4],[5,4,2],[3,4,5]],1,.18);
 assert.ok(Math.abs(coarse.totalKg-.09)<1e-12);assert.ok(Math.abs(fine.totalKg-coarse.totalKg)<1e-12);
 assert.ok(Math.abs([...fine.masses].reduce((a,b)=>a+b,0)-fine.totalKg)<1e-12);
 assert.throws(()=>lumpedMasses([0,0,0,1,0,0,2,0,0],[[0,1,2]],1,.18),/positive/);
});
test('unconstrained free fall follows g=9.81 m/s2 without a hidden velocity cap',()=>{
 const s=new ClothSolver({positions:[0,4,0],edges:[],unitMeters:1});s.airDrag=0;s.h=1/480;
 const n=480;for(let i=0;i<n;i++)s.substep();
 assert.ok(Math.abs(s.positions[1]-(4-9.81*s.h*s.h*n*(n+1)/2))<1e-9);
 assert.ok(Math.abs(s.velocity[1]+9.81)<1e-8);
 assert.equal(s.pins.length,0);
});
test('unilateral plane contact supports gravity; Coulomb friction reduces tangential motion',()=>{
 const collider={gap:(x,y,z)=>y,project:(x,y,z,m)=>y<m?[x,m,z]:null};
 const run=mu=>{const s=new ClothSolver({positions:[0,.007,0],edges:[],unitMeters:1,collider});s.airDrag=0;s.friction=mu;s.velocity[0]=.2;for(let i=0;i<240;i++)s.substep();return s;};
 const free=run(0),friction=run(.4);
 assert.ok(Math.abs(friction.positions[1]-.007)<1e-8);assert.ok(friction.positions[0]<free.positions[0]*.2);
 assert.ok(friction.positions[0]>=0);assert.ok(Math.abs(free.positions[0]-.2)<1e-8);
});
test('the two reported bodies support the garment with zero kinematic pins',()=>{
 for(const input of requests){const f=fixture(input),s=f.adapter.solver,rest=s.rest.slice();
  assert.equal(s.pins.length,0);assert.ok([...s.weights].every(w=>w>0));
  s.settle(90);f.adapter.sync();const m=measure(f);
  assert.equal(s.diagnostics().supportMode,'body-contact');assert.ok(m.regions.shoulder.near1cmAreaPct>95);
  assert.ok(m.regions.shoulder.medianGapCm<.3);assert.ok(m.kinkCm<.6);
  assert.ok(m.penetrationMm<1);assert.ok(m.p95Strain<.05);assert.ok(m.maxStrain<.3);
  assert.deepEqual(s.rest,rest);assert.equal(s.material.calibrated,false);
 }
});
test('removing the body removes support: an unsupported garment must actually fall',()=>{
 const f=fixture(requests[0]),s=f.adapter.solver;s.settle(90);
 const before=s.positions.slice(),g=s.gravity;s.setCollider(null,[]);s.airDrag=0;
 for(let i=0;i<120;i++)s.substep();let sum=0;for(let k=1;k<s.positions.length;k+=3)sum+=s.positions[k]-before[k];
 const mean=sum/s.weights.length;assert.ok(mean*unit<-.2,'garment remained artificially suspended');assert.equal(s.gravity,g);assert.equal(s.pins.length,0);
});
test('rest pattern survives changing the body and redressing the same configuration',()=>{
 const f=fixture(requests[0]),s=f.adapter.solver,rest=s.rest.slice(),mass=s.massData.totalKg;
 s.settle(15);s.resetRestPose([0,.4,0]);assert.deepEqual(s.rest,rest);assert.equal(s.massData.totalKg,mass);assert.equal(s.pins.length,0);
});
