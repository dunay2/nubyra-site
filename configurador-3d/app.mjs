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

function displayGarmentMeshes(candidates){
 const container=$('mesh-list');
 container.replaceChildren();
 for(const entry of candidates){
   const label=document.createElement('label');
   label.className='mesh-selection__item'+(entry.candidate?' is-suggested':'');
   const checkbox=document.createElement('input');
   checkbox.type='checkbox';checkbox.value=entry.id;checkbox.checked=entry.candidate;
   checkbox.setAttribute('aria-label','Seleccionar '+entry.name);
   const detail=document.createElement('span');
   detail.textContent=entry.name+' · '+entry.triangles.toLocaleString('es-ES')+' triángulos · '+(entry.uv?'UV':'sin UV')+(entry.excluded?' · revisar: accesorio':'');
   label.append(checkbox,detail);container.appendChild(label);
 }
 $('mesh-selection').hidden=false;
 $('mesh-result').textContent='Revisa y confirma las piezas de tejido; ningún material ha sido modificado.';
}
$('apply-meshes').addEventListener('click',()=>{
 if(!viewer)return;
 const ids=Array.from($('mesh-list').querySelectorAll('input[type=checkbox]:checked'),x=>x.value);
 try{
   const outcome=viewer.applyGarmentSelection(ids);
   viewer.update(state);
   modelWarning=outcome.warning;
   $('mesh-result').textContent=outcome.projectedMeshes+' mallas con marcajes provisionales.';
   $('render-status').textContent='MARCADO · SIN CALIBRAR';
 }catch(error){
   modelWarning=error.message;
   $('mesh-result').textContent='No se aplicaron cambios: '+error.message;
 }
 validate();
});

async function loadFreeModel(){
 const button=$('try-free-model');
 if(!viewer){
   modelWarning='El visor WebGL todavía no está disponible: comprueba Three.js y WebGL.';
   validate();return;
 }
 button.disabled=true;
 $('render-status').textContent='GENERANDO CAMISETA DE PRUEBA';
 try{
   const info=await viewer.loadFreeTestJersey();
   const selected=info.meshCandidates.filter(m=>m.candidate && /Jersey_(Front|Back)/.test(m.name));
   if(selected.length!==2)throw new Error('No se pudieron distinguir frontal y espalda de ensayo');
   localModelFiles=null;
   $('model-file').value='';
   displayGarmentMeshes(info.meshCandidates);
   const accepted=new Set(selected.map(m=>m.id));
   for(const input of $('mesh-list').querySelectorAll('input[type=checkbox]'))input.checked=accepted.has(input.value);
   const result=viewer.applyGarmentSelection([...accepted]);
   viewer.update(state);viewer.view('quarter');
   modelWarning='Modelo propio de ensayo NUBYRA: visualización y marcajes provisionales, sin validación industrial.';
   $('mesh-result').textContent='Camiseta de prueba: '+result.projectedMeshes+' superficies con marcajes.';
   $('model-caption').textContent='NUBYRA · Prueba femenina NUBYRA · '+info.triangles.toLocaleString('es-ES')+' triángulos · sin descarga';
   $('render-status').textContent='CAMISETA DE PRUEBA 3D';
   validate();
 }catch(error){
   modelWarning='No se pudo generar la camiseta de ensayo: '+error.message;
   $('render-status').textContent='REVISAR MODELO DE PRUEBA';
   validate();
 }finally{button.disabled=false}
}
$('try-free-model').addEventListener('click',()=>void loadFreeModel());

let localModelFiles=null;
async function importLocalModel(files){
  if(!files?.length)return;
  if(!viewer){modelWarning='El visor WebGL no está disponible. El editor 2D continúa activo.';validate();return;}
  const fileInput=$('model-file'),orientation=$('model-orientation');
  fileInput.disabled=true;orientation.disabled=true;
  $('render-status').textContent='CARGANDO MODELO';
  try{
    const report=await viewer.importFiles(files,{rotateDegrees:Number(orientation.value)});
    localModelFiles=Array.from(files);
    displayGarmentMeshes(report.meshCandidates||[]);
    modelWarning=report.warning;
    const names=report.meshNames?.slice(0,3).join(', ');
    $('model-caption').textContent='Modelo local · '+report.meshes+' mallas · '+report.triangles.toLocaleString('es-ES')+
      ' triángulos · UV '+report.uvMeshes+' · '+(names||'sin nombres de malla');
    $('render-status').textContent='MODELO LOCAL · SIN PUBLICAR';
    viewer.update(state);validate();
  }catch(error){
    $('render-status').textContent=localModelFiles?'MODELO ANTERIOR ACTIVO':'3D EN DIRECTO';
    modelWarning='Importación pendiente: '+error.message;validate();
  }finally{fileInput.disabled=false;orientation.disabled=false;}
}
$('model-file').addEventListener('change',e=>{
  const files=Array.from(e.target.files||[]);
  if(files.length)void importLocalModel(files);
});
$('model-orientation').addEventListener('change',()=>{
  if(localModelFiles)void importLocalModel(localModelFiles);
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
