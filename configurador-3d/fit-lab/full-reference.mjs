import * as T from 'three';
import {loadHumanBody,updateHumanBody} from './human-body.mjs';
import {createHumanAppearance} from './human-appearance.mjs';
import {createHumanFace} from './human-face.mjs';
import {createRestGarment,CM_PER_UNIT} from './fit-mesh.mjs';
import {createGarmentFinish} from './garment-finish.mjs';
import {GARMENT_CATALOG} from './garment-catalog.mjs';
import {syncSurfaceTrim} from './surface-bindings.mjs';
/** Explicitly synthetic full-body comparator. Local photos require declared height
 * and head/foot calibration; no cropped photograph is invented or stretched. */
export async function createFullReference(canvas,bytes,seed,shortFactory){
 if(!seed?.frame?.state||seed.frame.remaining!==0)throw Error('Falta la referencia completa');
 const frame=seed.frame,body=updateHumanBody(await loadHumanBody(bytes),frame.state,{collision:false}),scene=new T.Scene();scene.add(body);
 const appearance=createHumanAppearance(body),face=createHumanFace(body),shirt=createRestGarment(T,GARMENT_CATALOG[frame.state.activeConfiguration]);
 const finish=createGarmentFinish(shirt,frame.maps,body);finish.update(frame.positions);
 for(const edge of frame.trims){const m=shirt.getObjectByName(edge.name);if(m){syncSurfaceTrim(m.geometry.attributes.position,edge.bindings,frame.positions);m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();}}
 const shorts=shortFactory.create(body,{size:'P1',lengthCm:34});shorts.settle();scene.add(shirt,shorts.mesh);
 scene.add(new T.HemisphereLight(0xf5fcff,0x365267,2.1));for(const[x,y,z,p]of[[-3,5,5,2.7],[4,1,-3,1.4]]){const l=new T.DirectionalLight(0xffffff,p);l.position.set(x,y,z);scene.add(l);}
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 const camera=new T.OrthographicCamera(-2,2,3,-3,.1,50),photo=document.getElementById('full-reference-photo'),stage=canvas.parentElement,title=document.getElementById('full-reference-title');
 const controls=document.getElementById('reference-file'),height=document.getElementById('reference-height'),head=document.getElementById('reference-head'),feet=document.getElementById('reference-feet'),modeControl=document.getElementById('reference-mode'),status=document.getElementById('reference-photo-status');
 let metrics=null,key='',objectURL=null,mode='synthetic',photoLoaded=false;
 function syncPhoto(){
  if(!metrics||!photoLoaded)return;const cm=Number(height.value),h=Number(head.value)/100,f=Number(feet.value)/100;
  if(!(cm>=100&&cm<=220&&f>h+.10)){status.textContent='Revisa estatura y marcas: pies por debajo de la cabeza.';return;}
  const imageHeight=cm*metrics.pxPerCm/(f-h);photo.style.height=imageHeight+'px';photo.style.width='auto';photo.style.top=(metrics.floorPx-f*imageHeight)+'px';
  title.textContent='FOTO · '+cm+' cm declarados';status.textContent='Foto local. Escala según estatura y marcas introducidas; perspectiva sin calibrar.';
 }
 function render(next){
  metrics=next;if(mode==='photo'){syncPhoto();return;}const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h||!next.pxPerCm)return;
  if(mode==='photo'){syncPhoto();return;}const signature=[w,h,next.pxPerCm,next.floorPx].join(':');if(signature===key)return;key=signature;
  renderer.setSize(w,h,false);const half=h/(2*next.pxPerCm*CM_PER_UNIT);camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;
  const target=body.userData.floorY+(next.floorPx-h/2)/(next.pxPerCm*CM_PER_UNIT);camera.position.set(0,target,8);camera.lookAt(0,target,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
 }
 function choose(){mode=modeControl.value==='photo'&&photoLoaded?'photo':'synthetic';canvas.hidden=mode!=='synthetic';photo.hidden=mode!=='photo';title.textContent=mode==='synthetic'?'REFERENCIA 3D · 170 cm':'FOTO LOCAL';stage.dataset.source=mode;key='';if(metrics)render(metrics);}
 async function upload(){
  const file=controls.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){status.textContent='Utiliza JPG, PNG o WebP de hasta 10 MB.';return;}
  const next=URL.createObjectURL(file);try{const img=new Image();img.src=next;await img.decode();if(img.width*img.height>40000000)throw Error('Imagen demasiado grande');if(objectURL)URL.revokeObjectURL(objectURL);objectURL=next;photo.src=next;photoLoaded=true;modeControl.value='photo';choose();}catch(e){URL.revokeObjectURL(next);status.textContent='No se pudo cargar la foto: '+e.message;}
 }
 controls.addEventListener('change',upload);modeControl.addEventListener('change',choose);for(const el of[height,head,feet])el.addEventListener('input',syncPhoto);choose();
 return{render,snapshot:()=>({mode,fullBody:mode==='synthetic',heightCm:mode==='synthetic'?170:Number(height.value),heightSource:mode==='synthetic'?'fixed-synthetic-avatar':'user-declaration',samePixelScale:true,photographInvented:false}),destroy(){if(objectURL)URL.revokeObjectURL(objectURL);controls.removeEventListener('change',upload);modeControl.removeEventListener('change',choose);for(const el of[height,head,feet])el.removeEventListener('input',syncPhoto);finish.destroy();shirt.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});shorts.destroy();appearance.destroy();face.destroy();body.geometry.dispose();body.material.dispose();renderer.dispose();}};
}
