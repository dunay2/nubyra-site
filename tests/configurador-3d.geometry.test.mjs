import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {createFreeTestJersey, torsoHalfWidth, torsoDepth, GRID, TEST_JERSEY_META} from '../configurador-3d/free-test-jersey.mjs';
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
 assert.ok(meshes.some(x=>/Jersey_Front/.test(x.name)));
 assert.ok(meshes.some(x=>/Jersey_Back/.test(x.name)));
 assert.ok(meshes.some(x=>/trim-front-neck/.test(x.name)));
 const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
 assert.ok(size.y>2.25 && size.y<2.7,size.y);
 assert.ok(size.x>.9 && size.x<1.7,size.x);
 assert.ok(size.z>.35 && size.z<.9,size.z);
});
test('topología v2: pecho, cintura, cadera y gradientes de superficie suaves',()=>{
 assert.equal(TEST_JERSEY_META.topology,'structured-panel-grid-v2');
 assert.ok(torsoHalfWidth(.30)>torsoHalfWidth(-.28)+.08,'pecho más ancho que cintura');
 assert.ok(torsoHalfWidth(-.98)>torsoHalfWidth(-.28)+.08,'cadera más ancha que cintura');
 for(const y of [-1.2,-.95,-.64,-.28,0,.3,.39,.55,.78,1.09,1.2]){
   const w=torsoHalfWidth(y);
   assert.ok(w>.45&&w<.70,'anchura fuera de perfil en '+y);
   assert.ok(torsoDepth(0,y,true)>0,'frontal no queda detrás en '+y);
   assert.ok(torsoDepth(0,y,false)<0,'espalda no queda delante en '+y);
 }
 let previous=torsoHalfWidth(-1.22),maxStep=0;
 for(let i=1;i<=500;i++){
   const y=-1.22+i*2.42/500,now=torsoHalfWidth(y);
   maxStep=Math.max(maxStep,Math.abs(now-previous));previous=now;
 }
 assert.ok(maxStep<.008,'curvatura lateral demasiado abrupta: '+maxStep);
});

test('malla v2 regular y triangulada: centros continuos y normales coherentes',()=>{
 const group=createFreeTestJersey(THREE);
 const front=group.getObjectByName('NUBYRA_Test_Jersey_Front');
 const back=group.getObjectByName('NUBYRA_Test_Jersey_Back');
 assert.ok(front&&back);
 const panelTriangles=4*GRID.panelRows*GRID.halfPanelCols;
 assert.equal(front.geometry.index.count/3,panelTriangles);
 assert.equal(back.geometry.index.count/3,panelTriangles);
 for(const [mesh,expectedNormalSign] of [[front,1],[back,-1]]){
   const geo=mesh.geometry,uv=geo.getAttribute('uv'),
     normals=geo.getAttribute('normal'),positions=geo.getAttribute('position');
   assert.equal(positions.count,2*(GRID.panelRows+1)*(GRID.halfPanelCols+1));
   assert.equal(uv.count,positions.count);
   let degenerate=0,badWinding=0;
   const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
   for(let i=0;i<geo.index.count;i+=3){
     const ia=geo.index.getX(i),ib=geo.index.getX(i+1),ic=geo.index.getX(i+2);
     a.fromBufferAttribute(positions,ia);b.fromBufferAttribute(positions,ib);c.fromBufferAttribute(positions,ic);
     const cross=b.clone().sub(a).cross(c.clone().sub(a));
     if(cross.length()<1e-9)degenerate++;
     if(cross.z*expectedNormalSign<=0)badWinding++;
   }
   assert.equal(degenerate,0,'no deben existir triángulos degenerados en '+mesh.name);
   assert.equal(badWinding,0,'winding erróneo en '+mesh.name);
   for(let i=0;i<positions.count;i++){
     const nx=normals.getX(i),ny=normals.getY(i),nz=normals.getZ(i);
     assert.ok(Math.abs(Math.hypot(nx,ny,nz)-1)<1e-4,'normal no unitaria');
     assert.ok(nz*expectedNormalSign>.75,'normal orientada al revés');
     assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1,'UV inválidas');
   }
 }
});
test('distribución geométrica v2: menos coste relativo de ribetes y presupuesto móvil acotado',()=>{
 const root=createFreeTestJersey(THREE),byName=new Map();let total=0,panels=0,trim=0;
 root.traverse(m=>{
   if(!m.isMesh)return;
   const triangles=(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3;
   byName.set(m.name,triangles);total+=triangles;
   if(/Jersey_(Front|Back)|Side_(Left|Right)/.test(m.name))panels+=triangles;
   else trim+=triangles;
 });
 assert.equal(byName.size,12);
 assert.equal(total,11680,'cualquier cambio de topología debe revisar el presupuesto');
 assert.equal(panels,6880);
 assert.equal(trim,4800);
 assert.ok(panels/total>.58,'la mayoría de triángulos debe estar en tejido');
 assert.ok(total<18000,'presupuesto alto para la demo móvil');
 console.log('NUBYRA_TOPOLOGY_V2='+JSON.stringify({
   triangles:total,fabricTriangles:panels,trimTriangles:trim,meshCount:byName.size,
   ratioFabric:Number((panels/total).toFixed(4)),byPiece:Object.fromEntries(byName)
 }));
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
