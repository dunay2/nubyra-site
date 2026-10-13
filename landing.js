'use strict';
(() => {
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const header = $('#cabecera');
  const menuToggle = $('#menu-toggle');
  const mobileNav = $('#mobile-navigation');
  let toastTimeout;
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('is-visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('is-visible'),3300);}
  function updateHeader(){header.classList.toggle('is-scrolled', window.scrollY > 45);}
  window.addEventListener('scroll',updateHeader,{passive:true});updateHeader();
  function setMenu(open){mobileNav.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Cerrar menú de navegación':'Abrir menú de navegación');}
  menuToggle.addEventListener('click',()=>setMenu(mobileNav.hidden));
  $$('#mobile-navigation a').forEach(link=>link.addEventListener('click',()=>setMenu(false)));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mobileNav.hidden)setMenu(false);});
  window.addEventListener('resize',()=>{if(window.innerWidth>1000&&!mobileNav.hidden)setMenu(false);});
  const kitLabels = {oceano:'Océano',canaria:'Canaria',lava:'Lava',brisa:'Brisa',cumbre:'Cumbre',horizonte:'Horizonte'};
  $$('.kit-card').forEach(button => button.addEventListener('click', () => {
    const name = kitLabels[button.dataset.kit] || 'seleccionado';
    const notice = $('#builder-gallery-feedback');
    notice.textContent = 'Diseño ' + name + ': referencia del catálogo. El configurador 3D permite personalizar los colores y marcajes; todavía no reproduce este estampado exacto.';
    notice.hidden = false;
    $('#configurador').scrollIntoView({behavior:'smooth'});
  }));
  function download(filename,content,type){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
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
