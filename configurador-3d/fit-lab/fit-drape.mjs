/**
 * Aproximación geométrica a la caída de una camiseta de geometría de reposo FIJA.
 * No es simulación de gravedad, contacto integral, elasticidad ni certificado textil.
 *
 * Conserva una trayectoria central del panel delantero aproximadamente constante
 * mientras la desplaza alrededor de la proyección anterior del cuerpo sintético.
 * La geometría de reposo depende EXCLUSIVAMENTE de un catálogo finito.
 */
export const BODY_PROFILES=Object.freeze({
  front:Object.freeze({code:'front',label:'Proyección frontal',lateral:0.72,front:2.35,back:0}),
  lateral:Object.freeze({code:'lateral',label:'Distribución lateral',lateral:1.65,front:1.25,back:0}),
  thorax:Object.freeze({code:'thorax',label:'Volumen torácico distribuido',lateral:1.32,front:1.12,back:.58})
});
/**
 * Relieve del busto: variable geométrica independiente del perímetro de pecho.
 * CERO = ausencia de protrusión local; NUNCA se admiten niveles negativos.
 * No es una medida antropométrica en cm.
 */
export const BUST_PROJECTION_MIN=0;
export const BUST_PROJECTION_MAX=10;
export const DEFAULT_BUST_PROJECTION=3;
export function normalizeBustProjection(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(BUST_PROJECTION_MIN,
    Math.min(BUST_PROJECTION_MAX,n)):DEFAULT_BUST_PROJECTION;
}
export function bustProtrusionUnits(level,profile='front'){
  const value=normalizeBustProjection(level);
  const factor=getBodyProfile(profile).front/BODY_PROFILES.front.front;
  // En 0 no existe relieve extra ni depresión.
  return value/10*.24*factor;
}
export const DEFAULT_BODY_PROFILE='front';
export function getBodyProfile(code=DEFAULT_BODY_PROFILE){
  return BODY_PROFILES[code]??BODY_PROFILES[DEFAULT_BODY_PROFILE];
}
const gauss=v=>Math.exp(-v*v);
const smooth=t=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
const posAt=(geo,i)=>{const p=geo.getAttribute('position');return[p.getX(i),p.getY(i),p.getZ(i)]};
function meshFrontAt(mesh,y=.27,band=.07){
 const p=mesh?.geometry?.getAttribute('position');if(!p)throw Error('Falta geometría frontal');
 let result=-Infinity;
 for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-y)<=band)result=Math.max(result,p.getZ(i));
 if(!Number.isFinite(result))throw Error('No hay vértices de referencia en pecho');
 return result;
}
function fixedFrontLength(front,vertices,shift=0,lift=0){
 const geometry=front.geometry,cols=geometry.userData?.halfColumns??15;
 const rows=geometry.userData?.gridRows??48,rowStride=cols+1;
 let distance=0,prev=null;
 for(let row=0;row<=rows;row++){
  const idx=(row*rowStride)*3;
  const x=vertices[idx],y=vertices[idx+1],z=vertices[idx+2];
  const [yy,zz]=drapedPoint(x,y,z,shift,lift);
  if(prev)distance+=Math.hypot(x-prev[0],yy-prev[1],zz-prev[2]);
  prev=[x,yy,zz];
 }
 return distance;
}
function drapedPoint(x,y,z,shift,lift){
 // La espalda no recibe una deformación pectoral ficticia.
 const frontFraction=smooth((z+.03)/.21);
 const central=gauss(x/.75);
 const bust=gauss((y-.27)/.39);
 const shiftedZ=z+shift*frontFraction*central*bust;
 const hem=smooth((.45-y)/1.67);
 const shiftedY=y+lift*frontFraction*central*hem;
 return [shiftedY,shiftedZ];
}
export function estimateDrapeFromGeometry(body,garment,garmentLengthCm){
 if(!body?.geometry||!garment?.traverse)throw Error('Se necesitan cuerpo y prenda independientes');
 const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
 if(!front)throw Error('Falta panel delantero');
 const bodyFront=meshFrontAt(body);
 const garmentFront=meshFrontAt(front);
 // Separación solo ilustrativa en unidades de la malla, no cm de holgura.
 // La tela en reposo también puede estar demasiado separada del torso.
 // Aproximación: acercar el panel delantero, pero mantener una separación visible
 // y limitar el desplazamiento para no fingir una solución de colisiones 3D.
 const requiredShift=Math.max(-.18,Math.min(.32,bodyFront+.045-garmentFront));
 const source=Array.from(front.geometry.getAttribute('position').array);
 const restLength=fixedFrontLength(front,source,0,0);
 const drapedUnlifted=fixedFrontLength(front,source,requiredShift,0);
 const consumed=Math.max(0,drapedUnlifted-restLength);
 let lift=0;
 if(consumed>1e-8){
  let lo=0,hi=.35;
  if(fixedFrontLength(front,source,requiredShift,hi)>restLength){
   lift=hi;
  }else{
   for(let i=0;i<22;i++){
    const mid=(lo+hi)/2;
    if(fixedFrontLength(front,source,requiredShift,mid)>restLength)lo=mid;
    else hi=mid;
   }
   lift=(lo+hi)/2;
  }
 }
 // Modelo vertical de 2.42 unidades corresponde al largo nominal de esta
 // variante, SOLO para representación del mismo sistema en el plano 2D.
 const hemLiftCm=lift*Math.max(0,garmentLengthCm)/(1.20-(-1.22));
 return {
  frontProjectionUnits:requiredShift,
  contactMethod:'limited-front-proximity-offset',
  approximatesGravity:true,
  frontHemLiftUnits:lift,
  estimatedFrontHemLiftCm:hemLiftCm,
  pathLengthRestUnits:restLength,
  pathLengthDrapedUnits:fixedFrontLength(front,source,requiredShift,lift),
  pathLengthDeltaBeforeLiftUnits:consumed,
  method:'single-front-path-bounded-geometry',
  physicallyValidated:false,
  contactValidated:false,
  referenceGarmentLengthCm:garmentLengthCm
 };
}

// Aproximación de contacto sobre el torso sintético: reconstruye sus
// secciones elípticas por fila. No es un solver de tela ni de colisiones.
function bodySlices(body){
 const p=body.geometry.getAttribute('position'),slices=new Map();
 for(let i=0;i<p.count;i++){
   const y=p.getY(i),key=Math.round(y*10000),x=p.getX(i),z=p.getZ(i);
   const section=slices.get(key)??{y,maxX:0,minZ:Infinity,maxZ:-Infinity};
   section.maxX=Math.max(section.maxX,Math.abs(x));
   section.minZ=Math.min(section.minZ,z);
   section.maxZ=Math.max(section.maxZ,z);
   slices.set(key,section);
 }
 return [...slices.values()].sort((a,b)=>a.y-b.y);
}
function nearestSlice(slices,y){
 let best=slices[0],delta=Infinity;
 for(const slice of slices){
   const next=Math.abs(slice.y-y);
   if(next<delta){best=slice;delta=next;}
 }
 return best;
}
function relaxGarmentAgainstTorso(body,garment){
 const sections=bodySlices(body),clearance=.028;
 let resolved=0;
 garment.traverse(mesh=>{
   if(!mesh.isMesh||mesh.name?.startsWith('trim-'))return;
   const p=mesh.geometry?.getAttribute('position');if(!p)return;
   for(let i=0;i<p.count;i++){
     const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
     if(y<sections[0].y||y>sections[sections.length-1].y)continue;
     const section=nearestSlice(sections,y),width=section.maxX;
     if(Math.abs(x)>width*.99)continue;
     const arc=Math.sqrt(Math.max(0,1-(x/width)**2));
     const front=z>=0;
     const surface=front?section.maxZ*arc:section.minZ*arc;
     const target=surface+(front?clearance:-clearance);
     const contactFactor=.78*Math.max(0,Math.min(1,(y+.97)/1.2));
     let next=z+(target-z)*contactFactor;
     next=front?Math.max(next,target):Math.min(next,target);
     if(Number.isFinite(next)){p.setZ(i,next);resolved++;}
   }
   p.needsUpdate=true;mesh.geometry.computeVertexNormals();
   mesh.geometry.computeBoundingSphere();
 });
 return resolved;
}

export function drapeFixedGarment(body,garment,garmentLengthCm){
 const diagnostics=estimateDrapeFromGeometry(body,garment,garmentLengthCm);
 const {frontProjectionUnits:shift,frontHemLiftUnits:lift}=diagnostics;
 garment.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
  const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   const [yy,zz]=drapedPoint(x,y,z,shift,lift);
   p.setXYZ(i,x,yy,zz);
  }
  p.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
 });
 diagnostics.contactApproximationVertices=relaxGarmentAgainstTorso(body,garment);
 return diagnostics;
}
