import { DEFAULT_FIT, LIMITS, MODES, normalizeFit, nominalDifferences, serializeFit } from './fit-geometry.mjs';
import { LABEL_CONFIG, LABEL_VALUES } from './discrete-states.mjs';
import {
  BASE_SHIRTS, DEFAULT_BASE, BAND_STEPS,STATE_TO_MEASURE,
  classifiedLabels,bandThresholds,representativeCm,nearestBase,
  demoGarmentTargetsFromBody,normalizeBase
} from './size-classifier.mjs';

const $=id=>document.getElementById(id);
const fields=Object.keys(LIMITS);
const state={...DEFAULT_FIT,activeBase:DEFAULT_BASE,experimentMode:'body'};
let activeMode='body',viewer=null,geometryFrame=0,referenceSections=null;
function formatDelta(value){return (value>=0?'+':'')+String(value)+' cm';}
function syncInputs(){
  for(const key of fields){
    const number=$(key+'-number');
    const range=$(key+'-range');
    if(number && document.activeElement!==number)number.value=String(state[key]);
    if(range)range.value=String(state[key]);
  }
}
const labelNames={
  bodyChestState:'Pecho corporal',bodyHipState:'Cadera corporal',
  garmentChestState:'Pecho prenda',garmentHipState:'Cadera prenda',garmentLengthState:'Largo prenda'
};
const cmText=value=>Number(value).toLocaleString('es-ES',{maximumFractionDigits:1});
function syncDiscreteControls(){
  const labels=classifiedLabels(state,state.activeBase);
  document.querySelectorAll('[data-label-key]').forEach(button=>{
    const {labelKey,labelValue}=button.dataset;
    const yes=labels[labelKey]===Number(labelValue);
    button.setAttribute('aria-pressed',String(yes));
    button.classList.toggle('active',yes);
  });
  for(const measure of Object.keys(BAND_STEPS)){
    const b=bandThresholds(measure,state.activeBase),value=Number(state[measure]);
    const indicator=$('cm-band-'+measure);
    indicator.textContent='−1: menos de '+cmText(b.lower)+' cm · 0: '+cmText(b.lower)+
     ' a '+cmText(b.upper)+' cm · +1: más de '+cmText(b.upper)+' cm'+
     ' · actual '+cmText(value)+' cm';
  }
}
function updateDiscreteStatus(){
  const labels=classifiedLabels(state,state.activeBase);
  const selected=Object.entries(labels).filter(([,value])=>value!==0);
  $('discrete-status').textContent=selected.length
    ?'Grupos calculados para '+state.activeBase+': '+selected.map(([key,value])=>
      labelNames[key]+' '+(value===1?'+1':'−1')).join(' · ')+
      '. Cada etiqueta procede de los centímetros.'
    :'Grupos calculados para '+state.activeBase+
      ': todos los parámetros en el rango base (0).';
}
function updateProposalUI(){
  const proposed=nearestBase(state,activeMode);
  $('active-base').textContent=state.activeBase;
  $('suggested-base').textContent=proposed.base;
  $('proposal-explanation').textContent=activeMode==='body'
    ?'Propuesta automática usando pecho y cadera corporales. Si la aplicas, la camiseta se adapta con una diferencia de 14 cm de DEMOSTRACIÓN, no una holgura validada.'
    :'Propuesta automática según pecho, cadera y largo actuales de la camiseta. La malla ya muestra esas medidas de ensayo.';
  $('use-proposal').disabled=proposed.base===state.activeBase;
  $('use-proposal').textContent=proposed.base===state.activeBase
    ?'La propuesta coincide con la base activa'
    :'Usar camiseta '+proposed.base+' propuesta';
  document.querySelectorAll('[data-base-id]').forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset.baseId===state.activeBase));
    button.classList.toggle('active',button.dataset.baseId===state.activeBase);
  });
  return proposed;
}
function updateReadings(){
  const diffs=nominalDifferences(state);
  $('delta-chest').textContent=formatDelta(diffs.chest);
  $('delta-hip').textContent=formatDelta(diffs.hip);
}
function formatChangePercent(current,base){
  if(!(Number.isFinite(current)&&Number.isFinite(base)&&base>0))return '—';
  const raw=(current/base-1)*100;
  const rounded=Math.abs(raw)<.05?0:raw;
  return (rounded>0?'+':'')+rounded.toLocaleString('es-ES',{
    minimumFractionDigits:1,maximumFractionDigits:1
  })+' %';
}
function updateGeometryFeedback(){
  if(!viewer||!referenceSections)return;
  const sections=viewer.measureChestSections();
  const now=sections[activeMode],original=referenceSections[activeMode];
  $('mesh-mode-readout').textContent=activeMode==='body'?'A · Cuerpo':'B · Camiseta';
  for(const [id,metric] of [['shape-width','width'],['shape-front','front'],['shape-back','back']]){
    $(id).textContent=formatChangePercent(now[metric],original[metric]);
  }
}
function updateGeometry(){
  if(geometryFrame)cancelAnimationFrame(geometryFrame);
  geometryFrame=requestAnimationFrame(()=>{
    geometryFrame=0;
    if(!viewer)return;
    try{viewer.update(state);updateGeometryFeedback();}
    catch(error){
      const banner=$('scene-error');
      banner.textContent='Error en la geometría experimental: '+error.message;
      banner.hidden=false;
      $('render-status').textContent='REVISAR GEOMETRÍA';
      $('render-status').classList.add('error');
    }
  });
}
function redraw(){
  syncInputs();
  updateReadings();
  syncDiscreteControls();
  updateDiscreteStatus();
  updateProposalUI();
  updateGeometry();
}
function changeValue(key,value){
  if(!(key in LIMITS))return;
  const raw=Number(value);
  if(!Number.isFinite(raw))return;
  const [min,max]=LIMITS[key];
  state[key]=Math.min(max,Math.max(min,raw));
  // Fuente única de verdad: el intervalo -1/0/+1 se recalcula desde estos centímetros.
  redraw();
}
function enableMode(mode){
  if(!MODES.includes(mode))return;
  activeMode=mode;
  const body=mode==='body';
  $('mode-body').setAttribute('aria-pressed',String(body));
  $('mode-garment').setAttribute('aria-pressed',String(!body));
  $('body-fields').disabled=!body;
  $('garment-fields').disabled=body;
  $('body-fields').classList.toggle('is-locked',!body);
  $('garment-fields').classList.toggle('is-locked',body);
  state.experimentMode=activeMode;
  viewer?.setGuideTarget(activeMode);
  updateProposalUI();
  updateGeometryFeedback();
}
document.querySelectorAll('[data-label-key]').forEach(button=>{
  button.addEventListener('click',()=>{
    const {labelKey,labelValue}=button.dataset;
    if(!(labelKey in LABEL_CONFIG)||LABEL_CONFIG[labelKey].target!==activeMode)return;
    const next=Number(labelValue);
    if(!LABEL_VALUES.includes(next))return;
    const measure=STATE_TO_MEASURE[labelKey];
    if(!measure)return;
    // Los botones fijan un valor real del campo numérico (en este ensayo),
    // y de ese valor se deriva la clase correspondiente, sin sumas de deltas.
    changeValue(measure,representativeCm(measure,next,state.activeBase));
  });
});
document.querySelectorAll('[data-base-id]').forEach(button=>{
  button.addEventListener('click',()=>{
    const id=normalizeBase(button.dataset.baseId);
    state.activeBase=id;
    const ref=BASE_SHIRTS[id];
    for(const measure of ['garmentChestCm','garmentHipCm','garmentLengthCm'])
      state[measure]=ref[measure];
    enableMode('garment');
    redraw();
  });
});
$('use-proposal').addEventListener('click',()=>{
  const {base}=nearestBase(state,activeMode);
  if(base===state.activeBase)return;
  if(activeMode==='body'){
    // En el modo A no se modifica la camiseta hasta la aceptación explícita.
    const targets=demoGarmentTargetsFromBody(state);
    Object.assign(state,targets);
  }
  state.activeBase=base;
  enableMode('garment');
  redraw();
});
$('mode-body').addEventListener('click',()=>enableMode('body'));
$('mode-garment').addEventListener('click',()=>enableMode('garment'));
for(const key of fields){
  const range=$(key+'-range'),numeric=$(key+'-number');
  if(range)range.addEventListener('input',()=>changeValue(key,range.value));
  if(numeric){
    numeric.addEventListener('input',()=>{
      if(numeric.value.trim()!=='' && numeric.validity.valid)changeValue(key,numeric.value);
    });
    numeric.addEventListener('change',()=>{
      if(numeric.value.trim())changeValue(key,numeric.value);
      numeric.value=String(state[key]);
    });
  }
}
function resetSet(keys){
  for(const k of keys){
    state[k]=k.startsWith('garment')
      ?BASE_SHIRTS[state.activeBase][k]
      :DEFAULT_FIT[k];
  }
  redraw();
}
$('reset-body').addEventListener('click',()=>resetSet(['bodyChestCm','bodyHipCm','bodyHeightCm']));
$('reset-garment').addEventListener('click',()=>resetSet(['garmentChestCm','garmentHipCm','garmentLengthCm']));
$('reset-all').addEventListener('click',()=>{
  Object.assign(state,DEFAULT_FIT,{activeBase:DEFAULT_BASE,experimentMode:'body'});
  enableMode('body');
  redraw();
});
document.querySelectorAll('[data-view]').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    viewer?.view(button.dataset.view);
  });
});
function updateDisplay(){
  viewer?.setVisual({
    body:$('show-body').checked,
    transparent:$('transparent-garment').checked,
    wire:$('wireframe').checked
  });
}
['show-body','transparent-garment','wireframe'].forEach(id=>$(id).addEventListener('change',updateDisplay));
$('save-json').addEventListener('click',()=>{
  const bytes=JSON.stringify({...serializeFit(state),experimentMode:activeMode},null,2);
  const file=new Blob([bytes],{type:'application/json;charset=utf-8'});
  const href=URL.createObjectURL(file),a=document.createElement('a');
  a.href=href;a.download='NUBYRA_experimento_cuerpo_camiseta.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
});
redraw();
try{
  const {createFitViewer}=await import('./fit-viewer.mjs');
  viewer=createFitViewer($('fit-canvas'),state);
  viewer.setGuideTarget(activeMode);
  referenceSections=viewer.measureChestSections();
  updateDisplay();
  viewer.view('quarter');
  const check=viewer.geometryDiagnostics();
  if(!check.independentMeshReferences||check.garmentPieces<4)throw Error('Faltan mallas independientes');
  $('render-status').textContent='DOS MALLAS ACTIVAS';
  $('render-status').classList.add('ready');
  redraw();
}catch(error){
  $('render-status').textContent='3D NO DISPONIBLE';
  $('render-status').classList.add('error');
  const banner=$('scene-error');
  banner.hidden=false;
  banner.textContent='No ha sido posible iniciar la visualización WebGL. Comprueba el navegador o la carga de Three.js. Los controles y el JSON siguen disponibles. '+error.message;
  console.warn('NUBYRA Fit Lab:',error);
}
