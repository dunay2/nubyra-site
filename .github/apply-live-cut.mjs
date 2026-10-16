// One-time, checked source migration on fix/fit-lab-live-drape-edges only.
// Removed by the successful review commit; never used at application runtime.
import {readFile,writeFile} from 'node:fs/promises';
const edits=new Map();
async function edit(path,pairs){let s=await readFile(path,'utf8');for(const [old,next]of pairs){if(!s.includes(old))throw Error('Missing expected source in '+path+': '+old.slice(0,70));s=s.replace(old,next);}edits.set(path,s);}
await edit('configurador-3d/fit-lab/human-viewer.mjs',[
 ["import {createOuterGarmentLayer}","import {createGarmentFinish} from './garment-finish.mjs';\nimport {createOuterGarmentLayer}"],
 ["lastTransitionMs=0;","lastTransitionMs=0,lastSettleMs=0,liveFrames=0;"],
 ["function disposeGarment(group=garment){if(!group)return;","function disposeGarment(group=garment){if(!group)return;group.userData.finish?.destroy();"],
 ["for(const mesh of group.children.filter(x=>x.isMesh&&!x.name.startsWith('trim-'))){", "if(group.userData.finish){group.userData.finish.update(frame.positions);for(const edge of edges){const mesh=group.getObjectByName(edge.name);if(mesh){syncSurfaceTrim(mesh.geometry.attributes.position,edge.bindings,frame.positions);mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}}return;}\n  for(const mesh of group.children.filter(x=>x.isMesh&&!x.name.startsWith('trim-'))){"],
 ["kit.attach(next,{active:false});syncGarment(next,frame,nextMaps,nextTrims,reconcile);","kit.attach(next,{active:false});"],
 ["updateHumanBody(stagedBody,frame.state,{collision:false});}","updateHumanBody(stagedBody,frame.state,{collision:false});}\n    next.userData.finish=createGarmentFinish(next,nextMaps,stagedBody||body);syncGarment(next,frame,nextMaps,nextTrims,reconcile);"],
 ["// Do not expose the rest pattern jumping/falling into place during a change.\n      if(m.remaining>0){onFrame(snapshot());return;}","// Publish the first contact-resolved frame; subsequent settling is intentionally visible."],
 ["frameData=m;lastPhysicsState=m.state;", "pendingFrame=null;liveFrames++;if(m.remaining===0&&frameData?.remaining!==0)lastSettleMs=performance.now()-requestStarted;\n    frameData=m;lastPhysicsState=m.state;"],
 ["layering:outerLayer.snapshot(),appearance:","layering:outerLayer.snapshot(),finish:garment?.userData.finish?.snapshot(),appearance:"],
 ["error:transitionError,lastTransitionMs,cacheHit:","error:transitionError,lastTransitionMs,lastSettleMs,liveFrames,mode:'live-settling',cacheHit:"]
]);
await edit('configurador-3d/fit-lab/human-cloth-worker.mjs',[
 ["else if(performance.now()-lastSend>100){self.postMessage(simulation.progress());lastSend=performance.now();}","else if(performance.now()-lastSend>60)sendFrame();"],
 ["if(preparing){self.postMessage(simulation.progress());schedule();}else{sendFrame(true);schedule();}","// Four physical steps resolve initial contacts; do not wait for the full settle.\n  if(preparing)for(let i=0;i<4&&simulation.remaining>0;i++)simulation.step(false);\n  sendFrame(true);schedule();"]
]);
await edit('configurador-3d/fit-lab/human-appearance.mjs',[
 ["human-appearance/1.4","human-appearance/2.0"],
 ["return 1.609 + .035 * (r > 1e-8 ? dz / r : 1) + .008 * Math.sin(theta) ** 2\n      - .006 * Math.exp(-(((theta + .23) / .36) ** 2)) + .0030 * Math.sin(3 * theta) + .0013 * Math.sin(23 * theta + .4);", "const c=r>1e-8?dz/r:1;\n    return 1.603 + .055*Math.max(0,c) - .083*Math.max(0,-c) + .005*Math.sin(theta)**2\n      - .002*Math.exp(-(((theta+.18)/.30)**2)) + .0015*Math.sin(3*theta) + .0004*Math.sin(19*theta+.4);"],
 ["if (ids.every(id => base[id * 3 + 1] < 1.54))", "if (ids.every(id => base[id * 3 + 1] < 1.49))"],
 ["hairStyle: 'short-ponytail', hairMeshes: 3, scalpLocks: 140, tailLocks: 14", "hairStyle: 'soft-mid-ponytail', hairMeshes: 3, scalpLocks: 140, tailLocks: 24"],
 ["base[c * 3 + 1]) > 1.54)","base[c * 3 + 1]) > 1.45)"],
 ["const tie = new T.Vector3(0, 1.680, backZ - .016);", "const tieSurface=onScalp(new T.Vector3(.001,1.646,backZ-.020),0);\n  const tie=tieSurface.clone().addScaledVector(tieSurface.clone().sub(center).normalize(),hairVolume(tieSurface)-.004);"],
 ["target.x = .009 * Math.sin(theta)","target.x = .005 * Math.sin(theta)"],
 ["for (let i = 0; i < 14; i++) {\n      const theta = i * Math.PI * 2 / 14;", "for (let i = 0; i < 24; i++) {\n      const theta = i * Math.PI * 2 / 24;"],
 ["new T.Vector3(.009 * dx, tie.y + .008 * dz, tie.z)","new T.Vector3(tie.x+.008 * dx, tie.y + .007 * dz, tie.z+.004)"],
 ["new T.Vector3(.020 * dx, 1.735 + .008 * dz, backZ - .060)","new T.Vector3(.024 * dx, tie.y-.015 + .010 * dz, backZ - .095)"],
 ["new T.Vector3(.018 * dx, 1.596, backZ - .099 + .014 * dz)","new T.Vector3(.015+.020 * dx, 1.537, backZ - .116 + .015 * dz)"],
 ["new T.Vector3(.008 * dx + .004 * Math.sin(i), 1.533 + .025 * (i % 4) / 3, backZ - .051 + .008 * dz)","new T.Vector3(.012+.009 * dx + .003 * Math.sin(i), 1.481 + .022 * (i % 4) / 3, backZ - .075 + .010 * dz)"],
 ["curve.getPoints(28), .0065, .0042", "curve.getPoints(28), .007, .0045"]
]);
await edit('tests/fit-lab-human-appearance.test.mjs',[["'short-ponytail'","'soft-mid-ponytail'"],["tailLocks, 14","tailLocks, 24"]]);
await edit('scripts/build-fit-lab.mjs',[["release:'responsive-fit-comparison'","release:'live-drape-upper-finish',liveSettling:true,firstFrameBeforeSettle:true"],["hairStyle:'short-ponytail'","hairStyle:'soft-mid-ponytail'"]]);
for(const[path,source]of edits)await writeFile(path,source);
console.log('Applied source files:',[...edits.keys()]);
