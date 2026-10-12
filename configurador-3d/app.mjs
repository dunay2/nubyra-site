import { DEFAULT_STATE, PRESETS, normalizeText, normalizeNumber, validNumber, serializeProposal } from './layout.mjs';
import { jerseySVG, renderFallback } from './flat.mjs';

const $ = id => document.getElementById(id);
const state = { ...DEFAULT_STATE, crestDataUrl: null };
let viewer=null,modelWarning='',viewerWarnings=[],safeZones=false,flatMode=true;
const fields=['team','surname','number','sponsor-front','sponsor-top','sponsor-bottom'];
const stateKeys={'sponsor-front':'sponsorFront','sponsor-top':'sponsorTop','sponsor-bottom':'sponsorBottom'};

function render(){
  $('flat-preview').innerHTML=renderFallback(state,{safeZones});
  if(viewer)viewer.update(state);
  validate();
}
function validate(){
  const problems=[];
  if(!validNumber(state.number))problems.push('Indica un dorsal válido: 0, 00 o entre 1 y 99.');
  if(!state.team.trim())problems.push('Introduce el nombre del equipo.');
  problems.push(...viewerWarnings);
  if(modelWarning)problems.push(modelWarning);
  const box=$('validation');
  box.classList.toggle('has-error',problems.some(x=>!x.startsWith('Modelo externo')));
  box.textContent=problems.length?problems.join(' · '):'Composición visual sin solapamientos detectados. Pendiente de comprobar cotas y normativa de la competición.';
  $('download-json').disabled=!validNumber(state.number);
}

for(const id of fields){
  $(id).addEventListener('input',e=>{
    const key=stateKeys[id]||id;
    const raw=e.target.value;
    if(id==='number'){
      // Mientras se edita el input, permitir vacío para no bloquear el tecleo.
      e.target.value=raw.replace(/\D/g,'').slice(0,2);
      state.number=e.target.value;
    } else state[key]=normalizeText(raw,40);
    render();
  });
  if(id==='number')$(id).addEventListener('blur',e=>{
    const value=normalizeNumber(e.target.value);e.target.value=value;state.number=value;render();
  });
}

function selectedPreset(key){
  const colors=PRESETS[key];if(!colors)return;
  for(const part of ['base','accent','trim','text']){
    state[part]=colors[part];$(part).value=colors[part];
  }
  document.querySelectorAll('[data-preset]').forEach(b=>{
    const yes=b.dataset.preset===key;
    b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));
  });
  render();
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>selectedPreset(b.dataset.preset)));
for(const part of ['base','accent','trim','text']){
  $(part).addEventListener('input',e=>{
    state[part]=e.target.value;
    document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
    render();
  });
}
$('show-safe').addEventListener('change',e=>{safeZones=e.target.checked; if(viewer)viewer.setSafe(safeZones);render();});

$('crest-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>2*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)){
    e.target.value='';viewerWarnings=['El escudo debe ser PNG, JPG o WebP y no superar 2 MB.'];validate();return;
  }
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.decoding='async';image.src=url;await image.decode();
    if(image.naturalWidth>6000||image.naturalHeight>6000)throw new Error('Imagen excesivamente grande');
    const c=document.createElement('canvas');c.width=Math.min(800,image.naturalWidth);c.height=Math.round(image.naturalHeight*c.width/image.naturalWidth);
    c.getContext('2d').drawImage(image,0,0,c.width,c.height);
    const small=new Image();small.src=c.toDataURL('image/png');await small.decode();
    state.crest=small;state.crestDataUrl=small.src;state.crestName=file.name;viewerWarnings=[];render();
  }catch(error){viewerWarnings=['No se pudo leer el escudo: '+error.message];validate();}
  finally{URL.revokeObjectURL(url);}
});

$('model-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(!/\.glb$/i.test(file.name)||file.size>20*1024*1024){modelWarning='Selecciona un GLB de hasta 20 MB.';validate();return;}
  if(!viewer){modelWarning='El visor 3D aún no está disponible. Comprueba tu conexión o el navegador.';validate();return;}
  try{
    const report=await viewer.importModel(await file.arrayBuffer());
    modelWarning=report.warning;
    $('model-caption').textContent=`Modelo GLB importado · ${report.meshes} mallas · ${report.uvMeshes} con UV`;
    viewer.update(state);validate();
  }catch(error){modelWarning='No se pudo importar este modelo: '+error.message;validate();}
});

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-view]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));
  if(viewer)viewer.view(b.dataset.view);
}));
$('reset-camera').addEventListener('click',()=>viewer?.view('front'));

function saveFile(name,blob){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1800);}
$('download-json').addEventListener('click',()=>{
  if(!validNumber(state.number))return;
  saveFile('NUBYRA_diseno_3D_borrador.json',new Blob([JSON.stringify(serializeProposal(state),null,2)],{type:'application/json;charset=utf-8'}));
});

async function flatPng(){
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=1000;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f2f5f8';ctx.fillRect(0,0,canvas.width,canvas.height);
  const measure=document.createElement('canvas').getContext('2d');
  for(const [side,x] of [['front',45],['back',655]]){
    const svg=jerseySVG({...state,crest:state.crestDataUrl},side,measure,safeZones);
    const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);
    try{const img=new Image();img.src=url;await img.decode();ctx.drawImage(img,x,38,575,900);}
    finally{URL.revokeObjectURL(url);}
  }
  return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
}
$('download-png').addEventListener('click',async()=>{
  try{
    if(viewer){const response=await fetch(viewer.exportPng());saveFile('NUBYRA_previsualizacion_3D.png',await response.blob());}
    else saveFile('NUBYRA_previsualizacion_2D.png',await flatPng());
  }catch(error){viewerWarnings=['Error en exportación: '+error.message];validate();}
});

render();
// La personalización 2D permanece usable aunque el CDN de Three.js esté inaccesible.
try{
  const {initViewer}=await import('./viewer.mjs');
  viewer=await initViewer($('webgl'),state,warnings=>{viewerWarnings=warnings;validate();});
  flatMode=false;
  $('flat-preview').hidden=true;
  $('webgl').hidden=false;
  $('render-status').textContent='3D EN DIRECTO';
  $('render-status').classList.add('is-ready');
  $('model-caption').textContent='Volumen demostrador (temporal) · importa un GLB para la opción B';
  viewer.update(state);
}catch(error){
  flatMode=true;
  $('webgl').hidden=true;
  $('flat-preview').hidden=false;
  $('render-status').textContent='RESPALDO 2D';
  $('viewer-error').hidden=false;
  $('viewer-error').textContent='El módulo WebGL/Three.js no se ha podido cargar; el editor gráfico sigue disponible. Para el 3D se necesita WebGL y conexión para cargar la librería.';
  console.warn('NUBYRA: 3D no disponible:',error);
}
validate();
