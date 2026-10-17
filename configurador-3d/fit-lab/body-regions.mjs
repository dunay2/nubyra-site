/** Technical limits of this experimental mesh, not anatomical population limits.
 * Values are absolute offsets from an immutable reference, never accumulated deltas.
 * The same function is executed by preview, renderer and the physical Worker. */
export const BODY_REGIONS_VERSION='body-regions/1.0';
export const BODY_REGION_LIMITS=Object.freeze({
 hipWidthPct:Object.freeze({label:'Anchura de cadera',min:-12,max:12,step:1,unit:'%',initial:0}),
 gluteProjectionCm:Object.freeze({label:'Proyección posterior de pelvis',min:-3,max:3,step:.25,unit:'cm',initial:0}),
 abdomenProjectionCm:Object.freeze({label:'Proyección abdominal',min:-2.5,max:3,step:.25,unit:'cm',initial:0}),
 thighWidthPct:Object.freeze({label:'Anchura de muslos',min:-12,max:15,step:1,unit:'%',initial:0}),
 chestProjectionCm:Object.freeze({label:'Proyección del pecho',min:-2,max:2.5,step:.25,unit:'cm',initial:0})
});
export const REGION_KEYS=Object.freeze(Object.keys(BODY_REGION_LIMITS));
export const REGION_DEFAULTS=Object.freeze(Object.fromEntries(REGION_KEYS.map(k=>[k,0])));
export const BODY_SHAPE_KEYS=Object.freeze(['bodyBaseChestCm','bodyBaseHipCm',...REGION_KEYS]);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const band=(y,a,b,c,d)=>smooth((y-a)/(b-a))*(1-smooth((y-c)/(d-c)));
export function boundedRegions(state){
 const result={};for(const key of REGION_KEYS){const spec=BODY_REGION_LIMITS[key],n=Number(state[key]??0);
  if(!Number.isFinite(n))throw Error('Valor regional no válido: '+spec.label);
  result[key]=clamp(n,spec.min,spec.max);
 }return result;
}
/** Triangular map per horizontal plane: X=f(x,y), Z=g(z,x,y), Y unchanged.
 * Smooth finite-support fields, with independent front/back half spaces. No
 * perimeter renormalisation afterwards: reducing the rear never grows the belly. */
export function applyBodyRegions(positions,base,state,{scale,cmPerUnit}){
 const r=boundedRegions(state);if(!REGION_KEYS.some(k=>r[k]))return r;
 for(let i=0;i<positions.length;i+=3){
  const x=base[i],y=base[i+1],z=positions[i+2];
  const torso=1-smooth((Math.abs(x)-.17)/.09);
  const pelvis=band(y,.73,.84,.99,1.12)*torso;
  const thigh=band(y,.46,.56,.67,.775);
  const thighMask=smooth(Math.abs(x)/.055)*(1-smooth((Math.abs(x)-.17)/.08));
  // Symmetrical local width: fixed thigh centre, no shift of knee/feet.
  positions[i]*=1+r.hipWidthPct*.01*pelvis;
  positions[i]+=r.thighWidthPct*.01*thigh*thighMask*(positions[i]-Math.sign(x)*.085*scale);
  const front=z>=0;
  const amount=front?
   r.abdomenProjectionCm*band(y,.90,1.015,1.105,1.19)*torso+
   r.chestProjectionCm*band(y,1.105,1.20,1.29,1.37)*torso:
   r.gluteProjectionCm*band(y,.74,.83,.945,1.07)*torso;
  const radius=.14*scale;
  positions[i+2]=z+(front?1:-1)*amount/cmPerUnit*smooth(Math.abs(z)/radius);
 }
 return r;
}
/** Check local orientation and edge strain against the undeformed reference.
 * This is a local mesh guard, NOT an exhaustive global self-intersection test. */
export function inspectRegionalGeometry(reference,current,index){
 let minNormalDot=1,minEdgeRatio=Infinity,maxEdgeRatio=0,invalid=0;
 for(let j=0;j<current.length;j++)if(!Number.isFinite(current[j]))return {valid:false,reason:'Coordenadas no finitas'};
 for(let j=0;j<index.length;j+=3){
  const a=index[j]*3,b=index[j+1]*3,c=index[j+2]*3;
  const ax=reference[b]-reference[a],ay=reference[b+1]-reference[a+1],az=reference[b+2]-reference[a+2];
  const bx=reference[c]-reference[a],by=reference[c+1]-reference[a+1],bz=reference[c+2]-reference[a+2];
  const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  const dx=current[b]-current[a],dy=current[b+1]-current[a+1],dz=current[b+2]-current[a+2];
  const ex=current[c]-current[a],ey=current[c+1]-current[a+1],ez=current[c+2]-current[a+2];
  const mx=dy*ez-dz*ey,my=dz*ex-dx*ez,mz=dx*ey-dy*ex;
  const n2=nx*nx+ny*ny+nz*nz,m2=mx*mx+my*my+mz*mz;
  if(n2>1e-16){const dot=(nx*mx+ny*my+nz*mz)/Math.sqrt(n2*Math.max(m2,1e-30));minNormalDot=Math.min(minNormalDot,dot);if(dot<.15||m2<n2*.16)invalid++;}
  for(const [u,v]of[[a,b],[b,c],[c,a]]){
   const length=Math.hypot(reference[u]-reference[v],reference[u+1]-reference[v+1],reference[u+2]-reference[v+2]);
   if(length<1e-7)continue;const ratio=Math.hypot(current[u]-current[v],current[u+1]-current[v+1],current[u+2]-current[v+2])/length;
   minEdgeRatio=Math.min(minEdgeRatio,ratio);maxEdgeRatio=Math.max(maxEdgeRatio,ratio);
  }
 }
 const valid=invalid===0&&minEdgeRatio>=.55&&maxEdgeRatio<=1.65;
 return {valid,minNormalDot,minEdgeRatio,maxEdgeRatio,invalid,reason:valid?null:'Tope geométrico: la combinación comprime o gira excesivamente la malla'};
}
