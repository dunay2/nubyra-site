import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFreeTestJersey} from '../configurador-3d/free-test-jersey.mjs';
import {
 DEFAULT_FIT,createReferenceBody,deformBody,deformGarment,
 applyFitToModels,measureCrossSection,backSurfaceProfile,getBodyExtentAt
} from '../configurador-3d/fit-lab/fit-geometry.mjs';
import {
 GARMENT_CATALOG,DEFAULT_CONFIGURATION,stateForConfiguration
} from '../configurador-3d/fit-lab/garment-catalog.mjs';
import {BODY_PROFILES} from '../configurador-3d/fit-lab/fit-drape.mjs';

const home=process.env.THREE_TEST_DIR;
if(!home){
 test('el ensayo geométrico necesita Three.js', {skip:'THREE_TEST_DIR no disponible'},()=>{});
}else{
 const url=pathToFileURL(resolve(home,'node_modules/three/build/three.module.js')).href;
 const THREE=await import(url);
 const clone=geometry=>new Float32Array(geometry.getAttribute('position').array);
 const uv=geometry=>new Float32Array(geometry.getAttribute('uv').array);
 const metrics=group=>measureCrossSection(group,.27);
 const frontOf=group=>group.getObjectByName('NUBYRA_Test_Jersey_Front');
 const backOf=group=>group.getObjectByName('NUBYRA_Test_Jersey_Back');
 const input=(other={})=>({...DEFAULT_FIT,...stateForConfiguration(DEFAULT_CONFIGURATION),
  bodyProfile:'front',...other});
 test('cuerpo y camiseta tienen geometrías independientes y la prenda 12 mallas',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  assert.equal(body.userData.fitRole,'body');
  assert.ok(body.geometry!==garment.children[0].geometry);
  assert.equal(garment.children.filter(x=>x.isMesh).length,12);
  assert.ok(body.geometry.getAttribute('position').count>2200);
 });
 test('busto frontal: aumenta X y Z anterior sin aumentar Z posterior del cuerpo',()=>{
  const body=createReferenceBody(THREE);
  deformBody(body,input());
  const before=metrics(body);
  deformBody(body,input({bodyChestCm:118}));
  const after=metrics(body);
  assert.ok(after.width>before.width*1.10);
  assert.ok(after.front>before.front*1.35);
  assert.ok(Math.abs(after.back-before.back)<.004,
   'el busto no debería aumentar artificialmente la espalda');
 });
 test('perfil torácico sí puede modificar la profundidad posterior explícitamente',()=>{
  const body=createReferenceBody(THREE);
  deformBody(body,input({bodyProfile:'thorax'}));
  const before=metrics(body);
  deformBody(body,input({bodyChestCm:118,bodyProfile:'thorax'}));
  assert.ok(metrics(body).back>before.back*1.08);
  assert.deepEqual(Object.keys(BODY_PROFILES),['front','lateral','thorax']);
 });
 test('catálogo de seis reposos: nada se fabrica a un cm arbitrario',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  const originalUV=uv(frontOf(garment).geometry);
  const baselines=new Map();
  for(const code of Object.keys(GARMENT_CATALOG)){
   const result=applyFitToModels(body,garment,input({activeConfiguration:code}));
   assert.equal(result.restConfiguration,code);
   assert.equal(result.drape.physicallyValidated,false);
   baselines.set(code,metrics(garment));
  }
  assert.equal(baselines.size,6);
  assert.ok(baselines.get('N2-3').width>baselines.get('N1-1').width*1.2);
  assert.deepEqual(uv(frontOf(garment).geometry),originalUV);
 });
 test('los valores de cm introducidos de camiseta no alteran una variante fija',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  applyFitToModels(body,garment,input());
  const before=clone(frontOf(garment).geometry);
  applyFitToModels(body,garment,input({
   garmentChestCm:135,garmentHipCm:145,garmentLengthCm:84
  }));
  assert.deepEqual(clone(frontOf(garment).geometry),before);
 });
 test('la camiseta de reposo fijo puede elevar el bajo delantero al ganar busto',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  const initial=applyFitToModels(body,garment,input());
  const beforeShirt=metrics(garment);
  const beforeBack=clone(backOf(garment).geometry);
  const frontOriginal=clone(frontOf(garment).geometry);
  const expanded=applyFitToModels(body,garment,input({bodyChestCm:120}));
  const afterShirt=metrics(garment);
  const frontChanged=clone(frontOf(garment).geometry);
  const backChanged=clone(backOf(garment).geometry);
  assert.equal(expanded.restConfiguration,initial.restConfiguration);
  assert.ok(expanded.drape.frontProjectionUnits>initial.drape.frontProjectionUnits+.02,
   'el relieve frontal necesita desplazar el delantero');
  assert.ok(expanded.drape.frontHemLiftUnits>initial.drape.frontHemLiftUnits,
   'un recorrido frontal mayor debe acortar la caída visible');
  assert.ok(expanded.drape.estimatedFrontHemLiftCm>0);
  assert.ok(Math.abs(afterShirt.width-beforeShirt.width)<1e-5,
   'no se ensancha el reposo de camiseta para ajustar el cuerpo');
  assert.ok(Math.abs(afterShirt.back-beforeShirt.back)<.002,
   'no hay abombamiento dorsal ficticio');
  assert.notDeepEqual(frontChanged,frontOriginal,'delantero sí se adapta');
  assert.deepEqual(backChanged,beforeBack,'la espalda de la prenda se mantiene');
 });
 test('bajo delantero sube, bajo posterior mantiene posición geométrica',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  applyFitToModels(body,garment,input());
  const frontBefore=clone(frontOf(garment).geometry);
  const backBefore=clone(backOf(garment).geometry);
  const data=applyFitToModels(body,garment,input({bodyChestCm:120}));
  const f=frontOf(garment).geometry.getAttribute('position');
  const b=backOf(garment).geometry.getAttribute('position');
  let frontRows=0,backRows=0;
  for(let i=0;i<f.count;i++){
   if(frontBefore[i*3+1]<-1.16){
    if(f.getY(i)>frontBefore[i*3+1]+.001)frontRows++;
   }
  }
  for(let i=0;i<b.count;i++){
   if(backBefore[i*3+1]<-1.16){
    assert.ok(Math.abs(b.getY(i)-backBefore[i*3+1])<1e-6);
    backRows++;
   }
  }
  assert.ok(frontRows>8,'hay que elevar una parte del bajo delantero');
  assert.ok(backRows>8);
  assert.equal(data.drape.method,'single-front-path-bounded-geometry');
  assert.ok(data.drape.pathLengthDrapedUnits>0);
  assert.ok(data.drape.pathLengthRestUnits>0);
 });
 test('camiseta fija, variación corporal de perfil: cambiar parámetros no altera UV',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  const beforeUv=uv(frontOf(garment).geometry);
  applyFitToModels(body,garment,input({bodyChestCm:120,bodyProfile:'front'}));
  applyFitToModels(body,garment,input({bodyChestCm:110,bodyProfile:'lateral'}));
  applyFitToModels(body,garment,input({bodyChestCm:120,bodyProfile:'thorax'}));
  assert.deepEqual(uv(frontOf(garment).geometry),beforeUv);
 });
 test('cambio de configuración de reposo altera camiseta sin modificar cuerpo',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  applyFitToModels(body,garment,input());
  const originalBody=clone(body.geometry),base=metrics(garment);
  const updated=applyFitToModels(body,garment,input({
    activeConfiguration:'N2-3',...stateForConfiguration('N2-3')
  }));
  assert.equal(updated.restConfiguration,'N2-3');
  assert.ok(metrics(garment).width>base.width*1.20);
  assert.deepEqual(clone(body.geometry),originalBody);
 });
 test('dos ejecuciones con mismos valores son deterministas para las dos mallas',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  const settings=input({bodyChestCm:116,bodyHipCm:113,activeConfiguration:'N1-1'});
  const first=applyFitToModels(body,garment,settings);
  const bodyInitial=clone(body.geometry),frontInitial=clone(frontOf(garment).geometry);
  const second=applyFitToModels(body,garment,settings);
  assert.deepEqual(clone(body.geometry),bodyInitial);
  assert.deepEqual(clone(frontOf(garment).geometry),frontInitial);
  assert.equal(second.drape.frontHemLiftUnits,first.drape.frontHemLiftUnits);
  assert.ok(getBodyExtentAt(body,.28).halfWidth>.3);
 });
 test('perfil posterior y sección de diagnóstico siguen disponibles',()=>{
  const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
  applyFitToModels(body,garment,input());
  assert.ok(backSurfaceProfile(backOf(garment)).length>=8);
  assert.ok(metrics(garment).vertices>20);
  assert.throws(()=>measureCrossSection(null,.27),/malla o grupo/);
  assert.throws(()=>backSurfaceProfile(null),/geometría de espalda/);
 });
}