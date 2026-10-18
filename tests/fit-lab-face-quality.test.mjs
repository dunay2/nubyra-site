import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createHumanFace,FACE_DETAIL} from '../configurador-3d/fit-lab/human-face.mjs';
const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
test('Eye surface follows measured eyelid rims within one millimetre, including upper depth bound',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({}));const before=body.geometry.attributes.position.array.slice(),face=createHumanFace(body),g=face.group.children[0].geometry,p=g.attributes.position;
 for(let eye=0;eye<2;eye++){
  const range=g.userData.eyeVertexRanges[eye],rims=g.userData.eyeRims[eye],n=FACE_DETAIL.eyeColumns,m=FACE_DETAIL.eyeRows;
  assert.ok(rims.filter(r=>r.open).length>n*.50);
  for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
   const id=range.start+j*(n+1)+i,v=j/m,r=rims[i],z=r.lower[2]+(r.upper[2]-r.lower[2])*v;
   const displacement=p.getZ(id)-z;
   assert.ok(displacement>=0&&displacement<=.001,`Floating/recessed ocular surface: ${displacement} m`);
   assert.ok(p.getZ(id)<.15,'Eye must not be globally moved centimetres forward');
   assert.ok(Math.abs(p.getY(id)-(r.lower[1]+(r.upper[1]-r.lower[1])*v))<1e-6);
  }
 }
 assert.equal(g.groups.length,2,'Facial details must be batched, not one draw call per eyebrow hair');
 assert.deepEqual(body.geometry.attributes.position.array,before);
 const original=p.array.slice();for(const h of[125,170,210]){updateHumanBody(body,resolveState({bodyHeightCm:h}));face.update();assert.strictEqual(g,face.group.children[0].geometry);assert.deepEqual(p.array,original);}
 face.destroy();body.geometry.dispose();body.material.dispose();
});
