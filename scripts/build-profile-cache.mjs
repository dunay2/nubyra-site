import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {REFERENCE_PROFILES} from '../configurador-3d/fit-lab/reference-profiles.mjs';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
import {SHORT_SIZES} from '../configurador-3d/fit-lab/fixed-sizes.mjs';
import {SHORT_RISES} from '../configurador-3d/fit-lab/pattern-registry.mjs';
import {loadHumanBody,updateHumanBody} from '../configurador-3d/fit-lab/human-body.mjs';
import {shortSupport,createFixedShortFactory} from '../configurador-3d/fit-lab/fixed-shorts.mjs';
import {createHumanSimulation,SIMULATION_VERSION} from '../configurador-3d/fit-lab/human-simulation.mjs';
/** Build-time acceleration only: all 360 unchanged physics steps for exact default
 * profile inputs. Every other combination continues through the live solver. */
export async function buildProfileCache(destination,shortAsset){
 await mkdir(destination,{recursive:true});const bytes=await readFile('configurador-3d/fit-lab/assets/human-female.glb');
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),body=await loadHumanBody(buffer),factory=createFixedShortFactory(shortAsset);
 const simulation=await createHumanSimulation(buffer,{shortAsset});const entries={};
 try{for(const profile of REFERENCE_PROFILES){
  const state=resolveState({bodyHeightCm:profile.heightCm,bodyChestCm:profile.chestCm,bodyHipCm:profile.hipCm,desiredLengthCm:64});
  updateHumanBody(body,state,{collision:false});const ranked=Object.values(SHORT_SIZES).map(pattern=>({pattern,support:shortSupport(body,pattern)}))
   .sort((a,b)=>Number(a.support.blocked)-Number(b.support.blocked)||Math.abs(a.pattern.hipCm-state.bodyHipCm-8)-Math.abs(b.pattern.hipCm-state.bodyHipCm-8)||a.pattern.code.localeCompare(b.pattern.code));
  let choice=null;
  for(const candidate of ranked){if(candidate.support.blocked)continue;for(const riseCm of SHORT_RISES.filter(r=>r<=41.5)){try{const probe=factory.create(body,{size:candidate.pattern.code,lengthCm:42,riseCm});probe.destroy();choice={shortsSize:candidate.pattern.code,shortsLengthCm:42,shortsRiseCm:riseCm};break;}catch{}}if(choice)break;}
  if(!choice)throw Error('No usable default short seed '+profile.id);
  simulation.prepare({...state,...choice},1);while(simulation.remaining)simulation.step();
  const cache=simulation.cacheEntry(),data=Buffer.from(JSON.stringify(cache)),file=profile.id+'.json';
  await writeFile(destination+'/'+file,data);entries[cache.key]={file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
  console.log('Exact profile seed',profile.id,choice.shortsSize,choice.shortsRiseCm,data.length);
 }}finally{simulation.destroy();factory.destroy();body.geometry.dispose();body.material.dispose();}
 const manifest={version:SIMULATION_VERSION,sourceMeshSha256:createHash('sha256').update(bytes).digest('hex'),steps:360,entries};await writeFile(destination+'/index.json',JSON.stringify(manifest));return manifest;
}
