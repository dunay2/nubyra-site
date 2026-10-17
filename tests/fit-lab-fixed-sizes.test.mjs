import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {buildFixedShorts} from '../scripts/build-fixed-shorts.mjs';
import {createFixedShortFactory,horizontalPerimeter} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
import {SHORT_SIZES,SHORT_LENGTHS,assessJersey} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createRestGarment,CM_PER_UNIT} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';
const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));const bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const temp=await mkdtemp(join(tmpdir(),'nubyra-sizes-'));await buildFixedShorts(join(temp,'shorts.json'));const asset=JSON.parse(await readFile(join(temp,'shorts.json'),'utf8'));await rm(temp,{recursive:true,force:true});
const hash=g=>createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex');
test('All fixed shorts proposals retain their exact waist, hip and selected length',()=>{
 const factory=createFixedShortFactory(asset);assert.equal(Object.keys(asset.patterns).length,Object.keys(SHORT_SIZES).length*SHORT_LENGTHS.length);
 for(const p of Object.values(asset.patterns)){assert.ok(Math.abs(p.nominal.measuredWaistCm-p.nominal.waistCm)<.02);assert.ok(Math.abs(p.nominal.measuredHipCm-p.nominal.hipCm)<.02);assert.equal(p.nominal.industrialApproved,false);}factory.destroy();
});
test('Shorts rest templates and lower panels stay fixed across bodies; waist gathering and depth clearance are bounded',async()=>{
 const factory=createFixedShortFactory(asset),body=await loadHumanBody(bytes),checks=new Map();
 for(const h of[137,153,170]){updateHumanBody(body,resolveState({bodyHeightCm:h,bodyChestCm:75,bodyHipCm:79,armLoweringDeg:25}));const before=body.geometry.attributes.position.array.slice(),bottoms=[];
  for(const length of SHORT_LENGTHS){const o=factory.create(body,{size:'P4',lengthCm:length});o.settle();const dressed=o.mesh.geometry.attributes.position.array;const source=asset.patterns[o.snapshot().key].positions;for(let j=0;j<source.length;j+=3){assert.equal(dressed[j+1],source[j+1]);if(-source[j+1]*CM_PER_UNIT>=12){assert.equal(dressed[j],source[j]);assert.ok(Math.abs(dressed[j+2]-source[j+2])*CM_PER_UNIT<=3.0001);}}const key=createHash('sha256').update(JSON.stringify(source)).digest('hex');if(checks.has(length))assert.equal(key,checks.get(length));else checks.set(length,key);assert.ok(Math.abs((o.mesh.geometry.boundingBox.max.y-o.mesh.geometry.boundingBox.min.y)*CM_PER_UNIT-length)<.02);assert.equal(o.lengthCm,length);bottoms.push(o.lengthCm);assert.equal(o.snapshot().restGeometryIndependent,true);o.destroy();}
  assert.deepEqual(body.geometry.attributes.position.array,before);assert.deepEqual(bottoms,[34,42,50]);
 }factory.destroy();body.geometry.dispose();body.material.dispose();
});
test('A tied waistband remains at the waist even with excess circumference',async()=>{
 const factory=createFixedShortFactory(asset),body=updateHumanBody(await loadHumanBody(bytes),resolveState({bodyHeightCm:153,bodyChestCm:75,bodyHipCm:72})),o=factory.create(body,{size:'P4',lengthCm:42}),before=hash(o.mesh.geometry);
 assert.equal(o.support.status,'tied');assert.equal(o.support.dropCm,0);assert.ok(o.snapshot().waistGather.adjustedVertices>0);const initial=o.mesh.position.y;for(let i=0;i<100;i++)o.advance(.02);assert.equal(o.moving,false);assert.equal(o.mesh.position.y,initial);assert.equal(initial,body.userData.waistY);assert.equal(o.bottom,initial-42/CM_PER_UNIT);assert.equal(hash(o.mesh.geometry),before);assert.equal(o.support.clothSimulated,false);o.destroy();factory.destroy();body.geometry.dispose();body.material.dispose();
});
test('A too-small shorts waist or hip is rejected rather than stretched over the avatar',async()=>{
 const factory=createFixedShortFactory(asset),body=updateHumanBody(await loadHumanBody(bytes),resolveState({bodyChestCm:116,bodyHipCm:124,bodyHeightCm:200})),before=body.geometry.attributes.position.array.slice();
 assert.throws(()=>factory.create(body,{size:'P1',lengthCm:34}),/pequeño/);assert.deepEqual(body.geometry.attributes.position.array,before);factory.destroy();body.geometry.dispose();body.material.dispose();
});
test('Body waist measurement excludes arms; height alone does not decide jersey size',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({}));const a=horizontalPerimeter(body.geometry,body.userData.sourceToY(1.065),body.userData.base);assert.ok(a>60&&a<80);
 const small=assessJersey(resolveState({selectionMode:'manual',activeConfiguration:'N1-1',bodyChestCm:115,bodyHipCm:122}));assert.equal(small.blocked,true);
 const tall=assessJersey(resolveState({selectionMode:'manual',activeConfiguration:'N1-1',bodyHeightCm:200,bodyChestCm:84,bodyHipCm:94}));assert.equal(tall.blocked,false);assert.equal(tall.status,'short');assert.equal(tall.nominal.lengthCm,64);body.geometry.dispose();body.material.dispose();
});
test('Every jersey proposal creates a distinct fixed mesh, independent of body edits',()=>{
 const hashes=[];for(const g of Object.values(GARMENT_CATALOG)){const a=createRestGarment(T,g),b=createRestGarment(T,g);const digest=x=>createHash('sha256').update(x.children.filter(m=>m.isMesh).map(m=>hash(m.geometry)).join(',')).digest('hex');hashes.push(digest(a));assert.equal(digest(a),digest(b));for(const group of[a,b])group.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});}
 assert.equal(new Set(hashes).size,6);
});
