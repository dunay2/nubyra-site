/**
 * Discretizador de DEMOSTRACIÓN para experimentar el flujo de NUBYRA.
 * Ninguna referencia, corte o amplitud procede de fichas industriales.
 *
 * La medida en cm es fuente de verdad: su banda -1/0/+1 es DERIVADA.
 * Los dos patrones N1/N2 proceden de la memoria; sus ANCLAJES NUMÉRICOS NO.
 */
export const BASE_SHIRTS=Object.freeze({
  N1:Object.freeze({
    code:'N1',label:'Patrón base N1 (ensayo)',
    bodyChestCm:88,bodyHipCm:96,
    garmentChestCm:102,garmentHipCm:110,garmentLengthCm:64
  }),
  N2:Object.freeze({
    code:'N2',label:'Patrón base N2 (ensayo)',
    bodyChestCm:106,bodyHipCm:116,
    garmentChestCm:120,garmentHipCm:130,garmentLengthCm:72
  })
});
export const BAND_STEPS=Object.freeze({
  bodyChestCm:8,bodyHipCm:10,garmentChestCm:8,
  garmentHipCm:10,garmentLengthCm:6
});
export const MEASURE_TO_STATE=Object.freeze({
  bodyChestCm:'bodyChestState',bodyHipCm:'bodyHipState',
  garmentChestCm:'garmentChestState',garmentHipCm:'garmentHipState',
  garmentLengthCm:'garmentLengthState'
});
export const STATE_TO_MEASURE=Object.freeze(
  Object.fromEntries(Object.entries(MEASURE_TO_STATE).map(([a,b])=>[b,a]))
);
export const DEFAULT_BASE='N1';
export function normalizeBase(value){
  return Object.hasOwn(BASE_SHIRTS,value)?value:DEFAULT_BASE;
}
export function bandOf(value,reference,step){
  if(!(Number.isFinite(value)&&Number.isFinite(reference)&&Number.isFinite(step)&&step>0))
    throw Error('Banda geométrica inválida');
  if(value<reference-step/2)return -1;
  if(value>reference+step/2)return 1;
  return 0;
}
export function getBand(measure,value,base=DEFAULT_BASE){
  if(!(measure in BAND_STEPS))throw Error('Medida sin clasificación disponible');
  const id=normalizeBase(base);
  return bandOf(Number(value),BASE_SHIRTS[id][measure],BAND_STEPS[measure]);
}
export function bandThresholds(measure,base=DEFAULT_BASE){
  if(!(measure in BAND_STEPS))throw Error('Medida sin clasificación disponible');
  const reference=BASE_SHIRTS[normalizeBase(base)][measure],step=BAND_STEPS[measure];
  return {lower:reference-step/2,upper:reference+step/2,reference,step};
}
export function representativeCm(measure,level,base=DEFAULT_BASE){
  if(!(measure in BAND_STEPS)||![-1,0,1].includes(level))
    throw Error('Etiqueta o medida incorrecta');
  return BASE_SHIRTS[normalizeBase(base)][measure]+level*BAND_STEPS[measure];
}
export function classifiedLabels(values,base=DEFAULT_BASE){
  return Object.fromEntries(Object.entries(MEASURE_TO_STATE).map(([m,state])=>[
    state,getBand(m,Number(values[m]),base)
  ]));
}
export function nearestBase(values,mode='body'){
  if(!['body','garment'].includes(mode))throw Error('Modo desconocido');
  const measures=mode==='body'?['bodyChestCm','bodyHipCm']:
    ['garmentChestCm','garmentHipCm','garmentLengthCm'];
  const scores=Object.keys(BASE_SHIRTS).map(code=>{
    const sum=measures.reduce((total,m)=>{
      const distance=(Number(values?.[m])-BASE_SHIRTS[code][m])/BAND_STEPS[m];
      return total+distance*distance;
    },0);
    return {code,score:sum};
  });
  scores.sort((a,b)=>a.score-b.score||a.code.localeCompare(b.code));
  return {base:scores[0].code,mode,scores};
}
export function initialValuesForBase(code){
  const {bodyChestCm,bodyHipCm,garmentChestCm,garmentHipCm,garmentLengthCm}
   =BASE_SHIRTS[normalizeBase(code)];
  return {bodyChestCm,bodyHipCm,garmentChestCm,garmentHipCm,garmentLengthCm};
}
export function demoGarmentTargetsFromBody(values){
  // Una propuesta ilustrativa basada en la diferencia 14 cm de las mallas sintéticas,
  // NO una holgura de patronaje validada.
  return {
    garmentChestCm:Number(values.bodyChestCm)+14,
    garmentHipCm:Number(values.bodyHipCm)+14
  };
}
export function serializeClassifier(values,activeBase=DEFAULT_BASE,mode='body'){
  const id=normalizeBase(activeBase);
  return {
    schema:'nubyra.demo-size-proposal/0.1',
    activeBase:id,
    suggestedBase:nearestBase(values,mode).base,
    groups:classifiedLabels(values,id),
    references:BASE_SHIRTS[id],
    steps:BAND_STEPS,
    validatedIndustrialRanges:false,
    appliedGarmentPattern:null,
    note:'Rangos, tamaños en cm y cortes de clase ilustrativos. Los dos patrones N1/N2 sí figuran en la memoria, pero ninguna equivalencia métrica aquí ha sido aprobada para fabricación.'
  };
}
