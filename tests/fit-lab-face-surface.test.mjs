import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
test('Eye colour and pupils share a front-facing ocular surface instead of the socket back wall',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({}));
 const face=createHumanFace(body),g=face.group.children[0].geometry,p=g.attributes.position,c=g.attributes.color;
 assert.equal(face.snapshot().eyeSurface,'eyelid-rim-cap');assert.equal(g.userData.eyeVertexRanges.length,2);
 for(const {start,count}of g.userData.eyeVertexRanges){
   let dark=0,light=0;
   for(let i=start;i<start+count;i++){
     assert.ok(p.getZ(i)>.12,'Eye detail is behind the eyelid rim');
     if(c.getX(i)+c.getY(i)+c.getZ(i)<.10)dark++;
     if(c.getX(i)+c.getY(i)+c.getZ(i)>1)light++;
   }
   assert.ok(dark>20,'Missing pupil/iris');assert.ok(light>50,'Missing sclera');
 }
 face.destroy();body.geometry.dispose();body.material.dispose();
});
