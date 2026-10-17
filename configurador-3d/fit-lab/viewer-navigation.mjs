import * as T from 'three';
export const NAVIGATION_VERSION='lab-camera/1.0';
/** Camera controls never mutate body state or send a physical update. */
export function mountViewerNavigation({canvas,camera,controls,body,fit,invalidate}){
 const listeners=[];let touched=false,interactions=0;
 const listen=(el,type,fn)=>{el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));};
 controls.enablePan=true;controls.screenSpacePanning=true;controls.zoomToCursor=true;
 controls.minZoom=.35;controls.maxZoom=5;controls.minPolarAngle=.035;controls.maxPolarAngle=Math.PI-.035;
 controls.rotateSpeed=.8;controls.panSpeed=.9;controls.zoomSpeed=.9;
 controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.PAN};
 controls.touches={ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN};
 canvas.tabIndex=0;canvas.setAttribute('aria-label','Visor 3D: arrastra para girar, botón derecho para desplazar, rueda para zoom. F encuadra.');controls.listenToKeyEvents(canvas);
 const bar=document.createElement('div');bar.className='free-camera-tools';bar.setAttribute('role','group');bar.setAttribute('aria-label','Navegación de cámara');
 for(const [action,title,text]of[['zoom-in','Acercar','+'],['zoom-out','Alejar','−'],['fit','Recuperar encuadre','Encuadrar'],['focus','Centrar pelvis','Cadera'],['fullscreen','Pantalla completa','⛶']]){
  const button=document.createElement('button');button.type='button';button.dataset.cameraAction=action;button.textContent=text;button.title=title;button.setAttribute('aria-label',title);bar.append(button);
  listen(button,'click',async()=>{
   if(action==='fit'){touched=false;fit();}
   if(action==='zoom-in'||action==='zoom-out'){touched=true;camera.zoom=T.MathUtils.clamp(camera.zoom*(action==='zoom-in'?1.25:.8),controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();}
   if(action==='focus'){touched=true;const p=new T.Vector3(0,body.userData.hipY,0),d=camera.position.clone().sub(controls.target);controls.target.copy(p);camera.position.copy(p).add(d);}
   if(action==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await canvas.parentElement.requestFullscreen();}catch{help.textContent='Pantalla completa no disponible en este navegador.';}}
   controls.update();invalidate();
  });
 }
 canvas.parentElement.append(bar);const help=document.createElement('span');help.className='camera-help';help.textContent='Arrastra: girar · botón derecho: mover · rueda: zoom · doble clic: enfocar';canvas.parentElement.append(help);
 listen(controls,'start',()=>{touched=true;interactions++;});
 const raycaster=new T.Raycaster();
 listen(canvas,'dblclick',e=>{const b=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),camera);const hit=raycaster.intersectObject(body,false)[0];if(hit){touched=true;const d=camera.position.clone().sub(controls.target);controls.target.copy(hit.point);camera.position.copy(hit.point).add(d);controls.update();invalidate();}});
 listen(canvas,'keydown',e=>{if(e.key.toLowerCase()==='f'){e.preventDefault();touched=false;fit();}if(e.key==='+'||e.key==='=')bar.querySelector('[data-camera-action="zoom-in"]').click();if(e.key==='-')bar.querySelector('[data-camera-action="zoom-out"]').click();});
 return {get touched(){return touched;},reset(){touched=false;fit();},snapshot:()=>({version:NAVIGATION_VERSION,userControlled:touched,interactions,pan:true,orbit:true,zoom:camera.zoom,minZoom:controls.minZoom,maxZoom:controls.maxZoom,polarAngle:controls.getPolarAngle(),target:controls.target.toArray(),position:camera.position.toArray()}),destroy(){listeners.forEach(f=>f());controls.stopListenToKeyEvents();bar.remove();help.remove();}};
}
