import {GARMENT_CATALOG} from './garment-catalog.mjs';
/** Numerical proposals for the Lab, not approved manufacturing sizes. */
export const FIXED_SIZE_VERSION='fixed-garment-proposals/1.0';
export const SHORT_SIZES=Object.freeze(Object.fromEntries([
 ['P1',70,104],['P2',78,112],['P3',86,120],['P4',94,128]
].map(([code,waistCm,hipCm])=>[code,Object.freeze({code,waistCm,hipCm,elasticAllowanceCm:0,industrialApproved:false})])));
export const SHORT_LENGTHS=Object.freeze([34,42,50]);
export function fixedShortKey(code='P1',length=42){if(!SHORT_SIZES[code]||!SHORT_LENGTHS.includes(Number(length)))throw Error('Propuesta de pantalón desconocida');return code+'-'+length;}
export function assessJersey(state){
 const g=GARMENT_CATALOG[state.activeConfiguration];if(!g)throw Error('Camiseta desconocida');
 const chestEase=g.chestCm-state.bodyChestCm,hipEase=g.hipCm-state.bodyHipCm;
 // Geometric shoulder-to-hip reference, not a measured individual torso length.
 const shoulderToHip=state.bodyHeightCm*.525/1.7,belowHip=g.lengthCm-shoulderToHip;
 const blocked=chestEase<0||hipEase<0,excessive=chestEase>38||hipEase>44;
 const status=blocked?'too-small':belowHip<6?'short':excessive?'oversized':chestEase>24||hipEase>28?'loose':'candidate';
 const messages={
  'too-small':'No cabe con estas medidas nominales. Se conserva la equipación anterior; no se estira la talla para hacerla entrar.',
  short:'Contornos compatibles, pero largo corto para este torso. La camiseta conserva su largo.',
  oversized:'Exceso de holgura: ajuste y colisiones fuera del rango de ensayo. No se considera una talla adecuada.',
  loose:'Holgura amplia. La prenda conserva sus medidas; revisar caída y cobertura.',
  candidate:'Candidata de ensayo por contornos y largo. No equivale a talla validada.'
 };
 return {code:g.code,nominal:{chestCm:g.chestCm,hipCm:g.hipCm,lengthCm:g.lengthCm},chestEaseCm:chestEase,hipEaseCm:hipEase,belowHipCm:belowHip,status,blocked,excessive,reason:messages[status],industrialApproved:false};
}
export function assessShortNominal(state,size='P1'){
 const g=SHORT_SIZES[size];if(!g)throw Error('Talla de pantalón desconocida');
 return {code:size,blocked:state.bodyHipCm>g.hipCm,hipEaseCm:g.hipCm-state.bodyHipCm,reason:state.bodyHipCm>g.hipCm?'La cadera supera el contorno fijo del pantalón. Cambia la talla; no se ampliará automáticamente.':''};
}
