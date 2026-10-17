import {GARMENT_CATALOG} from './garment-catalog.mjs';
import {evaluateJersey} from './fit-policy.mjs';
import {SHORT_PATTERNS,SHORT_LENGTHS,normalizeShortCode,PATTERN_REGISTRY_VERSION} from './pattern-registry.mjs';
export {SHORT_LENGTHS,normalizeShortCode};
export const SHORT_SIZES=SHORT_PATTERNS;
export const FIXED_SIZE_VERSION=PATTERN_REGISTRY_VERSION;
export function fixedShortKey(code='N1-2',length=42){const id=normalizeShortCode(code);if(!SHORT_LENGTHS.includes(Number(length)))throw Error('Largo de pantalón desconocido');return id+'-'+Number(length);}
export function assessJersey(state){return evaluateJersey(GARMENT_CATALOG[state.activeConfiguration],state);}
export function assessShortNominal(state,size='N1-2'){
 const g=SHORT_SIZES[normalizeShortCode(size)];return {code:g.code,blocked:state.bodyHipCm>g.hipCm,hipEaseCm:g.hipCm-state.bodyHipCm,
 waistValidated:false,waistband:g.waistband,reason:state.bodyHipCm>g.hipCm?'La cadera supera el contorno fijo del pantalón.':'Sujeción elástica pendiente de calibración. El movimiento mostrado es un ensayo geométrico sin elástico.'};
}
