import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadHumanBody,updateHumanBody,createHumanCollider,humanSection} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanFace} from '../configurador-3d/fit-lab/human-face.mjs';
import {createHumanOutfit} from '../configurador-3d/fit-lab/human-outfit.mjs';
import {resolveState,transition} from '../configurador-3d/fit-lab/lab-model.mjs';
const data=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));
const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const release=b=>{b.geometry.dispose();b.material.dispose();};

test('Arm lowering is bounded, resettable and independent of garment selection',()=>{
 const s=resolveState({}),a=transition(s,{type:'measure',key:'armLoweringDeg',value:22});
 assert.equal(a.armLoweringDeg,22);assert.equal(a.activeConfiguration,s.activeConfiguration);
 assert.equal(resolveState({armLoweringDeg:999}).armLoweringDeg,25);assert.equal(transition(a,{type:'reset'}).armLoweringDeg,0);
});
test('Arm pose lowers hands, preserves torso sections, and is exactly reversible',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({}));
 const before=body.geometry.attributes.position.array.slice(),ring=humanSection(body,'chest').map(p=>p.toArray());
 const hip=humanSection(body,'hip').map(p=>p.toArray());let hand=0;for(let i=0;i<body.userData.base.length;i+=3)if(body.userData.base[i]>.48){hand=i;break;}
 for(const angle of[15,25]){updateHumanBody(body,resolveState({armLoweringDeg:angle}));const p=body.geometry.attributes.position.array;
 assert.ok(p[hand+1]<before[hand+1]-.1);assert.ok(p[hand]<before[hand]-.1);
 assert.deepEqual(humanSection(body,'chest').map(p=>p.toArray()),ring);assert.deepEqual(humanSection(body,'hip').map(p=>p.toArray()),hip);
 assert.strictEqual(createHumanCollider(body).geometry,body.geometry);assert.ok([...p].every(Number.isFinite));}
 updateHumanBody(body,resolveState({}));assert.deepEqual(body.geometry.attributes.position.array,before);release(body);
});
test('Facial features do not mutate the approved body, measurements, normals or BVH',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({})),before=body.geometry.attributes.position.array.slice(),indices=body.geometry.index.array.slice(),normals=body.geometry.attributes.normal.array.slice(),tree=body.geometry.boundsTree;
 const face=createHumanFace(body);assert.deepEqual(body.geometry.attributes.position.array,before);assert.deepEqual(body.geometry.index.array,indices);assert.deepEqual(body.geometry.attributes.normal.array,normals);assert.strictEqual(body.geometry.boundsTree,tree);
 assert.equal(face.snapshot().eyes,true);let disposed=0;face.group.children[0].geometry.addEventListener('dispose',()=>disposed++);
 for(const h of[125,160,190]){updateHumanBody(body,resolveState({bodyHeightCm:h}));face.update();assert.ok(Number.isFinite(face.group.position.y));assert.ok([...face.group.children[0].geometry.attributes.position.array].every(Number.isFinite));}
 face.destroy();face.destroy();assert.equal(disposed,1);assert.equal(face.group.parent,null);release(body);
});
test('Shorts vertices and face centres cover the medial pelvis without hiding body geometry',async()=>{
 for(const config of[{bodyHeightCm:160,bodyChestCm:88,bodyHipCm:96},{bodyHeightCm:170,bodyChestCm:84,bodyHipCm:94},{bodyHeightCm:145,bodyChestCm:78,bodyHipCm:88},{bodyHeightCm:180,bodyChestCm:110,bodyHipCm:120}]){
 const state=resolveState(config),body=updateHumanBody(await loadHumanBody(bytes),state),collider=createHumanCollider(body),before=body.geometry.attributes.position.array.slice();
 for(const length of[30,40,45]){const outfit=createHumanOutfit(body,state,{lengthCm:length}),p=outfit.mesh.geometry.attributes.position,idx=outfit.mesh.geometry.index;
 let min=Infinity;for(let i=0;i<p.count;i++)min=Math.min(min,collider.gap(p.getX(i),p.getY(i),p.getZ(i)));
 assert.ok(min>-.0001,`Vertex penetration ${min} at ${JSON.stringify(config)} / ${length}`);
 for(let i=0;i<idx.count;i+=3){const ids=[0,1,2].map(k=>idx.getX(i+k)),x=ids.reduce((s,i)=>s+p.getX(i),0)/3,y=ids.reduce((s,i)=>s+p.getY(i),0)/3,z=ids.reduce((s,i)=>s+p.getZ(i),0)/3;
 if(Math.abs(x)<.15&&y>body.userData.sourceToY(.765))assert.ok(collider.gap(x,y,z)>-.001,`Medial face penetrates body: ${x},${y},${z} gap=${collider.gap(x,y,z)} config=${JSON.stringify(config)} length=${length}`);}
 assert.equal(outfit.coverage.bodyHidden,false);assert.deepEqual(body.geometry.attributes.position.array,before);outfit.destroy();}release(body);}
});
test('Coverage remains independent of jersey length with relaxed arms',async()=>{
 const state=resolveState({armLoweringDeg:25}),body=updateHumanBody(await loadHumanBody(bytes),state);
 const a=createHumanOutfit(body,state),b=createHumanOutfit(body,{...state,garmentLengthCm:84});
 assert.deepEqual(a.mesh.geometry.attributes.position.array,b.mesh.geometry.attributes.position.array);assert.deepEqual(a.mesh.geometry.index.array,b.mesh.geometry.index.array);a.destroy();b.destroy();release(body);
});
test('No fold suppression: solver, rest pattern, material and normal reconciler remain byte-identical',async()=>{
 const expected=JSON.parse(await readFile(new URL('../docs/fit-lab/fold-preservation.json',import.meta.url),'utf8'));
 for(const [file,hash]of Object.entries(expected)){const actual=createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');assert.equal(actual,hash,file+' changed');}
});
