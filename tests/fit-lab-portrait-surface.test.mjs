import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {createPortraitSurface,PORTRAIT_CUT_Y} from '../configurador-3d/fit-lab/portrait-surface.mjs';
const file=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const fixture=async()=>updateHumanBody(await loadHumanBody(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)),resolveState({}));
test('Display head is finite and bounded; fitted body and cranium are not rewritten',async()=>{
 const b=await fixture(),base=b.userData.base.slice(),indices=b.geometry.index.array.slice();
 const g=createPortraitSurface(b.userData.base,b.geometry.index),info=g.userData.portrait;
 try{
  assert.deepEqual(b.userData.base,base);assert.deepEqual(b.geometry.index.array,indices);
  assert.ok(info.vertices<20000);assert.ok(info.triangles<36000);assert.ok(info.maxSourceShiftMm<=1.200001);
  assert.ok(g.attributes.position.array.every(Number.isFinite));assert.ok(g.attributes.normal.array.every(Number.isFinite));
  assert.ok(g.boundingBox.min.y<PORTRAIT_CUT_Y-.005);
  let ymax=-Infinity;for(let i=1;i<base.length;i+=3)ymax=Math.max(ymax,base[i]);
  assert.equal(g.boundingBox.max.y,ymax,'Craniometric height cannot change');
 }finally{g.dispose();b.geometry.dispose();b.material.dispose();}
});
test('Display head follows five heights without reconstruction; appearance disposal releases both meshes',async()=>{
 const b=await fixture(),f=createHumanFace(b),mesh=f.group.getObjectByName('avatar-display-head'),g=mesh.geometry;
 const data=g.attributes.position.array.slice(),original=b.geometry.attributes.position.array.slice();let disposed=0;
 g.addEventListener('dispose',()=>disposed++);
 try{
  assert.equal(f.snapshot().totalDrawBatches,3);assert.deepEqual(b.geometry.attributes.position.array,original);
  for(const h of [125,160,180,200,160]){updateHumanBody(b,resolveState({bodyHeightCm:h}));f.update();assert.equal(mesh.geometry,g);assert.deepEqual(g.attributes.position.array,data);assert.equal(f.group.scale.x,b.userData.scale/b.userData.unit);}
 }finally{f.destroy();f.destroy();assert.equal(disposed,1);b.geometry.dispose();b.material.dispose();}
});
