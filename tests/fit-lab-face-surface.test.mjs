import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
test('Complete optical eyes are recessed behind a single skin aperture, not floated over eyelid patches',async()=>{
 const b=updateHumanBody(await loadHumanBody(bytes),resolveState({})),f=createHumanFace(b),g=f.group.children[0].geometry,p=g.attributes.position;
 try{
  assert.equal(f.snapshot().eyeSurface,'recessed-ellipsoid');assert.equal(f.snapshot().eyelids,'integrated-head-surface');assert.equal(g.userData.eyeVertexRanges.length,2);
  // Test the visible forward pole, not every point of the back hemisphere.
  // The obsolete all-z>0.12 check allowed a whole eye to be translated by 2 cm.
  const skin=new T.BufferGeometry();skin.setAttribute('position',p.clone());skin.setIndex(Array.from(g.index.array.slice(0,g.userData.headIndexCount)));
  const tree=new MeshBVH(skin),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
  for(const {start,count,center:[cx,cy]} of g.userData.eyeVertexRanges){
   let min=Infinity,max=-Infinity;for(let i=start;i<start+count;i++){min=Math.min(min,p.getZ(i));max=Math.max(max,p.getZ(i));}
   assert.ok(min>.113&&min<.118);assert.ok(max>.132&&max<.136,'Globe must stay under the external lid, not centimetres ahead');
   for(const dx of[-.003,0,.003]){
    ray.origin.set(cx+dx,cy,.5);const hit=tree.raycastFirst(ray,T.DoubleSide);
    assert.ok(hit.point.z<.12,'Skin must leave the iris aperture open');
   }
   ray.origin.set(cx,cy+.012,.5);assert.ok(tree.raycastFirst(ray,T.DoubleSide).point.z>.13,'Skin must cover above the eye');
  }
  skin.dispose();
 }finally{f.destroy();b.geometry.dispose();b.material.dispose();}
});
