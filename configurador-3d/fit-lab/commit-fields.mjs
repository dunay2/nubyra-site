/** Input previews are cheap drafts; only a confirmed value enters the physical state. */
export function bindCommitFields(root,{read,commit,onDraft=()=>{}}){
 const drafts=new Map(),keys=new Set(),listeners=[];
 const inputs=[...root.querySelectorAll('[data-field]')];
 const listen=(e,t,f)=>{e.addEventListener(t,f);listeners.push(()=>e.removeEventListener(t,f));};
 const report=()=>onDraft(Object.fromEntries(drafts));
 const sync=(key,value)=>{
  for(const e of inputs.filter(i=>i.dataset.field===key))e.value=String(e.type==='number'&&typeof value==='number'&&Number.isFinite(value)?Math.round(value*10)/10:value);
  const output=root.getElementById?.(key+'-output')||root.querySelector('#'+key+'-output');
  if(output)output.textContent=String(value);
 };
 function preview(e){const key=e.dataset.field;drafts.set(key,e.value);e.removeAttribute('aria-invalid');
  if(e.value!==''&&e.validity.valid){for(const peer of inputs)if(peer!==e&&peer.dataset.field===key)peer.value=e.value;const o=root.querySelector('#'+key+'-output');if(o)o.textContent=e.value;}
  report();
 }
 function apply(e){const key=e.dataset.field;
  if(e.value===''||!e.validity.valid){sync(key,read(key));e.setAttribute('aria-invalid','true');drafts.delete(key);report();return;}
  const value=e.valueAsNumber;drafts.delete(key);sync(key,value);
  if(value!==read(key))commit(key,value);
  report();
 }
 function cancel(e){drafts.delete(e.dataset.field);keys.delete(e);sync(e.dataset.field,read(e.dataset.field));report();}
 const rangeKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown']);
 for(const e of inputs){
  listen(e,'input',()=>preview(e));
  listen(e,'change',()=>{if(!keys.has(e))apply(e);});
  listen(e,'pointerup',()=>{if(e.type==='range')apply(e);});
  listen(e,'pointercancel',()=>cancel(e));
  listen(e,'keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();cancel(e);}
   else if(event.key==='Enter'){event.preventDefault();keys.delete(e);apply(e);}
   else if(e.type==='range'&&rangeKeys.has(event.key)){keys.add(e);}
  });
  listen(e,'keyup',event=>{if(keys.has(e)&&rangeKeys.has(event.key)){keys.delete(e);apply(e);}});
  listen(e,'blur',()=>{keys.delete(e);if(drafts.has(e.dataset.field))apply(e);});
 }
 return {pending:()=>Object.fromEntries(drafts),reset(){keys.clear();drafts.clear();for(const e of inputs){sync(e.dataset.field,read(e.dataset.field));e.removeAttribute('aria-invalid');}report();},destroy(){listeners.forEach(f=>f());}};
}
