import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createBody,updateBody,ringPerimeter,CM_PER_UNIT,BODY_VERSION} from '../configurador-3d/fit-lab/body-surface.mjs';
import {createOutfitReference} from '../configurador-3d/fit-lab/outfit-reference.mjs';import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const fixture=input=>{const s=resolveState(input),b=updateBody(createBody(T),s),o=createOutfitReference(T,b,s);return {s,b,o};};
const width=(g,r)=>{let lo=Infinity,hi=-Infinity;const p=g.attributes.position,{around}=g.userData;for(let a=0;a<around;a++){lo=Math.min(lo,p.getX(r*(around+1)+a));hi=Math.max(hi,p.getX(r*(around+1)+a));}return hi-lo;};
function sectionWidth(g,y){const p=g.attributes.position,{rows,around}=g.userData;let r=0;while(r<rows&&p.getY((r+1)*(around+1))>y)r++;const a=width(g,r),b=width(g,Math.min(rows,r+1)),ya=p.getY(r*(around+1)),yb=p.getY(Math.min(rows,r+1)*(around+1));return ya===yb?a:a+(b-a)*(ya-y)/(ya-yb);}

test('raised chest preserves entered perimeter, hip plane, waist plane and total body bounds',()=>{
 for(const height of [125,143,160,190])for(const chest of [72,94,113]){
  const {s,b,o}=fixture({bodyHeightCm:height,bodyChestCm:chest}),p=b.geometry.attributes.position,scale=height/160;
  assert.equal(b.userData.version,BODY_VERSION);
  assert.ok(Math.abs(ringPerimeter(b,29)-chest)<.001);assert.ok(Math.abs(ringPerimeter(b,4)-s.bodyHipCm)<.001);
  assert.ok(Math.abs(b.userData.chestY-(1.2+(.38-1.2)*scale))<1e-6);
  assert.ok(Math.abs(p.getY(16*57)-(1.2+(-.36-1.2)*scale))<1e-6,'waist moved');
  assert.ok(Math.abs((o.layout.headTop-o.layout.floor)*CM_PER_UNIT-height)<1e-5);
  o.destroy();b.geometry.dispose();b.material.dispose();
 }
});
test('neck tapers gradually and remains below an attached, wider neutral head',()=>{
 for(const input of [{},{bodyChestCm:94,bodyHeightCm:166},{bodyChestCm:117,bodyHipCm:72,bodyHeightCm:143}]){
  const {b,o}=fixture(input),p=b.geometry.attributes.position,around=b.userData.around;
  const at=y=>{let closest=0;for(let r=1;r<=69;r++)if(Math.abs(p.getY(r*57)-y)<Math.abs(p.getY(closest*57)-y))closest=r;return p.getX(closest*57);};
  assert.ok(at(b.userData.neckBaseY)>p.getX(69*57)*1.1,'neck is still a cylinder');
  const head=o.bodyGroup.getObjectByName('Cabeza neutra de referencia').geometry,box=head.boundingBox;
  assert.ok(box.max.x-box.min.x>2*p.getX(69*57)*1.2,'head indistinguishable from neck width');
  assert.ok(box.min.y<o.layout.neckTop,'head floats above neck');assert.ok(Math.abs(box.max.y-o.layout.headTop)<1e-6);
  assert.ok([...head.attributes.normal.array].every(Number.isFinite));
  o.destroy();b.geometry.dispose();b.material.dispose();
 }
});
test('shorts have a free leg opening rather than matching the thigh taper',()=>{
 for(const input of [{},{bodyChestCm:94,bodyHipCm:96,bodyHeightCm:166},{bodyHipCm:72,bodyHeightCm:143}]){
  const {b,o}=fixture(input);
  for(const side of [-1,1]){const short=o.shortsGroup.getObjectByName('Pantalón visual '+side).geometry,leg=o.bodyGroup.getObjectByName('Pierna sintética '+side).geometry,last=short.userData.rows;
   const y=short.attributes.position.getY(last*(short.userData.around+1)),bodyWidth=sectionWidth(leg,y),hemWidth=width(short,last);
   assert.ok((hemWidth-bodyWidth)*CM_PER_UNIT>1.5,'hem reads as compression wear');
   assert.ok(width(short,last)>width(short,last-2)*.92,'lower opening tapers like the leg');
   assert.equal(short.groups.length,2);assert.equal(o.snapshot().clothSimulated,false);
  }
  o.destroy();b.geometry.dispose();b.material.dispose();
 }
});
test('feet and ankles stay aligned under the hips, with exact ground contact and fixed nominal shorts length',()=>{
 for(const h of [125,166,190])for(const hip of [72,96,130]){
  const {b,o}=fixture({bodyHeightCm:h,bodyHipCm:hip}),bodyHalfWidth=b.geometry.attributes.position.getX(0);
  for(const side of [-1,1]){const foot=o.bodyGroup.getObjectByName('Pie de referencia '+side).geometry,leg=o.bodyGroup.getObjectByName('Pierna sintética '+side).geometry,p=foot.attributes.position;
   const box=foot.boundingBox;assert.ok(Math.abs((box.min.x+box.max.x)/2-side*bodyHalfWidth*.42)<1e-6);
   assert.ok(Math.abs(box.min.y-o.layout.floor)<1e-6);for(let a=0;a<=32;a++){const j=32*33+a;for(const k of ['getX','getY','getZ'])assert.ok(Math.abs(p[k](a)-leg.attributes.position[k](j))<1e-6);}
  }
  for(const m of o.shortsMeshes)assert.ok(Math.abs((m.geometry.boundingBox.max.y-m.geometry.boundingBox.min.y)*CM_PER_UNIT-40)<.001);
  o.destroy();b.geometry.dispose();b.material.dispose();
 }
});
