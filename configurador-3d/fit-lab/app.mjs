import {FIELD_LIMITS,resolveState,transition} from './lab-model.mjs';
import {GARMENT_CATALOG} from './garment-catalog.mjs';
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:1});
let state=resolveState({}),viewer=null,renderFrame=0,lastSnapshot=null;
function field(key,label,parent){const [min,max]=FIELD_LIMITS[key],div=document.createElement('div');div.className='fit-field';div.innerHTML=`<div class="field-top"><label for="${key}-range">${label}</label><span><input id="${key}-number" data-field="${key}" type="number" min="${min}" max="${max}" step="1" aria-label="${label} en centímetros"><span>cm</span></span></div><input id="${key}-range" data-field="${key}" type="range" min="${min}" max="${max}" step="1">`;$(parent).append(div);}
for(const [key,label] of [['bodyChestCm','Pecho'],['bodyHipCm','Cadera'],['desiredLengthCm','Largo deseado']])field(key,label,'measure-fields');field('bodyHeightCm','Altura corporal','height-field');
for(const [key,label] of [['frontVolume','Frontal'],['sideVolume','Lateral'],['backVolume','Posterior']]){const div=document.createElement('div');div.className='shape-field';div.innerHTML=`<label for="${key}-range">${label}</label><input id="${key}-range" data-field="${key}" type="range" min="0" max="10" step="1"><output id="${key}-output" for="${key}-range">${state[key]}</output>`;$('shape-fields').append(div);}
for(const code of Object.keys(GARMENT_CATALOG)){const button=document.createElement('button');button.type='button';button.dataset.garment=code;button.textContent=code;button.addEventListener('click',()=>dispatch({type:'garment',code}));$('catalog-options').append(button);}
const FABRIC_COLORS=[['#173e64','Azul marino'],['#f2f0e9','Marfil'],['#141820','Negro'],['#b52840','Rojo'],['#197d81','Turquesa']];
let selectedColor=FABRIC_COLORS[0][0];
for(const [hex,name] of FABRIC_COLORS){const b=document.createElement('button');b.type='button';b.className='fabric-swatch';b.style.backgroundColor=hex;b.title=name;b.setAttribute('aria-label','Color '+name);b.dataset.color=hex;b.addEventListener('click',()=>{selectedColor=hex;document.querySelectorAll('[data-color]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));viewer?.setColor(hex);});$('fabric-colors').append(b);}
$('fabric-colors').firstElementChild.setAttribute('aria-pressed','true');
function syncUI(){
 const c=GARMENT_CATALOG[state.activeConfiguration];
 document.querySelectorAll('[data-field]').forEach(input=>{if(document.activeElement!==input||input.type==='range')input.value=state[input.dataset.field];});
 for(const key of ['frontVolume','sideVolume','backVolume'])$(key+'-output').textContent=fmt(state[key]);
 document.querySelectorAll('[data-selection-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.selectionMode===state.selectionMode)));
 document.querySelectorAll('[data-garment]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.garment===state.activeConfiguration)));
 $('catalog-options').dataset.mode=state.selectionMode;$('active-code').textContent=c.code;$('scene-code').textContent=c.code;
 $('active-dimensions').textContent=`Pecho ${c.chestCm} · Cadera ${c.hipCm} cm · Largo ${c.lengthCm} cm`;
 $('selection-status').textContent=state.reviewRequired?'Fuera del catálogo: se conserva la prenda para revisión.':state.selectionMode==='auto'?'Candidata actualizada con tus medidas.':'Prenda fija para comparar distintos cuerpos.';
 $('selection-status').classList.toggle('warning',state.reviewRequired);
 $('scene-mode').textContent=state.selectionMode==='auto'?'Selección automática':'Prenda fija · manual';
 $('scene-body').textContent=`Cuerpo · pecho ${fmt(state.bodyChestCm)} / cadera ${fmt(state.bodyHipCm)} cm`;
 $('scene-garment').textContent=`Camiseta · ${c.chestCm} / ${c.hipCm} cm · largo ${c.lengthCm} cm`;
 $('garment-length-readout').textContent=c.lengthCm+' cm';
 $('selection-explanation').textContent=`El recomendador compara las seis variantes. Candidata: ${state.recommendation.previewCode}. El largo solicitado (${fmt(state.desiredLengthCm)} cm) no estira artificialmente la camiseta elegida. Los tres controles de volumen cambian la forma conservando los contornos.`;
}
function onFrame(snapshot){
 lastSnapshot=snapshot;const review=$('fit-review');review.hidden=snapshot.cloth.maxStrain<=.5;review.textContent=review.hidden?'':'Deformación elevada en este ensayo: revisa la prenda seleccionada.';$('body-chest-readout').textContent=fmt(snapshot.body.chestCm)+' cm';$('body-hip-readout').textContent=fmt(snapshot.body.hipCm)+' cm';
 $('length-label').textContent='Alto visible '+fmt(snapshot.garment.hangingHeightCm)+' cm';
 $('contact-count').textContent=snapshot.cloth.contactVertices+' vértices';$('penetration').textContent=fmt(snapshot.cloth.maxPenetrationCm*10)+' mm';$('strain').textContent=fmt(snapshot.cloth.p95Strain*100)+' %';$('particle-count').textContent=snapshot.cloth.particles+' / '+snapshot.cloth.seams;
 $('cloth-state').textContent=snapshot.paused?'Simulación pausada':snapshot.cloth.maxVelocity>.06?'Tejido en movimiento':'Gravedad y contacto';
 if(viewer){const ref=viewer.reference();for(const [id,key] of [['ref-body-front','bodyFront'],['ref-body-side','bodySide'],['ref-shirt-front','shirtFront'],['ref-shirt-side','shirtSide']]){$(id).setAttribute('d',ref[key]);$(id).style.display=$(id.includes('body')?'show-body':'show-garment').checked?'':'none';}}
}
function dispatch(event){state=transition(state,event);syncUI();if(renderFrame)cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(()=>{renderFrame=0;try{viewer?.update(state);}catch(error){showError(error);}});}
function showError(error){$('scene-error').hidden=false;$('scene-error').textContent=error.message;$('render-status').textContent='Revisar visor';$('render-status').classList.add('error');}
for(const input of document.querySelectorAll('[data-field]')){input.addEventListener('input',()=>{if(input.value!==''&&input.validity.valid)dispatch({type:'measure',key:input.dataset.field,value:input.value});});input.addEventListener('change',()=>{dispatch({type:'measure',key:input.dataset.field,value:input.value||state[input.dataset.field]});input.value=state[input.dataset.field];});}
document.querySelectorAll('[data-selection-mode]').forEach(b=>b.addEventListener('click',()=>dispatch({type:'mode',value:b.dataset.selectionMode})));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{viewer?.view(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
for(const id of ['show-body','show-garment','transparent-garment','show-dimensions','show-motion'])$(id).addEventListener('change',()=>{
 if(!$('show-body').checked&&!$('show-garment').checked)$(id==='show-body'?'show-garment':'show-body').checked=true;
 viewer?.setVisual({body:$('show-body').checked,garment:$('show-garment').checked,transparent:$('transparent-garment').checked,dimensions:$('show-dimensions').checked,motion:$('show-motion').checked});
});
$('cloth-impulse').addEventListener('click',()=>viewer?.impulse());$('settle-cloth').addEventListener('click',()=>viewer?.settle());
$('pause-motion').addEventListener('click',()=>{const paused=$('pause-motion').getAttribute('aria-pressed')!=='true';viewer?.pause(paused);$('pause-motion').setAttribute('aria-pressed',String(paused));$('pause-motion').textContent=paused?'Reanudar':'Pausar';});
$('reset-all').addEventListener('click',()=>dispatch({type:'reset'}));
export function getLabSnapshot(){return JSON.parse(JSON.stringify({state,lastFrame:viewer?viewer.snapshot():lastSnapshot}));}
$('save-json').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({schema:'nubyra.fit-lab/1.0',...getLabSnapshot()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nubyra-fit-lab-ensayo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function syncMotionPreference(){for(const id of ['show-motion','cloth-impulse']){$(id).disabled=reduced.matches;$(id).title=reduced.matches?'Movimiento reducido según la preferencia del dispositivo':'';}}
syncMotionPreference();reduced.addEventListener('change',syncMotionPreference);
syncUI();try{const {createFitViewer}=await import('./fit-viewer.mjs');viewer=createFitViewer($('fit-canvas'),state,onFrame);$('render-status').textContent='XPBD · contacto activo';onFrame(viewer.snapshot());}catch(error){showError(error);}
window.addEventListener('pagehide',()=>{viewer?.destroy();reduced.removeEventListener('change',syncMotionPreference);},{once:true});
