import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {authorShortPattern} from '../scripts/build-fixed-shorts.mjs';
import {SHORT_SIZES} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {CM_PER_UNIT} from '../configurador-3d/fit-lab/body-surface.mjs';
import {createShortCloth} from '../configurador-3d/fit-lab/shorts-cloth.mjs';
import {createShortSurfaceCollider} from '../configurador-3d/fit-lab/shorts-contact.mjs';
import {createOptimizedHumanCollider} from '../configurador-3d/fit-lab/static-mesh-query.mjs';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {simulationKey} from '../configurador-3d/fit-lab/human-simulation.mjs';
const b=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url)),bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const hash=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function template(size='N1-2',length=42,rise=33.5){const p=authorShortPattern(SHORT_SIZES[size],length,rise),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.positions,3));g.setIndex(p.indices);return {geometry:g,pattern:p.nominal,key:size+'-'+length};}
test('Authored shorts have three boundary loops, sewn quadrants, outward faces and fixed dimensions',()=>{
 const t=template(),g=t.geometry,p=g.attributes.position,idx=g.index,edges=new Map();
 for(let f=0;f<idx.count;f+=3){const ids=[idx.getX(f),idx.getX(f+1),idx.getX(f+2)],a=new T.Vector3().fromBufferAttribute(p,ids[0]),b=new T.Vector3().fromBufferAttribute(p,ids[1]),c=new T.Vector3().fromBufferAttribute(p,ids[2]);assert.ok(new T.Triangle(a,b,c).getArea()>1e-9);
  for(let i=0;i<3;i++){const x=ids[i],y=ids[(i+1)%3],key=x<y?x+':'+y:y+':'+x;edges.set(key,(edges.get(key)||0)+1);}const center=a.clone().add(b).add(c).divideScalar(3);if(center.y>-.5&&Math.abs(center.z)>.1)assert.ok(new T.Triangle(a,b,c).getNormal(new T.Vector3()).z*center.z>0);
 }
 const adj=new Map();for(const [key,count]of edges){assert.ok(count<=2);if(count===1){const[x,y]=key.split(':').map(Number);for(const[a,b]of [[x,y],[y,x]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}}}for(const a of adj.values())assert.equal(a.length,2);
 const seen=new Set();let loops=0;for(const id of adj.keys()){if(seen.has(id))continue;loops++;const q=[id];while(q.length){const n=q.pop();if(seen.has(n))continue;seen.add(n);q.push(...adj.get(n));}}
 assert.equal(loops,3);assert.ok(Math.abs(t.pattern.measuredHipCm-104)<.02);assert.ok(Math.abs(t.pattern.measuredWaistCm-70)<.02);assert.equal(t.pattern.bodyDerived,false);g.dispose();
});
test('Gravity moves free cloth, not its waist, authored rest or body',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({bodyHeightCm:165,bodyChestCm:86,bodyHipCm:86})),t=template(),before=hash(body.geometry.attributes.position.array),rest=hash(t.geometry.attributes.position.array),a=createShortCloth(t,body),b=createShortCloth(t,body);b.solver.gravity=0;
 for(let i=0;i<90;i++){a.step();b.step();}const d=a.snapshot();assert.equal(d.waistDriftCm,0);assert.equal(d.nominalLengthCm,42);assert.ok(d.meanDropFromInitialCm>.1);assert.notEqual(hash(a.solver.positions),hash(b.solver.positions));assert.ok(d.maxPenetrationUnits*CM_PER_UNIT<.1);assert.ok(d.maxTrianglePenetrationUnits*CM_PER_UNIT<.1);assert.equal(hash(t.geometry.attributes.position.array),rest);assert.equal(hash(body.geometry.attributes.position.array),before);assert.ok(a.solver.positions.every(Number.isFinite));a.destroy();b.destroy();t.geometry.dispose();body.geometry.dispose();body.material.dispose();
});
test('Regional edits affect collision, not authored short seam/rest lengths',async()=>{
 const body=await loadHumanBody(bytes),t=template(),baseline=resolveState({bodyHeightCm:165,bodyChestCm:86,bodyHipCm:96});updateHumanBody(body,baseline);const a=createShortCloth(t,body),rest=hash(a.solver.rest);a.destroy();updateHumanBody(body,{...baseline,gluteProjectionCm:-1.5});const b=createShortCloth(t,body);assert.equal(hash(b.solver.rest),rest);assert.deepEqual(b.solver.edges.map(e=>e.length),a.solver.edges.map(e=>e.length));for(let i=0;i<4;i++)b.step();assert.equal(b.snapshot().waistDriftCm,0);b.destroy();t.geometry.dispose();body.geometry.dispose();body.material.dispose();
});
test('Short code, length and rise are part of joint cache identity',()=>{const s=resolveState({});assert.notEqual(simulationKey(s),simulationKey({...s,shortsSize:'N2-1'}));assert.notEqual(simulationKey(s),simulationKey({...s,shortsLengthCm:50}));assert.notEqual(simulationKey(s),simulationKey({...s,shortsRiseCm:35.5}));});
test('Shirt contacts current short triangles without radial display inflation',async()=>{
 const body=updateHumanBody(await loadHumanBody(bytes),resolveState({})),t=template(),base=createOptimizedHumanCollider(body),short=createShortCloth(t,body),contact=createShortSurfaceCollider(base,short);assert.ok(Number.isFinite(contact.gap(1,body.userData.waistY-.5,.05)));for(let i=0;i<4;i++)short.step();contact.sync();assert.equal(contact.stats().shortSurfaceUpdates,2);assert.equal(contact.stats().visualExtrusion,false);contact.destroy();short.destroy();t.geometry.dispose();body.geometry.dispose();body.material.dispose();
});
