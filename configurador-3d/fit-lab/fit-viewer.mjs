/** Visor aislado del configurador productivo. Sin datos personales ni servicios externos. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFreeTestJersey } from '../free-test-jersey.mjs';
import { createReferenceBody, deformBody, deformGarment, normalizeFit } from './fit-geometry.mjs';

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
  const visual={body:true,transparent:true,wire:false};
  const viewAngles={
    front:[0,.10,5.8],side:[5.8,.14,0],quarter:[3.4,.18,4.9],back:[0,.12,-5.8]
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
    mannequin.material.opacity=.83;
    garment.traverse(obj=>{
      if(!obj.isMesh)return;
      const materials=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const mat of materials){
        if(!mat)continue;
        mat.transparent=visual.transparent;
        mat.opacity=visual.transparent?.43:1;
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
      const v=normalizeFit(values);
      deformBody(mannequin,v);
      deformGarment(garment,v);
      return {body:mannequin,garment};
    },
    setVisual(flags){
      for(const key of Object.keys(visual))if(key in flags)visual[key]=Boolean(flags[key]);
      applyMaterialMode();
    },
    view(name){
      const coords=viewAngles[name]||viewAngles.quarter;
      camera.position.set(...coords);
      controls.target.set(0,0,0);
      controls.update();
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
