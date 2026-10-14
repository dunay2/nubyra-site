import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createBody,updateBody,CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createOutfitReference} from '../configurador-3d/fit-lab/outfit-reference.mjs';
import {normalizeKit} from '../configurador-3d/fit-lab/kit-design.mjs';
test('kit design normalizes graphic text, numbers and colors without adding body fields',()=>{
 const s=normalizeKit({surname:'  LEÓN  ',team:'TEST '.repeat(40),number:'09',base:'invalid',accent:'#AABBCC'});
 assert.equal(s.surname,'LEÓN');assert.equal(s.team.length,28);assert.equal(s.number,'9');assert.equal(s.base,'#173e64');assert.equal(s.accent,'#aabbcc');assert.equal(normalizeKit({number:'00'}).number,'00');assert.equal(normalizeKit({surname:''}).surname,'');
});
test('full-body reference floor-to-head is the nominal height on the existing centimeter scale',()=>{
 for(const h of [125,160,190]){const s=resolveState({bodyHeightCm:h}),body=updateBody(createBody(T),s),before=body.geometry.attributes.position.array.slice(),outfit=createOutfitReference(T,body,s);
  assert.ok(Math.abs((outfit.layout.headTop-outfit.layout.floor)*CM_PER_UNIT-h)<1e-8);
  assert.deepEqual(body.geometry.attributes.position.array,before,'visual reference changed the collider');
  let yMin=Infinity,yMax=-Infinity;for(const mesh of outfit.bodyMeshes){const p=mesh.geometry.attributes.position;assert.ok([...p.array].every(Number.isFinite));for(let i=0;i<p.count;i++){yMin=Math.min(yMin,p.getY(i));yMax=Math.max(yMax,p.getY(i));}}
  assert.ok(Math.abs((yMax-yMin)*CM_PER_UNIT-h)<.001);assert.equal(outfit.snapshot().anthropometryValidated,false);outfit.destroy();body.geometry.dispose();body.material.dispose();
 }
});
test('shorts are an independent length reference with exactly two material batches per leg',()=>{
 const state=resolveState({}),body=updateBody(createBody(T),state);for(const length of [25,40,60]){const kit=createOutfitReference(T,body,state,{shortsLengthCm:length});
  assert.equal(kit.snapshot().clothSimulated,false);assert.equal(kit.shortsMeshes.length,2);
  for(const m of kit.shortsMeshes){const bb=m.geometry.boundingBox;assert.ok(Math.abs((bb.max.y-bb.min.y)*CM_PER_UNIT-length)<.001);assert.equal(m.geometry.groups.length,2);assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));}
  kit.destroy();
 }
});
