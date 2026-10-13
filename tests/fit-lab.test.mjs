import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {
 FIT_VERSION,DEFAULT_FIT,LIMITS,MODES,
 normalizeFit,normalizeRenderFit,serializeFit,nominalDifferences
} from '../configurador-3d/fit-lab/fit-geometry.mjs';
import {
 BASE_SHIRTS,BAND_STEPS,DEFAULT_BASE,
 MEASURE_TO_STATE,STATE_TO_MEASURE,
 normalizeBase,bandOf,getBand,bandThresholds,representativeCm,
 classifiedLabels,nearestBase,serializeClassifier,
 demoGarmentTargetsFromBody,suggestPatternFromMeasurements,
 RECOMMENDATION_FIELDS
} from '../configurador-3d/fit-lab/size-classifier.mjs';
import {
 DEFAULT_LABELS,LABEL_CONFIG,LABEL_VALUES,serializeLabels
} from '../configurador-3d/fit-lab/discrete-states.mjs';
import {
 BUST_PROJECTION_MIN,BUST_PROJECTION_MAX,DEFAULT_BUST_PROJECTION,
 normalizeBustProjection,bustProtrusionUnits
} from '../configurador-3d/fit-lab/fit-drape.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','configurador-3d','fit-lab');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const app=readFileSync(resolve(root,'app.mjs'),'utf8');
const viewer=readFileSync(resolve(root,'fit-viewer.mjs'),'utf8');
const css=readFileSync(resolve(root,'styles.css'),'utf8');
const geometry=readFileSync(resolve(root,'fit-geometry.mjs'),'utf8');
const classifier=readFileSync(resolve(root,'size-classifier.mjs'),'utf8');
function elementPanel(id){
 const start=html.indexOf('id="panel-'+id+'"');
 if(start<0)throw Error('Panel no encontrado: '+id);
 const next=html.indexOf('<section class="tab-panel"',start+1);
 return html.slice(start,next<0?html.length:next);
}

test('el flujo inicial se ordena Medidas → Ajuste 3D → Propuesta en el mismo editor',()=>{
 assert.deepEqual([...html.matchAll(/data-tab="(measures|adjust|proposal)"/g)].map(m=>m[1]),[
  'measures','adjust','proposal'
 ]);
 for(const name of ['measures','adjust','proposal']){
  assert.match(html,new RegExp('id="tab-'+name+'"[^>]*role="tab"'));
  assert.match(html,new RegExp('id="panel-'+name+'"[^>]*role="tabpanel"'));
 }
 assert.match(html,/id="tab-measures"[^>]*aria-selected="true"/);
 assert.match(html,/id="panel-adjust"[^>]*hidden>/);
 assert.match(html,/id="panel-proposal"[^>]*hidden>/);
 const measures=elementPanel('measures');
 assert.doesNotMatch(measures,/id="suggested-base"/);
 assert.doesNotMatch(measures,/data-base-id=/);
 assert.doesNotMatch(measures,/Elige el tamaño base/);
 assert.match(css,/\.view-panel\{position:sticky;top:10px/);
 assert.match(css,/\.editor-panels\{max-height:/);
});
test('los tabs responden a ratón, teclado y controles para continuar',()=>{
 assert.match(app,/event\.key==='ArrowRight'/);
 assert.match(app,/event\.key==='ArrowLeft'/);
 assert.match(app,/event\.key==='Home'/);
 assert.match(app,/event\.key==='End'/);
 assert.match(app,/activateTab\(next,\{focus:true\}\)/);
 assert.match(app,/tab\.setAttribute\('aria-selected',String\(on\)\)/);
 assert.match(app,/panel\.hidden=!on/);
 assert.match(html,/data-go-tab="adjust"/);
 assert.match(html,/data-go-tab="proposal"/);
 assert.match(html,/data-go-tab="measures"/);
});
test('el paso Medidas solicita los tres datos necesarios y altura auxiliar',()=>{
 const first=elementPanel('measures');
 for(const id of [
  'bodyChestCm-number','bodyChestCm-range',
  'bodyHipCm-number','bodyHipCm-range',
  'goalLengthCm-number','goalLengthCm-range','bodyHeightCm-number'
 ])assert.match(first,new RegExp('id="'+id+'"'));
 assert.equal((first.match(/data-fit-key="desiredLengthCm"/g)||[]).length,2);
 assert.match(first,/independiente de la altura corporal/);
 assert.doesNotMatch(first,/id="garmentChestCm-range"/);
 assert.match(app,/desiredLengthCm:DEFAULT_FIT\.garmentLengthCm/);
});
test('el paso de Ajuste permite cuerpo A o camiseta B sin tocar la otra malla',()=>{
 const second=elementPanel('adjust');
 for(const id of [
  'mode-body','mode-garment','adjust-body-fields',
  'adjust-bodyChestCm-range','adjust-bodyHipCm-range',
  'garment-fields','garmentChestCm-range','garmentHipCm-range','garmentLengthCm-range'
 ])assert.match(second,new RegExp('id="'+id+'"'));
 assert.match(app,/\$\('adjust-body-fields'\)\.hidden=!body/);
 assert.match(app,/\$\('garment-fields'\)\.hidden=body/);
 assert.match(app,/\$\('body-fields'\)\.disabled=false/);
 assert.match(viewer,/applyFitToModels\(mannequin,garment,values\)/);
 assert.match(viewer,/pivot\.add\(mannequin,garment\)/);
 assert.match(viewer,/measureChestSections\(\)/);
 assert.match(viewer,/refreshRearGuide\(\)/);
});
test('patrón N1/N2 es resultado únicamente en la pestaña final',()=>{
 const final=elementPanel('proposal');
 assert.match(final,/id="suggested-base"/);
 assert.match(final,/id="proposal-explanation"/);
 assert.match(final,/id="proposal-status"/);
 assert.match(final,/id="proposal-input-chest"/);
 assert.match(final,/id="proposal-input-hip"/);
 assert.match(final,/id="proposal-input-length"/);
 assert.match(final,/id="use-proposal"/);
 assert.equal((final.match(/data-pattern-base="N[12]"/g)||[]).length,6);
 assert.match(final,/[Pp]osición lateral (?:industrial )?1\/2\/3/);
 assert.match(final,/sin validar/);
 assert.match(app,/const proposed=getRecommendation\(\)/);
 assert.match(app,/suggestPatternFromMeasurements\(state\)/);
 assert.doesNotMatch(app,/document\.querySelectorAll\('\[data-base-id\]'\)/);
});
test('clasificador utiliza 3 entradas independientes: pecho, cadera corporal y largo solicitado',()=>{
 assert.deepEqual(RECOMMENDATION_FIELDS,['bodyChestCm','bodyHipCm','desiredLengthCm']);
 assert.equal(suggestPatternFromMeasurements({...DEFAULT_FIT,desiredLengthCm:64}).base,'N1');
 assert.equal(suggestPatternFromMeasurements({
  ...DEFAULT_FIT,bodyChestCm:111,bodyHipCm:122,desiredLengthCm:76
 }).base,'N2');
 const small=suggestPatternFromMeasurements({
  ...DEFAULT_FIT,bodyChestCm:90,bodyHipCm:97,desiredLengthCm:64
 });
 assert.equal(small.lateralPosition,null);
 assert.equal(small.manufacturingApproved,false);
 assert.equal(small.candidateOnly,true);
 assert.equal(small.status,'demo-candidate');
 assert.deepEqual(Object.keys(small.measuredInputs).sort(),[
  'bodyChestCm','bodyHipCm','desiredLengthCm'
 ]);
 assert.throws(()=>suggestPatternFromMeasurements({bodyChestCm:88,bodyHipCm:90}),
  /Medida inválida/);
});

test('relieve de busto es una variable geométrica 0-10 separada de los centímetros del contorno',()=>{
 assert.equal(BUST_PROJECTION_MIN,0);
 assert.equal(BUST_PROJECTION_MAX,10);
 assert.equal(DEFAULT_BUST_PROJECTION,3);
 assert.equal(normalizeBustProjection(0),0);
 assert.equal(normalizeBustProjection(-15),0);
 assert.equal(normalizeBustProjection(3),3);
 assert.equal(normalizeBustProjection(999),10);
 assert.equal(normalizeBustProjection('inválido'),DEFAULT_BUST_PROJECTION);
 assert.equal(bustProtrusionUnits(0,'front'),0);
 assert.equal(bustProtrusionUnits(-25,'front'),0);
 assert.ok(bustProtrusionUnits(10,'front')>bustProtrusionUnits(3,'front'));
 assert.ok(bustProtrusionUnits(10,'lateral')>0);
 const normalized=normalizeRenderFit({...DEFAULT_FIT,bustProjectionLevel:-8});
 assert.equal(normalized.bustProjectionLevel,0);
 const out=serializeFit({...DEFAULT_FIT,bustProjectionLevel:0});
 assert.equal(out.body.bustProjectionLevel,0);
 assert.match(out.note,/0 = plano/);
 assert.match(geometry,/const outwardRelief=protrusion\*breastEnvelope/);
 assert.doesNotMatch(geometry,/chestDepth\*deltaChest\*chest/);
});
test('UI muestra nivel 0=plano sin cifras negativas en Medidas, Ajuste y gráfico 2D',async()=>{
 for(const id of [
  'bustProjectionLevel-number','bustProjectionLevel-range',
  'adjust-bustProjectionLevel-number','adjust-bustProjectionLevel-range',
  'scale-bust-level'
 ])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/min="0" max="10" step="1" value="3"/);
 assert.match(html,/0 = plano/);
 assert.match(html,/No existe un nivel negativo ni una cavidad/);
 assert.match(app,/bustProjectionLevel:\[BUST_PROJECTION_MIN,BUST_PROJECTION_MAX\]/);
 assert.match(app,/bustProjectionLevel:DEFAULT_BUST_PROJECTION/);
 assert.match(app,/\$\('scale-bust-level'\)\.textContent=svg\.bustProjectionLevel===0/);
 const {createScaleSilhouettes}=await import('../configurador-3d/fit-lab/scale-diagram.mjs');
 const base={...DEFAULT_FIT,bodyProfile:'front'};
 const neutral=createScaleSilhouettes({...base,bustProjectionLevel:0});
 const negative=createScaleSilhouettes({...base,bustProjectionLevel:-20});
 const reducedChest=createScaleSilhouettes({...base,bodyChestCm:65,bustProjectionLevel:0});
 const raised=createScaleSilhouettes({...base,bustProjectionLevel:10});
 assert.equal(neutral.bustReliefDiagramCm,0);
 assert.equal(neutral.bodySide,negative.bodySide);
 assert.equal(neutral.sideBustFrontX,reducedChest.sideBustFrontX,
  'menor contorno no debe dibujar el pecho hacia dentro');
 assert.ok(raised.sideBustFrontX>neutral.sideBustFrontX);
 assert.equal(raised.bustProjectionLevel,10);
});

test('largo solicitado es distinto de largo de la camiseta usada para comparar',()=>{
 const s={...DEFAULT_FIT,desiredLengthCm:78,activeBase:'N1'};
 const result=suggestPatternFromMeasurements(s);
 assert.equal(result.measuredInputs.desiredLengthCm,78);
 assert.equal(s.garmentLengthCm,64);
 const saved=serializeFit(s);
 assert.equal(saved.requestedGarmentLengthCm,78);
 assert.equal(saved.garment.lengthTargetCm,64);
 assert.equal(saved.sizeProposal.suggestedBase,result.base);
 assert.equal(saved.sizeProposal.lateralPosition,null);
 assert.equal(saved.sizeProposal.validatedIndustrialRanges,false);
 assert.match(app,/const preview=getPreviewRecommendation\(\)/);
});
test('la propuesta se recalcula pero no se aplica al visor de forma implícita',()=>{
 assert.match(app,/const proposed=getRecommendation\(\),preview=getPreviewRecommendation\(\),candidate=preview\.previewBase/);
 assert.match(app,/\$\('use-proposal'\)\.addEventListener\('click'/);
 assert.match(app,/Object\.assign\(state,stateForConfiguration\(preview\.previewCode\)\)/);
 assert.match(app,/activateTab\('adjust',\{focus:true\}\)/);
 assert.match(app,/button\.disabled=outOfDemo\|\|state\.activeConfiguration===preview\.previewCode/);
 assert.match(app,/if\(preview\.status==='review-outside-demo'\)return/);
 assert.equal(suggestPatternFromMeasurements({
  ...DEFAULT_FIT,bodyChestCm:120,bodyHipCm:130,desiredLengthCm:48
 }).status,'review-outside-demo');
});
test('grupos −1/0/+1 son clases relativas al candidato, sin reemplazar los centímetros',()=>{
 assert.deepEqual(LABEL_VALUES,[-1,0,1]);
 assert.equal(Object.keys(LABEL_CONFIG).length,5);
 assert.equal(Object.keys(BAND_STEPS).length,5);
 assert.deepEqual(Object.keys(MEASURE_TO_STATE).sort(),Object.keys(BAND_STEPS).sort());
 assert.deepEqual(Object.keys(BASE_SHIRTS),['N1','N2']);
 assert.equal(DEFAULT_BASE,'N1');
 assert.equal(normalizeBase('N2'),'N2');
 assert.equal(normalizeBase('invalid'),'N1');
 assert.deepEqual(DEFAULT_LABELS,{
  bodyChestState:0,bodyHipState:0,
  garmentChestState:0,garmentHipState:0,garmentLengthState:0
 });
 for(const [measure,key] of Object.entries(MEASURE_TO_STATE)){
  assert.equal(STATE_TO_MEASURE[key],measure);
  for(const level of LABEL_VALUES){
   const cm=representativeCm(measure,level,'N1');
   assert.equal(getBand(measure,cm,'N1'),level);
  }
  const band=bandThresholds(measure,'N1');
  assert.equal(band.upper-band.lower,BAND_STEPS[measure]);
 }
 assert.equal(bandOf(102,102,8),0);
 assert.equal(bandOf(97,102,8),-1);
 assert.equal(bandOf(107,102,8),1);
 assert.match(app,/changeValue\(measure,representativeCm\(measure,level,getRecommendation\(\)\.base\)\)/);
 assert.match(app,/classifiedLabels\(state,base\)/);
 assert.doesNotMatch(geometry,/effectFor\(values,/);
 assert.equal((html.match(/data-label-key="(\w+)" data-label-value="(-?1|0)"/g)||[]).length,15);
});
test('los valores de ensayo no se publican como tallaje aprobado',()=>{
 assert.match(html,/sin validar/);
 assert.match(html,/no una tabla de tallas industriales/);
 assert.match(html,/Ningún resultado permite aprobar una orden de producción/);
 assert.match(classifier,/Tolerancia EXPERIMENTAL/);
 const output=serializeFit({...DEFAULT_FIT,desiredLengthCm:64,activeBase:'N1'});
 assert.equal(output.status,'experimental-not-manufacturing-approved');
 assert.equal(output.sizeProposal.appliedGarmentPattern,null);
 assert.equal(output.sizeProposal.validatedIndustrialRanges,false);
 assert.equal(output.discretization.calibration,'not-calibrated-to-centimeters');
 assert.equal(serializeLabels(DEFAULT_LABELS).purpose,'visual-simulation-only');
});
test('estado numérico normalizado, medidas independientes y JSON reproducible',()=>{
 assert.deepEqual(MODES,['body','garment']);
 assert.equal(Object.keys(LIMITS).length,6);
 assert.equal(normalizeFit({bodyChestCm:999,garmentLengthCm:-2}).bodyChestCm,120);
 assert.deepEqual(nominalDifferences(DEFAULT_FIT),{chest:14,hip:14});
 assert.equal(normalizeRenderFit(DEFAULT_FIT).bodyChestState,0);
 const state={...DEFAULT_FIT,bodyChestCm:110,desiredLengthCm:75};
 const payload=serializeFit(state);
 assert.equal(payload.schema,FIT_VERSION);
 assert.equal(payload.body.chestCm,110);
 assert.equal(payload.garment.chestTargetCm,102);
 assert.equal(payload.requestedGarmentLengthCm,75);
 assert.equal(JSON.stringify(payload).includes('password'),false);
 assert.match(app,/workflowStep:activeTab/);
});
test('el visor permanece siempre visible, cámaras y contorno trasero conservados',()=>{
 assert.match(html,/id="fit-canvas"/);
 assert.match(html,/data-view="front"/);
 assert.match(html,/data-view="back"/);
 assert.match(html,/id="show-body"/);
 assert.match(html,/id="transparent-garment"/);
 assert.match(html,/id="wireframe"/);
 assert.match(html,/id="shape-width"/);
 assert.match(html,/id="shape-back"/);
 assert.match(app,/viewer\.update\(state\)/);
 assert.match(app,/viewer\?\.setGuideTarget\(mode\)/);
 assert.match(css,/@media\(max-width:640px\)/);
});

test('producto finito: solo 6 configuraciones de reposo y 2 capas independientes',async()=>{
 const {GARMENT_CATALOG,DEFAULT_CONFIGURATION,stateForConfiguration,
  recommendPreviewConfiguration}=await import('../configurador-3d/fit-lab/garment-catalog.mjs');
 assert.equal(Object.keys(GARMENT_CATALOG).length,6);
 assert.equal(DEFAULT_CONFIGURATION,'N1-2');
 const codes=['N1-1','N1-2','N1-3','N2-1','N2-2','N2-3'];
 assert.deepEqual(Object.keys(GARMENT_CATALOG),codes);
 assert.equal(stateForConfiguration('N1-1').garmentChestCm,98);
 assert.equal(stateForConfiguration('N1-2').garmentChestCm,102);
 assert.equal(stateForConfiguration('N2-3').garmentChestCm,124);
 assert.equal(new Set(codes.map(c=>GARMENT_CATALOG[c].lengthCm)).size,2);
 assert.throws(()=>stateForConfiguration('N3-1'),/desconocida/);
 const proposal=recommendPreviewConfiguration({...DEFAULT_FIT,desiredLengthCm:76,
  bodyChestCm:111,bodyHipCm:122});
 assert.equal(proposal.previewCode,'N2-3');
 assert.equal(proposal.lateralPosition,null);
 assert.equal(proposal.industrialApproved,false);
 assert.equal((html.match(/data-rest-option=/g)||[]).length,6);
 assert.match(html,/id="show-garment"/);
 assert.match(html,/id="show-body"/);
 assert.match(app,/garment:garment\.checked/);
 assert.match(app,/if\(key\.startsWith\('garment'\)\)return/);
});
test('diagrama 2D: altura y largo comparten escala vertical, sin antropometría certificada',async()=>{
 const {createScaleSilhouettes,DIAGRAM_SCALE,SHOULDER_HEIGHT_RATIO}=
  await import('../configurador-3d/fit-lab/scale-diagram.mjs');
 assert.equal(DIAGRAM_SCALE,1.26);
 assert.equal(SHOULDER_HEIGHT_RATIO,.82);
 const v=createScaleSilhouettes({...DEFAULT_FIT,estimatedFrontHemLiftCm:3});
 const w=createScaleSilhouettes({...DEFAULT_FIT,estimatedFrontHemLiftCm:0});
 assert.ok(v.bodyFront.length>100&&v.shirtFront.length>40);
 assert.equal(v.nominalLengthCm,64);
 assert.equal(v.bodyHeightCm,160);
 assert.ok(Math.abs(v.nominalHemY-v.frontHemY-3*DIAGRAM_SCALE)<.01);
 assert.equal(v.scalePxPerCm,DIAGRAM_SCALE);
 assert.equal(v.shoulderY,w.shoulderY);
 assert.ok(v.frontHemY<w.frontHemY);
 const lateral=createScaleSilhouettes({...DEFAULT_FIT,bodyProfile:'lateral'});
 assert.notEqual(lateral.bodySide,v.bodySide);
 for(const id of ['fit-scale-diagram','scale-body-front','scale-body-side',
  'scale-shirt-front','scale-shirt-side','scale-hem-lift']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/escala vertical/);
 assert.match(app,/function updateScaleDiagram\(\)/);
});
