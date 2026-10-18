import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {buildFixedShorts} from '../scripts/build-fixed-shorts.mjs';
import {createShortCloth} from '../configurador-3d/fit-lab/shorts-cloth.mjs';
import {createFixedShortFactory} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
const d=await mkdtemp(join(tmpdir(),'tied-contact-'));await buildFixedShorts(join(d,'patterns.json'));
const asset=JSON.parse(await readFile(join(d,'patterns.json'),'utf8'));await rm(d,{recursive:true});
const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
test('Worker contacts clear vertices and sampled faces while preserving rest pattern, waist and anatomy',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({bodyHeightCm:170,bodyChestCm:88,bodyHipCm:96}));
 const before=body.geometry.attributes.position.array.slice(),factory=createFixedShortFactory(asset),rest=JSON.stringify(asset);
 for(const lengthCm of[34,42,50]){const o=factory.create(body,{size:'N1-2',lengthCm});
  const template=factory.template({size:'N1-2',lengthCm}),sim=createShortCloth(template,body);for(let i=0;i<12;i++)sim.step();const c=sim.snapshot();
  assert.ok(c.contactVertices>0);assert.ok(c.maxPenetrationUnits*CM_PER_UNIT<.01);assert.ok(c.maxTrianglePenetrationUnits*CM_PER_UNIT<.1);assert.equal(c.waistDriftCm,0);assert.equal(c.nominalLengthCm,lengthCm);assert.equal(c.restPatternChanged,false);
  o.applyFrame({key:template.key,positions:sim.render(),diagnostics:c});assert.equal(o.snapshot().clothSimulated,true);assert.equal(o.top,body.userData.waistY);sim.destroy();o.destroy();
 }
 assert.deepEqual(body.geometry.attributes.position.array,before);assert.equal(JSON.stringify(asset),rest);
 factory.destroy();body.geometry.dispose();body.material.dispose();
});
test('Infeasible rise/contact on a tall body is rejected instead of exposing skin or stretching the fixed pattern',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({bodyHeightCm:200,bodyChestCm:88,bodyHipCm:96}));const before=body.geometry.attributes.position.array.slice();
 const factory=createFixedShortFactory(asset);assert.throws(()=>factory.create(body,{size:'N1-2',lengthCm:42}),/cadera\/tiro/);assert.deepEqual(body.geometry.attributes.position.array,before);
 factory.destroy();body.geometry.dispose();body.material.dispose();
});
