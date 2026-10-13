import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFreeTestJersey} from '../configurador-3d/free-test-jersey.mjs';
import {
  DEFAULT_FIT,createReferenceBody,deformBody,deformGarment,getBodyExtentAt,applyFitToModels,measureCrossSection
} from '../configurador-3d/fit-lab/fit-geometry.mjs';

const home=process.env.THREE_TEST_DIR;
if(!home){
  test('geometry lab requires Three.js', {skip:'THREE_TEST_DIR no disponible'},()=>{});
}else{
  const url=pathToFileURL(resolve(home,'node_modules/three/build/three.module.js')).href;
  const THREE=await import(url);
  const clone=(geometry)=>new Float32Array(geometry.getAttribute('position').array);
  const uv=(geometry)=>new Float32Array(geometry.getAttribute('uv').array);
  const differs=(a,b)=>a.some((v,i)=>Math.abs(v-b[i])>1e-6);
  function sectionExtent(mesh,y){
    const p=mesh.geometry.getAttribute('position');let x=0,z=0;
    for(let i=0;i<p.count;i++){
      if(Math.abs(p.getY(i)-y)<.04){
        x=Math.max(x,Math.abs(p.getX(i)));
        z=Math.max(z,Math.abs(p.getZ(i)));
      }
    }
    return {x,z};
  }

  test('dos geometrías independientes con referencias y materiales distintos',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    assert.equal(mannequin.userData.fitRole,'body');
    assert.ok(mannequin.geometry!==garment.children[0].geometry);
    assert.ok(mannequin.material!==garment.children[0].material);
    assert.equal(garment.children.filter(x=>x.isMesh).length,12);
    assert.ok(mannequin.geometry.getAttribute('position').count>2200);
  });
  test('Experimento A: al ampliar pecho corporal no cambia ni un vértice de la camiseta',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const g=garment.children[0],gBefore=clone(g.geometry),uvBefore=uv(g.geometry);
    deformBody(mannequin,DEFAULT_FIT);
    const before=sectionExtent(mannequin,.27);
    deformBody(mannequin,{...DEFAULT_FIT,bodyChestCm:115});
    const after=sectionExtent(mannequin,.27);
    assert.ok(after.x>before.x*1.20,'torso debe ensancharse al aumentar pecho');
    assert.ok(after.z>before.z*1.15,'torso debe abombarse en profundidad');
    assert.deepEqual(clone(g.geometry),gBefore);
    assert.deepEqual(uv(g.geometry),uvBefore);
  });
  test('Experimento B: ampliar pecho de la prenda aumenta ancho y profundidad sin mover el cuerpo',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const bodyBefore=clone(mannequin.geometry);
    const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
    const frontUV=uv(front.geometry);
    deformGarment(garment,DEFAULT_FIT);
    const before=sectionExtent(front,.27),positionBase=clone(front.geometry);
    deformGarment(garment,{...DEFAULT_FIT,garmentChestCm:132});
    const after=sectionExtent(front,.27);
    assert.ok(after.x>before.x*1.20,'frontal debe ensancharse');
    assert.ok(after.z>before.z*1.22,'debe abombarse el frente');
    assert.ok(differs(positionBase,clone(front.geometry)));
    assert.deepEqual(clone(mannequin.geometry),bodyBefore);
    assert.deepEqual(uv(front.geometry),frontUV);
  });
  test('Cadera cambia bajo sin desplazar escote; largo desplaza bajo sin modificar cuerpo',()=>{
    const mannequin=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const bodyBefore=clone(mannequin.geometry);
    const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
    deformGarment(garment,DEFAULT_FIT);
    const basePos=clone(front.geometry);
    const hipBefore=sectionExtent(front,-.98);
    deformGarment(garment,{...DEFAULT_FIT,garmentHipCm:145});
    assert.ok(sectionExtent(front,-.98).x>hipBefore.x*1.20);
    assert.deepEqual(clone(mannequin.geometry),bodyBefore);
    deformGarment(garment,{...DEFAULT_FIT,garmentLengthCm:78});
    const pos=front.geometry.getAttribute('position');
    let lower=0,highest=0;
    for(let i=0;i<pos.count;i++){
      const y=basePos[i*3+1],diff=pos.getY(i)-y;
      if(y< -1.16){lower++;assert.ok(diff<-.20)}
      if(y>1.08){highest++;assert.ok(Math.abs(diff)<.002)}
    }
    assert.ok(lower>0&&highest>0);
  });

  test('etiquetas corporales -1/0/+1: cambia volumen 3D sin alterar centímetros ni camiseta',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const initialGarment=clone(garment.children[0].geometry);
    deformBody(body,DEFAULT_FIT);
    const before=sectionExtent(body,.27);
    deformBody(body,{...DEFAULT_FIT,bodyChestState:1});
    const expanded=sectionExtent(body,.27);
    assert.ok(expanded.x>before.x*1.08,'+1 debe ensanchar pecho');
    assert.ok(expanded.z>before.z*1.07,'+1 debe incrementar profundidad');
    deformBody(body,{...DEFAULT_FIT,bodyChestState:-1});
    const reduced=sectionExtent(body,.27);
    assert.ok(reduced.x<before.x*.94,'-1 debe reducir pecho');
    assert.deepEqual(clone(garment.children[0].geometry),initialGarment,'la camiseta no cambia');
    deformBody(body,{...DEFAULT_FIT,bodyChestState:0});
    assert.ok(Math.abs(sectionExtent(body,.27).x-before.x)<1e-6);
  });
  test('etiquetas de prenda -1/0/+1: pecho, cadera y largo con cuerpo fijo y UV intactas',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const originalBody=clone(body.geometry);
    const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
    const baseUV=uv(front.geometry);
    deformGarment(garment,DEFAULT_FIT);
    const baselineChest=sectionExtent(front,.27),baselineHip=sectionExtent(front,-.98);
    deformGarment(garment,{...DEFAULT_FIT,garmentChestState:1});
    assert.ok(sectionExtent(front,.27).x>baselineChest.x*1.07);
    deformGarment(garment,{...DEFAULT_FIT,garmentHipState:1});
    assert.ok(sectionExtent(front,-.98).x>baselineHip.x*1.07);
    deformGarment(garment,{...DEFAULT_FIT,garmentLengthState:1});
    let minimum=Infinity;
    const position=front.geometry.getAttribute('position');
    for(let i=0;i<position.count;i++)minimum=Math.min(minimum,position.getY(i));
    assert.ok(minimum < -1.39,'+1 largo debe desplazar el bajo');
    assert.deepEqual(clone(body.geometry),originalBody,'el cuerpo permanece fijo');
    assert.deepEqual(uv(front.geometry),baseUV,'la UV no debe cambiar');
    deformGarment(garment,DEFAULT_FIT);
    assert.ok(Math.abs(sectionExtent(front,.27).x-baselineChest.x)<1e-6);
  });
  test('regresión real del visor: botones -1/+1 llegan al controlador y modifican las mallas',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    applyFitToModels(body,garment,DEFAULT_FIT);
    const initialBody=measureCrossSection(body,.27);
    const initialGarment=measureCrossSection(garment,.27);
    const fixedShirt=clone(garment.getObjectByName('NUBYRA_Test_Jersey_Front').geometry);
    const resolved=applyFitToModels(body,garment,{...DEFAULT_FIT,bodyChestState:1});
    assert.equal(resolved.bodyChestState,1);
    const expandedBody=measureCrossSection(body,.27);
    assert.ok(expandedBody.width>initialBody.width*1.10,'el botón +1 debe ampliar laterales corporales');
    assert.ok(expandedBody.front>initialBody.front*1.08,'el frente corporal crece');
    assert.ok(expandedBody.back>initialBody.back*1.08,'la espalda corporal también crece');
    assert.deepEqual(clone(garment.getObjectByName('NUBYRA_Test_Jersey_Front').geometry),fixedShirt);
    applyFitToModels(body,garment,{...DEFAULT_FIT,garmentChestState:1});
    const enlarged=measureCrossSection(garment,.27);
    assert.ok(enlarged.width>initialGarment.width*1.10,'el botón +1 de prenda debe ampliar laterales');
    assert.ok(enlarged.front>initialGarment.front*1.09,'debe crecer hacia el frente');
    assert.ok(enlarged.back>initialGarment.back*1.09,'debe crecer también hacia la espalda');
    const bodyRestored=measureCrossSection(body,.27);
    assert.ok(Math.abs(bodyRestored.width-initialBody.width)<1e-6,'el cuerpo queda fijo en modo B');
    assert.ok(Math.abs(bodyRestored.back-initialBody.back)<1e-6,'la espalda del cuerpo permanece fija');
  });
  test('sección medida responde a pecho y mantiene simetría de ancho y profundidad posterior',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    applyFitToModels(body,garment,DEFAULT_FIT);
    const base=measureCrossSection(garment,.27);
    assert.ok(base.vertices>=10);
    assert.ok(base.width>0.5 && base.front>0 && base.back>0);
    applyFitToModels(body,garment,{...DEFAULT_FIT,garmentChestCm:130});
    const enlarged=measureCrossSection(garment,.27);
    assert.ok(enlarged.width>base.width*1.2,'ajuste continuo de ancho desde slider');
    assert.ok(enlarged.front>base.front*1.2,'profundidad delantera');
    assert.ok(enlarged.back>base.back*1.2,'profundidad posterior');
    assert.throws(()=>measureCrossSection(null,.27),/malla o grupo 3D/);
    assert.throws(()=>measureCrossSection(garment,12),/No hay vértices/);
  });
  test('restablecimiento determinista: volver al estado base recupera vértices y mantiene UV',()=>{
    const group=createFreeTestJersey(THREE);
    const front=group.getObjectByName('NUBYRA_Test_Jersey_Front');
    deformGarment(group,DEFAULT_FIT);
    const original=clone(front.geometry),coords=uv(front.geometry);
    deformGarment(group,{...DEFAULT_FIT,garmentChestCm:78,garmentHipCm:136,garmentLengthCm:52});
    deformGarment(group,DEFAULT_FIT);
    assert.deepEqual(clone(front.geometry),original);
    assert.deepEqual(uv(front.geometry),coords);
    const mannequin=createReferenceBody(THREE);
    deformBody(mannequin,DEFAULT_FIT);
    const origBody=clone(mannequin.geometry);
    deformBody(mannequin,{...DEFAULT_FIT,bodyChestCm:120,bodyHipCm:75});
    deformBody(mannequin,DEFAULT_FIT);
    assert.deepEqual(clone(mannequin.geometry),origBody);
    assert.ok(getBodyExtentAt(mannequin,.28).halfWidth>.3);
  });
}
