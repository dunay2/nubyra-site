import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createBody,updateBody,createRestGarment,createClothAdapter,CM_PER_UNIT} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {createOutfitReference} from '../configurador-3d/fit-lab/outfit-reference.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {garmentSection,measureLayers} from '../scripts/fit-lab-layering-probe.mjs';
const cases=[{},
 {bodyChestCm:117,bodyHipCm:72,desiredLengthCm:52,bodyHeightCm:143,selectionMode:'manual',activeConfiguration:'N1-1'},
 {selectionMode:'manual',activeConfiguration:'N2-3',bodyChestCm:113,bodyHipCm:130,desiredLengthCm:64},
 {bodyChestCm:72,bodyHipCm:74,selectionMode:'manual',activeConfiguration:'N2-3'}];
function fixture(input){const state=resolveState(input),body=updateBody(createBody(T),state),outfit=createOutfitReference(T,body,state);return {state,body,outfit};}
function extentAt(mesh,row){const p=mesh.geometry.attributes.position,{around}=mesh.geometry.userData;let xlo=Infinity,xhi=-Infinity,zlo=Infinity,zhi=-Infinity;for(let a=0;a<around;a++){const i=row*(around+1)+a;xlo=Math.min(xlo,p.getX(i));xhi=Math.max(xhi,p.getX(i));zlo=Math.min(zlo,p.getZ(i));zhi=Math.max(zhi,p.getZ(i));}return {width:xhi-xlo,depth:zhi-zlo};}
test('cut A narrows upper thighs without changing waist, knee/ankle landmarks or nominal height',()=>{
 for(const input of cases){const {body,outfit,state}=fixture(input),L=outfit.layout;
  for(const leg of outfit.bodyMeshes.filter(m=>m.name.startsWith('Pierna'))){const hip=extentAt(leg,0),thigh=extentAt(leg,4),calf=extentAt(leg,20),ankle=extentAt(leg,32);
   assert.ok(thigh.width<hip.width*.68,'upper thigh unexpectedly flares');
   assert.ok(thigh.depth<hip.depth*.81,'upper thigh deeper than its hip join');
   assert.ok(ankle.width<calf.width*.6,'ankle/calf shape changed');
   assert.equal(leg.geometry.userData.rows,32);
  }
  assert.ok(Math.abs((L.headTop-L.floor)*CM_PER_UNIT-state.bodyHeightCm)<1e-6);
  outfit.destroy();body.geometry.dispose();body.material.dispose();
 }
});
test('cut A does not add shorts protrusion beyond existing body-shirt contact in four scenarios',()=>{
 for(const input of cases){const {state,body,outfit}=fixture(input),garment=createRestGarment(T,GARMENT_CATALOG[state.activeConfiguration]),rest=garment.getObjectByName('NUBYRA_Test_Jersey_Front').geometry.attributes.position.array.slice(),adapter=createClothAdapter(garment,body);adapter.solver.settle(90);adapter.sync();const positions=adapter.solver.positions.slice(),m=measureLayers(outfit,adapter,body);
  assert.ok(m.samples>1000,'too few section samples');
  assert.ok(m.addedProtrusionCm<.05,`${state.bodyChestCm}/${state.bodyHipCm}/${state.activeConfiguration}: additional shorts protrusion ${m.addedProtrusionCm}; total ${m.worstCm} cm`);
  if(!state.reviewRequired)assert.ok(m.worstCm<.05,'compatible scenario has overall protrusion');
  // Outside-catalogue geometry may already intersect the torso cut edge. Report it; do not attribute it to shorts or conceal it.
  if(m.worstCm>=.05){assert.equal(state.reviewRequired,true);assert.ok(m.bodyIntersectionSamples>0);}
  assert.deepEqual(adapter.solver.positions,positions,'layer inspection mutated the simulated shirt');
  assert.ok(garment.getObjectByName('NUBYRA_Test_Jersey_Front').geometry.attributes.position.count===rest.length/3);
  for(const part of outfit.shortsMeshes){assert.equal(part.renderOrder,0);for(const mat of part.material){assert.equal(mat.depthTest,true);assert.equal(mat.depthWrite,true);assert.equal(mat.polygonOffset,false);}}
  outfit.destroy();body.geometry.dispose();body.material.dispose();
 }
});
test('radial section diagnostic checks actual triangles and reports no invented surface below the hem',()=>{
 const cylinder=new T.Mesh(new T.CylinderGeometry(1,1,2,64,1,true));const section=garmentSection([cylinder],.3);
 assert.ok(Math.abs(section(.2,0)-1)<1e-5);assert.equal(garmentSection([cylinder],-2)(1,0),Infinity);
 cylinder.geometry.dispose();cylinder.material.dispose();
});
test('layer diagnostic distinguishes an existing torso/shirt intersection from additional shorts protrusion',()=>{
 const ring=(radius)=>{const p=[];for(const y of [.25,-.25])for(let i=0;i<=64;i++){const a=2*Math.PI*(i%64)/64;p.push(radius*Math.cos(a),y,radius*Math.sin(a));}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.userData={rows:1,around:64};return new T.Mesh(geometry);};
 const shirt=new T.Mesh(new T.CylinderGeometry(1.9,1.9,2,64,1,true)),body=new T.Mesh(new T.CylinderGeometry(2,2,2,64,1,true));
 const within=ring(2.001),outside=ring(2.1),a=measureLayers({shortsMeshes:[within]},{surfaces:[shirt]},body),b=measureLayers({shortsMeshes:[outside]},{surfaces:[shirt]},body);
 assert.ok(a.worstCm>2.6,'raw intersection was suppressed');assert.ok(a.bodyIntersectionSamples>0);assert.ok(a.addedProtrusionCm<.03,'body intersection must not be counted twice');
 assert.ok(b.addedProtrusionCm>2.6,'real extra shorts volume was hidden');
 for(const m of [shirt,body,within,outside]){m.geometry.dispose();m.material.dispose();}
});
test('shorts share upper torso sampling heights so thin underlayer cannot bridge across row changes',()=>{
 for(const input of [{},{bodyChestCm:117,bodyHipCm:72,bodyHeightCm:143}]){const {outfit,body}=fixture(input),p=body.geometry.attributes.position,ys=new Set();for(const m of outfit.shortsMeshes){const g=m.geometry;assert.equal(g.userData.around,body.userData.around);for(let r=0;r<=g.userData.rows;r++)ys.add(g.attributes.position.getY(r*(g.userData.around+1)).toFixed(6));}
  for(let r=0;r<=16;r++)assert.ok(ys.has(p.getY(r*(body.userData.around+1)).toFixed(6)),'missing body sampling height');outfit.destroy();body.geometry.dispose();body.material.dispose();
 }
});
