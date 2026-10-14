import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createBody,updateBody,ringPerimeter,CM_PER_UNIT,BODY_VERSION} from '../configurador-3d/fit-lab/body-surface.mjs';
import {createOutfitReference,OUTFIT_REFERENCE_VERSION} from '../configurador-3d/fit-lab/outfit-reference.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
function fixture(input={}){const state=resolveState(input),body=updateBody(createBody(T),state),outfit=createOutfitReference(T,body,state);return {state,body,outfit};}
function boundsAt(mesh,row){const p=mesh.geometry.attributes.position,n=mesh.geometry.userData.around;let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(let a=0;a<n;a++){const i=row*(n+1)+a;x0=Math.min(x0,p.getX(i));x1=Math.max(x1,p.getX(i));z0=Math.min(z0,p.getZ(i));z1=Math.max(z1,p.getZ(i));}return {width:x1-x0,depth:z1-z0};}
function dispose(v){v.outfit.destroy();v.body.geometry.dispose();v.body.material.dispose();}
test('upper refinement lifts the chest by a bounded amount without changing measured perimeters or hips',()=>{
 for(const h of [125,143,160,166,190])for(const [chest,hip]of [[72,74],[88,96],[94,96],[113,130]]){
  const v=fixture({bodyHeightCm:h,bodyChestCm:chest,bodyHipCm:hip}),b=v.body,p=b.geometry.attributes.position;
  assert.equal(b.userData.version,BODY_VERSION);assert.equal(v.outfit.snapshot().version,OUTFIT_REFERENCE_VERSION);
  assert.ok(Math.abs(ringPerimeter(b,29)-chest)<.001);assert.ok(Math.abs(ringPerimeter(b,4)-hip)<.001);
  const oldY=1.2+(.29-1.2)*h/160,lift=(b.userData.chestY-oldY)*CM_PER_UNIT;
  assert.ok(lift>1.1&&lift<2.1,'unbounded chest relocation: '+lift);
  for(let r=0;r<=21;r++){const old=1.2+(-1.16+.05*r-1.2)*h/160;assert.ok(Math.abs(p.getY(r*57)-old)<1e-6,'hip/lower rib section moved');}
  for(let r=1;r<=b.userData.rows;r++)assert.ok(p.getY(r*57)>p.getY((r-1)*57),'crossed section heights');
  dispose(v);
 }
});
test('neck has a tapered upper section and head is seated while total reference height stays exact',()=>{
 const v=fixture(),p=v.body.geometry.attributes.position,top=69*57;
 const neckBaseRow=63,base=neckBaseRow*57;assert.ok(p.getX(top)<p.getX(base)*.95,'neck remains cylindrical');
 const head=v.outfit.bodyGroup.getObjectByName('Cabeza neutra de referencia').geometry;head.computeBoundingBox();
 assert.ok(head.boundingBox.min.y<v.outfit.layout.neckTop-.16,'head remains perched on neck top');
 assert.ok(Math.abs(head.boundingBox.max.y-v.outfit.layout.headTop)<1e-6);
 assert.ok(Math.abs((v.outfit.layout.headTop-v.outfit.layout.floor)*CM_PER_UNIT-160)<1e-6);dispose(v);
});
test('shorts keep an open lower leg envelope rather than compressing to the knee',()=>{
 for(const input of [{},{bodyHeightCm:166,bodyChestCm:94,bodyHipCm:96},{bodyHeightCm:143,bodyChestCm:79,bodyHipCm:88}]){
  const v=fixture(input),short=v.outfit.shortsMeshes[0],g=short.geometry,rows=g.userData.rows,p=g.attributes.position;
  const hem=boundsAt(short,rows),above=boundsAt(short,rows-2);
  assert.ok(hem.width>=above.width*.95,'leg tapers like compression shorts');assert.ok(hem.depth>=above.depth*.95);
  const leg=v.outfit.bodyGroup.getObjectByName('Pierna sintética -1'),lp=leg.geometry.attributes.position,ln=leg.geometry.userData.around;
  const hemY=p.getY(rows*(g.userData.around+1));let nearest=0;for(let r=1;r<=leg.geometry.userData.rows;r++)if(Math.abs(lp.getY(r*(ln+1))-hemY)<Math.abs(lp.getY(nearest*(ln+1))-hemY))nearest=r;
  const limb=boundsAt(leg,nearest);assert.ok((hem.width-limb.width)*CM_PER_UNIT>1.5,'no transverse room at hem');
  assert.ok((hem.depth-limb.depth)*CM_PER_UNIT>1.5,'no depth room at hem');
  assert.equal(v.outfit.snapshot().clothSimulated,false);dispose(v);
 }
});
test('visual refinements keep topology, draw groups and lower-body alignment bounded',()=>{
 const v=fixture(),o=v.outfit;
 assert.equal(o.bodyMeshes.length,5);assert.equal(o.shortsMeshes.length,2);
 for(const m of [...o.bodyMeshes,...o.shortsMeshes]){assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));assert.ok([...m.geometry.attributes.normal.array].every(Number.isFinite));}
 for(const m of o.shortsMeshes)assert.equal(m.geometry.groups.length,2);
 const l=o.bodyGroup.getObjectByName('Pierna sintética 1'),f=o.bodyGroup.getObjectByName('Pie de referencia 1');
 const lp=l.geometry.attributes.position,fp=f.geometry.attributes.position,offset=l.geometry.userData.rows*33;
 for(let i=0;i<=32;i++)for(const axis of ['getX','getY','getZ'])assert.ok(Math.abs(lp[axis](offset+i)-fp[axis](i))<1e-6,'feet no longer aligned with leg');
 dispose(v);
});
