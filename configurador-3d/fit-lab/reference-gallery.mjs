import {REFERENCE_PROFILES,REFERENCE_PROFILES_VERSION,getReferenceProfile,nearestReferenceProfile,referenceImagePlacement,assessReferenceProfile} from './reference-profiles.mjs';
import {createReferenceRangeHelp} from './reference-range-help.mjs';
/** Gallery emits an explicit selection intent. The application owns body state;
 * automatic matching, image decode and range help never write measurements. */
export function mountReferenceGallery({stage,onSelectMode,onApplyProfile=()=>{}}){
 const root=document.getElementById('reference-gallery'),image=document.getElementById('profile-reference-photo'),meta=document.getElementById('profile-reference-meta'),auto=document.getElementById('reference-profile-auto'),message=document.getElementById('reference-match-status'),gauge=document.getElementById('profile-height-gauge');
 let data=null,active=false,automatic=auto.checked,selected='R05',nearest=null,body=null,bodyKey='',metrics=null;
 let disposed=false,token=0,lastMs=0,appliedId=null,applyCount=0,previewId=null,previewCount=0,restoreTimer=null,currentView='front',viewAsset=null;
 const listeners=[],images=new Map(),buttons=[];const help=createReferenceRangeHelp(()=>body);
 const listen=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
 const fmt=n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:1});
 for(const profile of REFERENCE_PROFILES){
  const card=document.createElement('div');card.className='reference-profile-card';
  const button=document.createElement('button');button.type='button';button.className='reference-profile';button.dataset.referenceProfile=profile.id;
  button.setAttribute('aria-label',`Aplicar ${profile.id}: altura ${profile.heightCm}, pecho ${profile.chestCm}, cadera ${profile.hipCm} centímetros`);
  const img=document.createElement('img');img.alt='';img.decoding='async';img.width=78;img.height=104;
  const title=document.createElement('strong');title.textContent=profile.heightCm+' cm';const mass=document.createElement('span');mass.textContent=profile.weightKg+' kg · escenario';const type=document.createElement('small');type.textContent=profile.label;button.append(img,title,mass,type);
  const info=document.createElement('button');info.type='button';info.className='reference-range-info';info.textContent='ⓘ';info.dataset.referenceInfo=profile.id;info.setAttribute('aria-label',`Consultar rangos de ${profile.id}, sin aplicar medidas`);
  card.append(button,info);root.querySelector('.reference-profile-grid').append(card);buttons.push(button);
  help.bind(info,()=>profile.id,{info:true});
  listen(button,'pointerenter',e=>{if(e.pointerType!=='touch')preview(profile.id);});
  listen(button,'pointerleave',scheduleRestore);listen(button,'focus',()=>preview(profile.id));listen(button,'blur',scheduleRestore);
  listen(button,'click',()=>{clearTimeout(restoreTimer);previewId=null;selected=profile.id;appliedId=profile.id;applyCount++;help.hide();onApplyProfile(profile.id);onSelectMode('profiles');show();});
 }
 image.tabIndex=0;help.bind(image,()=>image.dataset.profile||selected);
 const mainInfo=document.createElement('button');mainInfo.type='button';mainInfo.className='reference-main-info';mainInfo.id='reference-current-ranges';mainInfo.textContent='ⓘ Rangos de la foto';mainInfo.setAttribute('aria-label','Consultar rangos de la foto actual, sin aplicar medidas');root.querySelector('.reference-gallery-heading').append(mainInfo);help.bind(mainInfo,()=>image.dataset.profile||selected,{info:true});
 function preview(id){clearTimeout(restoreTimer);if(previewId===id)return;previewId=id;previewCount++;if(!active)onSelectMode('profiles');show();}
 function restore(){clearTimeout(restoreTimer);if(!previewId)return;previewId=null;show();}
 function scheduleRestore(){clearTimeout(restoreTimer);restoreTimer=setTimeout(()=>{if(!stage.matches(':hover')&&!root.querySelector('.reference-profile:hover')&&!root.querySelector('.reference-profile:focus-visible'))restore();},180);}
 listen(stage,'pointerenter',()=>clearTimeout(restoreTimer));listen(stage,'pointerleave',scheduleRestore);
 listen(document,'keydown',e=>{if(e.key==='Escape')restore();});
 function decorate(){
  const assessment=assessReferenceProfile(getReferenceProfile(selected),body);
  buttons.forEach(b=>{b.setAttribute('aria-pressed',String(active&&b.dataset.referenceProfile===selected));b.dataset.nearest=String(nearest?.profile.id===b.dataset.referenceProfile);});
  const p=getReferenceProfile(image.dataset.profile||selected);meta.textContent=`${p.heightCm} cm · ${p.weightKg} kg de escenario · pecho ${p.chestCm} / cadera ${p.hipCm} cm`;mainInfo.hidden=!active;stage.dataset.preview=String(Boolean(previewId));const label=document.getElementById('reference-kind-label');if(label)label.textContent=previewId?'Vista previa · pulsa la tarjeta para aplicar':'Referencia seleccionada · retrato ilustrativo';
  if(label&&currentView!=='front'&&currentView!=='quarter'&&image.dataset.displayedView==='front')label.textContent=`Referencia frontal · vista ${currentView==='back'?'trasera':'lateral'} no disponible`;
  const applied=appliedId===selected&&assessment.exact;
  message.textContent=!active?'Pulsa una foto para aplicar su altura, pecho y cadera. Consulta ⓘ sin cambiar medidas.':!assessment.valid?'Introduce medidas válidas para buscar una referencia.':applied?`Perfil ${selected} aplicado: altura ${fmt(body.bodyHeightCm)}, pecho ${fmt(body.bodyChestCm)} y cadera ${fmt(body.bodyHipCm)} cm. Propuesta de camiseta y pantalón actualizada; largo deseado conservado.`:automatic?(assessment.withinCoverage?`Referencia próxima ${selected}. Se conservan tus medidas exactas; la foto no las sustituye.`:'Fuera de cobertura: se muestra el ejemplo más próximo, no una equivalencia corporal.'):`Referencia ajustada manualmente. ${assessment.withinCoverage?'Coincidencia parcial dentro del rango.':'Fuera del rango: '+assessment.outside.join(', ')+'.'} Tus medidas se conservan.`;
  if(previewId)message.textContent=`Vista previa ${previewId}: solo cambia la foto. Pulsa para aplicar medidas y proponer equipación.`;
  help.refresh();
 }
 function place(){
  if(!active||!data||!metrics)return;const id=image.dataset.profile||selected,asset=viewAsset||data.assets[id];
  const profile=getReferenceProfile(id),head=asset.head??0,feet=asset.feet??1;
  if(!(metrics.pxPerCm>0&&feet>head))return;
  const placement=referenceImagePlacement({profile,asset,metrics}),{height,width}=placement;
  image.style.height=height+'px';image.style.width=width+'px';image.style.top=(metrics.floorPx-feet*height)+'px';
  gauge.hidden=metrics.fullView===false;gauge.style.top=(metrics.floorPx-profile.heightCm*metrics.pxPerCm)+'px';gauge.style.height=profile.heightCm*metrics.pxPerCm+'px';gauge.querySelector('span').textContent=profile.heightCm+' cm*';
  stage.dataset.sharedScale='true';
  image.dataset.headPx=String(metrics.floorPx-profile.heightCm*metrics.pxPerCm);image.dataset.feetPx=String(metrics.floorPx);

 }
 async function show(){
  decorate();place();if(!active||!data)return;const request=++token,id=previewId||selected,start=performance.now();const requestedView=currentView==='quarter'?'front':currentView,asset=data.assets[id].views?.[requestedView]||data.assets[id],imageKey=id+':'+requestedView;viewAsset=asset;
  try{let promise=images.get(imageKey);if(!promise){const next=new Image();next.src=new URL(asset.src,import.meta.url).href;promise=next.decode().then(()=>next);images.set(imageKey,promise);}const next=await promise;if(disposed||request!==token||!active)return;
   image.src=next.src;image.alt=`Referencia ilustrativa ${id}. ${getReferenceProfile(id).label}. No es una fotografía medida.`;image.dataset.profile=id;image.dataset.requestedView=requestedView;image.dataset.displayedView=asset===data.assets[id]?'front':requestedView;image.hidden=false;lastMs=performance.now()-start;decorate();place();help.retarget(image,id);help.retarget(mainInfo,id);
  }catch{images.delete(imageKey);message.textContent='No se pudo cargar esta referencia. Se conserva la imagen anterior. Puedes volver a intentarlo.';}
 }
 function setBody(next){
  body=next;const key=JSON.stringify([next?.bodyHeightCm,next?.bodyChestCm,next?.bodyHipCm]);if(key===bodyKey)return;bodyKey=key;nearest=nearestReferenceProfile(body);
  if(automatic&&nearest){const old=selected;selected=nearest.profile.id;if(active&&old!==selected)show();}decorate();
 }
 listen(auto,'change',()=>{automatic=auto.checked;if(automatic&&nearest)selected=nearest.profile.id;onSelectMode('profiles');show();});
 const ready=fetch(new URL('./assets/reference-profiles.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Referencias no disponibles');return r.json();}).then(value=>{
  if(disposed)return;if(value.version!=='reference-photo-assets/2.0')throw Error('Versión de referencias no válida');
  for(const p of REFERENCE_PROFILES){const a=value.assets?.[p.id];if(!a||a.src!==`./assets/references-hd-v2/${p.id}.webp`||a.thumbnail!==`./assets/references-hd-v2/${p.id}-thumb.webp`||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1000||a.height<1400)throw Error('Imagen de referencia inválida');}
  data=value;buttons.forEach(b=>b.querySelector('img').src=new URL(data.assets[b.dataset.referenceProfile].thumbnail,import.meta.url).href);root.dataset.loaded='true';show();
 }).catch(()=>{if(!disposed){root.dataset.loaded='error';message.textContent='No se pudieron cargar los ocho perfiles.';}});
 return {ready,setBody,setView(value){if(!['front','side','back','quarter'].includes(value))return;currentView=value;show();},setActive(value){active=value;token++;image.hidden=!active;gauge.hidden=!active;meta.hidden=!active;if(!active)help.hide();decorate();if(active)show();},render(next){metrics=next;place();},
  snapshot(){const a=assessReferenceProfile(getReferenceProfile(selected),body);return{version:REFERENCE_PROFILES_VERSION,requestedView:currentView,displayedView:image.dataset.displayedView||'front',directionalReferenceAvailable:image.dataset.requestedView===image.dataset.displayedView,previewId,previewCount,hoverWritesMeasures:false,photoScale:'linked-projected-height',feetPx:metrics?.floorPx??null,pxPerCm:metrics?.pxPerCm??null,mode:automatic?'auto':'manual',active,selectedId:selected,displayedId:image.dataset.profile||null,profile:{...a.profile},nearestId:nearest?.profile.id??null,withinCoverage:a.withinCoverage,score:a.score,coverage:a,appliedId,applyCount,rangeHelp:help.snapshot(),selectionWritesMeasures:false,explicitApplyWritesMeasures:true,lastSwapMs:lastMs,loaded:Boolean(data),patternsMutated:false,weightUsedForSelection:false,source:'generated-individual-portraits',assetResolution:data?{width:data.assets[selected].width,height:data.assets[selected].height}:null,anthropometryValidated:false};},
  destroy(){disposed=true;clearTimeout(restoreTimer);token++;listeners.forEach(fn=>fn());help.destroy();images.clear();buttons.forEach(b=>b.parentElement.remove());mainInfo.remove();}
 };
}
