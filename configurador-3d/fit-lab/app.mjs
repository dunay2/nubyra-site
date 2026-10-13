import { DEFAULT_FIT, LIMITS, MODES, normalizeFit, nominalDifferences, serializeFit } from './fit-geometry.mjs';
import { DEFAULT_LABELS, LABEL_CONFIG, LABEL_VALUES, labelKeyForMeasure, normalizeLabels } from './discrete-states.mjs';

const $=id=>document.getElementById(id);
const fields=Object.keys(LIMITS);
const state={...DEFAULT_FIT,...DEFAULT_LABELS};
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
function syncDiscreteControls(){
  const labels=normalizeLabels(state);
  document.querySelectorAll('[data-label-key]').forEach(button=>{
    const {labelKey,labelValue}=button.dataset;
    const yes=labels[labelKey]===Number(labelValue);
    button.setAttribute('aria-pressed',String(yes));
    button.classList.toggle('active',yes);
  });
}
function updateDiscreteStatus(){
  const selected=Object.entries(normalizeLabels(state)).filter(([,value])=>value!==0);
  $('discrete-status').textContent=selected.length
    ?'Estados visuales: '+selected.map(([key,value])=>labelNames[key]+' '+(value===1?'+1':'−1')).join(' · ')+'. Las cifras en cm no cambian al seleccionar etiquetas.'
    :'Etiquetas visuales: todos los parámetros en estado base (0).';
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
  updateGeometry();
}
function changeValue(key,value){
  if(!(key in LIMITS))return;
  const raw=Number(value);
  if(!Number.isFinite(raw))return;
  const [min,max]=LIMITS[key];
  state[key]=Math.min(max,Math.max(min,raw));
  // Al editar una medida explícita anulamos su etiqueta adimensional, sin inventar límites de cm.
  const discreteKey=labelKeyForMeasure(key);
  if(discreteKey)state[discreteKey]=0;
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
  updateGeometryFeedback();
}
document.querySelectorAll('[data-label-key]').forEach(button=>{
  button.addEventListener('click',()=>{
    const {labelKey,labelValue}=button.dataset;
    if(!(labelKey in LABEL_CONFIG)||LABEL_CONFIG[labelKey].target!==activeMode)return;
    const next=Number(labelValue);
    if(!LABEL_VALUES.includes(next))return;
    state[labelKey]=next;
    redraw();
  });
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
    state[k]=DEFAULT_FIT[k];
    const discreteKey=labelKeyForMeasure(k);
    if(discreteKey)state[discreteKey]=0;
  }
  redraw();
}
$('reset-body').addEventListener('click',()=>resetSet(['bodyChestCm','bodyHipCm','bodyHeightCm']));
$('reset-garment').addEventListener('click',()=>resetSet(['garmentChestCm','garmentHipCm','garmentLengthCm']));
$('reset-all').addEventListener('click',()=>{
  Object.assign(state,DEFAULT_FIT,DEFAULT_LABELS);
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
