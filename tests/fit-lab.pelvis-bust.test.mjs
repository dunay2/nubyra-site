import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import{createBody,updateBody,ringPerimeter,createCollider,CM_PER_UNIT}from'../configurador-3d/fit-lab/body-surface.mjs';
import{createOutfitReference}from'../configurador-3d/fit-lab/outfit-reference.mjs';
import{createBustReference}from'../configurador-3d/fit-lab/bust-reference.mjs';
import{resolveState}from'../configurador-3d/fit-lab/lab-model.mjs';
const fixture=input=>{const s=resolveState(input),b=updateBody(createBody(T),s),o=createOutfitReference(T,b,s);return {s,b,o};};
function topology(meshes){const points=new Map(),edges=new Map();let faces=0,degenerate=0;
 for(const m of meshes){const p=m.geometry.attributes.position,ids=[],ix=m.geometry.index.array;
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>Math.round(x*1e6)/1e6).join(',');if(!points.has(key))points.set(key,points.size);ids[i]=points.get(key);}
  for(let i=0;i<ix.length;i+=3){const v=[ix[i],ix[i+1],ix[i+2]].map(j=>new T.Vector3().fromBufferAttribute(p,j));if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length()<1e-10){degenerate++;continue;}faces++;
   for(let k=0;k<3;k++){const a=ids[ix[i+k]],b=ids[ix[i+(k+1)%3]],key=[Math.min(a,b),Math.max(a,b)].join(':'),e=edges.get(key)||{a,b,n:0,w:0};e.n++;e.w+=a<b?1:-1;edges.set(key,e);}
  }
 }
 const used=new Set(),adj=new Map();for(const e of edges.values()){used.add(e.a);used.add(e.b);if(e.n===1)for(const [a,b]of [[e.a,e.b],[e.b,e.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}}
 let loops=0;const seen=new Set();for(const a of adj.keys())if(!seen.has(a)){loops++;const stack=[a];while(stack.length){const b=stack.pop();if(seen.has(b))continue;seen.add(b);stack.push(...adj.get(b));}}
 return {loops,degenerate,nonManifold:[...edges.values()].filter(e=>e.n>2||e.n===2&&e.w!==0).length,branched:[...adj.values()].filter(e=>e.length!==2).length,euler:used.size-edges.size+faces};
}
test('pelvis and shorts have one waistband and two leg openings, no internal wall or unstitched crotch',()=>{
 for(const input of [{},{bodyChestCm:94,bodyHipCm:96,bodyHeightCm:166},{bodyChestCm:117,bodyHipCm:72,bodyHeightCm:143}]){
  const v=fixture(input);for(const meshes of [v.o.shortsMeshes,v.o.bodyMeshes.filter(m=>m.name.startsWith('Pierna'))]){
   const d=topology(meshes);assert.equal(d.loops,3);assert.equal(d.euler,-1);assert.equal(d.nonManifold,0);assert.equal(d.branched,0);assert.equal(d.degenerate,0);
  }v.o.destroy();v.b.geometry.dispose();v.b.material.dispose();
 }
});
test('hip to thigh has a curved shared crotch and matched mesh resolution, preserving compact hips and feet',()=>{
 const {b,o}=fixture({bodyChestCm:94,bodyHeightCm:166}),leg=o.bodyGroup.getObjectByName('Pierna sintética 1').geometry,p=leg.attributes.position,n=leg.userData.around;
 assert.equal(n,b.userData.around);assert.equal(o.shortsMeshes[0].geometry.userData.around,n);
 // Outer ring is exactly at torso lower boundary; the inner seam descends continuously.
 for(let a=0;a<=n/2;a++)assert.ok(Math.abs(p.getY(a)-o.layout.joinY)<1e-6);
 assert.ok(o.layout.joinY-p.getY(3*n/4)>.15,'no crotch saddle');
 assert.ok(Math.abs(p.getX(3*n/4))<1e-6,'crotch is not shared on the symmetry plane');
 assert.ok(p.getY(n/2)>p.getY(5*n/8)&&p.getY(5*n/8)>p.getY(3*n/4));
 const foot=o.bodyGroup.getObjectByName('Pie de referencia 1').geometry;
 for(let a=0;a<=n;a++)for(const key of ['getX','getY','getZ'])assert.ok(Math.abs(p[key](leg.userData.rows*(n+1)+a)-foot.attributes.position[key](a))<1e-6);
 o.destroy();b.geometry.dispose();b.material.dispose();
});
test('bust redistributes forward volume monotonically while retaining measured perimeters and section heights',()=>{
 for(const height of [143,160,190]){let previous=-Infinity;for(const frontVolume of [0,3,6,10]){
  const s=resolveState({bodyHeightCm:height,frontVolume,bodyChestCm:94}),b=updateBody(createBody(T),s),p=b.geometry.attributes.position,front=p.getZ(29*57+14)*CM_PER_UNIT;
  assert.ok(front>previous+.05);previous=front;
  assert.ok(Math.abs(ringPerimeter(b,29)-94)<.001);assert.ok(Math.abs(ringPerimeter(b,4)-s.bodyHipCm)<.001);
  for(let r=1;r<=69;r++)assert.ok(p.getY(r*57)>p.getY((r-1)*57));
  assert.ok(b.userData.chestY<b.userData.shoulderY-.25*height/160,'chest too near shoulder');
  b.geometry.dispose();b.material.dispose();
 }}
});
test('sports-bra guide is a removable visual aid from the body surface, not a force or body edit',()=>{
 for(const input of [{},{frontVolume:10},{bodyChestCm:94,bodyHeightCm:166}]){
  const s=resolveState(input),b=updateBody(createBody(T),s),before=b.geometry.attributes.position.array.slice(),g=createBustReference(T,b,s),p=g.mesh.geometry.attributes.position,c=createCollider(b);
  assert.deepEqual(b.geometry.attributes.position.array,before);assert.equal(g.snapshot().simulated,false);assert.equal(g.snapshot().calibrated,false);assert.equal(g.snapshot().bustPlaneY,b.userData.chestY);assert.ok(p.count<8000);
  assert.equal(g.mesh.geometry.groups.length,2);assert.ok([...p.array].every(Number.isFinite));
  let min=Infinity,max=-Infinity;for(let i=0;i<p.count;i++){const d=c.gap(p.getX(i),p.getY(i),p.getZ(i))*CM_PER_UNIT;min=Math.min(min,d);max=Math.max(max,d);}
  assert.ok(min>-.1,'guide visibly penetrates body '+min);assert.ok(max<.5,'guide detached from body '+max);
  g.destroy();b.geometry.dispose();b.material.dispose();
 }
});
