import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,measure,PROFILES} from '../scripts/fit-lab-contact-report.mjs';
const CM=64/2.42;
test('selected profiles: continuous straps, closer sampled shoulder contact and no peaks over 1 cm',()=>{
 for(const [name,input]of Object.entries(PROFILES)){
  const x=fixture(input),s=x.adapter.solver,rest=s.rest.slice();s.settle(90);x.adapter.sync();const m=measure(x);
  assert.equal(m.seamGapCm,0,name+' shoulder attachment');
  assert.ok(m.kinkCm<1,name+' upper edge kink '+m.kinkCm);
  assert.ok(m.penetrationMm<1,name+' sampled penetration '+m.penetrationMm);
  assert.ok(m.regions.shoulder.medianGapCm<.55,name+' shoulder gap');
  assert.ok(m.regions.shoulder.near1cmAreaPct>70,name+' shoulder region contact');
  assert.ok(m.p95Strain<.12&&m.maxStrain<.5,name+' excessive numerical stretch');
  assert.deepEqual(s.rest,rest,'rest pattern changed');
  if(name==='B')assert.ok(m.regions.hem.medianGapCm>m.regions.shoulder.medianGapCm+2,'oversize hem must remain loose');
 }
});
test('bending is reinforced only near the straps and uses a small explicit collision margin',()=>{
 const x=fixture({}),s=x.adapter.solver;
 assert.equal(s.clearance,.007);
 const reinforced=s.bends.filter(e=>Math.abs(e.compliance/s.massScale-15)<1e-9),ordinary=s.bends.filter(e=>Math.abs(e.compliance/s.massScale-30)<1e-9);
 assert.ok(reinforced.length>30&&ordinary.length>1000&&reinforced.length<ordinary.length);
 assert.ok(s.bends.every(e=>Number.isFinite(e.length)&&e.length>0));
});
test('wind leaves straps stable while the loose hem moves and recovers',()=>{
 const rms=(a,b,ids)=>Math.sqrt(ids.reduce((v,i)=>v+(a[3*i+2]-b[3*i+2])**2,0)/ids.length)*CM;
 for(const input of [PROFILES.A,PROFILES.B]){
  const x=fixture(input),s=x.adapter.solver,m=x.adapter.maps;
  const shoulder=[...new Set(x.garment.children.filter(g=>g.name.includes('Shoulder')).flatMap(g=>m.get(g.name)))];
  const hem=[...new Set(x.garment.children.filter(g=>g.name.includes('Jersey_')).flatMap(g=>m.get(g.name)).filter(i=>s.rest[3*i+1]<-.65))];
  s.settle(90);const rest=s.positions.slice();s.wind=true;for(let i=0;i<Math.round(1/s.h);i++)s.substep();
  const strapMotion=rms(rest,s.positions,shoulder),hemMotion=rms(rest,s.positions,hem);
  assert.ok(strapMotion<.2,'shoulder wind movement '+strapMotion);
  // Force response is measured relative to the supported region, not a prescribed artistic amplitude.
  assert.ok(hemMotion>6*strapMotion&&hemMotion>0,'wind must move the free hem relative to the supported straps');
  s.wind=false;s.settle(90);assert.ok(rms(rest,s.positions,shoulder)<.18);assert.ok(rms(rest,s.positions,hem)<1.1);
  assert.ok(measure(x).penetrationMm<1);assert.ok([...s.positions].every(Number.isFinite));
 }
});
