/** Reproducible fixed-material-region metrics. All lengths in cm; not textile certification. */
import * as T from 'three';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const root=process.env.MODEL_ROOT?pathToFileURL(resolve(process.env.MODEL_ROOT)+'/'):new URL('../',import.meta.url);
const {createBody,updateBody,createRestGarment,createClothAdapter,CM_PER_UNIT}=await import(new URL('configurador-3d/fit-lab/fit-mesh.mjs',root));
const {resolveState}=await import(new URL('configurador-3d/fit-lab/lab-model.mjs',root));
const {GARMENT_CATALOG}=await import(new URL('configurador-3d/fit-lab/garment-catalog.mjs',root));
export const PROFILES={A:{},B:{bodyChestCm:72,bodyHipCm:74,frontVolume:1,sideVolume:6,backVolume:0,selectionMode:'manual',activeConfiguration:'N2-3'},C:{selectionMode:'manual',activeConfiguration:'N2-2',bodyChestCm:104,bodyHipCm:114,frontVolume:10,sideVolume:10,backVolume:10}};
export function fixture(input){const state=resolveState(input),body=updateBody(createBody(T),state),garment=createRestGarment(T,GARMENT_CATALOG[state.activeConfiguration]);return {state,body,garment,adapter:createClothAdapter(garment,body)};}
const q=(a,p)=>[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*p)]||0;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function area(a,b,c){const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;}
export function measure({garment,adapter}){
 const s=adapter.solver,p=s.positions,r=s.rest,at=(v,id)=>[v[3*id],v[3*id+1],v[3*id+2]];
 const region={shoulder:[],upper:[],hem:[]};let bytes=0;
 for(const mesh of adapter.surfaces){
  const map=adapter.maps.get(mesh.name),index=mesh.geometry.index.array;
  for(let k=0;k<index.length;k+=3){const ids=[map[index[k]],map[index[k+1]],map[index[k+2]]],rest=ids.map(id=>at(r,id)),cur=ids.map(id=>at(p,id)),y=rest.reduce((v,a)=>v+a[1],0)/3;
   const key=mesh.name.includes('Shoulder')?'shoulder':y>.4?'upper':y<-.6?'hem':null;if(!key)continue;
   const center=[0,1,2].map(axis=>cur.reduce((v,a)=>v+a[axis],0)/3),gap=s.collider.gap(...center)*CM_PER_UNIT;
   region[key].push({gap,area:area(...rest)});
  }
 }
 for(const mesh of garment.children){if(!mesh.isMesh)continue;bytes+=mesh.geometry.index?.array.byteLength||0;for(const attr of Object.values(mesh.geometry.attributes))bytes+=attr.array.byteLength;}
 const stats={};for(const [name,values]of Object.entries(region)){const total=values.reduce((a,b)=>a+b.area,0);stats[name]={samples:values.length,medianGapCm:q(values.map(x=>x.gap),.5),p95GapCm:q(values.map(x=>x.gap),.95),near1cmAreaPct:100*values.filter(x=>x.gap>=-.1&&x.gap<=1).reduce((a,b)=>a+b.area,0)/(total||1)};}
 let kink=0,seamGap=0;
 for(const name of ['Front','Back']){const mesh=garment.getObjectByName('NUBYRA_Test_Jersey_'+name),map=adapter.maps.get(mesh.name),{gridRows:rows,halfColumns:cols}=mesh.geometry.userData;
  for(let h=0;h<2;h++){const o=h*(rows+1)*(cols+1)+rows*(cols+1),y=i=>p[map[o+i]*3+1];for(let i=1;i<cols;i++)kink=Math.max(kink,Math.abs(y(i-1)-2*y(i)+y(i+1))*CM_PER_UNIT);}
 }
 for(const side of ['Left','Right']){const band=garment.getObjectByName('NUBYRA_Test_Shoulder_'+side),map=adapter.maps.get(band.name),{depthRows,columns}=band.userData,half=side==='Left'?0:1;
  for(const [name,row]of [['Front',0],['Back',depthRows]]){const panel=garment.getObjectByName('NUBYRA_Test_Jersey_'+name),other=adapter.maps.get(panel.name),offset=half*25*9+24*9;for(let c=0;c<=columns;c++)seamGap=Math.max(seamGap,distance(at(p,map[row*(columns+1)+c]),at(p,other[offset+c]))*CM_PER_UNIT);}
 }
 const d=s.diagnostics();return {regions:stats,kinkCm:kink,seamGapCm:seamGap,penetrationMm:10*CM_PER_UNIT*Math.max(d.maxPenetrationUnits,d.maxTrianglePenetrationUnits),p95Strain:d.p95Strain,maxStrain:d.maxStrain,particles:d.particles,constraints:d.stretchConstraints+d.bendingConstraints+d.seams,pins:d.pins,meshBytes:bytes,typedSolverBytes:s.rest.byteLength+s.positions.byteLength+s.previous.byteLength+s.velocity.byteLength+s.weights.byteLength};
}
export async function report(){const records=[];for(const [profile,input]of Object.entries(PROFILES))for(const code of Object.keys(GARMENT_CATALOG)){
 const t0=performance.now(),x=fixture({...input,selectionMode:'manual',activeConfiguration:code}),t1=performance.now();x.adapter.solver.settle(90);x.adapter.sync();const t2=performance.now(),m=measure(x);
 records.push({profile,code,body:{chest:x.state.bodyChestCm,hip:x.state.bodyHipCm,height:x.state.bodyHeightCm},...m,setupMs:t1-t0,settle90Ms:t2-t1,requiresReview:m.maxStrain>.5||m.kinkCm>1||x.state.reviewRequired});
 }
 const output={schema:'nubyra-contact/2',basis:'rest-area weighted centroid regions; discrete and synthetic, not full-surface CCD',records};const dir=process.env.EVIDENCE_DIR||'/tmp/contact-report';await mkdir(dir,{recursive:true});await writeFile(dir+'/contact-report.json',JSON.stringify(output,null,2));console.log(JSON.stringify({runs:records.length,maxKinkCm:Math.max(...records.map(r=>r.kinkCm)),maxPenetrationMm:Math.max(...records.map(r=>r.penetrationMm)),review:records.filter(r=>r.requiresReview).map(r=>[r.profile,r.code,r.maxStrain,r.kinkCm])}));return output;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await report();
