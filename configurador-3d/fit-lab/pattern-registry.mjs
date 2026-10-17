import {BASE_SHIRTS} from './size-classifier.mjs';

/** Engineering proposals, not approved sizes. No body measurements enter this registry. */
export const PATTERN_REGISTRY_VERSION = 'nubyra.pattern-proposals/2.2';
export const FIT_POLICY_VERSION = 'nubyra.fit-rules/2.0';
const freeze = value => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);} return value; };
export const MATERIAL_REFERENCE = freeze({id:'recycled-polyester-demo',version:'1',calibrated:false,maxExtension:null});
// Explicit test intervals. These are hypotheses for review by the pattern maker,
// not a universal clothing ease formula or a guarantee of comfort.
export const JERSEY_RULES = freeze({version:FIT_POLICY_VERSION,source:'laboratory-hypothesis',
 chest:{minEaseCm:6,maxEaseCm:24},hip:{minEaseCm:6,maxEaseCm:28},
 length:{preferenceToleranceCm:4,minBelowHipCm:6},industrialApproved:false});
const offsets={1:{chest:-4,hip:-5},2:{chest:0,hip:0},3:{chest:4,hip:5}};
export const JERSEY_PATTERNS = freeze(Object.fromEntries(Object.values(BASE_SHIRTS).flatMap(base=>[1,2,3].map(position=>{
 const code=`${base.code}-${position}`;
 return [code,{code,base:base.code,position,patternId:`jersey/${code}`,patternVersion:'1.0',
  chestCm:base.garmentChestCm+offsets[position].chest,hipCm:base.garmentHipCm+offsets[position].hip,lengthCm:base.garmentLengthCm,
  material:MATERIAL_REFERENCE,limits:JERSEY_RULES,industrialApproved:false,
  geometryKind:'synthetic-fixed-rest-variant',manufacturingReference:null}];
}))));
export const SHORT_LENGTHS = freeze([34,42,50]);
export const SHORT_PATTERNS = freeze(Object.fromEntries([
 ['N1',70,104],['N2',86,120]
].flatMap(([base,waistCm,hipCm])=>[1,2,3].map(position=>{
 const code=`${base}-${position}`;
 return [code,{code,base,position,patternId:`shorts/${code}`,patternVersion:'2.0',waistCm,hipCm:hipCm+(position-2)*4,
  riseCm:33.5,material:MATERIAL_REFERENCE,
  waistband:{construction:'elastic-with-drawstring',attachment:'tied-in-viewer',restCm:waistCm,usableMaxCm:null,stiffness:null,validated:false},
  supportModel:'tied-drawstring-constraint',industrialApproved:false}];
}))));
export const DEFAULT_SHORT_CODE='N1-2';
const legacy={P1:'N1-2',P2:'N1-3',P3:'N2-2',P4:'N2-3'};
export function normalizeShortCode(code=DEFAULT_SHORT_CODE){const id=legacy[code]||code;if(!Object.hasOwn(SHORT_PATTERNS,id))throw Error('Configuración de pantalón desconocida');return id;}
export function patternSpecification(pattern,lengthCm=pattern.lengthCm){
 return {registryVersion:PATTERN_REGISTRY_VERSION,patternId:pattern.patternId,patternVersion:pattern.patternVersion,
  base:pattern.base,position:pattern.position,material:pattern.material,
  dimensions:{...('chestCm' in pattern?{chestCm:pattern.chestCm}:{waistRestCm:pattern.waistCm,riseCm:pattern.riseCm}),hipCm:pattern.hipCm,lengthCm},
  waistband:pattern.waistband||null,industrialApproved:false};
}

/** Explicit laboratory cuts, not factory-approved dimensions. */
export const JERSEY_LENGTHS=Object.freeze([48,56,64,72,80,84]);
export function nearestJerseyLength(value){
 const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Error('Largo deseado inválido');
 return [...JERSEY_LENGTHS].sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)||a-b)[0];
}
export function jerseyLengthVariant(pattern,lengthCm=pattern.lengthCm){
 if(!pattern||!JERSEY_LENGTHS.includes(Number(lengthCm)))throw Error('Corte de largo no disponible');
 return Object.freeze({...pattern,lengthCm:Number(lengthCm),patternId:`jersey/${pattern.code}/L${lengthCm}`,patternVersion:'2.0',lengthVariant:true});
}
/** Authored rise alternatives, never derived continuously from body geometry. */
export const SHORT_RISES=Object.freeze([33.5,35.5,37.5]);
export function shortRiseKey(code,lengthCm,riseCm=33.5){
 if(!SHORT_LENGTHS.includes(lengthCm)||!SHORT_RISES.includes(riseCm)||riseCm>lengthCm-.5)throw Error('Combinación fija de tiro y largo no disponible');
 return code+'-'+lengthCm+(riseCm===33.5?'':'-R'+riseCm);
}
