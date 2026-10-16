import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHumanSimulation,SETTLE_STEPS} from '../configurador-3d/fit-lab/human-simulation.mjs';
import {createOptimizedHumanCollider} from '../configurador-3d/fit-lab/static-mesh-query.mjs';
import {createHumanCollider} from '../configurador-3d/fit-lab/human-body.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const dir=process.env.EVIDENCE_DIR||'artifacts/performance';await mkdir(dir,{recursive:true});
const data=await readFile('configurador-3d/fit-lab/assets/human-female.glb'),bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const cases=[['reported-141',{bodyHeightCm:141,bodyChestCm:75,bodyHipCm:79}],['reported-153',{bodyHeightCm:153,bodyChestCm:82,bodyHipCm:86,armLoweringDeg:25}],['oversized-137',{bodyHeightCm:137,bodyChestCm:84,bodyHipCm:89,selectionMode:'manual',activeConfiguration:'N2-3'}]];
const results=[];
for(let n=0;n<cases.length;n++){
 const [name,input]=cases[n],state=resolveState(input),row={name,state,modes:{}};let reference;
 // Alternate execution order; both algorithms run cold with no settled-result cache.
 for(const mode of n%2?['optimized','reference']:['reference','optimized']){
  const start=performance.now(),sim=await createHumanSimulation(bytes,{colliderFactory:mode==='optimized'?createOptimizedHumanCollider:createHumanCollider});
  const loaded=performance.now();sim.prepare(state,1);const prepared=performance.now();
  for(let i=0;i<SETTLE_STEPS;i++)sim.step();const settled=performance.now(),frame=sim.frame();
  row.modes[mode]={loadMs:loaded-start,prepareMs:prepared-loaded,settleMs:settled-prepared,diagnosticsMs:performance.now()-settled,query:frame.bodyContact,diagnostics:frame.diagnostics};
  const entry=sim.cacheEntry();if(reference)assert.deepEqual(entry,reference);else reference=entry;sim.destroy();
 }
 row.identicalCoordinates=true;row.speedup=row.modes.reference.settleMs/row.modes.optimized.settleMs;results.push(row);console.log(JSON.stringify(row));
}
await writeFile(dir+'/collision-benchmark.json',JSON.stringify({node:process.version,steps:SETTLE_STEPS,cache:'disabled in both modes',results},null,2));
