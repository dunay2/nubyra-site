import {DEFAULT_FIT,LIMITS,MODES,nominalDifferences,serializeFit} from './fit-geometry.mjs';
import {LABEL_CONFIG,LABEL_VALUES} from './discrete-states.mjs';
import {
  BASE_SHIRTS,DEFAULT_BASE,BAND_STEPS,STATE_TO_MEASURE,
  classifiedLabels,bandThresholds,representativeCm,
  suggestPatternFromMeasurements
} from './size-classifier.mjs';
import {
  DEFAULT_CONFIGURATION,GARMENT_CATALOG,stateForConfiguration,
  recommendPreviewConfiguration
} from './garment-catalog.mjs';
import {DEFAULT_BODY_PROFILE,getBodyProfile,DEFAULT_BUST_PROJECTION,BUST_PROJECTION_MIN,BUST_PROJECTION_MAX} from './fit-drape.mjs';
import {createScaleSilhouettes} from './scale-diagram.mjs';

const $=id=>document.getElementById(id);
const TABS=Object.freeze(['measures','adjust','proposal']);
const state={...DEFAULT_FIT,desiredLengthCm:DEFAULT_FIT.garmentLengthCm,
  activeBase:DEFAULT_BASE,activeConfiguration:DEFAULT_CONFIGURATION,
  bodyProfile:DEFAULT_BODY_PROFILE,bustProjectionLevel:DEFAULT_BUST_PROJECTION,experimentMode:'body'};
let activeTab='measures',activeMode='body',viewer=null,geometryFrame=0,referenceSections=null;
const allLimits={...LIMITS,desiredLengthCm:LIMITS.garmentLengthCm,
  bustProjectionLevel:[BUST_PROJECTION_MIN,BUST_PROJECTION_MAX]};
const labelNames={
  bodyChestState:'Pecho corporal',bodyHipState:'Cadera corporal',
  garmentChestState:'Pecho prenda',garmentHipState:'Cadera prenda',
  garmentLengthState:'Largo prenda'
};
const cmText=v=>Number(v).toLocaleString('es-ES',{maximumFractionDigits:1});
const formatDelta=v=>(v>=0?'+':'')+cmText(v)+' cm';
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

function measureControls(key){
  const standard=[$(key+'-number'),$(key+'-range')];
  return [...new Set([...standard,...document.querySelectorAll('[data-fit-key="'+key+'"]')])]
    .filter(Boolean);
}
function syncInputs(){
  for(const key of Object.keys(allLimits)){
    for(const input of measureControls(key)){
      if(input.type==='number'&&document.activeElement===input)continue;
      input.value=String(state[key]);
    }
  }
}
function getRecommendation(){
  return suggestPatternFromMeasurements(state);
}
function syncDiscreteControls(){
  // La clasificación se deriva de medidas, no asigna la familia industrial.
  const base=getRecommendation().base;
  const labels=classifiedLabels(state,base);
  document.querySelectorAll('[data-label-key]').forEach(button=>{
    const yes=labels[button.dataset.labelKey]===Number(button.dataset.labelValue);
    button.setAttribute('aria-pressed',String(yes));
    button.classList.toggle('active',yes);
  });
  for(const key of Object.keys(BAND_STEPS)){
    const indicator=$('cm-band-'+key);
    if(!indicator)continue;
    const b=bandThresholds(key,base);
    indicator.textContent='−1: menos de '+cmText(b.lower)+' cm · 0: '+
      cmText(b.lower)+' a '+cmText(b.upper)+' cm · +1: más de '+
      cmText(b.upper)+' cm · actual '+cmText(state[key])+' cm (referencia de ensayo)';
  }
}
function updateReadings(){
  const differences=nominalDifferences(state);
  $('delta-chest').textContent=formatDelta(differences.chest);
  $('delta-hip').textContent=formatDelta(differences.hip);
}
function getPreviewRecommendation(){
  return recommendPreviewConfiguration(state);
}
function selectRestConfiguration(code){
  const target=stateForConfiguration(code);
  Object.assign(state,target);
  redraw();
}
function syncFiniteCatalog(){
  document.querySelectorAll('[data-rest-option]').forEach(button=>{
    const selected=button.dataset.restOption===state.activeConfiguration;
    button.setAttribute('aria-pressed',String(selected));
  });
}
function updateProposalUI(){
  const proposed=getRecommendation(),preview=getPreviewRecommendation(),candidate=preview.previewBase;
  $('suggested-base').textContent=candidate;
  $('active-base').textContent=state.activeConfiguration;
  $('suggested-preview-variant').textContent=preview.previewCode;
  syncFiniteCatalog();
  $('proposal-input-chest').textContent=cmText(state.bodyChestCm)+' cm';
  $('proposal-input-hip').textContent=cmText(state.bodyHipCm)+' cm';
  $('proposal-input-length').textContent=cmText(state.desiredLengthCm)+' cm';
  const outOfDemo=preview.status==='review-outside-demo';
  $('proposal-status').textContent=outOfDemo
    ?'Fuera de los rangos de referencia de este ensayo: revisión manual'
    :'Candidato de simulación · No aprobado para fabricación';
  $('proposal-status').classList.toggle('is-warning',outOfDemo);
  $('proposal-explanation').textContent='Selección de la mejor de seis maquetas de geometría de reposo fijo según medidas de pecho, cadera y largo. Ninguna dimensión, holgura, posición lateral ni simulación textil está validada.';
  $('lateral-position-warning').textContent='Patrón base candidato: '+candidate+
    '. Posición lateral 1/2/3: SIN ASIGNAR; faltan reglas y pruebas de patronaje. Las seis opciones mostradas son posibilidades técnicas, no resultados de tallaje.';
  document.querySelectorAll('[data-pattern-base]').forEach(box=>{
    box.classList.toggle('is-family-candidate',box.dataset.patternBase===candidate);
  });
  const classified=classifiedLabels(state,candidate);
  $('proposal-bands').textContent=
    'Grupos relativos al candidato '+candidate+' · Pecho: '+
    (classified.bodyChestState>0?'+1':String(classified.bodyChestState))+
    ' · Cadera: '+(classified.bodyHipState>0?'+1':String(classified.bodyHipState))+
    ' · Largo solicitado: '+(state.desiredLengthCm<
      BASE_SHIRTS[candidate].garmentLengthCm-3?'-1':
      state.desiredLengthCm>BASE_SHIRTS[candidate].garmentLengthCm+3?'+1':'0')+
    '. Son etiquetas de ensayo, no posiciones laterales industriales.';
  const selected=Object.entries(classified).filter(([,v])=>v!==0);
  $('discrete-status').textContent=selected.length
    ?'Etiquetas derivadas de las medidas (referencia '+candidate+'): '+
      selected.map(([k,v])=>labelNames[k]+' '+(v>0?'+1':'−1')).join(' · ')+
      '. No determinan posición de fabricación.'
    :'Etiquetas derivadas de las medidas: todos los parámetros dentro del grupo 0 de referencia '+candidate+'.';
  const button=$('use-proposal');
  button.disabled=outOfDemo||state.activeConfiguration===preview.previewCode;
  button.textContent=outOfDemo
    ?'Fuera del catálogo de ensayo: revisión manual'
    :button.disabled?'Esta variante de ensayo ya se ve en 3D'
      :'Probar en el visor '+preview.previewCode;
  return {...proposed,preview};
}
function formatPercent(value,reference){
  if(!(Number.isFinite(value)&&Number.isFinite(reference)&&reference>0))return '—';
  const raw=(value/reference-1)*100,rounded=Math.abs(raw)<.05?0:raw;
  return (rounded>0?'+':'')+rounded.toLocaleString('es-ES',{
    minimumFractionDigits:1,maximumFractionDigits:1
  })+' %';
}
function updateGeometryFeedback(){
  if(!viewer||!referenceSections)return;
  const current=viewer.measureChestSections()[activeMode],reference=referenceSections[activeMode];
  $('mesh-mode-readout').textContent=activeMode==='body'?'A · Cuerpo':'B · Camiseta';
  for(const [id,axis] of [['shape-width','width'],['shape-front','front'],['shape-back','back']]){
    $(id).textContent=formatPercent(current[axis],reference[axis]);
  }
}
function updateScaleDiagram(){
  const drape=viewer?.drapeDiagnostics();
  const svg=createScaleSilhouettes({
    ...state,
    estimatedFrontHemLiftCm:drape?.estimatedFrontHemLiftCm??0,
    frontProjectionUnits:drape?.frontProjectionUnits??0
  });
  const paths=[
    ['scale-body-front',svg.bodyFront],['scale-body-side',svg.bodySide],
    ['scale-shirt-front',svg.shirtFront],['scale-shirt-side',svg.shirtSide]
  ];
  for(const [id,d] of paths)$(id).setAttribute('d',d);
  for(const [id,head] of [
    ['scale-head-front',svg.headFront],['scale-head-side',svg.headSide]
  ]){
    for(const prop of ['cx','cy','r'])$(id).setAttribute(prop,String(head[prop]));
  }
  $('scale-front-hem').setAttribute('y1',String(svg.frontHemY));
  $('scale-front-hem').setAttribute('y2',String(svg.frontHemY));
  $('scale-reference-hem').setAttribute('y1',String(svg.nominalHemY));
  $('scale-reference-hem').setAttribute('y2',String(svg.nominalHemY));
  $('scale-height-label').textContent=cmText(svg.bodyHeightCm)+' cm';
  $('scale-length-label').textContent='Camiseta: '+cmText(svg.nominalLengthCm)+' cm';
  $('scale-body-height').textContent=cmText(svg.bodyHeightCm)+' cm';
  $('scale-shirt-length').textContent=cmText(svg.nominalLengthCm)+' cm';
  $('scale-hem-lift').textContent=drape
    ?'≈ '+cmText(svg.estimatedFrontHemLiftCm)+' cm (ensayo)'
    :'Pendiente del visor 3D';
  $('diagram-body-profile').textContent=getBodyProfile(state.bodyProfile).label;
  $('scale-bust-level').textContent=svg.bustProjectionLevel===0
    ?'0 · plano'
    :cmText(svg.bustProjectionLevel)+' / 10 · hacia fuera';
  document.querySelectorAll('[data-body-profile]').forEach(button=>{
    button.setAttribute('aria-pressed',
      String(button.dataset.bodyProfile===state.bodyProfile));
  });
  $('diagram-body-layer').setAttribute('display',
    $('show-body').checked?'inline':'none');
  $('diagram-garment-layer').setAttribute('display',
    $('show-garment').checked?'inline':'none');
  $('scale-front-hem').setAttribute('display',
    $('show-garment').checked?'inline':'none');
  $('scale-reference-hem').setAttribute('display',
    $('show-garment').checked?'inline':'none');
}
function updateGeometry(){
  if(geometryFrame)cancelAnimationFrame(geometryFrame);
  geometryFrame=requestAnimationFrame(()=>{
    geometryFrame=0;
    if(!viewer)return;
    try{
      viewer.update(state);
      updateGeometryFeedback();
      updateScaleDiagram();
    }catch(error){
      $('scene-error').hidden=false;
      $('scene-error').textContent='Error geométrico: '+error.message;
      $('render-status').textContent='REVISAR GEOMETRÍA';
      $('render-status').classList.add('error');
    }
  });
}
function redraw(){
  syncInputs();
  syncDiscreteControls();
  updateReadings();
  updateProposalUI();
  updateScaleDiagram();
  updateGeometry();
}
function changeValue(key,raw){
  if(!(key in allLimits))return;
  const value=Number(raw);
  if(!Number.isFinite(value))return;
  const [min,max]=allLimits[key];
  // Las medidas de reposo no son deslizadores libres: se eligen en catálogo.
  if(key.startsWith('garment'))return;
  state[key]=clamp(value,min,max);
  redraw();
}
function activateTab(name,{focus=false}={}){
  if(!TABS.includes(name))return;
  activeTab=name;
  for(const value of TABS){
    const tab=$('tab-'+value),panel=$('panel-'+value),on=value===name;
    tab.setAttribute('aria-selected',String(on));
    tab.tabIndex=on?0:-1;
    panel.hidden=!on;
  }
  if(focus)$('tab-'+name).focus();
}
document.querySelectorAll('[role="tab"][data-tab]').forEach(tab=>{
  tab.addEventListener('click',()=>activateTab(tab.dataset.tab));
  tab.addEventListener('keydown',event=>{
    const current=TABS.indexOf(tab.dataset.tab);
    const next=event.key==='ArrowRight'?TABS[(current+1)%TABS.length]:
      event.key==='ArrowLeft'?TABS[(current+TABS.length-1)%TABS.length]:
      event.key==='Home'?TABS[0]:event.key==='End'?TABS[TABS.length-1]:null;
    if(!next)return;
    event.preventDefault();
    activateTab(next,{focus:true});
  });
});
document.querySelectorAll('[data-go-tab]').forEach(button=>{
  button.addEventListener('click',()=>activateTab(button.dataset.goTab,{focus:true}));
});
function enableMode(mode){
  if(!MODES.includes(mode))return;
  activeMode=mode;
  state.experimentMode=mode;
  const body=mode==='body';
  $('mode-body').setAttribute('aria-pressed',String(body));
  $('mode-garment').setAttribute('aria-pressed',String(!body));
  // Medidas siempre editables en el paso 1. Congelar controles solo en Ajuste 3D.
  $('body-fields').disabled=false;
  $('adjust-body-fields').hidden=!body;
  $('adjust-body-fields').disabled=!body;
  $('garment-fields').hidden=body;
  $('garment-fields').disabled=true;
  $('garment-fields').classList.toggle('is-locked',body);
  viewer?.setGuideTarget(mode);
  updateGeometryFeedback();
}
$('mode-body').addEventListener('click',()=>enableMode('body'));
$('mode-garment').addEventListener('click',()=>enableMode('garment'));
document.querySelectorAll('[data-rest-option]').forEach(button=>{
  button.addEventListener('click',()=>selectRestConfiguration(button.dataset.restOption));
});
document.querySelectorAll('[data-body-profile]').forEach(button=>{
  button.addEventListener('click',()=>{
    const next=button.dataset.bodyProfile;
    if(!['front','lateral','thorax'].includes(next))return;
    state.bodyProfile=next;
    redraw();
  });
});
document.querySelectorAll('[data-label-key]').forEach(button=>{
  button.addEventListener('click',()=>{
    const {labelKey,labelValue}=button.dataset,config=LABEL_CONFIG[labelKey];
    if(!config)return;
    // En Medidas editamos cuerpo aunque Ajuste 3D se haya quedado en modo B.
    if(config.target==='garment')return; // no crear tallas intermedias
    if(activeTab==='adjust'&&config.target!==activeMode)return;
    const level=Number(labelValue);
    if(!LABEL_VALUES.includes(level))return;
    const measure=STATE_TO_MEASURE[labelKey];
    if(!measure)return;
    changeValue(measure,representativeCm(measure,level,getRecommendation().base));
  });
});
for(const key of Object.keys(allLimits)){
  for(const input of measureControls(key)){
    if(input.type==='range')input.addEventListener('input',()=>changeValue(key,input.value));
    if(input.type==='number'){
      input.addEventListener('input',()=>{
        if(input.value.trim()!==''&&input.validity.valid)changeValue(key,input.value);
      });
      input.addEventListener('change',()=>{
        if(input.value.trim()!=='')changeValue(key,input.value);
        input.value=String(state[key]);
      });
    }
  }
}
$('reset-body').addEventListener('click',()=>{
  for(const key of ['bodyChestCm','bodyHipCm','bodyHeightCm'])state[key]=DEFAULT_FIT[key];
  state.bustProjectionLevel=DEFAULT_BUST_PROJECTION;
  redraw();
});
$('reset-garment').addEventListener('click',()=>{
  selectRestConfiguration(DEFAULT_CONFIGURATION);
});
$('reset-all').addEventListener('click',()=>{
  Object.assign(state,DEFAULT_FIT,{
    desiredLengthCm:DEFAULT_FIT.garmentLengthCm,
    activeBase:DEFAULT_BASE,
    activeConfiguration:DEFAULT_CONFIGURATION,
    bodyProfile:DEFAULT_BODY_PROFILE,
    bustProjectionLevel:DEFAULT_BUST_PROJECTION,
    experimentMode:'body'
  });
  enableMode('body');
  activateTab('measures',{focus:true});
  redraw();
});
$('use-proposal').addEventListener('click',()=>{
  const preview=getPreviewRecommendation();
  if(preview.status==='review-outside-demo')return;
  Object.assign(state,stateForConfiguration(preview.previewCode));
  enableMode('garment');
  activateTab('adjust',{focus:true});
  redraw();
});
document.querySelectorAll('[data-view]').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('[data-view]').forEach(el=>
      el.setAttribute('aria-pressed',String(el===button)));
    viewer?.view(button.dataset.view);
  });
});
function updateDisplay(event){
  const body=$('show-body'),garment=$('show-garment');
  // Nunca dejamos al usuario ante un visor 3D vacío.
  if(!body.checked&&!garment.checked){
    if(event?.target===body)garment.checked=true;
    else body.checked=true;
  }
  viewer?.setVisual({
    body:body.checked,
    garment:garment.checked,
    transparent:$('transparent-garment').checked,
    wire:$('wireframe').checked
  });
  updateScaleDiagram();
}
for(const id of ['show-body','show-garment','transparent-garment','wireframe']){
  $(id).addEventListener('change',updateDisplay);
}
$('save-json').addEventListener('click',()=>{
  const documentData={
    ...serializeFit(state),
    requestedGarmentLengthCm:state.desiredLengthCm,
    restConfiguration:state.activeConfiguration,
    bodyDistributionProfile:state.bodyProfile,
    bustProjectionLevel:state.bustProjectionLevel,
    garmentCatalogSize:Object.keys(GARMENT_CATALOG).length,
    drapeEstimate:viewer?.drapeDiagnostics()??null,
    workflowStep:activeTab,
    experimentMode:activeMode,
    recommendation:getRecommendation()
  };
  const file=new Blob([JSON.stringify(documentData,null,2)],{type:'application/json;charset=utf-8'});
  const href=URL.createObjectURL(file),a=document.createElement('a');
  a.href=href;a.download='NUBYRA_medidas_ajuste_propuesta_demo.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
});
enableMode('body');
activateTab('measures');
redraw();
// El laboratorio sigue funcionando como formulario/JSON si no hay WebGL.
try{
  const {createFitViewer}=await import('./fit-viewer.mjs');
  viewer=createFitViewer($('fit-canvas'),state);
  viewer.setGuideTarget(activeMode);
  referenceSections=viewer.measureChestSections();
  updateDisplay();
  viewer.view('quarter');
  const check=viewer.geometryDiagnostics();
  if(!check.independentMeshReferences||check.garmentPieces<4)
    throw Error('Faltan las dos mallas independientes');
  $('render-status').textContent='DOS MALLAS ACTIVAS';
  $('render-status').classList.add('ready');
  redraw();
}catch(error){
  $('render-status').textContent='3D NO DISPONIBLE';
  $('render-status').classList.add('error');
  $('scene-error').hidden=false;
  $('scene-error').textContent='No se ha podido iniciar WebGL. Los controles y el JSON siguen disponibles. '+error.message;
  console.warn('NUBYRA Fit Lab:',error);
}
