import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {buildPortraitSurface} from '../configurador-3d/fit-lab/portrait-surface.mjs';
import {refinePortraitPoint,PORTRAIT_STYLE_LIMITS} from '../configurador-3d/fit-lab/portrait-style.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const fixture=async()=>updateHumanBody(await loadHumanBody(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)),resolveState({}));

test('Display style rejects invalid input and preserves all protected source points exactly',()=>{
 for(const amount of [-1,2,NaN,Infinity])assert.throws(()=>refinePortraitPoint(new T.Vector3(0,1.55,.15),amount),RangeError);
 assert.throws(()=>refinePortraitPoint(new T.Vector3(NaN,1.55,.15)),RangeError);
 for(const y of [1.40,1.475,1.490,1.642,1.68,1.73])for(const x of [-.1,0,.1]){
  const p=new T.Vector3(x,y,.14),copy=p.clone();refinePortraitPoint(p);assert.deepEqual(p,copy);
 }
 const p=new T.Vector3(.045,1.53,.13),copy=p.clone();refinePortraitPoint(p,0);assert.deepEqual(p,copy);
});

test('Softer portrait changes the jaw locally without resizing skull, torso or source buffers',async()=>{
 const b=await fixture(),original=b.userData.base.slice(),indices=b.geometry.index.array.slice();
 const before=buildPortraitSurface(b.userData.base,b.geometry.index,{styleAmount:0}),after=buildPortraitSurface(b.userData.base,b.geometry.index);
 try{
  assert.deepEqual(b.userData.base,original);assert.deepEqual(b.geometry.index.array,indices);
  assert.deepEqual(after.index.array,before.index.array);assert.equal(after.boundingBox.max.y,before.boundingBox.max.y);
  const a=before.attributes.position,p=after.attributes.position;let jawBefore=0,jawAfter=0,count=0,changed=0,max=0;
  for(let i=0;i<p.count;i++){
   const d=Math.hypot(p.getX(i)-a.getX(i),p.getY(i)-a.getY(i),p.getZ(i)-a.getZ(i));
   max=Math.max(max,d);if(d>1e-7)changed++;
   if(a.getY(i)<=1.490||a.getY(i)>=1.642)assert.equal(d,0,'Protected scalp/neck moved');
   if(a.getY(i)>1.510&&a.getY(i)<1.535&&Math.abs(a.getX(i))>.035&&a.getZ(i)>.080){jawBefore+=Math.abs(a.getX(i));jawAfter+=Math.abs(p.getX(i));count++;}
  }
  assert.ok(changed>500);assert.ok(count>50);assert.ok(jawAfter<jawBefore*.97,'The promised jaw adjustment must exist in the mesh');
  assert.ok(max<=PORTRAIT_STYLE_LIMITS.maxDisplacementMm/1000+1e-7);assert.ok(max>.001);
 }finally{before.dispose();after.dispose();b.geometry.dispose();b.material.dispose();}
});

test('Regional portrait mapping preserves triangle orientation and finite normals',async()=>{
 const b=await fixture(),before=buildPortraitSurface(b.userData.base,b.geometry.index,{styleAmount:0}),after=buildPortraitSurface(b.userData.base,b.geometry.index);
 const a=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3(),n1=new T.Vector3(),n2=new T.Vector3();
 const normal=(g,i,out)=>{a.fromBufferAttribute(g.attributes.position,g.index.getX(i));c.fromBufferAttribute(g.attributes.position,g.index.getX(i+1));d.fromBufferAttribute(g.attributes.position,g.index.getX(i+2));return out.copy(c).sub(a).cross(d.sub(a));};
 try{
  assert.ok(after.attributes.normal.array.every(Number.isFinite));
  for(let i=0;i<after.index.count;i+=3){normal(before,i,n1);normal(after,i,n2);if(n1.lengthSq()<1e-24)continue;assert.ok(n1.dot(n2)>0,`Face ${i/3} flipped`);}
 }finally{before.dispose();after.dispose();b.geometry.dispose();b.material.dispose();}
});
