import {createProfileSimulationCache} from './profile-simulation-cache.mjs';
import {createHumanSimulation,simulationKey,SettledCache,HUMAN_CLOTH} from './human-simulation.mjs';
export {HUMAN_CLOTH};
let simulation=null,timer=null,requestTimer=null,queued=null,revision=0,paused=false,wind=false,preparing=false,lastSend=0;
const cache=new SettledCache(8),profileCache=createProfileSimulationCache();
let seedGeneration=0;
async function loadProfileSeed(state,rev){
 const generation=++seedGeneration,key=simulationKey(state);
 const seed=await profileCache.get(state);
 if(!seed||generation!==seedGeneration||rev!==revision||queued||!simulation||simulationKey(simulation.state)!==key||!preparing)return;
 if(simulation.useCache(seed)){cache.set(key,seed);complete();schedule();}
}
function sendFrame(setup=false){const m=simulation.frame(setup,wind);self.postMessage(m,[m.positions.buffer,...(m.shorts?[m.shorts.positions.buffer]:[])]);lastSend=performance.now();}
function complete(){if(preparing){cache.set(simulationKey(simulation.state),simulation.cacheEntry());preparing=false;}sendFrame(true);}
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
  self.postMessage({type:'prepared',revision,ms:performance.now()-start});
  // Four physical steps resolve initial contacts; do not wait for the full settle.
  if(preparing)for(let i=0;i<4&&simulation.remaining>0;i++)simulation.step(false);
  sendFrame(true);schedule();if(preparing)void loadProfileSeed(m.state,revision);
 }catch(error){preparing=false;self.postMessage({type:'error',revision,message:error.message});}
}
self.onmessage=async({data:m})=>{
 try{
  if(m.type==='init'){
   if(m.bootstrap?.cache)cache.set(m.bootstrap.cache.key,m.bootstrap.cache);
   simulation=await createHumanSimulation(m.bytes,{shortAsset:m.shortAsset});
   queued=queued?.revision>m.revision?queued:m;applyQueued();
  }else if(m.type==='update'){
   if(m.revision<revision||m.revision<(queued?.revision??0))return;
   queued=m;if(requestTimer)clearTimeout(requestTimer);
   if(simulation)requestTimer=setTimeout(applyQueued,35);
  }else if(m.type==='pause'){
   paused=m.value;if(paused&&!preparing&&timer){clearTimeout(timer);timer=null;}schedule();
  }else if(m.type==='wind'){wind=m.value;if(!preparing&&simulation)sendFrame();schedule();}
  else if(m.type==='settle'){seedGeneration++;simulation?.settle();schedule();}
  else if(m.type==='impulse'){seedGeneration++;simulation?.impulse();schedule();}
 }catch(error){self.postMessage({type:'error',revision,message:error.message});}
};
