import {createProfileSimulationCache} from './profile-simulation-cache.mjs';
import {createHumanSimulation,simulationKey,SettledCache,HUMAN_CLOTH} from './human-simulation.mjs';
export {HUMAN_CLOTH};
let simulation=null,timer=null,requestTimer=null,queued=null,revision=0,paused=false,wind=false,preparing=false,lastSend=0;
const cache=new SettledCache(8);
let profileCache=null,setupPending=false;
let parallel=null,parallelFailure=null;
function stopParallel(message){simulation?.discardParallelShortFrames();parallel?.terminate();parallel=null;parallelFailure=message;}
function initializeParallel(m){
 // One helper only, and only on hosts reporting capacity for render + two workers.
 if(m.parallelShorts===false||(m.hardwareConcurrency??self.navigator?.hardwareConcurrency??1)<4||typeof Worker==='undefined')return;
 try{
  parallel=new Worker(new URL('./short-trajectory-worker.mjs',import.meta.url),{type:'module'});
  parallel.onmessage=({data:chunk})=>{
   if(chunk.revision!==revision||queued)return;
   if(chunk.type==='short-error'){stopParallel(chunk.message);return;}
   if(chunk.type==='short-frames'){try{simulation?.acceptShortFrames(chunk);}catch(error){stopParallel(error.message);}}
  };
  parallel.onerror=event=>{event.preventDefault?.();stopParallel(event.message||'Parallel worker unavailable');};
  const bytes=m.bytes.slice(0);parallel.postMessage({type:'init',bytes,shortAsset:m.shortAsset},[bytes]);
 }catch(error){stopParallel(error.message);}
}
function requestParallel(){const request=simulation.shortTrajectoryRequest();if(request&&parallel)parallel.postMessage({type:'prepare',...request});}
let seedGeneration=0;
async function loadProfileSeed(state,rev){
 const generation=++seedGeneration,key=simulationKey(state);
 const seed=await profileCache?.get(state);
 if(!seed||generation!==seedGeneration||rev!==revision||queued||!simulation||simulationKey(simulation.state)!==key||!preparing)return;
 if(simulation.useCache(seed)){cache.set(key,seed);complete();schedule();}
}
function sendFrame(setup=false){
 setupPending ||= setup;
 // Keep the last complete outfit visible while the arm-safe dressing pose is swept.
 // Never publish cloth simulated against a different body pose.
 if(!simulation.readyToPresent){self.postMessage(simulation.progress());lastSend=performance.now();return;}
 const m=simulation.frame(setupPending,wind);m.acceleration.parallelEnabled=Boolean(parallel);m.acceleration.parallelFailure=parallelFailure;m.bodyContact.acceleration=m.acceleration;setupPending=false;self.postMessage(m,[m.positions.buffer,...(m.shorts?[m.shorts.positions.buffer]:[])]);lastSend=performance.now();}
function complete(){parallel?.postMessage({type:'cancel',revision});if(preparing){cache.set(simulationKey(simulation.state),simulation.cacheEntry());preparing=false;}sendFrame(true);}
function schedule(){if(!timer&&simulation&&(!paused||preparing)&&(simulation.remaining>0||wind))timer=setTimeout(tick,0);}
function tick(){
 timer=null;if(!simulation||(paused&&!preparing))return;
 try{
  // Yield to edits between small batches. No changes to h, step count or solver equations.
  const deadline=performance.now()+12;let count=0;
  do{simulation.step(wind);count++;}while(simulation.remaining>0&&count<8&&performance.now()<deadline);
  if(simulation.remaining===0){if(preparing)complete();else if(performance.now()-lastSend>32)sendFrame();}
  else if(performance.now()-lastSend>60)sendFrame();
  schedule();
 }catch(error){preparing=false;self.postMessage({type:'error',revision,message:error.message});}
}
function applyQueued(){
 requestTimer=null;if(!simulation||!queued)return;
 const m=queued;queued=null;revision=m.revision;if(timer){clearTimeout(timer);timer=null;}
 try{
  const start=performance.now();simulation.prepare(m.state,revision,cache.get(simulationKey(m.state)));preparing=simulation.remaining>0;
  self.postMessage({type:'prepared',revision,ms:performance.now()-start});if(preparing)requestParallel();
  // Four physical steps resolve initial contacts; do not wait for the full settle.
  if(preparing)for(let i=0;i<4&&simulation.remaining>0;i++)simulation.step(false);
  sendFrame(true);schedule();if(preparing)void loadProfileSeed(m.state,revision);
 }catch(error){preparing=false;self.postMessage({type:'error',revision,message:error.message});}
}
self.onmessage=async({data:m})=>{
 try{
  if(m.type==='init'){
   // Validate precomputed results against the actual GLB received by this Worker,
   // not a historical asset identifier. Missing crypto only disables acceleration.
   try{const digest=await crypto.subtle.digest('SHA-256',m.bytes);
    const sourceMeshSha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    profileCache=createProfileSimulationCache({sourceMeshSha256});
   }catch{profileCache=null;}
   if(m.bootstrap?.cache)cache.set(m.bootstrap.cache.key,m.bootstrap.cache);
   initializeParallel(m);simulation=await createHumanSimulation(m.bytes,{shortAsset:m.shortAsset});
   queued=queued?.revision>m.revision?queued:m;applyQueued();
  }else if(m.type==='update'){
   if(m.revision<revision||m.revision<(queued?.revision??0))return;
   queued=m;parallel?.postMessage({type:'cancel',revision:m.revision});if(requestTimer)clearTimeout(requestTimer);
   if(simulation)requestTimer=setTimeout(applyQueued,35);
  }else if(m.type==='pause'){
   paused=m.value;if(paused&&!preparing&&timer){clearTimeout(timer);timer=null;}schedule();
  }else if(m.type==='wind'){wind=m.value;if(!preparing&&simulation)sendFrame();schedule();}
  else if(m.type==='settle'){seedGeneration++;simulation?.settle();schedule();}
  else if(m.type==='impulse'){seedGeneration++;simulation?.impulse();schedule();}
 }catch(error){self.postMessage({type:'error',revision,message:error.message});}
};
