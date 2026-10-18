import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanFace,FACE_VERSION} from '../configurador-3d/fit-lab/human-face.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const file=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
async function fixture(){return updateHumanBody(await loadHumanBody(bytes()),resolveState({}));}
const dispose=b=>{b.geometry.dispose();b.material.dispose();};
test('Portrait cut does not alter body, normals, topology, measurements or BVH',async()=>{
 const b=await fixture(),before=[hash(b.geometry.attributes.position.array),hash(b.geometry.attributes.normal.array),hash(b.geometry.index.array)],tree=b.geometry.boundsTree,m={...b.userData.measurements};
 const oldCompile=b.material.onBeforeCompile,oldKey=b.material.customProgramCacheKey,f=createHumanFace(b),s=f.snapshot();
 assert.equal(s.version,FACE_VERSION);assert.equal(s.browHairs,108);assert.equal(s.extraTextureRequests,0);assert.equal(s.expression,'relaxed-neutral');
 assert.deepEqual([hash(b.geometry.attributes.position.array),hash(b.geometry.attributes.normal.array),hash(b.geometry.index.array)],before);assert.deepEqual(b.userData.measurements,m);assert.equal(b.geometry.boundsTree,tree);
 f.destroy();f.destroy();assert.equal(b.material.onBeforeCompile,oldCompile);assert.equal(b.material.customProgramCacheKey,oldKey);dispose(b);
});
test('Face uses exactly two draw batches, finite optical coordinates and symmetric pupils',async()=>{
 const b=await fixture(),f=createHumanFace(b),g=f.group.children[0].geometry;
 assert.equal(g.groups.length,2);assert.equal(g.groups.reduce((s,x)=>s+x.count,0),g.index.count);
 for(const key of['position','normal','color','eyeCoord'])assert.ok(g.attributes[key].array.every(Number.isFinite),key);
 const ranges=g.userData.eyeVertexRanges;assert.equal(ranges.length,2);assert.equal(ranges[0].count,ranges[1].count);
 const p=g.attributes.position,e=g.attributes.eyeCoord;
 for(const r of ranges){let min=Infinity,found=-1;for(let i=r.start;i<r.start+r.count;i++){const d=Math.hypot(e.getX(i),e.getY(i));if(d<min){min=d;found=i;}}assert.ok(min<.0004);assert.ok(p.getZ(found)>.075,'iris remains in front of socket wall');}
 f.destroy();dispose(b);
});
test('Facial features follow stature without adding geometry or cumulative deformations',async()=>{
 const b=await fixture(),f=createHumanFace(b),g=f.group.children[0].geometry,h=hash(g.attributes.position.array),id=g.id;
 for(const height of[125,145,160,180,200,160]){updateHumanBody(b,resolveState({bodyHeightCm:height}));f.update();assert.equal(g.id,id);assert.equal(hash(g.attributes.position.array),h);assert.ok(f.group.position.toArray().every(Number.isFinite));assert.equal(f.group.scale.x,b.userData.scale/b.userData.unit);}
 f.destroy();dispose(b);
});
test('Shader hooks preserve upstream hooks and add continuous iris without network textures',async()=>{
 const b=await fixture();let called=0;b.material.onBeforeCompile=()=>called++;
 const f=createHumanFace(b),skinShader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 b.material.onBeforeCompile(skinShader,{});assert.equal(called,1);assert.ok(skinShader.uniforms.faceSourceScale.value>0);assert.match(skinShader.fragmentShader,/if\(vFaceSource.y > 1.4650\) discard/);
 const portraitShader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 f.group.getObjectByName('avatar-display-head').material.onBeforeCompile(portraitShader,{});assert.match(portraitShader.fragmentShader,/cheek/);
 assert.match(portraitShader.fragmentShader,/if\(vPortraitSource.y < 1.4650\) discard/);
 const eyeShader={uniforms:{},vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader};f.group.children[0].material[1].onBeforeCompile(eyeShader,{});assert.match(eyeShader.fragmentShader,/fwidth\(r\)/);assert.doesNotMatch(eyeShader.fragmentShader,/https?:/);
 f.destroy();dispose(b);
});
