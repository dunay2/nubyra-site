/**
 * Configuraciones FINITAS de ensayo.
 * N1/N2 y tres posiciones previstas provienen de la memoria del proyecto.
 * Las dimensiones NUMÉRICAS y variantes de malla son sintéticas, NO patronaje.
 */
import {BASE_SHIRTS,BAND_STEPS} from './size-classifier.mjs';

export const LATERAL_STATES=Object.freeze([1,2,3]);
// Diferencias solo ilustrativas para visualizar seis estados discretos;
// las posiciones industriales deben definirlas el fabricante/patronista.
const DEMO_LATERAL_OFFSETS=Object.freeze({
  1:Object.freeze({chestCm:-4,hipCm:-5}),
  2:Object.freeze({chestCm:0,hipCm:0}),
  3:Object.freeze({chestCm:4,hipCm:5})
});
export const GARMENT_CATALOG=Object.freeze(
  Object.fromEntries(Object.values(BASE_SHIRTS).flatMap(base=>
    LATERAL_STATES.map(position=>{
      const offsets=DEMO_LATERAL_OFFSETS[position];
      const code=base.code+'-'+position;
      return [code,Object.freeze({
        code,base:base.code,position,
        chestCm:base.garmentChestCm+offsets.chestCm,
        hipCm:base.garmentHipCm+offsets.hipCm,
        lengthCm:base.garmentLengthCm,
        industrialApproved:false,
        geometryKind:'synthetic-fixed-rest-variant',
        manufacturingReference:null
      })];
    })
  ))
);
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
export function recommendPreviewConfiguration(values){
  if(!values||typeof values!=='object')throw Error('Medidas requeridas');
  const chest=Number(values.bodyChestCm),hip=Number(values.bodyHipCm);
  const length=Number(values.desiredLengthCm??values.garmentLengthCm);
  if(![chest,hip,length].every(Number.isFinite))throw Error('Datos corporales inválidos');
  // La diferencia nominal de +14 cm es la referencia ya utilizada en la POC,
  // NO una holgura necesaria para deportistas.
  const target={chestCm:chest+14,hipCm:hip+14,lengthCm:length};
  const scored=availableConfigurations().map(item=>{
    const fields=[
      (item.chestCm-target.chestCm)/BAND_STEPS.garmentChestCm,
      (item.hipCm-target.hipCm)/BAND_STEPS.garmentHipCm,
      (item.lengthCm-target.lengthCm)/BAND_STEPS.garmentLengthCm
    ];
    return {...item,score:fields.reduce((a,v)=>a+v*v,0),
      demoCoverage:fields.every(v=>Math.abs(v)<=2)};
  }).sort((a,b)=>a.score-b.score||a.code.localeCompare(b.code));
  const best=scored[0];
  return {
    previewCode:best.code,previewBase:best.base,
    score:best.score,hasDemoCoverage:best.demoCoverage,
    lateralPosition:null,industrialApproved:false,
    status:best.demoCoverage?'simulation-only':'review-outside-demo',
    candidates:scored.map(({code,score,demoCoverage})=>({code,score,demoCoverage})),
    note:'Solo selección entre seis maquetas fijas de ensayo; no valida talla, ajuste, elasticidad ni posición lateral industrial.'
  };
}
