/** Cooperative fixed-step warm-up. No fewer steps, modified forces or rest lengths.
 * A replacement job cancels stale work. Browser tasks can run between small batches.
 */
export function createSettleJob({schedule=fn=>setTimeout(fn,0),unschedule=clearTimeout,clock=()=>performance.now(),budgetMs=10,onProgress=()=>{},onDone=()=>{},onError=()=>{}}={}){
 let job=null,timer=null,paused=false,serial=0;
 const stats={completed:0,cancelled:0,batches:0,maxBatchMs:0};
 const request=()=>{if(job&&!paused&&timer===null)timer=schedule(run);};
 function run(){timer=null;if(!job||paused)return;const current=job,start=clock(),wind=current.solver.wind;current.solver.wind=false;
  try{do{current.solver.substep();current.remaining--;current.completed++;}while(current.remaining>0&&clock()-start<budgetMs);
   const elapsed=clock()-start;stats.batches++;stats.maxBatchMs=Math.max(stats.maxBatchMs,elapsed);
   current.solver.wind=wind;
   if(current!==job)return;
   if(current.remaining===0){current.solver.velocity.fill(0);current.solver.maxVelocity=0;job=null;stats.completed++;onDone(current,elapsed);}
   else onProgress(current,elapsed);
   request();
  }catch(error){current.solver.wind=wind;job=null;onError(error);}
 }
 function cancel(){if(timer!==null)unschedule(timer);timer=null;if(job)stats.cancelled++;job=null;serial++;}
 return {start(solver,frames){cancel();const total=Math.ceil((frames/60)/solver.h);job={solver,total,remaining:total,completed:0,id:serial};request();},cancel,
  pause(value){paused=Boolean(value);if(paused&&timer!==null){unschedule(timer);timer=null;}else request();},
  snapshot:()=>({active:Boolean(job),remaining:job?.remaining??0,total:job?.total??0,paused,...stats}),destroy:cancel};
}

/** Render-loop budget only. Fixed physics h is unchanged; under load simulated time
 * can advance slower than wall time, instead of freezing input for a catch-up burst. */
export function advanceWithinBudget(solver,seconds,budgetMs=10,clock=()=>performance.now()){
 if(!Number.isFinite(seconds)||seconds<=0)return 0;
 solver.accumulator=Math.min(1/30,solver.accumulator+Math.min(seconds,1/30));
 const start=clock();let count=0;
 while(solver.accumulator>=solver.h){solver.substep();solver.accumulator-=solver.h;count++;if(clock()-start>=budgetMs)break;}
 return count;
}
