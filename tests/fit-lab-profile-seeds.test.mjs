import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProfileSimulationCache} from '../configurador-3d/fit-lab/profile-simulation-cache.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {SIMULATION_VERSION,simulationKey} from '../configurador-3d/fit-lab/human-simulation.mjs';
const digest=async b=>createHash('sha256').update(Buffer.from(b)).digest('hex');
const mesh='0b3666ee3f05a8d51c0fafc15c464799da305eefc3a60fa97e1bcd499983c758';
test('Optional profile seeds require exact state, file digest and source version',async()=>{
 const state=resolveState({}),key=simulationKey(state),bytes=Buffer.from(JSON.stringify({key,steps:360,positions:[1,2,3]}));let calls=0;
 const manifest={version:SIMULATION_VERSION,sourceMeshSha256:mesh,entries:{[key]:{file:'R05.json',bytes:bytes.length,sha256:await digest(bytes)}}};
 const fetcher=async url=>{calls++;return String(url).endsWith('index.json')?new Response(JSON.stringify(manifest)):new Response(bytes);};
 const c=createProfileSimulationCache({fetcher,digest});assert.equal((await c.get(state)).key,key);assert.equal((await c.get(state)).steps,360);assert.equal(calls,2);
 assert.equal(await c.get({...state,bodyHipCm:100}),null);assert.equal(calls,2);
 for(const mutation of ['digest','source','path']){const m=structuredClone(manifest);if(mutation==='digest')m.entries[key].sha256='0'.repeat(64);if(mutation==='source')m.sourceMeshSha256='invalid';if(mutation==='path')m.entries[key].file='../bad.json';
  const bad=createProfileSimulationCache({digest,fetcher:async url=>String(url).endsWith('index.json')?new Response(JSON.stringify(m)):new Response(bytes)});assert.equal(await bad.get(state),null);
 }
});
test('Missing/offline seeds never prevent custom live simulation',async()=>{
 const c=createProfileSimulationCache({fetcher:async()=>{throw Error('offline');},digest});assert.equal(await c.get(resolveState({})),null);
});
