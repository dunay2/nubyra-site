import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createStaticMeshQuery} from '../configurador-3d/fit-lab/static-mesh-query.mjs';
import {loadHumanBody,updateHumanBody,createHumanCollider} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createHumanSimulation} from '../configurador-3d/fit-lab/human-simulation.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const hit=()=>({point:new T.Vector3(),distance:Infinity,faceIndex:-1});
let seed=34567543;
const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
function identical(query,geometry,p){const a=hit(),b=hit();geometry.boundsTree.closestPointToPoint(p,a,0,Infinity);query.closestPointToPoint(p,b);assert.deepEqual(b,a);}

test('Exact static query agrees with the original BVH for points, edges, vertices and body edits',async()=>{
 const body=await loadHumanBody(bytes),state=resolveState({}),geometry=body.geometry;
 updateHumanBody(body,state);const q=createStaticMeshQuery(geometry);
 for(const h of[160,137,190]){
  updateHumanBody(body,resolveState({...state,bodyHeightCm:h,armLoweringDeg:h===160?0:25}));
  for(let i=0;i<4000;i++)identical(q,geometry,new T.Vector3((random()-.5)*4,random()*7-4,(random()-.5)*3));
  const p=geometry.attributes.position,idx=geometry.index;
  for(let i=0;i<p.count;i+=97)identical(q,geometry,new T.Vector3().fromBufferAttribute(p,i));
  for(let f=0;f<idx.count;f+=711){const a=new T.Vector3().fromBufferAttribute(p,idx.getX(f)),b=new T.Vector3().fromBufferAttribute(p,idx.getX(f+1));identical(q,geometry,a.add(b).multiplyScalar(.5));}
 }
 assert.equal(q.stats().rebuilds,3);assert.equal(q.stats().fallbacks,0);
 const point=new T.Vector3(.23,.2,.7),a=hit(),b=hit();q.closestPointToPoint(point,a);q.closestPointToPoint(point,b);assert.deepEqual(a,b);assert.ok(q.stats().memoReuse>0);
 // Replacing an attribute can reset its version. Identity is also part of invalidation.
 geometry.setAttribute('position',geometry.attributes.position.clone());geometry.boundsTree.refit();identical(q,geometry,point);assert.equal(q.stats().rebuilds,4);
 geometry.dispose();body.material.dispose();
});
test('Grouped BVHs use the original multi-root query instead of omitting any surface',()=>{
 const g=new T.BoxGeometry(2,2,2);g.boundsTree=new MeshBVH(g);const q=createStaticMeshQuery(g);
 for(const p of [new T.Vector3(0,0,0),new T.Vector3(-3,0,0),new T.Vector3(2,2,2)])identical(q,g,p);
 assert.equal(q.stats().fallbacks,3);g.dispose();
});
test('Cold 360-step cloth result and wind remain byte-identical, without simplifying contacts or changing folds',async()=>{
 const reference=await createHumanSimulation(bytes,{colliderFactory:createHumanCollider});
 const optimized=await createHumanSimulation(bytes);
 const state=resolveState({bodyHeightCm:153,bodyChestCm:82,bodyHipCm:86,armLoweringDeg:25});reference.prepare(state,1);optimized.prepare(state,1);
 for(let i=0;i<360;i++){reference.step();optimized.step();}
 assert.deepEqual(optimized.cacheEntry(),reference.cacheEntry());assert.deepEqual(optimized.frame().diagnostics,reference.frame().diagnostics);
 for(let i=0;i<12;i++){reference.step(true);optimized.step(true);}
 assert.deepEqual(optimized.cacheEntry(),reference.cacheEntry());assert.ok(optimized.frame().bodyContact.nearestQuery.memoReuse>0);
 optimized.destroy();reference.destroy();
});
