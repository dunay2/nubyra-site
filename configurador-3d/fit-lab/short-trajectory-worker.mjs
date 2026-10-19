import {loadHumanBody,updateHumanBody} from './human-body.mjs';
import {createOptimizedHumanCollider} from './static-mesh-query.mjs';
import {createFixedShortFactory} from './fixed-shorts.mjs';
import {createShortCloth} from './shorts-cloth.mjs';
import {dressingArmAngle} from './dressing-pose.mjs';
import {shortTrajectoryKey,TRAJECTORY_STEPS} from './short-trajectory.mjs';
let body=null,factory=null,cloth=null,state=null,revision=0,key=null,angle=0,timer=null,queued=null;
function stop(){if(timer!==null)clearTimeout(timer);timer=null;cloth?.destroy();cloth=null;}
function schedule(){if(timer===null&&cloth)timer=setTimeout(tick,0);}
function tick(){
 timer=null;if(!cloth)return;
 try{
  const width=cloth.solver.positions.length,first=cloth.solver.steps+1,buffer=new Float64Array(width*8),deadline=performance.now()+12;let count=0;
  do{
   const next=dressingArmAngle(state.armLoweringDeg??0,cloth.solver.steps);
   if(next!==angle){angle=next;updateHumanBody(body,{...state,armLoweringDeg:angle});}
   cloth.step();buffer.set(cloth.solver.positions,count*width);count++;
  }while(cloth.solver.steps<TRAJECTORY_STEPS&&count<8&&performance.now()<deadline);
  const positions=count===8?buffer:buffer.slice(0,count*width);
  self.postMessage({type:'short-frames',revision,key,fromStep:first,positions},[positions.buffer]);
  if(cloth.solver.steps<TRAJECTORY_STEPS)schedule();else stop();
 }catch(error){stop();self.postMessage({type:'short-error',revision,message:error.message});}
}
function prepare(m){
 stop();revision=m.revision;state=m.state;key=m.key;
 if(key!==shortTrajectoryKey(state))throw Error('Parallel short key mismatch');
 updateHumanBody(body,{...state,armLoweringDeg:0});angle=0;
 const template=factory.template({size:state.shortsSize??'N1-2',lengthCm:state.shortsLengthCm??42,riseCm:state.shortsRiseCm??33.5});
 cloth=createShortCloth(template,body,{collider:createOptimizedHumanCollider(body)});
 const positions=cloth.solver.positions.slice();self.postMessage({type:'short-frames',revision,key,fromStep:0,positions},[positions.buffer]);schedule();
}
self.onmessage=async({data:m})=>{
 try{
  if(m.type==='init'){body=await loadHumanBody(m.bytes);factory=createFixedShortFactory(m.shortAsset);if(queued){const next=queued;queued=null;prepare(next);}}
  else if(m.type==='prepare'){if(m.revision<revision||m.revision<(queued?.revision??0))return;if(!body||!factory)queued=m;else prepare(m);}
  else if(m.type==='cancel'&&m.revision>=revision){queued=null;stop();revision=m.revision;}
 }catch(error){stop();self.postMessage({type:'short-error',revision:m.revision??revision,message:error.message});}
};
