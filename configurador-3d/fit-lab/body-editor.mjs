import * as T from 'three';
import {BODY_REGION_LIMITS,REGION_KEYS,BODY_REGIONS_VERSION} from './body-regions.mjs';
/** Bounded, read-only draft cage; cloth and committed body stay intact until release. */
export function mountBodyEditor({canvas,camera,controls,body,scene,getState,measureDraft,commit,lock,invalidate,isReady}){
 const panel=document.createElement('details');panel.id='body-region-editor';panel.className='body-region-editor';
 panel.innerHTML='<summary>Editar cuerpo · puntos con topes</summary><p class="micro">Arrastra un punto o ajusta su valor. La malla de líneas es una previsualización; el tejido se recalcula al soltar. Los contornos resultantes se actualizan sin compensar volumen en otra zona.</p><button type="button" id="toggle-body-points" aria-pressed="false">Mostrar puntos</button><button type="button" id="undo-body-region" disabled>Deshacer zona</button><div class="region-fields"></div><p id="body-region-result" role="status" aria-live="polite">Límites técnicos de esta base; no son límites anatómicos.</p><p class="micro">Cambiar perfil o contornos principales inicia una nueva base regional. Los puntos no alteran el patrón de las prendas.</p>';
 document.querySelector('.shape-section').after(panel);
 const overlay=document.createElement('div');overlay.className='body-edit-points';overlay.hidden=true;canvas.parentElement.append(overlay);
 const status=panel.querySelector('#body-region-result'),toggle=panel.querySelector('#toggle-body-points'),undo=panel.querySelector('#undo-body-region');
 const fields=new Map(),listeners=[],history=[];let enabled=false,drag=null,draft=null,oldState=null,cage=null,disposed=false,lastKey='',neutralKey='',lastValid=null,limited=false,previews=0,commits=0;
 const listen=(el,type,fn,opts)=>{el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));};
 const fmt=n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:2});
 const specs={bodyHeightCm:{label:'Estatura',min:125,max:210,step:1,unit:'cm'},...BODY_REGION_LIMITS};
 const definitions=[['bodyHeightCm','Estatura',[0,1.70,.045],[0,1,0]],['hipWidthPct','Cadera',[.16,.88,.045],[1,0,0]],['gluteProjectionCm','Pelvis posterior',[.06,.88,-.08],[0,0,-1]],['abdomenProjectionCm','Abdomen',[0,1.07,.18],[0,0,1]],['thighWidthPct','Muslo',[.165,.63,.045],[1,0,0]],['chestProjectionCm','Pecho',[.065,1.25,.20],[0,0,1]]];
 const base=body.userData.base;
 const handles=definitions.map(([key,label,target,axis])=>{
  let id=0,best=Infinity;for(let i=0;i<base.length;i+=3){const d=(base[i]-target[0])**2+(base[i+1]-target[1])**2+(base[i+2]-target[2])**2;if(d<best){best=d;id=i/3;}}
  const el=document.createElement('button');el.type='button';el.dataset.bodyHandle=key;el.className='body-handle';el.setAttribute('aria-label',label+': arrastra o usa las flechas');el.innerHTML='<span class="handle-dot">↔</span><span class="handle-name"></span>';el.querySelector('.handle-name').textContent=label;overlay.append(el);
  el.querySelector('.handle-dot').textContent=key==='bodyHeightCm'?'↕':'↔';
  const h={key,label,id,axis:new T.Vector3(...axis),el};
  listen(el,'pointerdown',e=>startPointer(h,e));
  listen(el,'pointermove',e=>movePointer(h,e));
  listen(el,'pointerup',e=>{if(drag?.pointerId===e.pointerId){finish();el.releasePointerCapture?.(e.pointerId);}});
  listen(el,'pointercancel',cancel);listen(el,'lostpointercapture',()=>{if(drag)cancel();});
  listen(el,'keydown',e=>{if(e.key==='Escape'){cancel();return;}const sign=['ArrowRight','ArrowUp'].includes(e.key)?1:['ArrowLeft','ArrowDown'].includes(e.key)?-1:0;if(sign){e.preventDefault();if(begin())preview(key,Number(getState()[key]??0)+sign*specs[key].step*(e.shiftKey?4:1));finish();}});
  return h;
 });
 for(const key of REGION_KEYS){const spec=specs[key],row=document.createElement('div');row.className='region-field';
  const label=document.createElement('label');label.htmlFor='region-'+key;label.textContent=spec.label;
  const input=document.createElement('input');input.type='number';input.id='region-'+key;input.min=spec.min;input.max=spec.max;input.step=spec.step;input.value='0';input.dataset.regionInput=key;
  const slider=document.createElement('input');slider.type='range';slider.min=spec.min;slider.max=spec.max;slider.step=spec.step;slider.value='0';slider.setAttribute('aria-label',spec.label);slider.dataset.regionSlider=key;
  const note=document.createElement('small');note.textContent=`${spec.min} a +${spec.max} ${spec.unit} desde la base`;
  const reset=document.createElement('button');reset.type='button';reset.textContent='↺';reset.setAttribute('aria-label','Restablecer '+spec.label);
  row.append(label,input,reset,slider,note);panel.querySelector('.region-fields').append(row);fields.set(key,{input,slider});
  listen(slider,'input',()=>{if(begin())preview(key,Number(slider.value));});listen(slider,'change',finish);listen(slider,'pointercancel',cancel);
  listen(input,'change',()=>{if(begin())preview(key,Number(input.value));finish();});listen(input,'keydown',e=>{if(e.key==='Enter'){input.blur();}if(e.key==='Escape'){cancel();input.value=String(getState()[key]??0);}});
  listen(reset,'click',()=>{if(begin())preview(key,0);finish();});
 }
 function begin(){
  if(oldState)return true;
  if(!isReady()){status.textContent='Espera a que se presente el cuerpo solicitado o recupera una equipación válida antes de editar.';return false;}
  oldState={...getState()};lastValid={...oldState};draft={...oldState};limited=false;lock(true);
  const geometry=body.geometry.clone();const material=new T.MeshBasicMaterial({color:0x247b8f,wireframe:true,transparent:true,opacity:.17,depthTest:false,depthWrite:false});
  cage=new T.Mesh(geometry,material);cage.name='body-regional-draft-cage';cage.renderOrder=40;scene.add(cage);return true;
 }
 function clearCage(){if(cage){scene.remove(cage);cage.geometry.dispose();cage.material.dispose();cage=null;}}
 function report(){
  const s=draft||getState();status.textContent=(limited?'Tope alcanzado. ':'')+(draft?`Previsualización · pecho ${fmt(s.bodyChestCm)} cm · cadera ${fmt(s.bodyHipCm)} cm. Tejido sin recalcular.`:'Cambios confirmados. El tejido se asienta sobre el nuevo cuerpo.');
 }
 function preview(key,value){
  const spec=specs[key];if(!Number.isFinite(value)){status.textContent='Introduce un valor numérico válido.';return;}
  const capped=Math.max(spec.min,Math.min(spec.max,value));limited=value!==capped;let candidate={...draft,[key]:capped};
  try{const result=measureDraft(candidate);draft=result.state;cage.geometry.attributes.position.array.set(result.positions);cage.geometry.attributes.position.needsUpdate=true;cage.geometry.computeBoundingSphere();cage.geometry.computeBoundingBox();lastValid={...draft};}
  catch(error){limited=true;status.textContent=error.message;return;}
  previews++;fields.get(key)?.input&&(fields.get(key).input.value=String(draft[key]));if(fields.has(key))fields.get(key).slider.value=String(draft[key]);report();invalidate();
 }
 function finish(){
  if(!oldState)return;const before=oldState,after=draft;drag=null;oldState=null;draft=null;lastValid=null;clearCage();lock(false);
  if(after&&[...REGION_KEYS,'bodyHeightCm'].some(k=>(before[k]??0)!==(after[k]??0))){history.push(before);if(history.length>20)history.shift();commits++;commit(after);undo.disabled=false;report();}
  refresh();invalidate();
 }
 function cancel(){drag=null;oldState=null;draft=null;lastValid=null;clearCage();lock(false);status.textContent='Edición cancelada: se conserva el cuerpo anterior.';refresh();invalidate();}
 function point(h){const model=cage||body;if(h.key==='bodyHeightCm')return new T.Vector3(0,model.geometry.boundingBox?.max.y??body.userData.headTopY,0).add(new T.Vector3(0,.25,0));return new T.Vector3().fromBufferAttribute(model.geometry.attributes.position,h.id).addScaledVector(h.axis,.12);}
 function screen(p){const b=canvas.getBoundingClientRect(),q=p.clone().project(camera);return new T.Vector2((q.x+1)*b.width/2,(1-q.y)*b.height/2);}
 function startPointer(h,e){
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();
  const p=point(h),origin=screen(p),direction=screen(p.clone().add(h.axis)).sub(origin),pixels=direction.length();
  if(pixels<15){status.textContent='Gira la cámara para ver el eje de esta zona o utiliza el campo numérico.';return;}
  if(!begin())return;const scale=body.userData.scale/body.userData.unit;
  const units=h.key==='hipWidthPct'?Math.max(.001,Math.abs(p.x)*.01):h.key==='thighWidthPct'?.0009*scale:1/(64/2.42);
  drag={key:h.key,pointerId:e.pointerId,start:new T.Vector2(e.clientX,e.clientY),axis:direction.normalize(),pixelsPerValue:pixels*units,value:Number(oldState[h.key]??0)};
  h.el.setPointerCapture(e.pointerId);h.el.focus({preventScroll:true});
 }
 function movePointer(h,e){if(!drag||drag.pointerId!==e.pointerId||h.key!==drag.key)return;e.preventDefault();const delta=new T.Vector2(e.clientX,e.clientY).sub(drag.start).dot(drag.axis)/drag.pixelsPerValue;const step=specs[h.key].step;preview(h.key,Math.round((drag.value+delta)/step)*step);}
 function refresh(){for(const [key,f]of fields){if(document.activeElement!==f.input)f.input.value=String(getState()[key]??0);f.slider.value=String(getState()[key]??0);}}
 listen(toggle,'click',()=>{enabled=!enabled;overlay.hidden=!enabled;toggle.setAttribute('aria-pressed',String(enabled));toggle.textContent=enabled?'Ocultar puntos':'Mostrar puntos';invalidate();});
 listen(undo,'click',()=>{cancel();const previous=history.pop();if(previous){commit(previous);commits++;undo.disabled=!history.length;status.textContent='Se ha restaurado la edición corporal anterior.';}});
 listen(window,'keydown',e=>{if(e.key==='Escape'&&oldState){e.preventDefault();cancel();}});
 listen(panel,'toggle',()=>{if(!panel.open){cancel();enabled=false;overlay.hidden=true;toggle.setAttribute('aria-pressed','false');toggle.textContent='Mostrar puntos';}});
 return {
  render(){if(disposed)return;const n=getState(),neutral=JSON.stringify([n.bodyBaseChestCm??n.bodyChestCm,n.bodyBaseHipCm??n.bodyHipCm]);if(neutral!==neutralKey&&!oldState){if(neutralKey&&REGION_KEYS.every(k=>(n[k]??0)===0)){history.length=0;undo.disabled=true;}neutralKey=neutral;}const key=JSON.stringify([...REGION_KEYS,'bodyHeightCm'].map(k=>getState()[k]));if(key!==lastKey&&!oldState){lastKey=key;refresh();}if(!enabled)return;for(const h of handles){const p=point(h),q=p.clone().project(camera),v=screen(p);h.el.style.left=v.x+'px';h.el.style.top=v.y+'px';const axisPixels=screen(p.clone().add(h.axis)).sub(v).length();h.el.hidden=Math.abs(q.x)>1||Math.abs(q.y)>1||q.z<-1||q.z>1||axisPixels<15;h.el.dataset.limited=String(limited&&drag?.key===h.key);h.el.title=`${h.label}: ${fmt((draft||getState())[h.key]??0)} ${specs[h.key].unit} · ${specs[h.key].min} a ${specs[h.key].max}`;}},
  snapshot:()=>({version:BODY_REGIONS_VERSION,enabled,previewing:Boolean(oldState),draft:draft?{...draft}:null,previews,commits,limits:BODY_REGION_LIMITS,clothRecalculatedDuringDrag:false,guard:'local-orientation-edge-ratio',globalSelfIntersectionValidated:false}),
  destroy(){disposed=true;clearCage();listeners.forEach(f=>f());panel.remove();overlay.remove();}
 };
}
