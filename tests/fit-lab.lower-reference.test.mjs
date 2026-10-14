import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createBody,updateBody,createCollider,CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createOutfitReference,OUTFIT_REFERENCE_VERSION} from '../configurador-3d/fit-lab/outfit-reference.mjs';
function fixture(input={},length=40){const state=resolveState(input),body=updateBody(createBody(T),state),outfit=createOutfitReference(T,body,state,{shortsLengthCm:length});return {state,body,outfit};}
function normalsEqual(a,ia,b,ib){const an=a.attributes.normal,bn=b.attributes.normal;return ['getX','getY','getZ'].every(get=>Math.abs(an[get](ia)-bn[get](ib))<1e-5);}

test('elongated feet have a closed flat sole, project forward and meet the ankles without a normal seam',()=>{
 for(const height of [125,143,160,190]){
  const {outfit}=fixture({bodyHeightCm:height,bodyHipCm:height===143?72:96}),L=outfit.layout;
  for(const side of [-1,1]){
   const foot=outfit.bodyGroup.getObjectByName('Pie de referencia '+side).geometry,leg=outfit.bodyGroup.getObjectByName('Pierna sintética '+side).geometry;
   const p=foot.attributes.position,b=foot.boundingBox,{rows,around}=foot.userData;
   assert.ok(b.max.z-b.min.z>2*(b.max.x-b.min.x),'foot must be longer than wide');
   assert.ok(b.max.z>2*Math.abs(b.min.z),'toe must project forward of heel');
   let sole=0;for(let i=0;i<p.count;i++){assert.ok(p.getY(i)>=L.floor-1e-6);if(Math.abs(p.getY(i)-L.floor)<1e-6)sole++;}
   assert.equal(sole,around+2,'flat perimeter and centre on the ground');
   assert.equal(foot.index.count,rows*around*6+around*3,'sole is actually triangulated');
   assert.ok(foot.attributes.normal.getY(p.count-1)<-.99,'sole winding must face down');
   for(let i=0;i<=around;i++){
    const j=leg.userData.rows*(around+1)+i;
    for(const axis of ['getX','getY','getZ'])assert.ok(Math.abs(p[axis](i)-leg.attributes.position[axis](j))<1e-6,'ankle gap');
    assert.ok(normalsEqual(foot,i,leg,j),'ankle normal discontinuity');
   }
   const ringWidth=row=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<around;i++){const x=leg.attributes.position.getX(row*(around+1)+i);lo=Math.min(lo,x);hi=Math.max(hi,x);}return hi-lo;};
   assert.ok(ringWidth(32)<ringWidth(20)*.6,'ankle must narrow relative to calf');
  }
  outfit.destroy();
 }
});

test('reference height, short length, finite geometry and synthetic status are preserved over 27 combinations',()=>{
 for(const h of [125,160,190])for(const hip of [72,96,130])for(const length of [25,40,60]){
  const {state,body,outfit}=fixture({bodyHeightCm:h,bodyHipCm:hip},length),copy=body.geometry.attributes.position.array.slice();
  assert.ok(Math.abs((outfit.layout.headTop-outfit.layout.floor)*CM_PER_UNIT-h)<1e-6);
  assert.equal(outfit.snapshot().version,OUTFIT_REFERENCE_VERSION);
  assert.equal(outfit.snapshot().clothSimulated,false);assert.equal(outfit.snapshot().anthropometryValidated,false);
  for(const mesh of [...outfit.bodyMeshes,...outfit.shortsMeshes]){
   assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...mesh.geometry.attributes.normal.array].every(Number.isFinite));
  }
  for(const mesh of outfit.shortsMeshes){assert.ok(Math.abs((mesh.geometry.boundingBox.max.y-mesh.geometry.boundingBox.min.y)*CM_PER_UNIT-length)<.001);assert.equal(mesh.geometry.groups.length,2);}
  assert.deepEqual(body.geometry.attributes.position.array,copy,'lower reference must not mutate the collider');
  outfit.destroy();
 }
});

test('shorts have continuous periodic normals and only longitudinal color groups, never a horizontal band',()=>{
 const {outfit}=fixture();
 for(const mesh of outfit.shortsMeshes){const g=mesh.geometry,{rows,around}=g.userData;
  for(let row=0;row<=rows;row++)assert.ok(normalsEqual(g,row*(around+1),g,row*(around+1)+around),'periodic seam');
  const [main,stripe]=g.groups;assert.equal(main.materialIndex,0);assert.equal(stripe.materialIndex,1);
  assert.equal(stripe.count,rows*5*6,'same 5 circumferential cells at every height');
  const heights=new Set();for(let i=stripe.start;i<stripe.start+stripe.count;i++)heights.add(Math.floor(g.index.array[i]/(around+1)));
  assert.equal(heights.size,rows+1,'stripe must run top to hem');
 }
});

test('upper shorts closely follow the actual body ring instead of an outer ellipse protruding through the shirt',()=>{
 for(const input of [{},{bodyChestCm:117,bodyHipCm:72,bodyHeightCm:143}]){
  const {body,outfit}=fixture(input),c=createCollider(body);let maxGap=-Infinity;
  for(const m of outfit.shortsMeshes){const p=m.geometry.attributes.position,{rows,around}=m.geometry.userData;
   for(let r=0;r<=rows;r++)for(let a=0;a<=around/2;a++){const i=r*(around+1)+a;if(p.getY(i)<=outfit.layout.joinY+.01)continue;
    maxGap=Math.max(maxGap,c.gap(p.getX(i),p.getY(i),p.getZ(i)));
   }
  }
  assert.ok(maxGap<.007,'reference waistband outside the shirt collision shell: '+maxGap);
 }
});
