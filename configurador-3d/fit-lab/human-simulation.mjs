import * as T from 'three';
import {loadHumanBody,updateHumanBody,createHumanCollider} from './human-body.mjs';
import {createRestGarment,createClothAdapter} from './fit-mesh.mjs';
import {GARMENT_CATALOG} from './garment-catalog.mjs';
import {DEMO_CLOTH} from './cloth-material.mjs';
import {addHumanSurfaceContacts} from './human-contacts.mjs';

export const SIMULATION_VERSION='human-simulation/1.0';
export const HUMAN_CLOTH={...DEMO_CLOTH,id:'human-bvh-demo-v1',stepSeconds:1/240,iterations:4};
export const SETTLE_STEPS=360;
const FIELDS=['bodyChestCm','bodyHipCm','bodyHeightCm','frontVolume','sideVolume','backVolume','armLoweringDeg','activeConfiguration'];
export const simulationKey=state=>SIMULATION_VERSION+':'+JSON.stringify(FIELDS.map(key=>state[key]));

/** Bounded session cache. Entries are settled physical results, never scaled render meshes. */
export class SettledCache {
 constructor(limit=8){this.limit=limit;this.entries=new Map();}
 get(key){const v=this.entries.get(key);if(v){this.entries.delete(key);this.entries.set(key,v);}return v;}
 set(key,value){this.entries.delete(key);this.entries.set(key,value);while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);}
}

/** Same pattern, material and fixed-step solver used by the viewer and build-time bootstrap. */
export async function createHumanSimulation(bytes){
 const body=await loadHumanBody(bytes);let adapter=null,garment=null,contacts=null,state=null,revision=0;
 let remaining=0,total=SETTLE_STEPS,cacheHit=false;
 function disposeGarment(){contacts?.destroy();if(garment){const materials=new Set();garment.traverse(m=>{if(m.isMesh){m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material])materials.add(mat);}});materials.forEach(m=>m.dispose());}}
 function prepare(next,rev,cached){
  state=next;revision=rev;disposeGarment();updateHumanBody(body,state);
  garment=createRestGarment(T,GARMENT_CATALOG[state.activeConfiguration]);
  adapter=createClothAdapter(garment,body,{colliderFactory:createHumanCollider,material:HUMAN_CLOTH,clearance:.016});
  contacts=addHumanSurfaceContacts(adapter,body);remaining=total=SETTLE_STEPS;cacheHit=false;
  const s=adapter.solver;
  if(cached?.key===simulationKey(state)&&cached.positions?.length===s.positions.length&&cached.steps===SETTLE_STEPS&&cached.positions.every(Number.isFinite)){
   s.positions.set(cached.positions);s.previous.set(cached.positions);s.velocity.fill(0);s.steps=SETTLE_STEPS;s.time=SETTLE_STEPS*s.h;s.maxVelocity=0;remaining=0;cacheHit=true;
  }
 }
 function step(wind=false){if(!adapter)return;const s=adapter.solver;s.wind=wind&&remaining===0;s.substep();if(remaining>0){remaining--;if(remaining===0){s.velocity.fill(0);s.maxVelocity=0;}}}
 function frame(setup=false,wind=false){
  const s=adapter.solver;
  const m={type:'frame',revision,state,positions:Float32Array.from(s.positions),diagnostics:s.diagnostics(),remaining,total,sleeping:remaining===0&&!wind,bodyContact:s.collider.stats(),reverseContact:contacts.stats(),cacheHit};
  if(setup){m.maps=Object.fromEntries(adapter.maps);m.trims=adapter.trims.map(x=>({name:x.mesh.name,bindings:x.bindings}));m.material=HUMAN_CLOTH;}
  return m;
 }
 return {
  prepare,step,frame,get remaining(){return remaining;},get total(){return total;},get state(){return state;},
  progress:()=>({type:'progress',revision,remaining,total}),
  cacheEntry:()=>({key:simulationKey(state),steps:SETTLE_STEPS,positions:Array.from(adapter.solver.positions)}),
  impulse(){adapter?.solver.impulse();remaining=total=160;},
  settle(){if(adapter)remaining=total=SETTLE_STEPS;},
  destroy(){disposeGarment();body.geometry.dispose();body.material.dispose();}
 };
}
