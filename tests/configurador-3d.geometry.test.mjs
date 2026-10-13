import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {createFreeTestJersey} from '../configurador-3d/free-test-jersey.mjs';
import {inspectGlb} from '../configurador-3d/model-audit.mjs';
const base=process.env.THREE_TEST_DIR;
if(!base){
  test('ensayo GLB/Three.js opcional', {skip:'Requiere THREE_TEST_DIR: las pruebas normales no descargan Three.js'},()=>{});
}else{
const core=pathToFileURL(resolve(base,'node_modules/three/build/three.module.js')).href;
const exporterPath=pathToFileURL(resolve(base,'node_modules/three/examples/jsm/exporters/GLTFExporter.js')).href;
const loaderPath=pathToFileURL(resolve(base,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')).href;
const THREE=await import(core);
const {GLTFExporter}=await import(exporterPath);
const {GLTFLoader}=await import(loaderPath);
class FileReaderCompat {
 constructor(){this.result=null;this.error=null;this.onloadend=null;this.onerror=null}
 readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.({target:this})}).catch(e=>{this.error=e;this.onerror?.({target:this})})}
 readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+(blob.type||'application/octet-stream')+';base64,'+Buffer.from(b).toString('base64');this.onloadend?.({target:this})}).catch(e=>{this.error=e;this.onerror?.({target:this})})}
}
globalThis.FileReader=FileReaderCompat;
test('malla femenina visual abierta: mallas separadas y UV/normales correctas',()=>{
 const group=createFreeTestJersey(THREE);
 const meshes=[];group.traverse(n=>{if(n.isMesh)meshes.push(n)});
 assert.equal(meshes.length,12);
 for(const mesh of meshes){
  assert.ok(mesh.geometry.getAttribute('position')?.count>0,mesh.name);
  assert.equal(mesh.geometry.getAttribute('normal')?.count,mesh.geometry.getAttribute('position').count,mesh.name);
  assert.equal(mesh.geometry.getAttribute('uv')?.count,mesh.geometry.getAttribute('position').count,mesh.name);
  assert.ok(mesh.geometry.index ? mesh.geometry.index.count%3===0 : mesh.geometry.getAttribute('position').count%3===0,mesh.name);
 }
 const byPiece=meshes.map(mesh=>({
  name:mesh.name,
  triangles:(mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count)/3
 }));
 const triangleTotal=byPiece.reduce((n,piece)=>n+piece.triangles,0);
 assert.ok(Number.isInteger(triangleTotal),'el recuento de triángulos debe ser entero');
 console.log('NUBYRA_GEOMETRY_AUDIT='+JSON.stringify({
  triangles:triangleTotal,meshCount:meshes.length,byPiece
 }));
 assert.ok(meshes.some(x=>/Jersey_Front/.test(x.name)));
 assert.ok(meshes.some(x=>/Jersey_Back/.test(x.name)));
 assert.ok(meshes.some(x=>/trim-front-neck/.test(x.name)));
 const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
 assert.ok(size.y>2.25 && size.y<2.7,size.y);
 assert.ok(size.x>.9 && size.x<1.7,size.x);
 assert.ok(size.z>.35 && size.z<.9,size.z);
});
test('exportación GLB 2.0 del modelo de ensayo auditable e importable',async()=>{
 const group=createFreeTestJersey(THREE);
 const glb=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});
 assert.ok(glb instanceof ArrayBuffer);
 const audit=inspectGlb(glb);
 assert.equal(audit.meshes,12);
 assert.equal(audit.uvCoverage,1);
 assert.equal(audit.missingNormals,0);
 assert.ok(audit.triangles>1000 && audit.triangles<250000);
 const loaded=await new GLTFLoader().parseAsync(glb,'');
 let front=0,back=0;loaded.scene.traverse(x=>{if(x.isMesh && x.name.includes('Jersey_Front'))front++;if(x.isMesh && x.name.includes('Jersey_Back'))back++});
 assert.equal(front,1);assert.equal(back,1);
});
}
