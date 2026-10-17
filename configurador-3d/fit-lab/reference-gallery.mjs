import {REFERENCE_PROFILES,REFERENCE_PROFILES_VERSION,getReferenceProfile,nearestReferenceProfile,referenceImagePlacement} from './reference-profiles.mjs';

/** Right-side illustrations and selectors. Does not import the body, solver,
 * pattern registry, or any application-state mutation API. */
export function mountReferenceGallery({stage,onSelectMode}){
 const root=document.getElementById('reference-gallery'),image=document.getElementById('profile-reference-photo'),
  meta=document.getElementById('profile-reference-meta'),auto=document.getElementById('reference-profile-auto'),
  message=document.getElementById('reference-match-status'),gauge=document.getElementById('profile-height-gauge');
 let data=null,active=false,automatic=true,selected='R05',nearest=null,bodyKey='',metrics=null,disposed=false,token=0,lastMs=0;
 const listeners=[],images=new Map(),buttons=[];
 const listen=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
 const fmt=n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:1});
 for(const profile of REFERENCE_PROFILES){
  const button=document.createElement('button');button.type='button';button.className='reference-profile';button.dataset.referenceProfile=profile.id;
  button.setAttribute('aria-label',`${profile.id}: ${profile.heightCm} centímetros; ${profile.weightKg} kilogramos de escenario; ${profile.label}`);
  const img=document.createElement('img');img.alt='';img.decoding='async';img.width=44;img.height=128;
  const title=document.createElement('strong');title.textContent=profile.heightCm+' cm';
  const mass=document.createElement('span');mass.textContent=profile.weightKg+' kg · escenario';
  const type=document.createElement('small');type.textContent=profile.label;
  button.append(img,title,mass,type);root.querySelector('.reference-profile-grid').append(button);buttons.push(button);
  listen(button,'click',()=>{automatic=false;auto.checked=false;selected=profile.id;onSelectMode('profiles');show();});
 }
 function decorate(){
  buttons.forEach(b=>{b.setAttribute('aria-pressed',String(active&&b.dataset.referenceProfile===selected));b.dataset.nearest=String(nearest?.profile.id===b.dataset.referenceProfile);});
  const p=getReferenceProfile(selected);meta.textContent=`${p.heightCm} cm · ${p.weightKg} kg de escenario · pecho ${p.chestCm} / cadera ${p.hipCm} cm`;
  message.textContent=!active?'Elige un perfil para verlo a la derecha. El modelo central y sus prendas no cambian.':automatic?
   nearest?(nearest.withinCoverage?'Referencia próxima por estatura, pecho y cadera.':'Fuera de cobertura: se muestra el ejemplo más próximo, no una equivalencia corporal.'):'Introduce medidas válidas para buscar una referencia.':
   'Referencia fijada manualmente. Las medidas del modelo central no se modifican.';
 }
 function place(){
  if(!active||!data||!metrics)return;const p=getReferenceProfile(selected),a=data.assets[selected];
  const s=referenceImagePlacement({profile:p,asset:a,metrics});
  image.style.height=s.height+'px';image.style.width=s.width+'px';image.style.top=s.top+'px';
  gauge.style.top=s.headPx+'px';gauge.style.height=(s.feetPx-s.headPx)+'px';gauge.querySelector('span').textContent=p.heightCm+' cm*';
  gauge.hidden=metrics.fullView===false;
 }
 async function show(){
  decorate();place();if(!active||!data)return;const request=++token,id=selected,start=performance.now();
  try{
   let promise=images.get(id);if(!promise){const next=new Image();next.src=new URL(data.assets[id].src,import.meta.url).href;promise=next.decode().then(()=>next);images.set(id,promise);}
   const next=await promise;if(disposed||request!==token||!active)return;
   image.src=next.src;image.alt=`Referencia ilustrativa ${id}. ${getReferenceProfile(id).label}. No es una fotografía medida.`;
   image.dataset.profile=id;image.hidden=false;lastMs=performance.now()-start;place();
  }catch{images.delete(id);message.textContent='No se pudo cargar esta referencia. Se conserva la imagen anterior; puedes volver a la foto original.';}
 }
 listen(auto,'change',()=>{automatic=auto.checked;if(automatic&&nearest)selected=nearest.profile.id;onSelectMode('profiles');show();});
 const ready=fetch(new URL('./assets/reference-profiles.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Referencias no disponibles');return r.json();}).then(value=>{
  if(disposed)return;if(value.version!=='reference-photo-assets/2.0')throw Error('Versión de referencias no válida');
  for(const p of REFERENCE_PROFILES){const a=value.assets?.[p.id];if(!a||a.src!==`./assets/references-hd-v2/${p.id}.webp`||a.thumbnail!==`./assets/references-hd-v2/${p.id}-thumb.webp`||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1000||a.height<1400)throw Error('Imagen de referencia inválida');}
  data=value;buttons.forEach(b=>b.querySelector('img').src=new URL(data.assets[b.dataset.referenceProfile].thumbnail,import.meta.url).href);root.dataset.loaded='true';show();
 }).catch(()=>{if(!disposed){root.dataset.loaded='error';message.textContent='No se pudieron cargar los ocho perfiles. La foto original sigue disponible.';}});
 return {
  ready,
  setActive(value){active=value;token++;image.hidden=!active;gauge.hidden=!active;meta.hidden=!active;decorate();if(active)show();},
  render(next){metrics=next;const body=next.body,key=JSON.stringify([body?.bodyHeightCm,body?.bodyChestCm,body?.bodyHipCm]);
   if(key!==bodyKey){bodyKey=key;nearest=nearestReferenceProfile(body);if(automatic&&nearest){const old=selected;selected=nearest.profile.id;if(old!==selected&&active)show();}decorate();}place();},
  snapshot:()=>({version:REFERENCE_PROFILES_VERSION,mode:automatic?'auto':'manual',active,selectedId:selected,profile:{...getReferenceProfile(selected)},nearestId:nearest?.profile.id??null,withinCoverage:nearest?.withinCoverage??false,score:nearest?.score??null,lastSwapMs:lastMs,loaded:Boolean(data),bodyMutated:false,patternsMutated:false,weightUsedForSelection:false,source:'generated-individual-portraits',assetResolution:data?{width:data.assets[selected].width,height:data.assets[selected].height}:null,anthropometryValidated:false}),
  destroy(){disposed=true;token++;listeners.forEach(fn=>fn());images.clear();}
 };
}
