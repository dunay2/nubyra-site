import * as T from 'three';
import {ClothSolver} from './cloth-solver.mjs';
import {createOptimizedHumanCollider} from './static-mesh-query.mjs';
import {CM_PER_UNIT} from './body-surface.mjs';
export const SHORT_CLOTH_VERSION='waist-supported-xpbd/1.0';
export const SHORT_CLOTH_MATERIAL=Object.freeze({id:'shorts-demo-network-v1',arealDensityKgM2:.18,distanceComplianceMPerN:.0001,bendDistanceComplianceMPerN:10,friction:.22,stepSeconds:1/240,iterations:5,calibrated:false});
/** Fixed sewn rest surface. Body edits affect collision and waist support only. */
export function createShortCloth(template,body,{material=SHORT_CLOTH_MATERIAL,collider=createOptimizedHumanCollider(body)}={}){
 const src=template.geometry.attributes.position,index=template.geometry.index,positions=[],map=[],lookup=new Map();
 for(let i=0;i<src.count;i++){
  const xyz=[src.getX(i),src.getY(i),src.getZ(i)],key=xyz.map(v=>Math.round(v*1e6)).join(':');
  if(!lookup.has(key)){lookup.set(key,positions.length/3);positions.push(...xyz);}map.push(lookup.get(key));
 }
 const triangles=[],edgeMap=new Map(),opposites=new Map();
 for(let i=0;i<index.count;i+=3){const t=[map[index.getX(i)],map[index.getX(i+1)],map[index.getX(i+2)]];if(new Set(t).size!==3)continue;triangles.push(t);
  for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=a<b?a+':'+b:b+':'+a;edgeMap.set(k,[a,b]);const o=opposites.get(k)||[];o.push(t[(j+2)%3]);opposites.set(k,o);}
 }
 const bends=[...opposites.values()].filter(v=>v.length===2&&v[0]!==v[1]),waistY=body.userData.waistY,pins=[],ray=new T.Ray(new T.Vector3(),new T.Vector3());
 for(let id=0;id<positions.length/3;id++)if(positions[id*3+1]>-.06/CM_PER_UNIT){
  const x=positions[id*3],z=positions[id*3+2],r=Math.hypot(x,z);if(r<1e-7)throw Error('Cinturilla inválida');
  ray.origin.set(0,waistY-.001,0);ray.direction.set(x/r,0,z/r);const h=body.geometry.boundsTree.raycastFirst(ray,T.DoubleSide);if(!h)throw Error('No se encuentra el soporte de cintura');
  const radius=Math.hypot(h.point.x,h.point.z)+.3/CM_PER_UNIT;pins.push({id,position:[x/r*radius,waistY,z/r*radius]});
 }
 if(pins.length<8)throw Error('El patrón no tiene una cinturilla continua');
 const solver=new ClothSolver({positions,triangles,edges:[...edgeMap.values()],bends,pins,collider,initialTranslation:[0,waistY,0],material,unitMeters:CM_PER_UNIT/100,clearance:.30/CM_PER_UNIT});
 const renderPositions=new Float32Array(src.count*3);let initialMeanY=0;for(let i=0;i<solver.weights.length;i++)initialMeanY+=solver.positions[i*3+1]/solver.weights.length;
 function render(){for(let i=0;i<map.length;i++){const j=map[i]*3;renderPositions[i*3]=solver.positions[j];renderPositions[i*3+1]=solver.positions[j+1];renderPositions[i*3+2]=solver.positions[j+2];}return renderPositions;}
 return {solver,render,map,pins,template,step(){solver.substep();},snapshot(){const d=solver.diagnostics();let meanY=0,minY=Infinity;for(let i=0;i<solver.weights.length;i++){const y=solver.positions[i*3+1];meanY+=y/solver.weights.length;minY=Math.min(minY,y);}return {...d,version:SHORT_CLOTH_VERSION,waistY,waistDriftCm:d.pinErrorUnits*CM_PER_UNIT,meanDropFromInitialCm:(initialMeanY-meanY)*CM_PER_UNIT,visibleVerticalLengthCm:(waistY-minY)*CM_PER_UNIT,nominalLengthCm:template.pattern.lengthCm,nominalRiseCm:template.pattern.riseReferenceCm,restPatternChanged:false,bodyChanged:false,clothSimulated:true,materialCalibrated:false};},destroy(){}};
}
