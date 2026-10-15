import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanOutfit} from '../configurador-3d/fit-lab/human-outfit.mjs';
const file=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
test('Shorts geometry is byte-identical across jersey lengths at fixed body/shorts settings',async()=>{
 const state={bodyHeightCm:170,bodyChestCm:84,bodyHipCm:94,frontVolume:3,sideVolume:5,backVolume:5};
 const body=updateHumanBody(await loadHumanBody(bytes),state,{collision:false});
 let expected=null,index=null;
 for(const garmentLengthCm of [45,64,85]){
  const outfit=createHumanOutfit(body,{...state,garmentLengthCm},{lengthCm:40});
  const p=outfit.mesh.geometry.attributes.position.array;
  if(expected){assert.deepEqual(p,expected);assert.deepEqual(outfit.mesh.geometry.index.array,index);}
  else{expected=p.slice();index=outfit.mesh.geometry.index.array.slice();}
  assert.ok(outfit.bottom>outfit.kneeTop);assert.equal(outfit.lengthCm,40);
  outfit.destroy();
 }
 body.geometry.dispose();body.material.dispose();
});
