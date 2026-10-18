import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProfileSimulationCache} from '../configurador-3d/fit-lab/profile-simulation-cache.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {SIMULATION_VERSION,simulationKey} from '../configurador-3d/fit-lab/human-simulation.mjs';
const digest=async b=>createHash('sha256').update(Buffer.from(b)).digest('hex');
// Explicit test identity: the Worker supplies the digest of its own GLB.
const mesh='1'.repeat(64);
test('Optional profile seeds require exact state, file digest and source version',async()=>{
 const state=resolveState({}),key=simulationKey(state),bytes=Buffer.from(JSON.stringify({key,steps:360,positions:[1,2,3]}));let calls=0;
 const manifest={version:SIMULATION_VERSION,sourceMeshSha256:mesh,entries:{[key]:{file:'R05.json',bytes:bytes.length,sha256:await digest(bytes)}}};
 const fetcher=async url=>{calls++;return String(url).endsWith('index.json')?new Response(JSON.stringify(manifest)):new Response(bytes);};
 const c=createProfileSimulationCache({sourceMeshSha256:mesh,fetcher,digest});assert.equal((await c.get(state)).key,key);assert.equal((await c.get(state)).steps,360);assert.equal(calls,2);
 assert.equal(await c.get({...state,bodyHipCm:100}),null);assert.equal(calls,2);
 for(const mutation of ['digest','source','path']){const m=structuredClone(manifest);if(mutation==='digest')m.entries[key].sha256='0'.repeat(64);if(mutation==='source')m.sourceMeshSha256='invalid';if(mutation==='path')m.entries[key].file='../bad.json';
  const bad=createProfileSimulationCache({sourceMeshSha256:mesh,digest,fetcher:async url=>String(url).endsWith('index.json')?new Response(JSON.stringify(m)):new Response(bytes)});assert.equal(await bad.get(state),null);
 }
});
test('Missing/offline seeds never prevent custom live simulation',async()=>{
 const c=createProfileSimulationCache({sourceMeshSha256:mesh,fetcher:async()=>{throw Error('offline');},digest});assert.equal(await c.get(resolveState({})),null);
});
test('Seeds for another source mesh are ignored even with a valid state and file digest',async()=>{
 const state=resolveState({}),key=simulationKey(state),bytes=Buffer.from(JSON.stringify({key,steps:360,positions:[1,2,3]}));
 const manifest={version:SIMULATION_VERSION,sourceMeshSha256:mesh,entries:{[key]:{file:'R05.json',bytes:bytes.length,sha256:await digest(bytes)}}};
 let calls=0;const fetcher=async url=>{calls++;return String(url).endsWith('index.json')?new Response(JSON.stringify(manifest)):new Response(bytes);};
 const cache=createProfileSimulationCache({sourceMeshSha256:'2'.repeat(64),fetcher,digest});
 assert.equal(await cache.get(state),null);assert.equal(calls,1);
 for(const sourceMeshSha256 of [undefined,null,'', 'invalid']){
  const invalid=createProfileSimulationCache({sourceMeshSha256,fetcher,digest});
  assert.equal(await invalid.get(state),null);
 }
 assert.equal(calls,1,'No network work for an unknown source mesh');
});
