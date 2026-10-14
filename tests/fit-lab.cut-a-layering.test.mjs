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
 {bodyChestCm:113,bodyHipCm:130,desiredLengthCm:64},
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
test('cut A layered reference does not protrude visibly through the settled jersey in four named scenarios',()=>{
 for(const input of cases){const {state,body,outfit}=fixture(input),garment=createRestGarment(T,GARMENT_CATALOG[state.activeConfiguration]),rest=garment.getObjectByName('NUBYRA_Test_Jersey_Front').geometry.attributes.position.array.slice(),adapter=createClothAdapter(garment,body);adapter.solver.settle(90);adapter.sync();const positions=adapter.solver.positions.slice(),m=measureLayers(outfit,adapter);
  assert.ok(m.samples>1000,'too few section samples');
  assert.ok(m.worstCm<.05,`${state.bodyChestCm}/${state.bodyHipCm}/${state.activeConfiguration}: shorts outside shirt by ${m.worstCm} cm`);
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
