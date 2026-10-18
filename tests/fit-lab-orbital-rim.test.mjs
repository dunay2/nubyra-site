import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
test('All ocular vertices remain at the front rim, never on the back wall of the eye socket',async()=>{
 const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
 const body=updateHumanBody(await loadHumanBody(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),resolveState({})),f=createHumanFace(body),g=f.group.children[0].geometry,p=g.attributes.position;
 for(const r of g.userData.eyeVertexRanges)for(let i=r.start;i<r.start+r.count;i++)assert.ok(p.getZ(i)>.120,`eye vertex ${i} recessed to ${p.getZ(i)}`);
 assert.equal(f.snapshot().orbitalRimVerified,true);f.destroy();body.geometry.dispose();body.material.dispose();
});
