import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBody,updateBody,createCollider,ringPerimeter,CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
import {createRestGarment,createClothAdapter} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';
const bodyFor=input=>updateBody(createBody(THREE),resolveState(input));

test('torso is a closed, nondegenerate, consistently wound surface after angular seam welding',()=>{
 const body=bodyFor({}),p=body.geometry.attributes.position,index=body.geometry.index.array,ids=[],vertices=new Map(),edges=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(6)).join(',');if(!vertices.has(key))vertices.set(key,vertices.size);ids.push(vertices.get(key));}
 let volume=0;
 for(let i=0;i<index.length;i+=3){
  const tri=[index[i],index[i+1],index[i+2]],v=tri.map(j=>new THREE.Vector3().fromBufferAttribute(p,j));
  const cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));assert.ok(cross.length()>1e-8,'degenerate triangle');volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
  for(let k=0;k<3;k++){const a=ids[tri[k]],b=ids[tri[(k+1)%3]],key=[Math.min(a,b),Math.max(a,b)].join(':');const e=edges.get(key)||{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);}
 }
 for(const e of edges.values()){assert.equal(e.count,2,'each edge belongs to two faces');assert.equal(e.direction,0,'opposite face winding');}assert.ok(volume>0);assert.equal(vertices.size-edges.size+index.length/3,2);
});

test('neck and shoulders are explicit; chest and hip perimeter remain exact over 36 extreme combinations',()=>{
 for(const bodyChestCm of [65,88,120])for(const bodyHipCm of [70,130])for(const frontVolume of [0,10])for(const sideVolume of [0,5,10]){
  const b=bodyFor({bodyChestCm,bodyHipCm,frontVolume,sideVolume,backVolume:10}),m=b.userData,p=b.geometry.attributes.position;
  assert.ok(m.neckBaseY>m.shoulderY&&m.shoulderY>m.chestY);assert.ok(m.shoulderHalfWidth>m.neckHalfWidth*2.5);
  assert.ok(Math.abs(ringPerimeter(b,29)-bodyChestCm)<.001);assert.ok(Math.abs(ringPerimeter(b,4)-bodyHipCm)<.001);
  assert.ok([...p.array].every(Number.isFinite));
  for(let r=0;r<=m.rows;r++)for(let a=0;a<m.around;a++){const j=r*(m.around+1)+a,k=r*(m.around+1)+(m.around/2-a+m.around)%m.around;assert.ok(Math.abs(p.getX(j)+p.getX(k))<1e-6);assert.ok(Math.abs(p.getZ(j)-p.getZ(k))<1e-6);}
 }
});

test('upper body has continuous ring transitions and broad rather than point-like anterior volume',()=>{
 const b=bodyFor({frontVolume:10}),p=b.geometry.attributes.position,{around,rows}=b.userData;
 for(let a=0;a<around;a++)for(let r=28;r<rows;r++){const i=r*(around+1)+a,j=i+around+1;assert.ok(Math.hypot(p.getX(i)-p.getX(j),p.getZ(i)-p.getZ(j))<.14,'bounded ring transition');}
 const center=29*57+14,z=p.getZ(center);assert.ok(p.getZ(center-5)>z*.65);assert.ok(p.getZ(center+5)>z*.65);
 const n=b.geometry.attributes.normal;for(let r=0;r<=rows;r++){const a=r*57,b=a+56;for(const axis of ['getX','getY','getZ'])assert.ok(Math.abs(n[axis](a)-n[axis](b))<1e-7);}
});

test('collider follows the nonuniform body rings, closed caps and sloping shoulder surface',()=>{
 const body=bodyFor({}),c=createCollider(body),p=body.geometry.attributes.position,m=body.userData;
 for(let r=0;r<=m.rows;r++)for(let a=0;a<m.around;a++){const i=r*(m.around+1)+a;assert.ok(Math.abs(c.gap(p.getX(i),p.getY(i),p.getZ(i)))<1e-6,'visual vertex on collider');}
 const x=m.shoulderHalfWidth*.65,z=.1,y=c.surfaceHeight(x,z);
 assert.ok(y<m.neckBaseY&&y>m.shoulderY);
 const projected=c.project(x,y-.015,z,.012);assert.ok(projected);assert.ok(projected[1]>y-.015,'contact has an upward shoulder component');assert.ok(c.gap(...projected)>.0119);
 const inside=c.project(0,c.ys.at(-1)-.003,0,.012);assert.ok(inside[1]>c.ys.at(-1));
});

test('small body in oversized N2-3 preserves its rest pattern and neckline bindings with shoulder support',()=>{
 const body=bodyFor({bodyChestCm:72,bodyHipCm:74,frontVolume:1,sideVolume:6,backVolume:0}),garment=createRestGarment(THREE,GARMENT_CATALOG['N2-3']),a=createClothAdapter(garment,body);
 const rest=a.solver.rest.slice();
 for(const pin of a.solver.pins){assert.ok(Math.abs(pin.position[0])>body.userData.neckHalfWidth*1.5);assert.ok(pin.position[1]<body.userData.neckBaseY);}
 a.solver.settle(120);a.sync();assert.deepEqual(a.solver.rest,rest);
 const d=a.solver.diagnostics();assert.equal(d.pinErrorUnits,0);assert.ok(d.maxPenetrationUnits*CM_PER_UNIT<.1);assert.ok(d.maxTrianglePenetrationUnits*CM_PER_UNIT<.1);
 assert.ok(d.p95Strain<.15);assert.ok([...a.solver.positions].every(Number.isFinite));
});
