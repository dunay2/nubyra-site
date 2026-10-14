/**
 * NUBYRA Fit Lab — POC geométrica de dos mallas independientes.
 * Entradas en cm de DEMOSTRACIÓN. Sin calibración antropométrica, sin fitting ni fabricación.
 * El cuerpo es un volumen sintético abstracto, nunca la representación de una jugadora.
 */
import { serializeLabels } from './discrete-states.mjs';
import { classifiedLabels,serializeClassifier,suggestPatternFromMeasurements } from './size-classifier.mjs';
import {getBodyProfile,drapeFixedGarment,normalizeBustProjection,bustProtrusionUnits} from './fit-drape.mjs';
import {getGarmentConfiguration} from './garment-catalog.mjs';
export const FIT_VERSION='nubyra.fit-lab/0.4';
export const DEFAULT_FIT=Object.freeze({
  bodyChestCm:88,bodyHipCm:96,bodyHeightCm:160,
  garmentChestCm:102,garmentHipCm:110,garmentLengthCm:64
});
export const LIMITS=Object.freeze({
  bodyChestCm:[65,120],bodyHipCm:[70,130],bodyHeightCm:[125,190],
  garmentChestCm:[75,135],garmentHipCm:[80,145],garmentLengthCm:[48,84]
});
export const MODES=Object.freeze(['body','garment']);
const snapshot=new WeakMap();
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const gauss=(v)=>Math.exp(-(v*v));
const smooth=(v)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};

export function normalizeFit(values){
  const result={};
  for(const [key,[min,max]] of Object.entries(LIMITS)){
    const v=Number(values?.[key]);
    result[key]=Number.isFinite(v)?clamp(v,min,max):DEFAULT_FIT[key];
  }
  return result;
}
/**
 * Contrato único del visor: conserva medidas y etiquetas independientes.
 * El visor previo normalizaba SOLO cm, borrando -1/+1 antes del morph.
 */
export function normalizeRenderFit(values){
  const cm=normalizeFit(values);
  return {...cm,...classifiedLabels(cm,values?.activeBase),bustProjectionLevel:normalizeBustProjection(values?.bustProjectionLevel)};
}
export function serializeFit(state){
  const values=normalizeFit(state);
  const rawRequested=Number(state?.desiredLengthCm);
  const requestedLength=Number.isFinite(rawRequested)
    ?clamp(rawRequested,...LIMITS.garmentLengthCm)
    :values.garmentLengthCm;
  const recommendation=suggestPatternFromMeasurements({
    ...values,desiredLengthCm:requestedLength
  });
  const classes=classifiedLabels(values,recommendation.base);
  const legacy=serializeClassifier(values,state?.activeBase,state?.experimentMode||'body');
  return {
    schema:FIT_VERSION,
    status:'experimental-not-manufacturing-approved',
    kind:'synthetic-geometry-not-anthropometric',
    workflow:'measurements-to-3d-to-pattern-proposal',
    requestedGarmentLengthCm:requestedLength,
    discretization:serializeLabels(classes),
    sizeProposal:{
      ...legacy,
      fixedPreviewConfiguration:state?.activeConfiguration??'N1-2',
      finiteCatalogSize:6,
      activeBase:state?.activeBase||'N1',
      suggestedBase:recommendation.base,
      groups:classes,
      lateralPosition:null,
      candidateOnly:true,
      candidateStatus:recommendation.status,
      measuredInputs:recommendation.measuredInputs,
      validatedIndustrialRanges:false,
      appliedGarmentPattern:null
    },
    body:{
      chestCm:values.bodyChestCm,hipCm:values.bodyHipCm,
      bustProjectionLevel:normalizeBustProjection(state?.bustProjectionLevel),
      heightReferenceCm:values.bodyHeightCm
    },
    garment:{
      chestTargetCm:values.garmentChestCm,hipTargetCm:values.garmentHipCm,
      lengthTargetCm:values.garmentLengthCm
    },
    differencesNominalCm:{
      chest:values.garmentChestCm-values.bodyChestCm,
      hip:values.garmentHipCm-values.bodyHipCm
    },
    note:'Medidas y rangos ilustrativos, NO perímetros calibrados sobre las mallas. La proyección del busto está limitada a 0-10 (0 = plano, nunca negativa) y no son centímetros. Las posiciones industriales 1/2/3, holguras y tallas no están validadas.'
  };
}
export function nominalDifferences(input){
  const v=normalizeFit(input);
  return {chest:v.garmentChestCm-v.bodyChestCm,hip:v.garmentHipCm-v.bodyHipCm};
}
// Perfil de torso abstracto: no presupone edad, sexo o medidas normalizadas.
function bodyHalfAxes(y){
  const bust=gauss((y-.27)/.44),hips=gauss((y+.98)/.43);
  const shoulder=gauss((y-.86)/.38);
  return {
    width:.386+.102*bust+.083*hips+.038*shoulder,
    // Sin busto en la malla neutra: en nivel 0 el perfil anterior no tiene relieve pectoral.
    depth:.205+.042*hips
  };
}
export function createReferenceBody(T){
  if(!T?.BufferGeometry||!T?.Mesh)throw Error('Se requiere Three.js');
  const rows=44,around=56,pos=[],uv=[],indices=[];
  for(let r=0;r<=rows;r++){
    const y=-1.16+2.20*r/rows,axes=bodyHalfAxes(y);
    for(let a=0;a<=around;a++){
      const theta=Math.PI*2*a/around;
      pos.push(Math.cos(theta)*axes.width,y,Math.sin(theta)*axes.depth-.005);
      uv.push(a/around,r/rows);
    }
  }
  for(let r=0;r<rows;r++)for(let a=0;a<around;a++){
    const i=r*(around+1)+a,j=i+around+1;
    indices.push(i,j,i+1,i+1,j,j+1);
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  const material=new T.MeshPhysicalMaterial({
    color:0x57a8bc,metalness:.02,roughness:.68,
    transparent:true,opacity:.80,depthWrite:false,side:T.DoubleSide
  });
  const mesh=new T.Mesh(geo,material);
  mesh.name='NUBYRA / torso sintético independiente';
  mesh.userData.fitRole='body';mesh.renderOrder=0;
  return mesh;
}
function cacheBase(mesh){
  let original=snapshot.get(mesh);
  if(original)return original;
  const attr=mesh.geometry?.getAttribute('position');
  if(!attr)throw Error('La malla no dispone de posiciones');
  original=new Float32Array(attr.array);
  snapshot.set(mesh,original);
  return original;
}
function changePositions(mesh,transform){
  const position=mesh.geometry.getAttribute('position');
  const original=cacheBase(mesh);
  for(let i=0;i<position.count;i++){
    const ix=i*3,x=original[ix],y=original[ix+1],z=original[ix+2];
    const [nx,ny,nz]=transform(x,y,z);
    if(![nx,ny,nz].every(Number.isFinite))throw Error('Deformación inválida');
    position.setXYZ(i,nx,ny,nz);
  }
  position.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundingBox();
}
export function deformBody(mesh,values){
  if(mesh?.userData?.fitRole!=='body')throw Error('Se esperaba la malla corporal');
  const v=normalizeFit(values);
  const deltaChest=v.bodyChestCm/DEFAULT_FIT.bodyChestCm-1;
  const deltaHip=v.bodyHipCm/DEFAULT_FIT.bodyHipCm-1;
  const profile=getBodyProfile(values?.bodyProfile);
  const level=normalizeBustProjection(values?.bustProjectionLevel);
  const protrusion=bustProtrusionUnits(level,profile.code);
  changePositions(mesh,(x,y,z)=>{
    const chest=gauss((y-.28)/.43),hip=gauss((y+.98)/.46);
    // Pecho torácico (medida de contorno) puede variar en anchura sin crear
    // una concavidad frontal. Esto es independiente del relieve del busto.
    const lateral=Math.max(.30,1+profile.lateral*deltaChest*chest+1.04*deltaHip*hip);
    const centered=z+.005,isFront=centered>0;
    const rearTorsoAdjustment=!isFront&&profile.code==='thorax'
      ?profile.back*deltaChest*chest:0;
    const depth=Math.max(.40,1+rearTorsoAdjustment+1.06*deltaHip*hip);
    const frontFacing=isFront?smooth(centered/.115):0;
    // Volumen horizontal redondeado: sección ancha con meseta central,
    // transición suave en extremos y mayor extensión vertical que el punto original.
    const horizontal=Math.max(0,1-Math.pow(Math.abs(x)/.58,4));
    const vertical=gauss((y-.25)/.43);
    const breastEnvelope=Math.pow(horizontal,.7)*vertical*frontFacing;
    // PRINCIPIO FÍSICO DEL ENSAYO: el relieve es 0 o positivo.
    // No se utiliza deltaChest negativo para empujar vértices al interior.
    const outwardRelief=protrusion*breastEnvelope;
    return [x*lateral,y,centered*depth+outwardRelief-.005];
  });
  return mesh;
}
export function deformGarment(group,values){
  if(!group?.traverse)throw Error('La prenda debe ser un grupo de mallas independiente');
  const v=normalizeFit(values);
  const deltaChest=v.garmentChestCm/DEFAULT_FIT.garmentChestCm-1;
  const deltaHip=v.garmentHipCm/DEFAULT_FIT.garmentHipCm-1;
  const extraLength=(v.garmentLengthCm-DEFAULT_FIT.garmentLengthCm)/40;
  let count=0;
  group.traverse(mesh=>{
    if(!mesh.isMesh || !mesh.geometry?.getAttribute('position'))return;
    count++;
    changePositions(mesh,(x,y,z)=>{
      const bustWeight=gauss((y-.27)/.44);
      const hipWeight=gauss((y+1.02)/.48);
      // Ensayo geométrico: deformar los dos laterales y desplazar explícitamente
      // el panel trasero en -Z, no solo proyectar volumen por delante.
      const lateral=1+1.46*deltaChest*bustWeight+1.10*deltaHip*hipWeight;
      const isBack=z<0;
      const depth=1+(isBack?1.95:1.16)*deltaChest*bustWeight+1.01*deltaHip*hipWeight;
      const offset=(isBack?-.12:.035)*deltaChest*bustWeight;
      // El escote y hombros apenas se desplazan; el bajo absorbe el largo.
      const lower=smooth((.53-y)/1.75);
      const shiftedY=y-extraLength*lower;
      return [x*lateral,shiftedY,z*depth+offset];
    });
  });
  if(count===0)throw Error('Prenda sin superficies deformables');
  return count;
}
/**
 * Escala métrica COMÚN al torso y a la camiseta. El factor se fija una vez
 * con el largo nominal de la camiseta base; jamás se reescala la escena
 * de manera independiente para acomodar las mallas a la pantalla.
 * La altura completa introducida es informativa: esta POC dibuja solo torso.
 */
export const CM_PER_UNIT=64/2.42;
const ellipseCircumference=(a,b)=>Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)));
function calibrateCircumferences(object,chestCm,hipCm){
  const targets=[[.27,chestCm],[-.98,hipCm]];
  const ratios=targets.map(([y,target])=>{
    const section=measureCrossSection(object,y,.075);
    const actual=ellipseCircumference(section.width/2,section.depth/2)*CM_PER_UNIT;
    return target/actual;
  });
  object.traverse(mesh=>{
    if(!mesh.isMesh||mesh.name?.startsWith('trim-'))return;
    const pos=mesh.geometry.getAttribute('position');
    if(!pos)return;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      const chest=Math.exp(-Math.pow((y-.27)/.52,2)),hip=Math.exp(-Math.pow((y+.98)/.50,2));
      const weight=chest+hip;
      const ratio=weight>1e-8?(chest*ratios[0]+hip*ratios[1])/weight:1;
      const strength=Math.min(1,weight);
      const radial=1+(ratio-1)*strength;
      pos.setXYZ(i,x*radial,y,z*radial);
    }
    pos.needsUpdate=true;mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere();
  });
}
/**
 * Único punto de entrada de la interacción A/B (barras y botones discretos).
 * Convierte estado de UI en un contrato compartido, no elimina las etiquetas.
 * Las dos mallas conservan sus propias referencias y posiciones iniciales.
 */
export function applyFitToModels(body,garment,state){
  const v=normalizeRenderFit(state);
  deformBody(body,{...v,bodyProfile:state?.bodyProfile,bustProjectionLevel:state?.bustProjectionLevel});
  calibrateCircumferences(body,v.bodyChestCm,v.bodyHipCm);
  // El reposo de la camiseta se elige entre las seis configuraciones de ensayo.
  // Ningún valor corporal entra directamente en las dimensiones de fabricación.
  const configuration=getGarmentConfiguration(state?.activeConfiguration??'N1-2');
  const garmentRest={
    ...v,garmentChestCm:configuration.chestCm,
    garmentHipCm:configuration.hipCm,
    garmentLengthCm:configuration.lengthCm
  };
  deformGarment(garment,garmentRest);
  calibrateCircumferences(garment,configuration.chestCm,configuration.hipCm);
  const drape=drapeFixedGarment(body,garment,configuration.lengthCm);
  return {...v,restConfiguration:configuration.code,drape};
}
// Inspección aproximada, NO holgura verificada ni perímetro real calculado.
export function getBodyExtentAt(mesh,y,band=.035){
  if(!mesh?.geometry)throw Error('Cuerpo requerido');
  const p=mesh.geometry.getAttribute('position');let maxX=0,maxZ=0;
  for(let i=0;i<p.count;i++){
    if(Math.abs(p.getY(i)-y)>band)continue;
    maxX=Math.max(maxX,Math.abs(p.getX(i)));
    maxZ=Math.max(maxZ,Math.abs(p.getZ(i)));
  }
  return {halfWidth:maxX,halfDepth:maxZ};
}

/**
 * Diagnóstico derivado directamente de vértices cerca de una altura 3D.
 * Devuelve anchura y profundidades (frontal y posterior), en unidades del modelo.
 * No mide perímetro de cinta ni certifica holgura física.
 */
export function measureCrossSection(object,atY=.27,band=.060){
  if(!object?.traverse)throw Error('Se necesita una malla o grupo 3D');
  if(!Number.isFinite(atY)||!(band>0))throw Error('Sección transversal inválida');
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,count=0;
  object.traverse(mesh=>{
    if(!mesh?.isMesh||!mesh.geometry?.getAttribute('position'))return;
    if(mesh.name?.startsWith('trim-'))return;
    const a=mesh.geometry.getAttribute('position');
    for(let i=0;i<a.count;i++){
      if(Math.abs(a.getY(i)-atY)>band)continue;
      const x=a.getX(i),z=a.getZ(i);
      if(!Number.isFinite(x)||!Number.isFinite(z))continue;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
      count++;
    }
  });
  if(count<6||!Number.isFinite(minX)||!Number.isFinite(minZ)){
    throw Error('No hay vértices suficientes en la sección de ensayo');
  }
  return {
    width:maxX-minX,
    front:Math.max(0,maxZ),
    back:Math.max(0,-minZ),
    depth:maxZ-minZ,
    vertices:count
  };
}

/**
 * Muestras reales del reverso en una sección de pecho.
 * Se emplean solamente para dibujar la silueta superpuesta en vista espalda.
 */
export function backSurfaceProfile(mesh,atY=.27,band=.065){
  const positions=mesh?.geometry?.getAttribute('position');
  if(!positions)throw Error('La referencia no tiene geometría de espalda');
  const bins=new Map();
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    if(z>=-.02 || Math.abs(y-atY)>band)continue;
    const key=Math.round(x*46),candidate={x,y:atY,z:z-.038,error:Math.abs(y-atY)};
    const current=bins.get(key);
    if(!current||candidate.error<current.error)bins.set(key,candidate);
  }
  const points=[...bins.values()].sort((a,b)=>a.x-b.x);
  if(points.length<8)throw Error('La sección posterior carece de puntos de referencia');
  return points.map(({x,y,z})=>({x,y,z}));
}
