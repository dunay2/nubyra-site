import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {
  FIT_VERSION,DEFAULT_FIT,LIMITS,MODES,
  normalizeFit,normalizeRenderFit,serializeFit,nominalDifferences
} from '../configurador-3d/fit-lab/fit-geometry.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','configurador-3d','fit-lab');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const app=readFileSync(resolve(root,'app.mjs'),'utf8');
const viewer=readFileSync(resolve(root,'fit-viewer.mjs'),'utf8');
const css=readFileSync(resolve(root,'styles.css'),'utf8');

test('A/B: cinco variables del modelo y altura auxiliar están acotadas',()=>{
 assert.deepEqual(MODES,['body','garment']);
 assert.equal(Object.keys(LIMITS).length,6);
 assert.deepEqual(normalizeFit({bodyChestCm:999,garmentLengthCm:-2}),
   {...DEFAULT_FIT,bodyChestCm:120,garmentLengthCm:48});
 assert.equal(normalizeFit({bodyChestCm:'invalid'}).bodyChestCm,88);
});
test('las diferencias nominales usan entradas independientes y no pretenden certificar holgura',()=>{
 assert.deepEqual(nominalDifferences(DEFAULT_FIT),{chest:14,hip:14});
 assert.deepEqual(nominalDifferences({...DEFAULT_FIT,bodyChestCm:110}),{chest:-8,hip:14});
 const payload=serializeFit({...DEFAULT_FIT,bodyChestCm:110});
 assert.equal(payload.schema,FIT_VERSION);
 assert.equal(payload.status,'experimental-not-manufacturing-approved');
 assert.equal(payload.body.chestCm,110);
 assert.equal(payload.garment.chestTargetCm,102);
 assert.equal(payload.garment.lengthTargetCm,64);
 assert.match(payload.note,/NO son perímetros medidos/);
 assert.equal(JSON.stringify(payload).includes('password'),false);
});
test('pantalla A: controles del cuerpo; pantalla B: controles de prenda en grupos independientes',()=>{
 for(const id of ['mode-body','mode-garment','body-fields','garment-fields','bodyChestCm-range',
 'bodyChestCm-number','bodyHipCm-range','garmentChestCm-range','garmentChestCm-number',
 'garmentHipCm-range','garmentLengthCm-range','bodyHeightCm-number','reset-all'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/<fieldset[^>]*id="garment-fields"[^>]*disabled/);
 assert.match(html,/Altura corporal \(auxiliar\)/);
 assert.match(html,/No hay fotos, medidas de jugadoras ni cálculo de tensión textil/);
 assert.match(html,/Ningún resultado permite aprobar una orden de producción/);
 assert.match(css,/@media\(max-width:620px\)/);
});
test('se congelan los campos de la otra malla en cada modo y se sincronizan dos entradas',()=>{
 assert.match(app,/\$\('body-fields'\)\.disabled=!body/);
 assert.match(app,/\$\('garment-fields'\)\.disabled=body/);
 assert.match(app,/range\.addEventListener\('input'/);
 assert.match(app,/numeric\.addEventListener\('change'/);
 assert.match(app,/viewer\.update\(state\)/);
 assert.match(app,/activeMode='body'/);
});
test('viewer renderiza dos referencias de geometría separadas y nunca reescala ambas automáticamente',()=>{
 assert.match(viewer,/createReferenceBody\(THREE\)/);
 assert.match(viewer,/createFreeTestJersey\(THREE\)/);
 assert.match(viewer,/pivot\.add\(mannequin,garment\)/);
 assert.match(viewer,/applyFitToModels\(mannequin,garment,values\)/);
 assert.match(viewer,/measureChestSections\(\)/);
 assert.match(viewer,/mannequin!==garment/);
 assert.ok(!viewer.includes('MPFB2'),'no hay dependencia de Blender en el navegador');
});


import {
  DEFAULT_LABELS,LABEL_CONFIG,LABEL_VALUES,normalizeLabels,
  normalizeLabel,effectFor,labelKeyForMeasure,serializeLabels
} from '../configurador-3d/fit-lab/discrete-states.mjs';

test('cinco variables geométricas discretas, tres etiquetas por variable y sin convertir a cm',()=>{
 assert.deepEqual(LABEL_VALUES,[-1,0,1]);
 assert.equal(Object.keys(LABEL_CONFIG).length,5);
 assert.deepEqual(DEFAULT_LABELS,{
  bodyChestState:0,bodyHipState:0,
  garmentChestState:0,garmentHipState:0,garmentLengthState:0
 });
 assert.equal(normalizeLabel('1'),1);
 assert.equal(normalizeLabel('invalid'),0);
 assert.equal(normalizeLabel(2),0);
 assert.deepEqual(normalizeLabels({bodyChestState:-1,garmentHipState:1,bodyHipState:88}),
  {...DEFAULT_LABELS,bodyChestState:-1,garmentHipState:1});
 assert.equal(labelKeyForMeasure('bodyHeightCm'),null);
 assert.equal(labelKeyForMeasure('bodyChestCm'),'bodyChestState');
 assert.equal(effectFor({garmentLengthState:-1},'garmentLengthState'),-.18);
 assert.throws(()=>effectFor({},'invalid'),/desconocida/);
});
test('la interfaz incorpora 15 botones discretos: A con 2 variables, B con 3',()=>{
 const all=[...html.matchAll(/data-label-key="(\w+)" data-label-value="(-?1|0)"/g)];
 assert.equal(all.length,15);
 for(const key of Object.keys(LABEL_CONFIG)){
  const list=all.filter(x=>x[1]===key).map(x=>Number(x[2]));
  assert.deepEqual(list,[-1,0,1]);
 }
 assert.match(html,/No equivalen a intervalos de centímetros/);
 assert.match(html,/id="discrete-status"/);
 assert.match(app,/LABEL_CONFIG\[labelKey\]\.target!==activeMode/);
 assert.match(app,/state\[discreteKey\]=0/);
 assert.match(app,/button\.setAttribute\('aria-pressed',String\(yes\)\)/);
 assert.match(css,/\.discrete-options button\[aria-pressed=true\]/);
});
test('JSON conserva medidas originales y etiqueta visual independiente sin patrón asignado',()=>{
 const original={...DEFAULT_FIT,...DEFAULT_LABELS,
  bodyChestState:1,garmentHipState:-1,garmentLengthState:1};
 const exported=serializeFit(original);
 assert.equal(exported.body.chestCm,DEFAULT_FIT.bodyChestCm);
 assert.equal(exported.garment.hipTargetCm,DEFAULT_FIT.garmentHipCm);
 assert.equal(exported.differencesNominalCm.chest,14);
 assert.equal(exported.discretization.levels.bodyChestState,1);
 assert.equal(exported.discretization.levels.garmentHipState,-1);
 assert.equal(exported.discretization.levels.garmentLengthState,1);
 assert.equal(exported.discretization.manufacturingPattern,null);
 assert.equal(exported.discretization.calibration,'not-calibrated-to-centimeters');
 assert.equal(serializeLabels(original).purpose,'visual-simulation-only');
 assert.match(exported.note,/intervalos en centímetros/);
});


test('regresión: la normalización del visor no descarta los botones -1/+1',()=>{
 const incoming={...DEFAULT_FIT,
   bodyChestState:1,bodyHipState:-1,garmentChestState:1,
   garmentHipState:-1,garmentLengthState:1};
 const full=normalizeRenderFit(incoming);
 assert.deepEqual(full,{...DEFAULT_FIT,...incoming});
 assert.equal(full.bodyChestState,1);
 assert.equal(full.garmentChestState,1);
 assert.equal(full.garmentLengthState,1);
 assert.deepEqual(normalizeRenderFit({bodyChestState:3,garmentChestState:'-1'}),
   {...DEFAULT_FIT,...DEFAULT_LABELS,garmentChestState:-1});
 assert.match(viewer,/applyFitToModels\(mannequin,garment,values\)/);
});
test('botón seleccionado produce indicador de ancho, frente y espalda tras actualizar la malla',()=>{
 for(const id of ['mesh-mode-readout','shape-width','shape-front','shape-back']){
   assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(app,/function updateGeometryFeedback\(\)/);
 assert.match(app,/try\{viewer\.update\(state\);updateGeometryFeedback\(\);\}/);
 assert.match(app,/referenceSections=viewer\.measureChestSections\(\)/);
 assert.match(app,/button\.addEventListener\('click'/);
 assert.match(css,/\.geometry-feedback__stats/);
 assert.match(viewer,/measureCrossSection\(mannequin,\.27\)/);
 assert.match(viewer,/measureCrossSection\(garment,\.27\)/);
});
