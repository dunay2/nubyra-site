import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createBody,updateBody,createRestGarment,createClothAdapter,CM_PER_UNIT} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';

const cases=[
 {bodyChestCm:88,bodyHipCm:96},
 {bodyChestCm:72,bodyHipCm:74,desiredLengthCm:84,frontVolume:1,sideVolume:6,backVolume:0,selectionMode:'manual',activeConfiguration:'N2-3'},
 {selectionMode:'manual',activeConfiguration:'N2-2',bodyChestCm:104,bodyHipCm:114,frontVolume:10,sideVolume:10,backVolume:10}
];

function fixture(input){
 const state=resolveState(input),body=updateBody(createBody(T),state);
 const garment=createRestGarment(T,GARMENT_CATALOG[state.activeConfiguration]);
 const adapter=createClothAdapter(garment,body);
 return {state,body,garment,adapter};
}

test('two actual 3D shoulder bands connect the front and back at the particle level',()=>{
 const {garment,adapter}=fixture(cases[0]);
 assert.equal(garment.children.filter(m=>m.isMesh).length,14);
 for(const [half,label] of [[0,'Left'],[1,'Right']]){
  const shoulder=garment.getObjectByName('NUBYRA_Test_Shoulder_'+label);
  assert.ok(shoulder?.isMesh,'missing fabric band '+label);
  assert.equal(shoulder.userData.kind,'shoulder-fabric');
  assert.equal(shoulder.material,garment.getObjectByName('NUBYRA_Test_Jersey_Front').material);
  assert.equal(shoulder.geometry.index.count,6*8*6);
  const map=adapter.maps.get(shoulder.name),a=adapter.maps.get('NUBYRA_Test_Jersey_Front'),b=adapter.maps.get('NUBYRA_Test_Jersey_Back');
  const stride=9,offset=half*25*stride+24*stride;
  const last=6*stride;
  for(let col=0;col<9;col++){
   assert.equal(map[col],a[offset+col],'front attachment not welded');
   assert.equal(map[last+col],b[offset+col],'back attachment not welded');
  }
 }
 for(const [m,map] of adapter.maps)assert.ok(map.every(i=>i>=0&&i<adapter.solver.weights.length),m);
});

test('no shoulder spikes after XPBD settle for reference, oversize and full controls',()=>{
 for(const input of cases){
  const {state,garment,adapter}=fixture(input),sol=adapter.solver;
  const initialRest=sol.rest.slice();
  sol.settle(90);
  adapter.sync();
  const d=sol.diagnostics();
  let maxKink=0;
  for(const name of ['Front','Back']){
   const panel=garment.getObjectByName('NUBYRA_Test_Jersey_'+name);
   const {gridRows:rows,halfColumns:cols}=panel.geometry.userData,map=adapter.maps.get(panel.name);
   for(let half=0;half<2;half++){
    const at=col=>sol.positions[3*map[half*(rows+1)*(cols+1)+rows*(cols+1)+col]+1];
    for(let col=1;col<cols;col++)maxKink=Math.max(maxKink,Math.abs(at(col+1)-2*at(col)+at(col-1)));
   }
  }
  assert.ok(maxKink*CM_PER_UNIT<1.2,'upper edge has localized spike: '+(maxKink*CM_PER_UNIT).toFixed(2)+' cm for '+state.activeConfiguration);
  assert.ok(d.maxTrianglePenetrationUnits*CM_PER_UNIT<.1,'cloth/body triangle penetration');
  assert.ok(d.p95Strain<.12,'strain distribution increased unexpectedly');
  assert.ok(d.maxStrain<.6,'local cloth stretch is excessive');
  assert.deepEqual(sol.rest,initialRest,'solver altered the garment rest pattern');
  assert.ok(adapter.surfaces.length===6,'two shoulder meshes must participate in rendering and solver');
 }
});

test('welded visual vertices receive matching normals after sync, including centre seams',()=>{
 const {garment,adapter}=fixture(cases[0]);
 adapter.solver.settle(55);adapter.sync();
 for(const mesh of adapter.surfaces){
  const map=adapter.maps.get(mesh.name),n=mesh.geometry.getAttribute('normal');
  for(let i=0;i<map.length;i++){
   const id=map[i],j=map.indexOf(id);
   if(j===i)continue;
   for(const axis of ['getX','getY','getZ'])assert.ok(Math.abs(n[axis](i)-n[axis](j))<.0001,'seam normal discontinuity');
  }
 }
});
