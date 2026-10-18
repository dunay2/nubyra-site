import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
test('Eye colour and pupils share a front-facing ocular surface instead of the socket back wall',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({}));
 const face=createHumanFace(body),g=face.group.children[0].geometry,p=g.attributes.position,c=g.attributes.color;
 assert.equal(face.snapshot().eyeSurface,'eyelid-rim-cap');assert.equal(g.userData.eyeVertexRanges.length,2);
 for(const {start,count}of g.userData.eyeVertexRanges){
   let dark=0,light=0;
   for(let i=start;i<start+count;i++){
     assert.ok(p.getZ(i)>.12,'Eye detail is behind the eyelid rim');
     if(c.getX(i)+c.getY(i)+c.getZ(i)<.10)dark++;
     if(c.getX(i)+c.getY(i)+c.getZ(i)>1)light++;
   }
   // The mesh now covers a full ellipsoidal cap, not only the exposed slit.
   // Pupil validity is a geometric/pigment contract, not a tessellation count.
   assert.ok(dark>0,'Missing pupil pigment');assert.ok(light>50,'Missing sclera');
   const uv=g.attributes.eyeCoord;let nearest=-1,d=Infinity,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(let i=start;i<start+count;i++){
     const x=uv.getX(i),y=uv.getY(i),r=Math.hypot(x,y);if(r<d){d=r;nearest=i;}
     minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   }
   assert.ok(d<.00001,'Pupil centre must be sampled');
   assert.ok(c.getX(nearest)+c.getY(nearest)+c.getZ(nearest)<.1,'Pupil centre must be dark');
   assert.ok(minX<-.0051&&maxX>.0051&&minY<-.0051&&maxY>.0051,'Both full iris radii must fit in the ocular cap');
 }
 face.destroy();body.geometry.dispose();body.material.dispose();
});
