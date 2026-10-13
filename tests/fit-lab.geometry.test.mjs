import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFreeTestJersey} from '../configurador-3d/free-test-jersey.mjs';
import {representativeCm,classifiedLabels,BASE_SHIRTS} from '../configurador-3d/fit-lab/size-classifier.mjs';
import {
  DEFAULT_FIT,createReferenceBody,deformBody,deformGarment,getBodyExtentAt,applyFitToModels,measureCrossSection,backSurfaceProfile
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

  test('bandas corporales vinculadas a cm: ensanchan sección anterior, lateral y posterior sin tocar prenda',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const initialGarment=clone(garment.children[0].geometry);
    applyFitToModels(body,garment,DEFAULT_FIT);
    const before=measureCrossSection(body,.27);
    const high=representativeCm('bodyChestCm',1,'N1');
    assert.equal(classifiedLabels({...DEFAULT_FIT,bodyChestCm:high},'N1').bodyChestState,1);
    applyFitToModels(body,garment,{...DEFAULT_FIT,bodyChestCm:high,activeBase:'N1'});
    const expanded=measureCrossSection(body,.27);
    assert.ok(expanded.width>before.width*1.09,'el pecho debe ensanchar ambos laterales');
    assert.ok(expanded.front>before.front*1.07,'el frente debe ganar volumen');
    assert.ok(expanded.back>before.back*1.10,'la espalda debe ganar volumen en -Z');
    const low=representativeCm('bodyChestCm',-1,'N1');
    applyFitToModels(body,garment,{...DEFAULT_FIT,bodyChestCm:low,activeBase:'N1'});
    assert.ok(measureCrossSection(body,.27).width<before.width*.92,'-1 debe reducir el contorno');
    assert.deepEqual(clone(garment.children[0].geometry),initialGarment);
    applyFitToModels(body,garment,DEFAULT_FIT);
    assert.ok(Math.abs(measureCrossSection(body,.27).width-before.width)<1e-6);
  });
  test('bandas de camiseta en cm: pecho, cadera y largo afectan 3D sin tocar cuerpo y UV',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const originalBody=clone(body.geometry);
    const front=garment.getObjectByName('NUBYRA_Test_Jersey_Front');
    const back=garment.getObjectByName('NUBYRA_Test_Jersey_Back');
    const baseUV=uv(front.geometry);
    applyFitToModels(body,garment,DEFAULT_FIT);
    const baselineChest=measureCrossSection(garment,.27),baselineHip=sectionExtent(front,-.98);
    const highChest=representativeCm('garmentChestCm',1,'N1');
    assert.equal(classifiedLabels({...DEFAULT_FIT,garmentChestCm:highChest},'N1').garmentChestState,1);
    applyFitToModels(body,garment,{...DEFAULT_FIT,garmentChestCm:highChest});
    const chest=measureCrossSection(garment,.27);
    assert.ok(chest.width>baselineChest.width*1.08);
    assert.ok(chest.back>baselineChest.back*1.10,'el pecho mueve también la espalda');
    const hip=representativeCm('garmentHipCm',1,'N1');
    applyFitToModels(body,garment,{...DEFAULT_FIT,garmentHipCm:hip});
    assert.ok(sectionExtent(front,-.98).x>baselineHip.x*1.08);
    const longer=representativeCm('garmentLengthCm',1,'N1');
    applyFitToModels(body,garment,{...DEFAULT_FIT,garmentLengthCm:longer});
    const positions=front.geometry.getAttribute('position');
    let low=Infinity;
    for(let i=0;i<positions.count;i++)low=Math.min(low,positions.getY(i));
    assert.ok(low<-1.34,'el bajo debe bajar');
    assert.deepEqual(clone(body.geometry),originalBody);
    assert.deepEqual(uv(front.geometry),baseUV);
    assert.ok(back.geometry.getAttribute('position').count>0);
    applyFitToModels(body,garment,DEFAULT_FIT);
    assert.ok(Math.abs(measureCrossSection(garment,.27).width-baselineChest.width)<1e-6);
  });
  test('controlador de visor consume medidas en cm, deriva clase y abre contorno completo',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    applyFitToModels(body,garment,DEFAULT_FIT);
    const originalBody=measureCrossSection(body,.27);
    const originalShirt=measureCrossSection(garment,.27);
    const fixedShirt=clone(garment.getObjectByName('NUBYRA_Test_Jersey_Front').geometry);
    const v=applyFitToModels(body,garment,{...DEFAULT_FIT,
      bodyChestCm:representativeCm('bodyChestCm',1,'N1'),activeBase:'N1'});
    assert.equal(v.bodyChestState,1);
    const b=measureCrossSection(body,.27);
    assert.ok(b.width>originalBody.width*1.09);
    assert.ok(b.front>originalBody.front*1.07);
    assert.ok(b.back>originalBody.back*1.10,'la zona trasera debe desplazarse en -Z');
    assert.deepEqual(clone(garment.getObjectByName('NUBYRA_Test_Jersey_Front').geometry),fixedShirt);
    const updated=applyFitToModels(body,garment,{...DEFAULT_FIT,
      garmentChestCm:representativeCm('garmentChestCm',1,'N1'),activeBase:'N1'});
    assert.equal(updated.garmentChestState,1);
    const g=measureCrossSection(garment,.27);
    assert.ok(g.width>originalShirt.width*1.08);
    assert.ok(g.front>originalShirt.front*1.06);
    assert.ok(g.back>originalShirt.back*1.10,'el reverso de la prenda realmente crece');
    const restored=measureCrossSection(body,.27);
    assert.ok(Math.abs(restored.width-originalBody.width)<1e-6);
    assert.ok(Math.abs(restored.back-originalBody.back)<1e-6);
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
  test('contorno posterior visible de ensayo se desplaza hacia -Z respecto al original',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const back=garment.getObjectByName('NUBYRA_Test_Jersey_Back');
    applyFitToModels(body,garment,DEFAULT_FIT);
    const original=backSurfaceProfile(back);
    const originalMin=Math.min(...original.map(p=>p.z));
    assert.ok(original.length>=8,'perfil original debe tener puntos');
    applyFitToModels(body,garment,{...DEFAULT_FIT,garmentChestCm:120});
    const changed=backSurfaceProfile(back);
    const changedMin=Math.min(...changed.map(p=>p.z));
    assert.ok(changedMin<originalMin-.06,
      'el contorno de la espalda no se separa lo suficiente en -Z');
    const indicator=measureCrossSection(garment,.27);
    assert.ok(indicator.back>.24,'el diagnóstico recoge el aumento del perfil posterior');
    assert.throws(()=>backSurfaceProfile(null),/geometría de espalda/);
  });
  test('cambiar la propuesta N1 a N2 mantiene referencias de cuerpo/prenda y UV',()=>{
    const body=createReferenceBody(THREE),garment=createFreeTestJersey(THREE);
    const initialUV=uv(garment.getObjectByName('NUBYRA_Test_Jersey_Back').geometry);
    applyFitToModels(body,garment,DEFAULT_FIT);
    const oldGarment=measureCrossSection(garment,.27);
    const base2=BASE_SHIRTS.N2;
    const result=applyFitToModels(body,garment,{...DEFAULT_FIT,
      garmentChestCm:base2.garmentChestCm,garmentHipCm:base2.garmentHipCm,
      garmentLengthCm:base2.garmentLengthCm,activeBase:'N2'});
    assert.equal(result.garmentChestState,0,'la etiqueta del patrón nuevo es 0');
    const newGarment=measureCrossSection(garment,.27);
    assert.ok(newGarment.width>oldGarment.width*1.20);
    assert.ok(newGarment.back>oldGarment.back*1.25);
    assert.deepEqual(uv(garment.getObjectByName('NUBYRA_Test_Jersey_Back').geometry),initialUV);
    assert.ok(Math.abs(measureCrossSection(body,.27).width-measureCrossSection(createReferenceBody(THREE),.27).width)<.0001);
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
