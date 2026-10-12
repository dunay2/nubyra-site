'use strict';
(() => {
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const header = $('#cabecera');
  const menuToggle = $('#menu-toggle');
  const mobileNav = $('#mobile-navigation');
  const kitLabels = {oceano:'Océano',canaria:'Canaria',lava:'Lava',brisa:'Brisa',cumbre:'Cumbre',horizonte:'Horizonte'};
  const printBase = 'https://vyeebvzuxarekfaisfdy.supabase.co/storage/v1/object/public/nubyra-web/01_print_recursos/';
  const catalogBase = 'https://vyeebvzuxarekfaisfdy.supabase.co/storage/v1/object/public/nubyra-web/02_catalogo_recursos/';
  const state = {kit:'oceano',team:'NUBYRA',number:'10',measures:{length:60,chest:92,hip:98}};
  let toastTimeout;
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('is-visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('is-visible'),3300);}
  function updateHeader(){header.classList.toggle('is-scrolled', window.scrollY > 45);}
  window.addEventListener('scroll',updateHeader,{passive:true});updateHeader();
  function setMenu(open){mobileNav.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Cerrar menú de navegación':'Abrir menú de navegación');}
  menuToggle.addEventListener('click',()=>setMenu(mobileNav.hidden));
  $$('#mobile-navigation a').forEach(link=>link.addEventListener('click',()=>setMenu(false)));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobileNav.hidden)setMenu(false);});
  window.addEventListener('resize',()=>{if(window.innerWidth>1000&&!mobileNav.hidden)setMenu(false);});
  function updateKit(){
    $('#builder-design-label').textContent='Diseño '+kitLabels[state.kit];
    $('#builder-sample').textContent=[kitLabels[state.kit],state.team||'Equipo sin nombre',state.number||'—'].join(' · ');
    const photo=$('#builder-image'); photo.src=state.kit==='oceano'?printBase+'configurador-camiseta-frente.png':catalogBase+'equipacion-'+state.kit+'.png';
    photo.alt='Imagen conceptual del diseño '+kitLabels[state.kit]+'; no es una simulación 3D ni actualiza en pantalla las medidas o datos introducidos.';
    $('#builder-view-description').textContent=state.kit==='oceano'?'Camiseta / Vista frontal':'Equipación / Vistas conceptuales';
    $$('[data-kit]', $('#builder')).forEach(button=>{const yes=button.dataset.kit===state.kit;button.classList.toggle('is-selected',yes);button.setAttribute('aria-pressed',String(yes));});
  }
  $$('[data-kit]', $('#builder')).forEach(button=>button.addEventListener('click',()=>{state.kit=button.dataset.kit;updateKit();}));
  $$('.kit-card').forEach(button=>button.addEventListener('click',()=>{state.kit=button.dataset.kit;updateKit();setTab('design');document.getElementById('configurador').scrollIntoView({behavior:'smooth'});}));
  $('#builder-team').addEventListener('input',e=>{state.team=e.target.value.trim().slice(0,24);updateKit();});
  $('#builder-number').addEventListener('input',e=>{const filtered=e.target.value.replace(/\D/g,'').slice(0,3);e.target.value=filtered;state.number=filtered;updateKit();});
  const designTab=$('#tab-design'),proportionsTab=$('#tab-proportions');
  const designPanel=$('#builder-design-panel'),proportionsPanel=$('#builder-proportions-panel');
  function setTab(name){const design=name==='design';designTab.setAttribute('aria-selected',String(design));proportionsTab.setAttribute('aria-selected',String(!design));designTab.tabIndex=design?0:-1;proportionsTab.tabIndex=design?-1:0;designPanel.hidden=!design;proportionsPanel.hidden=design;}
  designTab.addEventListener('click',()=>setTab('design'));proportionsTab.addEventListener('click',()=>setTab('proportions'));
  [designTab,proportionsTab].forEach((t,i)=>t.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=i===0?proportionsTab:designTab;next.click();next.focus();}}));
  ['length','chest','hip'].forEach(name=>{const input=$('#measure-'+name),output=$('#value-'+name);input.addEventListener('input',()=>{state.measures[name]=Number(input.value);output.textContent=input.value+' cm';});});
  function download(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  $('#builder-download').addEventListener('click',()=>{
    const proposal={schema:'nubyra.visual-preview/1.0',status:'conceptual-not-sent',design:state.kit,team:state.team,number:state.number,measurementsIllustrative:state.measures,unit:'cm',manufacturingApproved:false,note:'Propuesta visual local. La prenda no está validada y la imagen no refleja las medidas ni constituye una simulación 3D. No es presupuesto ni pedido.'};
    download('NUBYRA_propuesta_conceptual.json',JSON.stringify(proposal,null,2),'application/json;charset=utf-8');toast('Propuesta descargada. No se ha enviado ni guardado en un servidor.');
  });
  updateKit();
  const dialog=$('#contact-dialog');let opener=null;
  $$('[data-contact]').forEach(b=>b.addEventListener('click',()=>{opener=b;$('#contact-subject').value=b.dataset.contact;dialog.showModal();}));
  $('#close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>opener?.focus());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  $('#contact-form').addEventListener('submit',e=>{
    e.preventDefault();if(!e.currentTarget.reportValidity())return;
    const d=new FormData(e.currentTarget);const text=['NUBYRA · Borrador de consulta','',`Motivo: ${d.get('subject')}`,`Nombre: ${d.get('person')}`,`Correo: ${d.get('email')}`,'','Mensaje:',String(d.get('message')),'','Este archivo es un borrador local, no una solicitud enviada.'].join('\n');
    download('NUBYRA_consulta_borrador.txt',text,'text/plain;charset=utf-8');dialog.close();toast('Borrador descargado; no se ha enviado.');
  });
})();
