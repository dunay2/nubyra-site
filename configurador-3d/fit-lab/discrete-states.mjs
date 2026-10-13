/**
 * Etiquetas -1/0/+1 para estudiar la variación geométrica, NO clases corporales.
 * Las amplitudes son parámetros adimensionales de ensayo y NO intervalos de cm.
 * Los límites industriales, la asignación N1/N2 y las holguras no están calibrados.
 */
export const LABEL_VALUES=Object.freeze([-1,0,1]);
export const LABEL_CONFIG=Object.freeze({
  bodyChestState:Object.freeze({target:'body',axis:'chest',measure:'bodyChestCm',amplitude:.12}),
  bodyHipState:Object.freeze({target:'body',axis:'hip',measure:'bodyHipCm',amplitude:.12}),
  garmentChestState:Object.freeze({target:'garment',axis:'chest',measure:'garmentChestCm',amplitude:.12}),
  garmentHipState:Object.freeze({target:'garment',axis:'hip',measure:'garmentHipCm',amplitude:.12}),
  garmentLengthState:Object.freeze({target:'garment',axis:'length',measure:'garmentLengthCm',amplitude:.18})
});
export const DEFAULT_LABELS=Object.freeze(Object.fromEntries(Object.keys(LABEL_CONFIG).map(key=>[key,0])));
export function normalizeLabel(value){
  const numeric=Number(value);
  return LABEL_VALUES.includes(numeric)?numeric:0;
}
export function normalizeLabels(data){
  return Object.fromEntries(
    Object.keys(LABEL_CONFIG).map(key=>[key,normalizeLabel(data?.[key])])
  );
}
export function effectFor(data,key){
  const config=LABEL_CONFIG[key];
  if(!config)throw Error('Etiqueta geométrica desconocida');
  return normalizeLabel(data?.[key])*config.amplitude;
}
export function labelKeyForMeasure(measure){
  for(const [key,config] of Object.entries(LABEL_CONFIG)){
    if(config.measure===measure)return key;
  }
  return null;
}
export function serializeLabels(values){
  return {
    schema:'nubyra.discrete-visual-labels/0.1',
    levels:normalizeLabels(values),
    meaning:{
      '-1':'Menor volumen o longitud relativa',
      '0':'Geometría de referencia',
      '1':'Mayor volumen o longitud relativa'
    },
    calibration:'not-calibrated-to-centimeters',
    purpose:'visual-simulation-only',
    manufacturingPattern:null
  };
}
