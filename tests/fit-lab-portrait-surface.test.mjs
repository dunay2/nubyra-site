import test from 'node:test';import assert from 'node:assert/strict';
import * as T from 'three';import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody,humanSection} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {createHumanAppearance} from '../configurador-3d/fit-lab/human-appearance.mjs';
import {PORTRAIT_JOIN_Y} from '../configurador-3d/fit-lab/portrait-surface.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const file=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const fixture=async()=>updateHumanBody(await loadHumanBody(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)),resolveState({}));
const dispose=b=>{b.geometry.dispose();b.material.dispose();};
test('Refined head triangles are nondegenerate and the physical body is not edited',async()=>{
 const b=await fixture(),p=b.geometry.attributes.position.array.slice(),base=b.userData.base.slice(),f=createHumanFace(b),g=f.group.children[0].geometry;
 try{
  assert.deepEqual(b.geometry.attributes.position.array,p);assert.deepEqual(b.userData.base,base);
  const x=new T.Vector3(),y=new T.Vector3(),z=new T.Vector3();
  for(let i=0;i<g.index.count;i+=3){x.fromBufferAttribute(g.attributes.position,g.index.getX(i));y.fromBufferAttribute(g.attributes.position,g.index.getX(i+1));z.fromBufferAttribute(g.attributes.position,g.index.getX(i+2));assert.ok(y.sub(x).cross(z.sub(x)).lengthSq()>1e-26);}
  assert.equal(f.snapshot().extraTextureRequests,0);assert.equal(g.groups.length,2);
 }finally{f.destroy();dispose(b);}
});
test('Neck boundary tracks real source edges across height and contour changes without a cut seam',async()=>{
 const b=await fixture(),f=createHumanFace(b),g=f.group.children[0].geometry,id=g.id;
 try{
  for(const input of [ {},{bodyHeightCm:125,bodyChestCm:65,bodyHipCm:70},{bodyHeightCm:210,bodyChestCm:130,bodyHipCm:145},{bodyHeightCm:145,bodyChestCm:80,bodyHipCm:89},{bodyHeightCm:170,bodyChestCm:88,bodyHipCm:96},{}]){
   updateHumanBody(b,resolveState(input));const measures={...b.userData.measurements},hip=humanSection(b,'hip').map(p=>p.toArray());f.update();
   assert.equal(g.id,id);assert.deepEqual(b.userData.measurements,measures);assert.deepEqual(humanSection(b,'hip').map(p=>p.toArray()),hip);
   for(const {vertex,a,b:other} of g.userData.neckAttachments){
    if(g.userData.restSkin[vertex*3+1]>PORTRAIT_JOIN_Y+.001)continue;
    const s=f.group.scale.x,p=b.geometry.attributes.position;
    for(let axis=0;axis<3;axis++){
     const actual=g.attributes.position.array[vertex*3+axis]*s+f.group.position.getComponent(axis),expected=(p.array[a*3+axis]+p.array[other*3+axis])/2;
     assert.ok(Math.abs(actual-expected)<1e-5,'Visual neck drifted from canonical seam');
    }
   }
  }
 }finally{f.destroy();dispose(b);}
});
test('Repeated A-B-A body changes are deterministic, reuse the skin and keep eyes fixed within the head',async()=>{
 const b=await fixture(),f=createHumanFace(b),g=f.group.children[0].geometry;
 try{
  const initial=g.attributes.position.array.slice(),range=g.userData.eyeVertexRanges[0],eye=initial.slice(range.start*3,(range.start+range.count)*3);
  for(let i=0;i<3;i++){updateHumanBody(b,resolveState({bodyHeightCm:190,bodyChestCm:110,bodyHipCm:125}));f.update();updateHumanBody(b,resolveState({}));f.update();assert.deepEqual(g.attributes.position.array,initial);}
  assert.deepEqual(g.attributes.position.array.slice(range.start*3,(range.start+range.count)*3),eye);
 }finally{f.destroy();dispose(b);}
});
test('Total refined head and hair triangle budget stays below the published 131828-triangle head scene',async()=>{
 const b=await fixture(),a=createHumanAppearance(b),f=createHumanFace(b);
 try{
  let count=b.geometry.index.count/3;for(const m of [...a.group.children,...f.group.children])count+=m.geometry.index.count/3;
  assert.ok(count<105000,`Head-scene geometry budget regressed: ${count}`);
  assert.equal(a.snapshot().scalpLocks,46);assert.equal(a.snapshot().templeLocks,4);assert.equal(a.snapshot().scalpDetail,'filtered-surface-fibres');
 }finally{f.destroy();a.destroy();dispose(b);}
});
