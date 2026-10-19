import {BODY_SHAPE_KEYS} from './body-regions.mjs';
import {DRESSING_POSE_VERSION} from './dressing-pose.mjs';
import {SHORT_CLOTH_VERSION} from './shorts-cloth.mjs';
export const TRAJECTORY_VERSION='short-trajectory/1.0-exact';
export const TRAJECTORY_STEPS=360;
const fields=['bodyChestCm','bodyHipCm','bodyHeightCm','bodyBaseChestCm','bodyBaseHipCm','frontVolume','sideVolume','backVolume','armLoweringDeg',...BODY_SHAPE_KEYS,'shortsSize','shortsLengthCm','shortsRiseCm'];
const defaults={armLoweringDeg:0,shortsSize:'N1-2',shortsLengthCm:42,shortsRiseCm:33.5};
/** Jersey does not act on shorts in this one-way solver. Never reuse across bodies,
 * regional edits, poses or short patterns. Scope is one immutable GLB/asset session. */
export const shortTrajectoryKey=s=>[TRAJECTORY_VERSION,SHORT_CLOTH_VERSION,DRESSING_POSE_VERSION,JSON.stringify(fields.map(k=>s[k]??defaults[k]))].join(':');
export class ShortTrajectoryCache{
 constructor({maxBytes=24*1024*1024,maxEntries=2}={}){this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.entries=new Map();this.bytes=0;}
 acquire(key,initial){
  let entry=this.entries.get(key);
  if(entry){if(entry.width!==initial.length||!entry.matches(0,initial)){this.delete(key);entry=null;}else{this.entries.delete(key);this.entries.set(key,entry);return entry;}}
  const width=initial.length,bytes=(TRAJECTORY_STEPS+1)*width*8+TRAJECTORY_STEPS+1;
  if(bytes>this.maxBytes||this.maxEntries<1)return null;
  while(this.bytes+bytes>this.maxBytes||this.entries.size>=this.maxEntries)this.delete(this.entries.keys().next().value);
  const positions=new Float64Array((TRAJECTORY_STEPS+1)*width),valid=new Uint8Array(TRAJECTORY_STEPS+1);
  entry={key,width,bytes,positions,valid,
   matches(step,p){if(p.length!==width)return false;const k=step*width;for(let i=0;i<width;i++)if(!Object.is(positions[k+i],p[i]))return false;return true;},
   record(step,p){if(step<0||step>TRAJECTORY_STEPS||!Number.isInteger(step)||p.length!==width)throw Error('Invalid short trajectory frame');if(valid[step]){if(!this.matches(step,p))throw Error('Short trajectory diverged from the reference computation');return;}positions.set(p,step*width);valid[step]=1;},
   replay(solver){const step=solver.steps+1;if(step>TRAJECTORY_STEPS||!valid[step])return false;
    solver.previous.set(solver.positions);solver.positions.set(positions.subarray(step*width,(step+1)*width));let max=0;
    for(let i=0;i<width;i++){const v=(solver.positions[i]-solver.previous[i])/solver.h;solver.velocity[i]=v;max=Math.max(max,Math.abs(v));}
    solver.time+=solver.h;solver.steps=step;solver.maxVelocity=max;return true;
   },
   get complete(){return valid.every(Boolean);}
  };
  entry.record(0,initial);this.entries.set(key,entry);this.bytes+=bytes;return entry;
 }
 delete(key){const e=this.entries.get(key);if(e){this.bytes-=e.bytes;this.entries.delete(key);}}
 clear(){this.entries.clear();this.bytes=0;}
 stats(){return {version:TRAJECTORY_VERSION,entries:this.entries.size,bytes:this.bytes,maxBytes:this.maxBytes};}
}
