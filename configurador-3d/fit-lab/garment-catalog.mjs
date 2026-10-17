/**
 * Configuraciones FINITAS de ensayo.
 * N1/N2 y tres posiciones previstas provienen de la memoria del proyecto.
 * Las dimensiones NUMÉRICAS y variantes de malla son sintéticas, NO patronaje.
 */
import {JERSEY_PATTERNS,nearestJerseyLength,jerseyLengthVariant} from './pattern-registry.mjs';
import {rankJerseys} from './fit-policy.mjs';
export const LATERAL_STATES=Object.freeze([1,2,3]);
export const GARMENT_CATALOG=JERSEY_PATTERNS;
export const DEFAULT_CONFIGURATION='N1-2';
export function getGarmentConfiguration(code=DEFAULT_CONFIGURATION){
  const result=GARMENT_CATALOG[code];
  if(!result)throw Error('Configuración de ensayo desconocida: '+String(code));
  return result;
}
export function stateForConfiguration(code,lengthCm){
  const original=getGarmentConfiguration(code);
  const candidate=lengthCm===undefined?original:jerseyLengthVariant(original,lengthCm);
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
export function garmentForState(state){
 return jerseyLengthVariant(getGarmentConfiguration(state.activeConfiguration),state.garmentLengthCm??getGarmentConfiguration(state.activeConfiguration).lengthCm);
}
export function recommendPreviewConfiguration(values){
 const lengthCm=nearestJerseyLength(values.desiredLengthCm??64);
 const cuts=Object.fromEntries(Object.values(GARMENT_CATALOG).map(g=>[g.code,jerseyLengthVariant(g,lengthCm)]));
 const result=rankJerseys(cuts,values);
 const ordered=[...result.candidates].sort((a,b)=>Number(a.assessment.blocked)-Number(b.assessment.blocked)||a.score-b.score||a.code.localeCompare(b.code));
 const candidate=result.recommendedCode?ordered.find(c=>c.code===result.recommendedCode):ordered[0];
 const assessment=candidate.assessment;
 const reason=assessment.compatible?`Propuesta ${candidate.code} · largo ${lengthCm} cm. ${assessment.reason}`:
  `Propuesta más próxima: ${candidate.code} · largo ${lengthCm} cm. ${assessment.reason} Ajuste pendiente de revisión; no es una talla validada.`;
 return {...result,previewCode:candidate.code,previewBase:cuts[candidate.code].base,recommendedCode:candidate.code,hasConfiguration:true,
  hasDemoCoverage:assessment.compatible,proposedLengthCm:lengthCm,requestedLengthCm:values.desiredLengthCm,
  lateralPosition:cuts[candidate.code].position,status:assessment.compatible?'proposal':'proposal-review',reason,note:reason,
  proposal:{code:candidate.code,lengthCm,assessment,renderable:!assessment.blocked,requiresReview:!assessment.compatible}};
}
