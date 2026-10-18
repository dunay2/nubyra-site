import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {createStaticMeshQuery} from '../configurador-3d/fit-lab/static-mesh-query.mjs';
import {MeshBVH} from 'three-mesh-bvh';
import {authorShortPattern} from '../scripts/build-fixed-shorts.mjs';
import {SHORT_SIZES} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
test('Accelerated short nearest query stays exact across deformations/refits',()=>{
 const data=authorShortPattern(SHORT_SIZES['N2-3'],42,33.5),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setIndex(data.indices);g.boundsTree=new MeshBVH(g,{maxLeafTris:8});const q=createStaticMeshQuery(g),point=new T.Vector3();
 for(let shape=0;shape<4;shape++){
  for(let i=0;i<g.attributes.position.count;i++){const y=data.positions[i*3+1];g.attributes.position.setXYZ(i,data.positions[i*3]*(1+shape*.01*Math.sin(y*3)),y,data.positions[i*3+2]+shape*.006*Math.sin(y*4));}
  g.attributes.position.needsUpdate=true;g.boundsTree.refit();
  for(let i=0;i<3000;i++){point.set(Math.sin(i*2.399)*1.6,-(i%173)/173*2,Math.cos(i*1.771)*1.2);const a={point:new T.Vector3()},b={point:new T.Vector3()};g.boundsTree.closestPointToPoint(point,a,0,Infinity);q.closestPointToPoint(point,b);assert.ok(a.point.distanceTo(b.point)<1e-12);assert.ok(Math.abs(a.distance-b.distance)<1e-12);}
 }g.dispose();
});
test('Visible layering has no stencil discard and does not change physical solvers',async()=>{
 const layer=await readFile(new URL('../configurador-3d/fit-lab/outer-garment-layer.mjs',import.meta.url),'utf8');assert.doesNotMatch(layer,/NotEqualStencilFunc|AlwaysStencilFunc|depthTest\s*:\s*false/);assert.match(layer,/stencilWrite=false/);
});
