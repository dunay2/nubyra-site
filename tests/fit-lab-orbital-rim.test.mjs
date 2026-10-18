import test from 'node:test';import assert from 'node:assert/strict';
import {readFile}from'node:fs/promises';import * as T from 'three';import {MeshBVH}from'three-mesh-bvh';
import {loadHumanBody,updateHumanBody}from'../configurador-3d/fit-lab/human-body.mjs';
import {resolveState}from'../configurador-3d/fit-lab/lab-model.mjs';import {createHumanFace}from'../configurador-3d/fit-lab/human-face.mjs';
const d=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
test('Visible pupils sit in the real aperture; complete optical backs stay hidden behind the skull',async()=>{
 const b=updateHumanBody(await loadHumanBody(d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength)),resolveState({})),f=createHumanFace(b),g=f.group.children[0].geometry;
 const skin=g.clone(),eyes=g.clone();skin.clearGroups();eyes.clearGroups();skin.setIndex(Array.from(g.index.array.slice(0,g.userData.headIndexCount)));eyes.setIndex(Array.from(g.index.array.slice(g.groups[1].start)));
 const st=new MeshBVH(skin),et=new MeshBVH(eyes),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));
 try{
  for(const {center:[cx,cy]}of g.userData.eyeVertexRanges){
   for(const dx of[-.0015,0,.0015]){
    ray.origin.set(cx+dx,cy,.5);ray.direction.set(0,0,-1);const eye=et.raycastFirst(ray,T.DoubleSide),head=st.raycastFirst(ray,T.DoubleSide);
    assert.ok(eye&&head);assert.ok(eye.point.z>.131&&eye.point.z<.136,'Iris pole outside actual eye bounds');assert.ok(eye.distance<head.distance,'Pupil buried inside the face');
    ray.origin.set(cx+dx,cy,-.5);ray.direction.set(0,0,1);assert.ok(st.raycastFirst(ray,T.DoubleSide).distance<et.raycastFirst(ray,T.DoubleSide).distance,'Eye back visible through the skull');
   }
  }
 }finally{skin.dispose();eyes.dispose();f.destroy();b.geometry.dispose();b.material.dispose();}
});
