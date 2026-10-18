import {SIMULATION_VERSION,simulationKey} from './human-simulation.mjs';
/** Optional exact-state seeds. A failed or stale request never blocks live physics. */
export function createProfileSimulationCache({fetcher=fetch,digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')}={}){
 let manifest=null;const requests=new Map();
 const index=fetcher(new URL('./profile-cache/index.json',import.meta.url)).then(r=>r.ok?r.json():null).then(m=>{
  if(m?.version===SIMULATION_VERSION&&m?.sourceMeshSha256==='0b3666ee3f05a8d51c0fafc15c464799da305eefc3a60fa97e1bcd499983c758')manifest=m;
 }).catch(()=>{});
 return {async get(state){
  try{
   await index;const key=simulationKey(state),entry=manifest?.entries?.[key];
   if(!entry||!/^R0[1-8]\.json$/.test(entry.file)||!/^[a-f0-9]{64}$/.test(entry.sha256))return null;
   if(!requests.has(key))requests.set(key,(async()=>{
    const r=await fetcher(new URL('./profile-cache/'+entry.file,import.meta.url),{signal:AbortSignal.timeout(3000)});if(!r.ok)return null;
    const bytes=await r.arrayBuffer();if(bytes.byteLength!==entry.bytes||await digest(bytes)!==entry.sha256)return null;
    const data=JSON.parse(new TextDecoder().decode(bytes));return data.key===key?data:null;
   })().catch(()=>null));
   return await requests.get(key);
  }catch{return null;}
 }};
}
