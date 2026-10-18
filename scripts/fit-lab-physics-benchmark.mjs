import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(process.env.BENCH_ROOT||'.'),dir=process.env.EVIDENCE_DIR||'artifacts/physics-benchmark';await mkdir(dir,{recursive:true});
const {createHumanSimulation}=await import(pathToFileURL(root+'/configurador-3d/fit-lab/human-simulation.mjs'));
const {resolveState}=await import(pathToFileURL(root+'/configurador-3d/fit-lab/lab-model.mjs'));
const b=await readFile(root+'/configurador-3d/fit-lab/assets/human-female.glb'),shortAsset=JSON.parse(await readFile(process.env.SHORT_ASSET||'fit-dist/fit-lab/fixed-shorts.json','utf8'));
const simulation=await createHumanSimulation(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),{shortAsset}),results=[];
try{for(const [label,height,chest,hip,size,short]of[['R08',180,106,118,'N2-3','N2-3'],['R03',155,80,90,'N1-1','N1-1']]){
 const state={...resolveState({bodyHeightCm:height,bodyChestCm:chest,bodyHipCm:hip,selectionMode:'manual',activeConfiguration:size,desiredLengthCm:64}),shortsSize:short,shortsLengthCm:42,shortsRiseCm:33.5};
 const t=performance.now();simulation.prepare(state,1);const prep=performance.now()-t,t1=performance.now();while(simulation.remaining)simulation.step();const steps=performance.now()-t1,c=simulation.cacheEntry();
 const hash=v=>createHash('sha256').update(Buffer.from(Float64Array.from(v).buffer)).digest('hex');results.push({label,prepareMs:prep,stepsMs:steps,totalMs:prep+steps,shirtHash:hash(c.positions),shortHash:hash(c.shortPositions),state});
 }}finally{simulation.destroy();}await writeFile(dir+'/'+(process.env.BENCH_NAME||'current')+'.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
