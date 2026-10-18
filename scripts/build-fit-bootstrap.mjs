import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createHumanSimulation,SIMULATION_VERSION} from '../configurador-3d/fit-lab/human-simulation.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
export async function buildBootstrap(destination,input={},shortAsset=null){
 const b=await readFile('configurador-3d/fit-lab/assets/human-female.glb');
 const sim=await createHumanSimulation(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),{shortAsset});
 try{
  sim.prepare(resolveState(input),1);while(sim.remaining)sim.step();
  const f=sim.frame(true);f.positions=Array.from(f.positions);if(f.shorts)f.shorts.positions=Array.from(f.shorts.positions);
  const payload={version:SIMULATION_VERSION,sourceMeshSha256:createHash('sha256').update(b).digest('hex'),cache:sim.cacheEntry(),frame:f};
  await writeFile(destination,JSON.stringify(payload));
 }finally{sim.destroy();}
}
