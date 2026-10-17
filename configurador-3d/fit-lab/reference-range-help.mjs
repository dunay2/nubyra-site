import {getReferenceProfile,assessReferenceProfile} from './reference-profiles.mjs';
/** One noninteractive tooltip. Hover/focus retain it; Esc dismisses it. Independent
 * info buttons pin it on touch without selecting or changing any body profile. */
export function createReferenceRangeHelp(readBody){
 const tip=document.createElement('div');tip.id='reference-range-tooltip';tip.className='reference-range-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.append(tip);
 let current=null,pinned=false,hovered=false,timer=null,disposed=false;
 const remove=[];
 const listen=(el,type,fn,options)=>{el.addEventListener(type,fn,options);remove.push(()=>el.removeEventListener(type,fn,options));};
 const fmt=n=>n===null?'—':Number(n).toLocaleString('es-ES',{maximumFractionDigits:1});
 function content(){
  if(!current)return;const p=getReferenceProfile(current.id),a=assessReferenceProfile(p,readBody());
  const title=document.createElement('strong');title.textContent=`${p.id} · ${p.label}`;
  const caption=document.createElement('p');caption.textContent='Rangos de selección de la referencia';
  const table=document.createElement('table'),head=table.createTHead().insertRow();
  for(const text of['Medida','Base','Rango','Actual']){const th=document.createElement('th');th.scope='col';th.textContent=text;head.append(th);}
  const body=table.createTBody();
  for(const z of a.zones){const row=body.insertRow();row.dataset.coverage=z.within===null?'unknown':z.within?'inside':'outside';
   const th=document.createElement('th');th.scope='row';th.textContent=z.label+' (cm)';row.append(th);
   for(const text of[fmt(z.base),`${fmt(z.min)}–${fmt(z.max)}`,fmt(z.value)])row.insertCell().textContent=text;
  }
  const result=document.createElement('p');result.className='reference-range-result';result.textContent=!a.valid?'Introduce medidas válidas.':a.withinCoverage?'Dentro del rango en las tres medidas.':`Fuera del rango: ${a.outside.join(', ')}.`;
  const note=document.createElement('small');note.textContent='Intervalos provisionales de selección, no tallas ni garantía de ajuste. Datos de escenario, no medidos en la foto.';
  tip.replaceChildren(title,caption,table,result,note);
 }
 function place(){
  if(!current||tip.hidden)return;const r=current.trigger.getBoundingClientRect(),v=window.visualViewport;
  const left=v?.offsetLeft||0,top=v?.offsetTop||0,w=v?.width||innerWidth,h=v?.height||innerHeight,gap=8;
  tip.style.maxHeight=Math.max(80,h-24)+'px';tip.style.width=Math.min(350,w-24)+'px';const box=tip.getBoundingClientRect();
  const x=Math.max(left+12,Math.min(left+w-box.width-12,r.left+r.width/2-box.width/2));
  let y=r.top-box.height-gap;if(y<top+12)y=r.bottom+gap;y=Math.max(top+12,Math.min(top+h-box.height-12,y));
  tip.style.left=x+'px';tip.style.top=y+'px';
 }
 function hide(){clearTimeout(timer);if(current){current.trigger.removeAttribute('aria-describedby');if(current.info)current.trigger.setAttribute('aria-expanded','false');}tip.hidden=true;current=null;pinned=false;hovered=false;}
 function show(trigger,id,info=false,pin=false){
  if(disposed||!id)return;clearTimeout(timer);if(current?.trigger!==trigger){hide();current={trigger,id,info};}else current.id=id;
  pinned=pin;trigger.setAttribute('aria-describedby',tip.id);if(info)trigger.setAttribute('aria-expanded','true');tip.dataset.profile=id;content();tip.hidden=false;place();
 }
 function deferHide(){clearTimeout(timer);timer=setTimeout(()=>{if(!pinned&&!hovered&&document.activeElement!==current?.trigger)hide();},180);}
 function bind(trigger,readId,{info=false}={}){
  if(info){trigger.setAttribute('aria-controls',tip.id);trigger.setAttribute('aria-expanded','false');}let pointer=null;
  listen(trigger,'pointerdown',e=>{pointer=e.pointerType;});
  listen(trigger,'pointerenter',e=>{if(e.pointerType!=='touch'){pointer=e.pointerType;show(trigger,readId(),info);}});
  listen(trigger,'pointerleave',()=>{pointer=null;deferHide();});
  listen(trigger,'focus',()=>{if(pointer!=='touch')show(trigger,readId(),info);});listen(trigger,'blur',deferHide);
  if(info)listen(trigger,'click',e=>{e.preventDefault();e.stopPropagation();if(current?.trigger===trigger&&pinned)hide();else show(trigger,readId(),true,true);});
 }
 listen(tip,'pointerenter',()=>{hovered=true;clearTimeout(timer);});listen(tip,'pointerleave',()=>{hovered=false;deferHide();});
 listen(document,'keydown',e=>{if(e.key==='Escape'&&current){e.preventDefault();hide();}});
 listen(document,'pointerdown',e=>{if(current&&!tip.contains(e.target)&&!current.trigger.contains(e.target))hide();});
 listen(window,'resize',place);listen(document,'scroll',place,true);
 if(window.visualViewport){listen(window.visualViewport,'resize',place);listen(window.visualViewport,'scroll',place);}
 return {bind,hide,refresh(){if(current){content();place();}},retarget(trigger,id){if(current?.trigger===trigger)show(trigger,id,current.info,pinned);},snapshot:()=>({open:!tip.hidden,profileId:current?.id??null,pinned}),destroy(){disposed=true;hide();remove.forEach(fn=>fn());tip.remove();}};
}
