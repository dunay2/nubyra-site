import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {createHumanSimulation} from '../configurador-3d/fit-lab/human-simulation.mjs';
import {createRestGarment} from '../configurador-3d/fit-lab/fit-mesh.mjs';
import {createGarmentFinish} from '../configurador-3d/fit-lab/garment-finish.mjs';
import {GARMENT_CATALOG} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const bytes=await readFile(new URL('../configurador-3d/fit-lab/assets/human-female.glb',import.meta.url));const buffer=()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
test('Local edge finish is finite, continuous, and does not alter body or simulated folds',async()=>{
 const state=resolveState({}),sim=await createHumanSimulation(buffer());sim.prepare(state,1);for(let i=0;i<4;i++)sim.step();const f=sim.frame(true),body=updateHumanBody(await loadHumanBody(buffer()),state);
 const bodyBefore=body.geometry.attributes.position.array.slice(),solverBefore=sim.cacheEntry(),shirt=createRestGarment(T,GARMENT_CATALOG[state.activeConfiguration]);const finish=createGarmentFinish(shirt,f.maps,body);finish.update(f.positions);
 assert.deepEqual(body.geometry.attributes.position.array,bodyBefore);assert.deepEqual(sim.cacheEntry(),solverBefore);assert.equal(finish.snapshot().continuousLoops,3);
 for(const m of shirt.children){if(m.isMesh)assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite),m.name);}
 for(const name of['trim-neck-continuous','trim-armhole-left-continuous','trim-armhole-right-continuous']){const p=shirt.getObjectByName(name).geometry.attributes.position;for(let k=0;k<9;k++)for(const axis of['getX','getY','getZ'])assert.ok(Math.abs(p[axis](k)-p[axis](p.count-9+k))<1e-5,name+' is open');}
 const p=shirt.getObjectByName('NUBYRA_Test_Jersey_Front').geometry.attributes.position,before=p.array.slice();assert.throws(()=>finish.update(new Float32Array([NaN])));assert.deepEqual(p.array,before);finish.destroy();sim.destroy();body.geometry.dispose();body.material.dispose();
});
test('Worker streams complete setup and subsequent physical frames',async()=>{
 const worker=await readFile(new URL('../configurador-3d/fit-lab/human-cloth-worker.mjs',import.meta.url),'utf8'),viewer=await readFile(new URL('../configurador-3d/fit-lab/human-viewer.mjs',import.meta.url),'utf8');
 assert.match(worker,/sendFrame\(true\);schedule\(\)/);assert.match(worker,/lastSend>60\)sendFrame\(\)/);assert.doesNotMatch(viewer,/if\(m\.remaining>0\)\{onFrame\(snapshot\(\)\);return;/);
});
