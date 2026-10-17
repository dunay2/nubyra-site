/**
 * Configuraciones FINITAS de ensayo.
 * N1/N2 y tres posiciones previstas provienen de la memoria del proyecto.
 * Las dimensiones NUMÉRICAS y variantes de malla son sintéticas, NO patronaje.
 */
import {JERSEY_PATTERNS} from './pattern-registry.mjs';
import {rankJerseys} from './fit-policy.mjs';
export const LATERAL_STATES=Object.freeze([1,2,3]);
export const GARMENT_CATALOG=JERSEY_PATTERNS;
export const DEFAULT_CONFIGURATION='N1-2';
export function getGarmentConfiguration(code=DEFAULT_CONFIGURATION){
  const result=GARMENT_CATALOG[code];
  if(!result)throw Error('Configuración de ensayo desconocida: '+String(code));
  return result;
}
export function stateForConfiguration(code){
  const candidate=getGarmentConfiguration(code);
  return {
    activeBase:candidate.base,
    activeConfiguration:candidate.code,
    garmentChestCm:candidate.chestCm,
    garmentHipCm:candidate.hipCm,
    garmentLengthCm:candidate.lengthCm
  };
}
export function availableConfigurations(){
  return Object.values(GARMENT_CATALOG);
}
export function recommendPreviewConfiguration(values){return rankJerseys(GARMENT_CATALOG,values);}
