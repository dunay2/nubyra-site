import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {buildFixedShorts} from '../scripts/build-fixed-shorts.mjs';
import {createFixedShortFactory} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
const d=await mkdtemp(join(tmpdir(),'tied-contact-'));await buildFixedShorts(join(d,'patterns.json'));
const asset=JSON.parse(await readFile(join(d,'patterns.json'),'utf8'));await rm(d,{recursive:true});
const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
test('Posterior cloth contact clears vertices, centres and edges without changing length, rest pattern or anatomy',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({bodyHeightCm:170,bodyChestCm:88,bodyHipCm:96}));
 const before=body.geometry.attributes.position.array.slice(),factory=createFixedShortFactory(asset),rest=JSON.stringify(asset);
 for(const lengthCm of[34,42,50]){const o=factory.create(body,{size:'N1-2',lengthCm});
  const c=o.snapshot().surfaceContact;assert.ok(c.adjustedVertices>0);assert.ok(c.remainingDeficitCm<.001);assert.equal(c.requiresReview,false);assert.ok(c.maxOffsetCm<=3.0001);
  const p=o.mesh.geometry.attributes.position,base=asset.patterns['N1-2-'+lengthCm].positions;for(let i=0;i<p.count;i++)assert.equal(p.getY(i),base[i*3+1]);
  assert.ok(Math.abs((o.top-o.bottom)*CM_PER_UNIT-lengthCm)<1e-10);o.advance(100);assert.equal(o.top,body.userData.waistY);o.destroy();
 }
 assert.deepEqual(body.geometry.attributes.position.array,before);assert.equal(JSON.stringify(asset),rest);
 factory.destroy();body.geometry.dispose();body.material.dispose();
});
test('Infeasible rise/contact on a tall body is rejected instead of exposing skin or stretching the fixed pattern',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({bodyHeightCm:200,bodyChestCm:88,bodyHipCm:96}));const before=body.geometry.attributes.position.array.slice();
 const factory=createFixedShortFactory(asset);assert.throws(()=>factory.create(body,{size:'N1-2',lengthCm:42}),/cadera\/tiro/);assert.deepEqual(body.geometry.attributes.position.array,before);
 factory.destroy();body.geometry.dispose();body.material.dispose();
});
