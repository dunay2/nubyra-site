/**
 * Prueba de interacción real del controlador DOM sin necesitar WebGL.
 * Construye nodos mínimos desde el HTML y ejecuta app.mjs con sus listeners.
 * Three.js no está instalado en la raíz del repo: el visor hace fallback controlado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(import.meta.dirname,'..','configurador-3d','fit-lab');
const markup=readFileSync(resolve(root,'index.html'),'utf8');
const nodes=[],ids=new Map();

class NodeStub {
 constructor(tag,attrs,doc){
  this.tagName=tag;
  this.attrs={...attrs};
  this.id=attrs.id||null;
  this.dataset={};
  this.value=attrs.value||'';
  this.type=attrs.type||'';
  this.hidden='hidden' in attrs;
  this.disabled='disabled' in attrs;
  this.tabIndex=attrs.tabindex==null?0:Number(attrs.tabindex);
  this.textContent='';
  this.validity={valid:true};
  this.listeners=new Map();
  this.doc=doc;
  this.classValues=new Set((attrs.class||'').split(/\s+/).filter(Boolean));
  this.classList={
   add:key=>this.classValues.add(key),
   remove:key=>this.classValues.delete(key),
   contains:key=>this.classValues.has(key),
   toggle:(key,yes)=>{const value=yes??!this.classValues.has(key);
    if(value)this.classValues.add(key);else this.classValues.delete(key);return value}
  };
  for(const [k,v] of Object.entries(attrs)){
   if(k.startsWith('data-')){
    const camel=k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    this.dataset[camel]=v;
   }
  }
 }
 addEventListener(name,callback){
  const list=this.listeners.get(name)||[];
  list.push(callback);this.listeners.set(name,list);
 }
 dispatch(name,extra={}){
  const event={
   target:this,key:extra.key,
   preventDefault(){this.defaultPrevented=true},
   defaultPrevented:false
  };
  for(const callback of this.listeners.get(name)||[])callback(event);
 }
 setAttribute(name,value){this.attrs[name]=String(value)}
 getAttribute(name){return this.attrs[name]??null}
 focus(){this.doc.activeElement=this}
}
const documentMock={
 activeElement:null,
 getElementById(id){return ids.get(id)||null},
 querySelectorAll(selector){
  const data=selector.match(/^\[data-fit-key="([^"]+)"\]$/);
  if(data)return nodes.filter(n=>n.attrs['data-fit-key']===data[1]);
  if(selector==='[role="tab"][data-tab]')
   return nodes.filter(n=>n.attrs.role==='tab'&&n.attrs['data-tab']!=null);
  const supported=['data-go-tab','data-label-key','data-pattern-base','data-view',
   'data-rest-option','data-body-profile'];
  for(const name of supported){
   if(selector==='['+name+']')return nodes.filter(n=>n.attrs[name]!=null);
  }
  throw Error('Selector no cubierto en smoke DOM: '+selector);
 },
 body:{append(){}},
 createElement(tag){return {
  tagName:tag,set href(_) {},set download(_) {},click(){},remove(){}
 }}
};
const rx=/<([a-z][a-z0-9-]*)\b([^>]*)>/gi;
for(const match of markup.matchAll(rx)){
 const attrs={};
 const token=/(?:^|\s)([a-z][a-z0-9:-]*)(?:="([^"]*)")?/gi;
 for(const a of match[2].matchAll(token))attrs[a[1]]=a[2]??'';
 const node=new NodeStub(match[1],attrs,documentMock);
 nodes.push(node);
 if(node.id){
  if(ids.has(node.id))throw Error('ID duplicado en HTML: '+node.id);
  ids.set(node.id,node);
 }
}
const node=id=>{
 const n=ids.get(id);
 assert.ok(n,'Falta '+id);
 return n;
};
const original={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,
 cancelAnimationFrame:globalThis.cancelAnimationFrame,consoleWarn:console.warn};
globalThis.document=documentMock;
globalThis.requestAnimationFrame=()=>1;
globalThis.cancelAnimationFrame=()=>{};
console.warn=()=>{};
try{
 const file=pathToFileURL(resolve(root,'app.mjs')).href;
 await import(file+'?fit-lab-ui-smoke');
}finally{
 console.warn=original.consoleWarn;
}
test('pestañas: inicia en Medidas, cambia por clic y por teclado',()=>{
 assert.equal(node('tab-measures').getAttribute('aria-selected'),'true');
 assert.equal(node('panel-measures').hidden,false);
 assert.equal(node('panel-adjust').hidden,true);
 assert.equal(node('panel-proposal').hidden,true);
 node('tab-adjust').dispatch('click');
 assert.equal(node('panel-measures').hidden,true);
 assert.equal(node('panel-adjust').hidden,false);
 assert.equal(node('tab-adjust').getAttribute('aria-selected'),'true');
 node('tab-adjust').dispatch('keydown',{key:'ArrowRight'});
 assert.equal(node('panel-proposal').hidden,false);
 assert.equal(node('tab-proposal').getAttribute('aria-selected'),'true');
 node('tab-proposal').dispatch('keydown',{key:'Home'});
 assert.equal(node('panel-measures').hidden,false);
 assert.equal(node('tab-measures').tabIndex,0);
});
test('al cambiar las medidas se propone N2 sin modificar la camiseta visible',()=>{
 assert.equal(node('suggested-base').textContent,'N1');
 assert.equal(node('active-base').textContent,'N1');
 assert.equal(node('garmentChestCm-number').value,'102');
 assert.equal(node('garmentLengthCm-number').value,'64');
 node('bodyChestCm-range').value='111';
 node('bodyChestCm-range').dispatch('input');
 node('bodyHipCm-range').value='122';
 node('bodyHipCm-range').dispatch('input');
 node('goalLengthCm-range').value='76';
 node('goalLengthCm-range').dispatch('input');
 assert.equal(node('suggested-base').textContent,'N2');
 assert.equal(node('proposal-input-length').textContent,'76 cm');
 assert.equal(node('garmentChestCm-number').value,'102',
  'la medida corporal no debe escalar la prenda');
 assert.equal(node('garmentLengthCm-number').value,'64',
  'el largo solicitado no debe mutar la camiseta observada');
 assert.equal(node('goalLengthCm-number').value,'76');
 assert.equal(node('use-proposal').disabled,false);
 assert.equal(node('active-base').textContent,'N1');
});
test('Aplicar cambia solo la prenda, mantiene datos corporales y lleva a Ajuste 3D',()=>{
 node('tab-proposal').dispatch('click');
 node('use-proposal').dispatch('click');
 assert.equal(node('active-base').textContent,'N2-3');
 assert.equal(node('panel-adjust').hidden,false);
 assert.equal(node('tab-adjust').getAttribute('aria-selected'),'true');
 assert.equal(node('bodyChestCm-number').value,'111');
 assert.equal(node('bodyHipCm-number').value,'122');
 assert.equal(node('garmentLengthCm-number').value,'72',
  'la longitud procede de la variante fija N2, no del largo libre solicitado');
 assert.equal(node('mode-garment').getAttribute('aria-pressed'),'true');
 assert.equal(node('body-fields').disabled,false);
 assert.equal(node('adjust-body-fields').disabled,true);
 assert.equal(node('garment-fields').disabled,true,
  'los rangos de reposo solo se muestran en modo lectura');
 assert.equal(node('garment-fields').hidden,false);
 assert.equal(node('active-base').textContent,'N2-3');
});
test('controles duplicados se sincronizan entre pestañas',()=>{
 node('mode-body').dispatch('click');
 node('adjust-bodyChestCm-range').value='100';
 node('adjust-bodyChestCm-range').dispatch('input');
 assert.equal(node('bodyChestCm-range').value,'100');
 assert.equal(node('bodyChestCm-number').value,'100');
 assert.equal(node('proposal-input-chest').textContent,'100 cm');
 node('tab-measures').dispatch('click');
 assert.equal(node('panel-measures').hidden,false);
});

test('dos capas ocultables y vista de 3/4 posterior disponibles',()=>{
 assert.equal(node('show-body').checked??true,true);
 // Las capas se gestionan con el mismo controlador sin crear mallas nuevas.
 node('show-body').checked=false;
 node('show-body').dispatch('change');
 assert.equal(node('show-body').checked,false);
 assert.equal(node('diagram-body-layer').attrs.display,'none');
 node('show-garment').checked=false;
 node('show-garment').dispatch('change');
 assert.equal(node('show-body').checked,true,'al menos una capa debe quedar visible');
 assert.equal(node('diagram-body-layer').attrs.display,'inline');
 assert.ok(nodes.some(n=>n.dataset.view==='rearquarter'));
});
test('seis estados de camiseta discretos con medidas de reposo no editables',()=>{
 const options=nodes.filter(n=>n.dataset.restOption!=null);
 assert.equal(options.length,6);
 node('tab-adjust').dispatch('click');
 const n1=options.find(x=>x.dataset.restOption==='N1-1');
 n1.dispatch('click');
 assert.equal(node('active-base').textContent,'N1-1');
 assert.equal(node('garmentChestCm-number').value,'98');
 assert.equal(node('garmentHipCm-number').value,'105');
 assert.equal(node('garmentLengthCm-number').value,'64');
 node('garmentChestCm-range').value='134';
 node('garmentChestCm-range').dispatch('input');
 assert.equal(node('garmentChestCm-number').value,'98',
  'arrastrar un slider legado no puede fabricar una talla intermedia');
});
test('perfil sintético cambia la imagen 2D sin cambiar medidas ni talla de reposo',()=>{
 node('tab-measures').dispatch('click');
 const before=node('scale-body-side').attrs.d;
 const chest=node('bodyChestCm-number').value;
 const variant=node('active-base').textContent;
 nodes.find(n=>n.dataset.bodyProfile==='lateral').dispatch('click');
 assert.equal(node('diagram-body-profile').textContent,'Distribución lateral');
 assert.notEqual(node('scale-body-side').attrs.d,before);
 assert.equal(node('bodyChestCm-number').value,chest);
 assert.equal(node('active-base').textContent,variant);
});

test.after(()=>{
 globalThis.document=original.document;
 globalThis.requestAnimationFrame=original.requestAnimationFrame;
 globalThis.cancelAnimationFrame=original.cancelAnimationFrame;
});
