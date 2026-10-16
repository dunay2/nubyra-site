import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createStaticMeshQuery} from '../configurador-3d/fit-lab/static-mesh-query.mjs';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),state=resolveState({});
let seed=6199;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function compare(g,query,p){const a={point:new T.Vector3()},b={point:new T.Vector3()};g.boundsTree.closestPointToPoint(p,a);query.closestPointToPoint(p,b);assert.deepEqual(b,a);}
test('Specialized nearest query is exact on 18000 off-surface points and shared vertex ties, across body refits',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),state),g=body.geometry,query=createStaticMeshQuery(g),p=new T.Vector3();
 for(const height of [137,153,190]){
  updateHumanBody(body,resolveState({...state,bodyHeightCm:height,bodyChestCm:height===190?112:82,bodyHipCm:height===190?124:86,armLoweringDeg:25}));
  const box=g.boundingBox;
  for(let i=0;i<6000;i++){p.set((random()-.5)*4,box.min.y-.2+random()*(box.max.y-box.min.y+.4),(random()-.5)*3);compare(g,query,p);}
  for(let i=0;i<g.attributes.position.count;i+=47){p.fromBufferAttribute(g.attributes.position,i);compare(g,query,p);}
 }
 body.geometry.dispose();body.material.dispose();
});
test('Grouped BVHs retain the canonical multi-root nearest search',()=>{
 const g=new T.BoxGeometry(1,2,3);g.boundsTree=new MeshBVH(g);const query=createStaticMeshQuery(g);
 for(const p of [new T.Vector3(0,0,0),new T.Vector3(4,1,-3),new T.Vector3(.5,1,1.5)])compare(g,query,p);
 g.dispose();
});
test('Spatial seeds only tighten a bound: coherent queries and refits stay exactly canonical',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),state),g=body.geometry,q=createStaticMeshQuery(g),p=new T.Vector3(),a={point:new T.Vector3()},b={point:new T.Vector3()};
 for(const h of [141,153]){
  updateHumanBody(body,resolveState({bodyHeightCm:h,bodyChestCm:82,bodyHipCm:86,armLoweringDeg:25}));
  for(let i=0;i<12000;i++){
   const t=i/12000*12;p.set(.2+.07*Math.sin(t),body.userData.chestY+.1*Math.cos(t*.8),.4+.06*Math.cos(t));
   g.boundsTree.closestPointToPoint(p,a);q.closestPointToPoint(p,b);assert.deepEqual(b,a);
  }
 }
 assert.ok(q.stats().seededQueries>20000);assert.equal(q.stats().fallbacks,0);assert.equal(q.stats().rebuilds,2);
 body.geometry.dispose();body.material.dispose();
});
