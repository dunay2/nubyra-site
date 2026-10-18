import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {loadHumanBody,updateHumanBody,createHumanCollider} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanAppearance} from '../configurador-3d/fit-lab/human-appearance.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const state={bodyHeightCm:170,bodyChestCm:84,bodyHipCm:94,frontVolume:3,sideVolume:5,backVolume:5,armLoweringDeg:25};

test('Rounded crown and attached ponytail have finite surfaces without a disconnected root',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),state),a=createHumanAppearance(body);
 try{
  const scalp=a.group.children[0].geometry,tail=a.group.children[2].geometry,p=scalp.attributes.position;
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<p.count;i++)if(p.getY(i)>scalp.boundingBox.max.y-.0008){minX=Math.min(minX,p.getX(i));maxX=Math.max(maxX,p.getX(i));minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));}
  assert.ok(maxX-minX>.01&&maxZ-minZ>.01,'Crown must have a rounded area, not a single pointed vertex');
  const copy=scalp.clone(),tree=new MeshBVH(copy),hit={point:new T.Vector3()},v=new T.Vector3();let nearest=Infinity;
  for(let i=0;i<32;i++){tree.closestPointToPoint(v.fromBufferAttribute(tail.attributes.position,i),hit);nearest=Math.min(nearest,hit.distance);}
  assert.ok(nearest<.001,'Ponytail root visibly detached from cap');copy.dispose();
  let vertices=0;
  for(const m of a.group.children){
   vertices+=m.geometry.attributes.position.count;
   const g=m.geometry,idx=g.index,pos=g.attributes.position,n=g.attributes.normal,x=new T.Vector3(),y=new T.Vector3(),z=new T.Vector3();
   assert.ok([...n.array].every(Number.isFinite));
   for(let i=0;i<idx.count;i+=3){x.fromBufferAttribute(pos,idx.getX(i));y.fromBufferAttribute(pos,idx.getX(i+1));z.fromBufferAttribute(pos,idx.getX(i+2));assert.ok(y.sub(x).cross(z.sub(x)).lengthSq()>1e-28,'Collapsed hair triangle');}
  }
  assert.ok(vertices<60000,'Hair vertex budget regressed');
 }finally{a.destroy();body.geometry.dispose();body.material.dispose();}
});

test('Ponytail clears the real head and neck in five heights; creation does not edit body normals',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),state),normals=body.geometry.attributes.normal.array.slice(),a=createHumanAppearance(body);
 try{
  assert.deepEqual(body.geometry.attributes.normal.array,normals);
  for(const height of[125,145,170,200,210]){
   updateHumanBody(body,{...state,bodyHeightCm:height});a.update();body.updateMatrixWorld(true);
   const col=createHumanCollider(body),m=a.group.children[2],p=m.geometry.attributes.position,v=new T.Vector3();
   for(let i=0;i<p.count;i+=7){m.localToWorld(v.fromBufferAttribute(p,i));assert.ok(col.gap(v.x,v.y,v.z)*CM_PER_UNIT>.04,'Ponytail intersects the real head/neck');}
  }
 }finally{a.destroy();body.geometry.dispose();body.material.dispose();}
});
