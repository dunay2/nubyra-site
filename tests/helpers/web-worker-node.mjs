/** Run the exact browser Worker modules in Node for deterministic CPU benchmarks.
 * No application rewrite: this adapter only translates the Worker message API. */
import {parentPort,workerData,Worker as NodeWorker} from 'node:worker_threads';
globalThis.self=globalThis;
self.postMessage=(message,transfer=[])=>parentPort.postMessage(message,transfer);
class WorkerAdapter{
 constructor(url){
  if(workerData.rejectNested)throw Error('Nested Worker unavailable (fallback test)');
  this.worker=new NodeWorker(new URL('./web-worker-node.mjs',import.meta.url),{workerData:{module:url.href}});
  this.worker.on('message',data=>this.onmessage?.({data}));
  this.worker.on('error',error=>this.onerror?.({message:error.message,preventDefault(){}}));
 }
 postMessage(message,transfer=[]){this.worker.postMessage(message,transfer);}
 terminate(){return this.worker.terminate();}
}
globalThis.Worker=WorkerAdapter;
await import(workerData.module);
parentPort.on('message',data=>self.onmessage({data}));
