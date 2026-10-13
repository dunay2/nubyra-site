/** Visor aislado del configurador productivo. Sin datos personales ni servicios externos. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFreeTestJersey } from '../free-test-jersey.mjs';
import { createReferenceBody, applyFitToModels, measureCrossSection, backSurfaceProfile } from './fit-geometry.mjs';

export function createFitViewer(canvas,initial){
  if(!canvas || !canvas.parentElement)throw Error('Canvas de laboratorio requerido');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.38;
  renderer.setClearColor(0xffffff,0);
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe5f4ff,0x34475f,2.3));
  const key=new THREE.DirectionalLight(0xffffff,3.2);
  key.position.set(-3,5,6);scene.add(key);
  const fill=new THREE.DirectionalLight(0x90a8d9,1.15);
  fill.position.set(4,1,-5);scene.add(fill);
  const pivot=new THREE.Group();scene.add(pivot);
  const mannequin=createReferenceBody(THREE);
  const garment=createFreeTestJersey(THREE);
  mannequin.name='BodyMesh · sintético (independiente)';
  garment.name='GarmentMesh · camiseta NUBYRA (independiente)';
  pivot.add(mannequin,garment);
  const backPanel=garment.getObjectByName('NUBYRA_Test_Jersey_Back');
  if(!backPanel)throw Error('Se necesita el panel trasero para comparar el volumen');
  const guides=new THREE.Group();
  guides.name='Comparación de sección posterior original vs actual';
  pivot.add(guides);
  const outlineGeometry=points=>new THREE.BufferGeometry().setFromPoints(
    points.map(({x,y,z})=>new THREE.Vector3(x,y,z))
  );
  const originalProfiles={
    body:backSurfaceProfile(mannequin),
    garment:backSurfaceProfile(backPanel)
  };
  let guideTarget='body',viewName='quarter',lastFit=null;
  const originalLine=new THREE.Line(outlineGeometry(originalProfiles.body),
    new THREE.LineBasicMaterial({color:0xc38712,depthTest:false,transparent:true,opacity:.95}));
  originalLine.renderOrder=99;
  const currentLine=new THREE.Line(outlineGeometry(originalProfiles.body),
    new THREE.LineBasicMaterial({color:0x127da9,depthTest:false,transparent:true,opacity:1}));
  currentLine.renderOrder=100;
  guides.add(originalLine,currentLine);
  guides.visible=false;
  function refreshRearGuide(){
    originalLine.geometry.dispose();
    currentLine.geometry.dispose();
    originalLine.geometry=outlineGeometry(originalProfiles[guideTarget]);
    currentLine.geometry=outlineGeometry(backSurfaceProfile(guideTarget==='body'?mannequin:backPanel));
    guides.visible=['back','rearquarter','side'].includes(viewName);
  }
  const camera=new THREE.PerspectiveCamera(33,1,.1,50);
  camera.position.set(3.2,.24,4.9);
  const controls=new OrbitControls(camera,canvas);
  controls.target.set(0,.01,0);
  controls.enableDamping=true;
  controls.dampingFactor=.075;
  controls.enablePan=false;
  controls.minDistance=3.1;
  controls.maxDistance=8.4;
  controls.minPolarAngle=.58;
  controls.maxPolarAngle=2.60;
  controls.update();
  const visual={body:true,garment:true,transparent:true,wire:false};
  const viewAngles={
    front:[0,.10,5.8],side:[5.8,.14,0],quarter:[3.4,.18,4.9],back:[0,.12,-5.8],rearquarter:[3.5,.2,-4.9]
  };
  let disposed=false,frameId=0;
  const updateSize=()=>{
    const p=canvas.parentElement;
    const width=Math.max(1,p.clientWidth),height=Math.max(1,p.clientHeight);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  };
  const observer=new ResizeObserver(updateSize);
  observer.observe(canvas.parentElement);updateSize();
  function applyMaterialMode(){
    mannequin.visible=visual.body;
    garment.visible=visual.garment;
    mannequin.material.opacity=.83;
    garment.traverse(obj=>{
      if(!obj.isMesh)return;
      const materials=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const mat of materials){
        if(!mat)continue;
        mat.transparent=visual.transparent;
        mat.opacity=visual.transparent ? 0.43 : 1;
        mat.depthWrite=!visual.transparent;
        mat.side=THREE.DoubleSide;
        mat.wireframe=visual.wire;
        mat.needsUpdate=true;
      }
    });
  }
  applyMaterialMode();
  function tick(){
    if(disposed)return;
    controls.update();
    renderer.render(scene,camera);
    frameId=requestAnimationFrame(tick);
  }
  tick();
  const api={
    update(values){
      // Único controlador común: las etiquetas nunca se pierden en esta frontera.
      lastFit=applyFitToModels(mannequin,garment,values);
      refreshRearGuide();
      return {body:mannequin,garment};
    },
    setVisual(flags){
      for(const key of Object.keys(visual))if(key in flags)visual[key]=Boolean(flags[key]);
      applyMaterialMode();
    },
    view(name){
      viewName=name in viewAngles?name:'quarter';
      const coords=viewAngles[viewName];
      camera.position.set(...coords);
      controls.target.set(0,0,0);
      controls.update();
      guides.visible=['back','rearquarter','side'].includes(viewName);
    },
    setGuideTarget(mode){
      if(!['body','garment'].includes(mode))return;
      guideTarget=mode;
      refreshRearGuide();
    },
    // Estimador geométrico, no medición de gravedad, fricción ni elasticidad real.
    drapeDiagnostics(){
      return lastFit?.drape??null;
    },
    currentRestConfiguration(){
      return lastFit?.restConfiguration??null;
    },
    // Cálculo sobre vértices, sin equivalencia antropométrica en centímetros.
    measureChestSections(){
      return {
        body:measureCrossSection(mannequin,.27),
        garment:measureCrossSection(garment,.27)
      };
    },
    // Únicamente referencia geométrica. No interpretar como separación de tejido medida en cm.
    geometryDiagnostics(){
      return {
        bodyVertexCount:mannequin.geometry.getAttribute('position').count,
        garmentPieces:garment.children.filter(x=>x.isMesh).length,
        independentMeshReferences:mannequin!==garment,
        bodyGeometryId:mannequin.geometry.uuid,
        garmentGeometryId:garment.children[0].geometry.uuid
      };
    },
    destroy(){
      disposed=true;cancelAnimationFrame(frameId);
      observer.disconnect();controls.dispose();
      mannequin.geometry.dispose();mannequin.material.dispose();
      originalLine.geometry.dispose();originalLine.material.dispose();
      currentLine.geometry.dispose();currentLine.material.dispose();
      garment.traverse(x=>{
        if(x.isMesh){
          x.geometry.dispose();
          const mats=Array.isArray(x.material)?x.material:[x.material];
          mats.forEach(m=>m?.dispose());
        }
      });
      renderer.dispose();
    }
  };
  api.update(initial);
  return api;
}
