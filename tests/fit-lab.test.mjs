import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {
 FIT_VERSION,DEFAULT_FIT,LIMITS,MODES,normalizeFit,normalizeRenderFit,
 serializeFit,nominalDifferences
} from '../configurador-3d/fit-lab/fit-geometry.mjs';
import {DEFAULT_LABELS,LABEL_CONFIG,LABEL_VALUES,serializeLabels} from '../configurador-3d/fit-lab/discrete-states.mjs';
import {
 BASE_SHIRTS,BAND_STEPS,DEFAULT_BASE,MEASURE_TO_STATE,STATE_TO_MEASURE,
 normalizeBase,bandOf,getBand,bandThresholds,representativeCm,
 classifiedLabels,nearestBase,initialValuesForBase,serializeClassifier,
 demoGarmentTargetsFromBody
} from '../configurador-3d/fit-lab/size-classifier.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','configurador-3d','fit-lab');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const app=readFileSync(resolve(root,'app.mjs'),'utf8');
const viewer=readFileSync(resolve(root,'fit-viewer.mjs'),'utf8');
const css=readFileSync(resolve(root,'styles.css'),'utf8');
const geometry=readFileSync(resolve(root,'fit-geometry.mjs'),'utf8');

test('A/B: las 6 medidas del ensayo (5 variables + altura auxiliar) están acotadas',()=>{
 assert.deepEqual(MODES,['body','garment']);
 assert.equal(Object.keys(LIMITS).length,6);
 assert.deepEqual(normalizeFit({bodyChestCm:999,garmentLengthCm:-2}),
  {...DEFAULT_FIT,bodyChestCm:120,garmentLengthCm:48});
 assert.equal(normalizeFit({bodyChestCm:'invalid'}).bodyChestCm,88);
});
test('las diferencias nominales no son holguras certificadas ni medidas del patronista',()=>{
 assert.deepEqual(nominalDifferences(DEFAULT_FIT),{chest:14,hip:14});
 assert.deepEqual(nominalDifferences({...DEFAULT_FIT,bodyChestCm:110}),{chest:-8,hip:14});
 const v=serializeFit({...DEFAULT_FIT,bodyChestCm:110});
 assert.equal(v.schema,FIT_VERSION);
 assert.equal(v.status,'experimental-not-manufacturing-approved');
 assert.equal(v.body.chestCm,110);
 assert.equal(v.garment.chestTargetCm,102);
 assert.match(v.note,/NO son perímetros medidos/);
 assert.equal(v.sizeProposal.validatedIndustrialRanges,false);
});
test('UI de cuerpo, prenda, tamaño base y contornos de espalda',()=>{
 for(const id of ['mode-body','mode-garment','body-fields','garment-fields',
 'bodyChestCm-range','bodyChestCm-number','bodyHipCm-range','garmentChestCm-range',
 'garmentChestCm-number','garmentHipCm-range','garmentLengthCm-range',
 'bodyHeightCm-number','reset-all','active-base','suggested-base','use-proposal',
 'mesh-mode-readout','shape-width','shape-front','shape-back'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/<fieldset[^>]*id="garment-fields"[^>]*disabled/);
 assert.match(html,/Altura corporal \(auxiliar\)/);
 assert.match(html,/No hay fotos, medidas de jugadoras ni cálculo de tensión textil/);
 assert.match(html,/Ningún resultado permite aprobar una orden de producción/);
 assert.match(html,/línea .*ámbar.*marca el contorno posterior inicial/);
 assert.match(css,/\.rear-guide-help/);
 assert.match(css,/@media\(max-width:620px\)/);
});
test('el modo A congela inputs de prenda y el B inputs corporales',()=>{
 assert.match(app,/\$\('body-fields'\)\.disabled=!body/);
 assert.match(app,/\$\('garment-fields'\)\.disabled=body/);
 assert.match(app,/range\.addEventListener\('input'/);
 assert.match(app,/numeric\.addEventListener\('change'/);
 assert.match(app,/viewer\.update\(state\)/);
 assert.match(app,/viewer\?\.setGuideTarget\(activeMode\)/);
});
test('mallas independientes y guía trasera para comparar originales vs deformaciones',()=>{
 assert.match(viewer,/createReferenceBody\(THREE\)/);
 assert.match(viewer,/createFreeTestJersey\(THREE\)/);
 assert.match(viewer,/pivot\.add\(mannequin,garment\)/);
 assert.match(viewer,/applyFitToModels\(mannequin,garment,values\)/);
 assert.match(viewer,/measureChestSections\(\)/);
 assert.match(viewer,/backSurfaceProfile\(backPanel\)/);
 assert.match(viewer,/refreshRearGuide\(\)/);
 assert.match(viewer,/guides\.visible=viewName==='back'/);
 assert.match(viewer,/mannequin!==garment/);
});
test('cinco variables admiten tres grupos y cada grupo responde a cm',()=>{
 assert.deepEqual(LABEL_VALUES,[-1,0,1]);
 assert.equal(Object.keys(LABEL_CONFIG).length,5);
 assert.equal(Object.keys(BAND_STEPS).length,5);
 assert.deepEqual(Object.keys(MEASURE_TO_STATE).sort(),Object.keys(BAND_STEPS).sort());
 assert.equal(DEFAULT_BASE,'N1');
 assert.equal(normalizeBase('N2'),'N2');
 assert.equal(normalizeBase('otro'),'N1');
 assert.deepEqual(Object.keys(BASE_SHIRTS),['N1','N2']);
 assert.ok(BASE_SHIRTS.N2.garmentChestCm>BASE_SHIRTS.N1.garmentChestCm);
 assert.equal(bandOf(99,102,8),0);
 assert.equal(bandOf(97,102,8),-1);
 assert.equal(bandOf(107,102,8),1);
 assert.equal(getBand('garmentChestCm',102,'N1'),0);
 assert.equal(getBand('garmentChestCm',120,'N2'),0);
 assert.throws(()=>getBand('bodyHeightCm',160),/sin clasificación/);
});
test('los límites en cm están definidos para esta prueba y son bidireccionales',()=>{
 for(const [measure,key] of Object.entries(MEASURE_TO_STATE)){
  assert.equal(STATE_TO_MEASURE[key],measure);
  for(const level of LABEL_VALUES){
   const cm=representativeCm(measure,level,'N1');
   assert.equal(getBand(measure,cm,'N1'),level,measure+': '+level);
   assert.equal(classifiedLabels({...DEFAULT_FIT,[measure]:cm},'N1')[key],level);
  }
  const band=bandThresholds(measure,'N1');
  assert.equal(band.upper-band.lower,BAND_STEPS[measure]);
 }
 assert.throws(()=>representativeCm('garmentChestCm',2),/incorrecta/);
 assert.deepEqual(classifiedLabels(DEFAULT_FIT,'N1'),DEFAULT_LABELS);
});
test('al cambiar los centímetros se cambia la etiqueta; estado manual obsoleto no se suma',()=>{
 const values={...DEFAULT_FIT,bodyChestCm:96,garmentChestCm:110,
  bodyChestState:-1,garmentChestState:-1};
 const effective=normalizeRenderFit(values);
 assert.equal(effective.bodyChestCm,96);
 assert.equal(effective.garmentChestCm,110);
 assert.equal(effective.bodyChestState,1);
 assert.equal(effective.garmentChestState,1);
 assert.equal(normalizeRenderFit({bodyChestState:1}).bodyChestState,0);
 assert.match(app,/changeValue\(measure,representativeCm\(measure,next,state\.activeBase\)\)/);
 assert.doesNotMatch(geometry,/effectFor\(values,/);
 assert.match(app,/const labels=classifiedLabels\(state,state.activeBase\)/);
 assert.match(html,/Cada etiqueta representa un <strong>intervalo de centímetros de ensayo<\/strong>/);
});
test('selectores 15 botones y rangos cm calculados desde tamaño base',()=>{
 const groups=[...html.matchAll(/class="discrete-options"/g)];
 assert.equal(groups.length,5);
 const all=[...html.matchAll(/data-label-key="(\w+)" data-label-value="(-?1|0)"/g)];
 assert.equal(all.length,15);
 for(const key of Object.keys(LABEL_CONFIG))
  assert.deepEqual(all.filter(v=>v[1]===key).map(v=>Number(v[2])),[-1,0,1]);
 for(const measure of Object.keys(BAND_STEPS))
  assert.match(html,new RegExp('id="cm-band-'+measure+'"'));
 assert.match(app,/function updateDiscreteStatus\(\)/);
 assert.match(app,/function updateProposalUI\(\)/);
 assert.match(app,/button\.setAttribute\('aria-pressed',String\(yes\)\)/);
 assert.match(css,/\.discrete-options button\[aria-pressed=true\]/);
});
test('recomendación cambia dinámicamente de N1 a N2 con medidas corporales',()=>{
 assert.equal(nearestBase(DEFAULT_FIT,'body').base,'N1');
 const bigger={...DEFAULT_FIT,bodyChestCm:111,bodyHipCm:122};
 assert.equal(nearestBase(bigger,'body').base,'N2');
 assert.equal(nearestBase({...DEFAULT_FIT,garmentChestCm:130,garmentHipCm:137},'garment').base,'N2');
 assert.equal(nearestBase(DEFAULT_FIT,'garment').base,'N1');
 assert.deepEqual(demoGarmentTargetsFromBody(DEFAULT_FIT),
  {garmentChestCm:102,garmentHipCm:110});
 assert.deepEqual(initialValuesForBase('N2'),{
  bodyChestCm:106,bodyHipCm:116,garmentChestCm:120,garmentHipCm:130,garmentLengthCm:72
 });
 assert.match(app,/nearestBase\(state,activeMode\)/);
 assert.match(app,/\$\('use-proposal'\)\.disabled=proposed.base===state.activeBase/);
 assert.match(app,/if\(activeMode==='body'\)/);
 assert.match(app,/enableMode\('garment'\)/);
});
test('medidas numéricas y tamaño base explicitan reglas NO validadas para fabricación',()=>{
 const state={...DEFAULT_FIT,activeBase:'N2',experimentMode:'garment',
  bodyChestCm:106,garmentChestCm:128,garmentHipCm:120};
 const out=serializeFit(state);
 assert.equal(out.body.chestCm,106);
 assert.equal(out.garment.chestTargetCm,128);
 assert.equal(out.discretization.levels.garmentChestState,1);
 assert.equal(out.discretization.levels.garmentHipState,-1);
 assert.equal(out.sizeProposal.activeBase,'N2');
 assert.equal(out.sizeProposal.suggestedBase,'N2');
 assert.equal(out.sizeProposal.validatedIndustrialRanges,false);
 assert.equal(out.sizeProposal.appliedGarmentPattern,null);
 assert.equal(serializeClassifier(state,'N2','garment').schema,'nubyra.demo-size-proposal/0.1');
 assert.equal(serializeLabels(DEFAULT_LABELS).purpose,'visual-simulation-only');
 assert.equal(JSON.stringify(out).includes('password'),false);
});
