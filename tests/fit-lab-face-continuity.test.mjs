import * as T from 'three';import {MeshBVH} from 'three-mesh-bvh';
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {mountReleaseIdentity} from '../configurador-3d/fit-lab/release-identity.mjs';
const bytes=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
test('Ocular cap has continuous depths, covers both pupils, and never floats centimetres ahead',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),resolveState({}));const face=createHumanFace(body);
 try{
  const g=face.group.children[0].geometry,p=g.attributes.position;
  for(const range of g.userData.eyeVertexRanges){
   assert.equal(range.count,49*13);
   for(let row=0;row<13;row++)for(let col=0;col<49;col++){
    const i=range.start+row*49+col,z=p.getZ(i);assert.ok(z>.12&&z<.14,'Depth must lie near actual orbital rim');
    if(col>0)assert.ok(Math.abs(z-p.getZ(i-1))<.001,'Discontinuous column depth');
   }
   const middle=range.start+6*49+24;assert.ok(p.getZ(middle)>.131&&p.getZ(middle)<.138);
  }
  const s=face.snapshot();assert.equal(s.depthSearchSteps,0);assert.equal(s.drawBatches,2);assert.ok(s.constructionVertices<6000);assert.ok(s.sampleQueries<2400);
 }finally{face.destroy();body.geometry.dispose();body.material.dispose();}
});
test('Only verified commit IDs may be presented as a published build',async()=>{
 const label={dataset:{},textContent:'',title:'',removeAttribute(name){if(name==='data-commit')delete this.dataset.commit;}};
 const root={getElementById:()=>label};let options;
 const good=await mountReleaseIdentity({root,fetcher:async(_,o)=>{options=o;return {ok:true,json:async()=>({commit:'a'.repeat(40),faceVersion:'test-face'})};}});
 assert.equal(options.cache,'no-store');assert.equal(good.commit,label.dataset.commit);assert.equal(label.textContent,'Lab · aaaaaaa');
 const bad=await mountReleaseIdentity({root,fetcher:async()=>({ok:true,json:async()=>({commit:'local'})})});
 assert.equal(bad,null);assert.equal(label.dataset.commit,undefined);assert.match(label.textContent,/no verificada/);
 const unavailable=await mountReleaseIdentity({root,fetcher:async()=>{throw Error('offline');}});assert.equal(unavailable,null);
});

test('Eye surface is visible at the pupil but occluded by source skin at its perimeter',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),resolveState({}));const face=createHumanFace(body);
 const source=face.group.getObjectByName('avatar-display-head').geometry.clone(),tree=new MeshBVH(source),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
 try{
  const g=face.group.children[0].geometry,p=g.attributes.position;
  for(const r of g.userData.eyeVertexRanges){
   const at=(row,col)=>r.start+row*49+col;
   for(const i of [at(0,24),at(12,24),at(6,0),at(6,48)]){
    ray.origin.set(p.getX(i),p.getY(i),.5);const hit=tree.raycastFirst(ray,T.DoubleSide);
    assert.ok(hit&&p.getZ(i)<hit.point.z-.0001,'Ocular perimeter must sit behind orbital skin');
   }
   const i=at(6,24);ray.origin.set(p.getX(i),p.getY(i),.5);const hit=tree.raycastFirst(ray,T.DoubleSide);
   assert.ok(hit&&p.getZ(i)>hit.point.z+.01,'Pupil centre must be in front of the recessed socket');
  }
  assert.equal(face.snapshot().lidOverlays,0);
 }finally{source.dispose();face.destroy();body.geometry.dispose();body.material.dispose();}
});
