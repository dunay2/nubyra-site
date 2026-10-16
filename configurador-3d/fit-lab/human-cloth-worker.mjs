import * as T from 'three';
import {loadHumanBody,updateHumanBody,createHumanCollider} from './human-body.mjs';
import {createRestGarment,createClothAdapter} from './fit-mesh.mjs';
import {GARMENT_CATALOG} from './garment-catalog.mjs';
import {DEMO_CLOTH} from './cloth-material.mjs';
import {addHumanSurfaceContacts} from './human-contacts.mjs';
export const HUMAN_CLOTH={...DEMO_CLOTH,id:'human-bvh-demo-v1',stepSeconds:1/240,iterations:4};
let body=null,adapter=null,garment=null,contacts=null,state=null,revision=0,timer=null,paused=false,wind=false,remaining=0,total=0,lastSend=0,loaded=false,queued=null,preparing=false;
function disposeGarment(){contacts?.destroy();if(garment)garment.traverse(m=>{if(m.isMesh){m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.dispose();}});}
function send(setup=false){if(!adapter)return;const s=adapter.solver;const message={type:'frame',revision,state,positions:Float32Array.from(s.positions),diagnostics:s.diagnostics(),remaining,total,sleeping:remaining===0&&!wind,bodyContact:adapter.solver.collider.stats(),reverseContact:contacts.stats()};
 if(setup){message.maps=Object.fromEntries(adapter.maps);message.trims=adapter.trims.map(x=>({name:x.mesh.name,bindings:x.bindings}));message.material=HUMAN_CLOTH;}
 self.postMessage(message,[message.positions.buffer]);lastSend=performance.now();
}
function schedule(){if(!timer&&(!paused||preparing)&&adapter&&(remaining>0||wind))timer=setTimeout(tick,0);}
function tick(){timer=null;if((paused&&!preparing)||!adapter)return;try{adapter.solver.wind=wind&&remaining===0;adapter.solver.substep();if(remaining>0)remaining--;if(remaining===0){preparing=false;if(!wind)adapter.solver.velocity.fill(0);send();}else if(performance.now()-lastSend>100)send();schedule();}catch(e){self.postMessage({type:'error',revision,message:e.message});}}
function apply(next,rev){revision=rev;state=next;const start=performance.now();updateHumanBody(body,state);disposeGarment();garment=createRestGarment(T,GARMENT_CATALOG[state.activeConfiguration]);adapter=createClothAdapter(garment,body,{colliderFactory:createHumanCollider,material:HUMAN_CLOTH,clearance:.016});contacts=addHumanSurfaceContacts(adapter,body);total=remaining=360;preparing=true;send(true);self.postMessage({type:'prepared',revision,ms:performance.now()-start});schedule();}
self.onmessage=async({data:m})=>{try{
 if(m.type==='init'){body=await loadHumanBody(m.bytes);loaded=true;apply(queued?.state??m.state,queued?.revision??m.revision);queued=null;}
 else if(m.type==='update'){if(!loaded){queued=m;return;}apply(m.state,m.revision);}
 else if(m.type==='pause'){paused=m.value;if(paused&&!preparing&&timer){clearTimeout(timer);timer=null;}schedule();}
 else if(m.type==='wind'){wind=m.value;if(adapter)adapter.solver.wind=wind;schedule();}
 else if(m.type==='settle'){if(adapter){total=remaining=360;schedule();send();}}
 else if(m.type==='impulse'){if(adapter){adapter.solver.impulse();total=remaining=160;schedule();}}
 }catch(e){self.postMessage({type:'error',revision,message:e.message});}};
