import {Worker} from 'node:worker_threads';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveState} from '../configurador-3d/fit-lab/lab-model.mjs';
const dir=process.env.EVIDENCE_DIR||'artifacts/performance';await mkdir(dir,{recursive:true});
if(!process.env.BASELINE_ROOT)throw Error('Set BASELINE_ROOT to a checkout of baseline 16b7d41');
const baselineRoot=path.resolve(process.env.BASELINE_ROOT);
const b=await readFile('configurador-3d/fit-lab/assets/human-female.glb'),bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const shortAsset=JSON.parse(await readFile('fit-dist/fit-lab/fixed-shorts.json','utf8'));
const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
async function scenario(root,{parallel=true,hardwareConcurrency=8,rejectNested=false,changes=[64,72]}={}){
 const worker=new Worker(new URL('../tests/helpers/web-worker-node.mjs',import.meta.url),{workerData:{module:pathToFileURL(path.join(root,'configurador-3d/fit-lab/human-cloth-worker.mjs')).href,rejectNested}});
 const frames=[],errors=[];let resolve,reject,timer;worker.on('error',e=>{errors.push(e.message);reject?.(e);});
 worker.on('message',f=>{if(f.type==='error'){errors.push(f.message);reject?.(Error(f.message));}if(f.type==='frame'&&f.remaining===0){frames.push(f);resolve?.(f);}});
 async function run(message){return new Promise((r,j)=>{resolve=r;reject=j;timer=setTimeout(()=>j(Error('Worker benchmark timeout')),120000);worker.postMessage(message);}).finally(()=>clearTimeout(timer));}
 const output=[];
 try{for(const [i,desiredLengthCm]of changes.entries()){
  const state={...resolveState({bodyHeightCm:145,bodyChestCm:74,bodyHipCm:82,armLoweringDeg:25,desiredLengthCm}),shortsSize:'N1-1',shortsLengthCm:42,shortsRiseCm:33.5};
  const start=performance.now(),frame=await run({type:i?'update':'init',revision:i+1,state,...(i?{}:{bytes,shortAsset,parallelShorts:parallel,hardwareConcurrency})});
  output.push({length:desiredLengthCm,ms:performance.now()-start,shirt:hash(frame.positions),shorts:hash(frame.shorts.positions),diagnostics:frame.diagnostics,shortDiagnostics:frame.shorts.diagnostics,acceleration:frame.acceleration??null});
 }assert.deepEqual(errors,[]);return output;}finally{await worker.terminate();}
}
const pairs=[];
for(let repeat=0;repeat<Number(process.env.BENCH_REPEATS||3);repeat++){
 const order=repeat%2?['after','before']:['before','after'],pair={};
 for(const mode of order)pair[mode]=await scenario(mode==='after'?process.cwd():baselineRoot);
 for(let i=0;i<2;i++){assert.equal(pair.after[i].shirt,pair.before[i].shirt);assert.equal(pair.after[i].shorts,pair.before[i].shorts);assert.deepEqual(pair.after[i].diagnostics,pair.before[i].diagnostics);assert.deepEqual(pair.after[i].shortDiagnostics,pair.before[i].shortDiagnostics);}
 assert.ok(pair.after[0].acceleration.parallelEnabled);assert.ok(pair.after[0].acceleration.shortStepsReused>0);assert.equal(pair.after[1].acceleration.shortStepsReused,360);
 pairs.push(pair);console.log(JSON.stringify({repeat,before:pair.before.map(x=>x.ms),after:pair.after.map(x=>x.ms),reuse:pair.after.map(x=>x.acceleration.shortStepsReused)}));
 await writeFile(dir+'/timings-partial.json',JSON.stringify(pairs,null,2));
}
const median=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)];
const summary=['cold','jerseyChange'].map((name,i)=>{const beforeMs=median(pairs.map(p=>p.before[i].ms)),afterMs=median(pairs.map(p=>p.after[i].ms));return {name,beforeMs,afterMs,reductionPct:100*(1-afterMs/beforeMs),speedup:beforeMs/afterMs};});
const fallback=await scenario(process.cwd(),{rejectNested:true,changes:[64]});assert.equal(fallback[0].shirt,pairs[0].before[0].shirt);assert.equal(fallback[0].shorts,pairs[0].before[0].shorts);assert.equal(fallback[0].acceleration.parallelEnabled,false);
const lowCore=await scenario(process.cwd(),{hardwareConcurrency:2,changes:[64]});assert.equal(lowCore[0].shirt,pairs[0].before[0].shirt);assert.equal(lowCore[0].shorts,pairs[0].before[0].shorts);assert.equal(lowCore[0].acceleration.parallelEnabled,false);
await writeFile(dir+'/benchmark.json',JSON.stringify({environment:{node:process.version,platform:process.platform,arch:process.arch,logicalCPUs:(await import('node:os')).availableParallelism()},baseline:'16b7d41cca37357ebde2a3afc621ba33f8ca813f',candidate:process.env.GITHUB_SHA||'local',summary,pairs,fallback,lowCore,allPositionHashesEqual:true},null,2));
console.log(JSON.stringify({summary,allPositionHashesEqual:true,fallbackPassed:true}));
